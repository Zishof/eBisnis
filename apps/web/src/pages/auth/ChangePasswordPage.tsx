import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { ShieldAlert } from 'lucide-react';
import { useAuth, useErrorMessage } from '../../app/auth-context';
import { useToast } from '../../components/ui';

interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

/** Halaman ganti kata sandi wajib setelah login pertama. */
export function ChangePasswordPage() {
  const { t } = useTranslation();
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { register, handleSubmit, watch, formState } = useForm<ChangePasswordForm>();
  const newPassword = watch('newPassword', '');

  const rules = [
    { key: 'length', label: 'Minimal 10 karakter', ok: newPassword.length >= 10 },
    { key: 'lower', label: 'Huruf kecil', ok: /[a-z]/.test(newPassword) },
    { key: 'upper', label: 'Huruf besar', ok: /[A-Z]/.test(newPassword) },
    { key: 'digit', label: 'Angka', ok: /\d/.test(newPassword) },
    { key: 'symbol', label: 'Simbol', ok: /[^A-Za-z0-9]/.test(newPassword) },
  ];

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    if (values.newPassword !== values.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    setBusy(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      toast.push('Kata sandi berhasil diganti. Silakan masuk kembali.', 'success');
      navigate('/masuk', { replace: true });
    } catch (err) {
      setError(toMessage(err, (key, fallback) => t(key, fallback ?? key)));
    } finally {
      setBusy(false);
    }
  });

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-14">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <p className="text-sm text-amber-900 dark:text-amber-100">{t('auth.changePasswordSubtitle')}</p>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            {t('auth.changePasswordTitle')}
          </h1>
          {user && (
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              <span className="ltr-code">{user.username}</span>
            </p>
          )}

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
              <label className="field-label" htmlFor="current-password">
                {t('auth.currentPassword')}
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                className="field-input"
                {...register('currentPassword', { required: true })}
              />
              {formState.errors.currentPassword && <p className="field-error">{t('common.required')}</p>}
            </div>

            <div>
              <label className="field-label" htmlFor="new-password">
                {t('auth.newPassword')}
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                className="field-input"
                {...register('newPassword', { required: true })}
              />
              <ul className="mt-2 grid grid-cols-2 gap-1 text-xs">
                {rules.map((rule) => (
                  <li
                    key={rule.key}
                    className={rule.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}
                  >
                    {rule.ok ? '✓' : '○'} {rule.label}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="field-label" htmlFor="confirm-password">
                {t('auth.confirmPassword')}
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                className="field-input"
                {...register('confirmPassword', { required: true })}
              />
            </div>

            <button
              type="submit"
              className="btn-primary w-full"
              disabled={busy || rules.some((rule) => !rule.ok)}
            >
              {busy ? t('common.loading') : t('auth.changePassword')}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
