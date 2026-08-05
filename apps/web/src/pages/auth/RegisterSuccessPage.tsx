import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Copy, Download } from 'lucide-react';
import { useToast } from '../../components/ui';
import { emedikPublicBrandFor, type EmedikPublicBrand } from '../public/emedik-host';

interface RegistrationResult {
  status: string;
  registrationId: string;
  tenantId: string;
  username: string;
  schemaName: string;
  auditSchemaName: string;
  loginUrl: string;
  temporaryPassword?: string;
  mustChangePassword: boolean;
}

export function registerSuccessCopy(brand: EmedikPublicBrand | null, translate: (key: string) => string) {
  if (brand?.kind === 'apotik') {
    return {
      title: `${brand.name} berhasil disiapkan`,
      subtitle: 'Ruang kerja apotik, contoh obat, supplier, stok awal, dan POS Apotik siap dicoba.',
    };
  }
  if (brand?.kind === 'emedik') {
    return {
      title: `${brand.name} berhasil disiapkan`,
      subtitle: 'Ruang kerja fasilitas kesehatan, data contoh layanan, farmasi, billing, dan akses awal siap dicoba.',
    };
  }
  return {
    title: translate('register.successTitle'),
    subtitle: translate('register.successSubtitle'),
  };
}

export function RegisterSuccessPage() {
  const { t } = useTranslation();
  const location = useLocation();
  const toast = useToast();
  const [copied, setCopied] = useState<string | null>(null);
  const emedikBrand = emedikPublicBrandFor();
  const brandName = emedikBrand?.name ?? 'eBisnis.id';
  const filePrefix = emedikBrand?.kind === 'apotik' ? 'apotik-emedik' : emedikBrand ? 'emedik' : 'ebisnis';
  const successCopy = registerSuccessCopy(emedikBrand, (key) => t(key));

  const result = (location.state as { result?: RegistrationResult } | null)?.result;

  // Halaman ini hanya bermakna tepat setelah pendaftaran.
  if (!result) return <Navigate to="/daftar" replace />;

  const copy = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      toast.push(t('common.copied'), 'success');
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.push('Salin manual dari layar.', 'error');
    }
  };

  const downloadSummary = () => {
    const lines = [
      `RINGKASAN AKUN ${brandName}`,
      '=========================',
      `Nama pengguna   : ${result.username}`,
      `Schema ERP      : ${result.schemaName}`,
      `Schema audit    : ${result.auditSchemaName}`,
      `URL masuk       : ${result.loginUrl}`,
      result.temporaryPassword ? `Kata sandi awal : ${result.temporaryPassword}` : '',
      '',
      'Kata sandi sementara wajib diganti pada saat masuk pertama kali.',
      'Simpan berkas ini di tempat yang aman dan jangan dibagikan.',
    ].filter(Boolean);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filePrefix}-akun-${result.username}.txt`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="py-14">
      <div className="container-page max-w-2xl">
        <div className="card p-8">
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
            <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">
              {successCopy.title}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              {successCopy.subtitle}
            </p>
          </div>

          {result.temporaryPassword && (
            <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/40">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                {t('register.credentialWarning')}
              </p>
            </div>
          )}

          <dl className="mt-6 space-y-3">
            <CredentialRow
              label={t('register.desiredUsername')}
              value={result.username}
              onCopy={() => void copy('username', result.username)}
              copied={copied === 'username'}
              testId="success-username"
            />
            {result.temporaryPassword && (
              <CredentialRow
                label={t('auth.password')}
                value={result.temporaryPassword}
                onCopy={() => void copy('password', result.temporaryPassword!)}
                copied={copied === 'password'}
                testId="success-password"
                highlight
              />
            )}
            <CredentialRow label={t('register.schemaPreview')} value={result.schemaName} />
            <CredentialRow label={t('register.auditSchemaPreview')} value={result.auditSchemaName} />
            <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800">
              <dt className="text-sm text-slate-600 dark:text-slate-300">Status provisioning</dt>
              <dd className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {result.status}
              </dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <button type="button" className="btn-outline flex-1" onClick={downloadSummary}>
              <Download className="h-4 w-4" aria-hidden />
              {t('register.downloadSummary')}
            </button>
            <Link to="/masuk" className="btn-primary flex-1" data-testid="go-to-login">
              {t('register.goToLogin')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
  copied,
  testId,
  highlight,
}: {
  label: string;
  value: string;
  onCopy?: () => void;
  copied?: boolean;
  testId?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={
        highlight
          ? 'flex items-center justify-between gap-3 rounded-lg border border-brand-300 bg-brand-50 px-4 py-3 dark:border-brand-800 dark:bg-brand-950/40'
          : 'flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 dark:bg-slate-800'
      }
    >
      <dt className="text-sm text-slate-600 dark:text-slate-300">{label}</dt>
      <dd className="flex items-center gap-2">
        <span className="ltr-code text-sm font-semibold text-slate-900 dark:text-white" data-testid={testId}>
          {value}
        </span>
        {onCopy && (
          <button
            type="button"
            className="rounded p-1.5 text-slate-500 hover:bg-white dark:hover:bg-slate-700"
            onClick={onCopy}
            aria-label={`Salin ${label}`}
          >
            {copied ? <span className="text-xs text-emerald-600">✓</span> : <Copy className="h-4 w-4" aria-hidden />}
          </button>
        )}
      </dd>
    </div>
  );
}
