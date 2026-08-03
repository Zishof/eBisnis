import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Crown, Eye, EyeOff, UserRound, Users } from 'lucide-react';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import { berandaSesudahMasuk } from '../../app/beranda-sesudah-masuk';
import { isSantriHost, isSantriPortalHost, slugPondokDariHost } from '../../verticals/pesantren/santri-host';
import { isSalonDemoHost } from '../contoh/salon-host';
import { emedikPublicBrandFor } from '../public/emedik-host';

interface LoginForm {
  username: string;
  password: string;
}

const AKUN_SALON_DEMO = [
  {
    label: 'Pelanggan',
    roleCode: 'PELAPOR_TIKET',
    username: 'pelanggan.salon',
    password: 'SalonDemo#2026',
    description: 'Melihat promo, booking, invoice, struk, dan riwayat kunjungan.',
    icon: UserRound,
  },
  {
    label: 'Manajemen Salon',
    roleCode: 'MANAJER_OPERASIONAL',
    username: 'manajemen.salon',
    password: 'SalonDemo#2026',
    description: 'Mengelola booking, layanan, kursi, petugas, stok, dan operasional harian.',
    icon: Users,
  },
  {
    label: 'Pemilik Salon',
    roleCode: 'PEMILIK_USAHA',
    username: 'pemilik.salon',
    password: 'SalonDemo#2026',
    description: 'Membaca omzet, laba, tren layanan, dan performa bisnis salon.',
    icon: Crown,
  },
];

export function LoginPage() {
  const { t } = useTranslation();
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, formState, setValue } = useForm<LoginForm>();
  const santri = isSantriHost();
  const salon = isSalonDemoHost();
  const emedikBrand = emedikPublicBrandFor();
  /*
   * Portal umum santri.info (apex/www) menawarkan demo dan pendaftaran pondok
   * BARU -- ajakan yang wajar bagi pengunjung yang belum jadi pelanggan.
   *
   * Subdomain pondok (`<slug>.santri.info`) adalah pelanggan yang SUDAH
   * terdaftar. Menawarkan "Coba Demo Pesantren" atau "daftar akun" kepadanya
   * di halaman masuknya sendiri tidak relevan -- bahkan menyesatkan, sebab
   * demo mendarat di penyewa demo bersama, bukan penyewa pondok ini.
   */
  const portalUmum = isSantriPortalHost();
  const slugPondok = slugPondokDariHost();

  const pilihAkunSalon = (roleCode: string) => {
    const akun = AKUN_SALON_DEMO.find((item) => item.roleCode === roleCode) ?? AKUN_SALON_DEMO[0];
    setValue('username', akun.username, { shouldDirty: true, shouldValidate: true });
    setValue('password', akun.password, { shouldDirty: true, shouldValidate: true });
  };

  useEffect(() => {
    if (!salon) return;
    const role = searchParams.get('role');
    if (role) pilihAkunSalon(role);
  }, [salon, searchParams]);

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    setBusy(true);
    try {
      const session = await login(values.username, values.password);
      if (session.mustChangePassword) {
        navigate('/ganti-kata-sandi', { replace: true });
        return;
      }
      const from = (location.state as { from?: string } | null)?.from;
      navigate(berandaSesudahMasuk(session, from), { replace: true });
    } catch (err) {
      setError(toMessage(err, (key, fallback) => t(key, fallback ?? key)));
    } finally {
      setBusy(false);
    }
  });

  const startDemo = async () => {
    if (salon) {
      pilihAkunSalon('PELAPOR_TIKET');
      setError(null);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const session = await loginDemo();
      // Sama seperti masuk biasa: tujuan ditentukan dari vertical penyewa demo
      // yang sesungguhnya diberikan peladen (lihat resolusi host pada
      // `createDemoSession`), bukan selalu `/app`. Pengunjung yang menekan
      // "Coba Demo" dari santri.info harus mendarat di beranda ePesantren bila
      // peladen memang memberinya penyewa demo pesantren.
      navigate(berandaSesudahMasuk(session), { replace: true });
    } catch (err) {
      setError(toMessage(err, (key, fallback) => t(key, fallback ?? key)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {slugPondok
              ? 'Masuk'
              : santri
                ? 'Masuk ke santri.info'
                : salon
                  ? 'Masuk ke Salon Cantik Demo'
                  : emedikBrand
                    ? emedikBrand.loginTitle
                    : t('auth.loginTitle')}
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
            {santri
              ? 'Gunakan akun pengurus, ustadz/ustadzah, atau wali santri yang terdaftar.'
              : salon
                ? 'Gunakan akun pelanggan, manajemen salon, atau pemilik salon untuk mencoba demo.'
                : emedikBrand
                  ? emedikBrand.loginSubtitle
              : t('auth.loginSubtitle')}
          </p>

          {error && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
            >
              {error}
            </div>
          )}

          <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
            <div>
              <label className="field-label" htmlFor="login-username">
                {t('auth.username')}
              </label>
              <input
                id="login-username"
                autoComplete="username"
                className="field-input ltr-code"
                {...register('username', { required: true })}
              />
              {formState.errors.username && <p className="field-error">{t('common.required')}</p>}
            </div>

            <div>
              <label className="field-label" htmlFor="login-password">
                {t('auth.password')}
              </label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="field-input pe-10"
                  {...register('password', { required: true })}
                />
                <button
                  type="button"
                  className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
                </button>
              </div>
              {formState.errors.password && <p className="field-error">{t('common.required')}</p>}
            </div>

            <button type="submit" className="btn-primary w-full" disabled={busy}>
              {busy ? t('auth.signingIn') : t('auth.signIn')}
            </button>
          </form>

          {!slugPondok && (
            <>
              <div className="mt-6 flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-xs uppercase text-slate-400">atau</span>
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              <button
                type="button"
                className="btn-outline mt-4 w-full"
                onClick={() => void startDemo()}
                disabled={busy}
              >
                {santri
                  ? 'Coba Demo Pesantren'
                  : salon
                    ? 'Isi akun pelanggan salon'
                    : emedikBrand
                      ? emedikBrand.demoLabel
                      : t('nav.demo')}
              </button>
            </>
          )}

          {salon && (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pilih persona demo
              </p>
              {AKUN_SALON_DEMO.map((akun) => {
                const Icon = akun.icon;
                return (
                  <button
                    key={akun.roleCode}
                    type="button"
                    className="group flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-brand-950/30"
                    onClick={() => pilihAkunSalon(akun.roleCode)}
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-brand-100 text-brand-800 group-hover:bg-brand-700 group-hover:text-white dark:bg-brand-950 dark:text-brand-200">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900 dark:text-white">{akun.label}</span>
                      <span className="mt-0.5 block text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {akun.description}
                      </span>
                      <span className="mt-2 block truncate rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {akun.username} / {akun.password}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {portalUmum && (
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
              {t('auth.noAccount')}{' '}
              <Link to="/daftar-pesantren" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                Daftarkan pondok Anda
              </Link>
            </p>
          )}
          {!santri && !salon && (
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
              {t('auth.noAccount')}{' '}
              <Link to="/daftar" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                {emedikBrand ? emedikBrand.registerLinkLabel : t('auth.registerNow')}
              </Link>
            </p>
          )}
          {salon && (
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Ingin melihat website pelanggan?{' '}
              <Link to="https://salon.ebisnis.id" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">
                Buka Salon Cantik Demo
              </Link>
            </p>
          )}
          {slugPondok && (
            <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-300">
              Lupa kata sandi atau belum punya akun? Hubungi pengurus pondok Anda.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
