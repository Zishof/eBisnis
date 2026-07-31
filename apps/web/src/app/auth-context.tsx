import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  // Diimpor sebagai NILAI, bukan hanya tipe: `instanceof ApiError` dipakai
  // membedakan penolakan yang mengakhiri sesi (401/403) dari gangguan sementara
  // (429, 5xx). Impor bertipe saja terhapus saat kompilasi, dan perbandingannya
  // ikut hilang tanpa satu pun galat — seluruh galat lalu dianggap sementara.
  ApiError,
  api,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
} from '../lib/api';

export interface SessionUser {
  userId: string;
  username: string;
  displayName: string;
  isPlatformStaff: boolean;
  isDemo: boolean;
  mustChangePassword: boolean;
  localeCode: string;
  platformPermissions: string[];
  tenantPermissions: string[];
  tenant: { tenantId: string; schemaName: string } | null;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  mustChangePassword: boolean;
  user: {
    id: string;
    username: string;
    displayName: string;
    isPlatformStaff: boolean;
    localeCode: string;
    platformPermissions: string[];
  };
  tenant: { tenantId: string; schemaName: string; tenantName: string } | null;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  loginDemo: () => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  stepUp: (password: string, purpose: string, reason?: string) => Promise<string>;
  refreshSession: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasPlatformPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  /**
   * Memuat identitas pemilik sesi.
   *
   * Gangguan sementara dicoba lagi, bukan diperlakukan sebagai "belum masuk".
   * Peladen yang menjawab 429 atau 5xx tidak sedang mengatakan sesinya tidak
   * sah; menampilkan halaman masuk karenanya membuat pengguna mengira ia
   * terlempar keluar, dan pada layar kasir keranjangnya ikut hilang.
   *
   * Percobaannya dibatasi dua kali dengan jeda pendek. Tanpa batas, peladen yang
   * benar-benar mati akan membuat layar menggantung tanpa keterangan apa pun —
   * yang juga bukan jawaban.
   */
  const loadSession = useCallback(async () => {
    for (let percobaan = 1; percobaan <= 2; percobaan += 1) {
      try {
        setUser(await api.get<SessionUser>('/auth/me'));
        return;
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 401 || status === 403) {
          setUser(null);
          return;
        }
        if (percobaan === 2) return;
        await new Promise((r) => setTimeout(r, 800));
      }
    }
  }, []);

  useEffect(() => {
    // Pemulihan sesi memakai refresh token yang tersimpan di sessionStorage.
    void (async () => {
      if (!getRefreshToken()) {
        setLoading(false);
        return;
      }
      try {
        const refreshed = await api.post<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          { refreshToken: getRefreshToken() },
          { skipRefresh: true },
        );
        setAccessToken(refreshed.accessToken);
        setRefreshToken(refreshed.refreshToken);
        await loadSession();
      } catch (e) {
        /*
         * Hanya penolakan yang benar-benar berarti "sesi ini tidak sah lagi"
         * yang membuang tokennya.
         *
         * Semula SETIAP galat di sini membuang sesi — termasuk 429 dari pembatas
         * laju dan 5xx dari peladen yang sedang tersedak. Keduanya sementara,
         * tetapi akibatnya permanen: refresh token terhapus, tidak ada lagi yang
         * dapat dipakai mencoba, dan pengguna mendarat di halaman masuk.
         *
         * Cacat yang sama sempat diperbaiki di `lib/api.ts` tetapi terlewat di
         * sini — dan justru jalur inilah yang menyala, sebab `loadSession()`
         * berada di dalam `try` yang sama: `/auth/me` yang dijawab 429 ikut
         * menjatuhkan sesinya.
         */
        const status = e instanceof ApiError ? e.status : 0;
        if (status === 401 || status === 403) {
          setAccessToken(null);
          setRefreshToken(null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [loadSession]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await api.post<LoginResponse>(
        '/auth/login',
        { username, password },
        { skipRefresh: true },
      );
      setAccessToken(result.accessToken);
      setRefreshToken(result.refreshToken);
      const session: SessionUser = {
        userId: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
        isPlatformStaff: result.user.isPlatformStaff,
        isDemo: false,
        mustChangePassword: result.mustChangePassword,
        localeCode: result.user.localeCode,
        platformPermissions: result.user.platformPermissions,
        tenantPermissions: [],
        tenant: result.tenant
          ? { tenantId: result.tenant.tenantId, schemaName: result.tenant.schemaName }
          : null,
      };
      setUser(session);
      // Permission tenant dimuat setelah kewajiban ganti kata sandi selesai.
      if (!result.mustChangePassword) await loadSession();
      return session;
    },
    [loadSession],
  );

  const loginDemo = useCallback(async () => {
    const result = await api.post<{ accessToken: string; schemaName: string }>(
      '/public/demo/session',
      undefined,
      { skipRefresh: true },
    );
    setAccessToken(result.accessToken);
    setRefreshToken(null);
    await loadSession();
  }, [loadSession]);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // Kegagalan logout server tidak boleh menahan pengguna di aplikasi.
    }
    setAccessToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      // Ganti kata sandi mencabut sesi lama; masuk ulang dengan kata sandi baru.
      setAccessToken(null);
      setRefreshToken(null);
      setUser(null);
    },
    [],
  );

  const stepUp = useCallback(async (password: string, purpose: string, reason?: string) => {
    const result = await api.post<{ stepUpToken: string }>('/auth/step-up', {
      password,
      purpose,
      reason,
    });
    return result.stepUpToken;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      loginDemo,
      logout,
      changePassword,
      stepUp,
      refreshSession: loadSession,
      hasPermission: (permission) => user?.tenantPermissions.includes(permission) ?? false,
      hasPlatformPermission: (permission) =>
        user?.platformPermissions.includes(permission) ?? false,
    }),
    [user, loading, login, loginDemo, logout, changePassword, stepUp, loadSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth harus dipakai di dalam AuthProvider.');
  return context;
}

/** Menerjemahkan errorCode dari backend menjadi pesan yang dapat dibaca. */
export function useErrorMessage() {
  return useCallback((error: unknown, translate: (key: string, fallback?: string) => string) => {
    const apiError = error as ApiError;
    if (apiError?.code) {
      const translated = translate(`error.${apiError.code}`, apiError.message);
      return translated.startsWith('error.') ? apiError.message : translated;
    }
    return error instanceof Error ? error.message : 'Terjadi kesalahan.';
  }, []);
}
