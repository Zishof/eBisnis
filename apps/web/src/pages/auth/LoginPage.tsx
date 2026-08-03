import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import { berandaSesudahMasuk } from '../../app/beranda-sesudah-masuk';
import { isSantriHost, isSantriPortalHost, slugPondokDariHost } from '../../verticals/pesantren/santri-host';
import { isSalonDemoHost } from '../contoh/salon-host';
import { emedikPublicBrandFor } from '../public/emedik-host';

interface LoginForm {
  username: string;
  password: string;
}

export function LoginPage() {
  const { t } = useTranslation();
  const { login, loginDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, formState } = useForm<LoginForm>();
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
                {santri ? 'Coba Demo Pesantren' : salon ? 'Coba Demo Salon' : emedikBrand ? emedikBrand.demoLabel : t('nav.demo')}
              </button>
            </>
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
