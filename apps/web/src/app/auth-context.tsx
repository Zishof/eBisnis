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
  api,
  getRefreshToken,
  setAccessToken,
  setRefreshToken,
  type ApiError,
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

  const loadSession = useCallback(async () => {
    try {
      const me = await api.get<SessionUser>('/auth/me');
      setUser(me);
    } catch {
      setUser(null);
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
      } catch {
        setAccessToken(null);
        setRefreshToken(null);
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
