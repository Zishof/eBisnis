import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Check, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';
import { emedikPublicBrandFor, type EmedikPublicBrand } from '../public/emedik-host';

interface RegistrationConfig {
  countries: string[];
  businessTypes: string[];
  generatePasswordDefault: boolean;
  usernameRules: { pattern: string; minLength: number; maxLength: number; description: string };
  passwordRules: Record<string, unknown>;
}

interface UsernameCheck {
  available: boolean;
  normalizedUsername: string;
  schemaName: string;
  auditSchemaName: string;
  reason?: string | null;
  message: string;
  suggestions: string[];
}

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

interface RegisterForm {
  businessName: string;
  businessType: string;
  country: string;
  province: string;
  cityRegency: string;
  district: string;
  address: string;
  contactPerson: string;
  contactPhone: string;
  businessPhone: string;
  email: string;
  desiredUsername: string;
  password: string;
  passwordConfirmation: string;
}

const STEPS = ['stepBusiness', 'stepLocation', 'stepContact', 'stepAccount'] as const;

export function registerStepLabels(brand: EmedikPublicBrand | null, translate: (key: string) => string): string[] {
  if (brand?.kind === 'apotik') return ['Profil Apotik', 'Lokasi layanan', 'Kontak farmasi', 'Akun apotik'];
  if (brand?.kind === 'emedik') return ['Profil Fasilitas', 'Lokasi layanan', 'Kontak PIC', 'Akun fasilitas'];
  return STEPS.map((key) => translate(`register.${key}`));
}

export function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toMessage = useErrorMessage();
  const emedikBrand = emedikPublicBrandFor();
  const stepLabels = useMemo(() => registerStepLabels(emedikBrand, (key) => t(key)), [emedikBrand, t]);

  const [step, setStep] = useState(0);
  const [generatePassword, setGeneratePassword] = useState(true);
  // Bawaannya menyala: penyewa baru lebih terbantu oleh contoh yang dapat
  // dilihat daripada oleh layar kosong. Yang sudah punya data sendiri dapat
  // mematikannya, dan tetap dapat memasukkannya kemudian dari dalam aplikasi.
  const [includeSampleData, setIncludeSampleData] = useState(true);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [usernameQuery, setUsernameQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const config = useQuery({
    queryKey: ['registration-config'],
    queryFn: () => api.get<RegistrationConfig>('/public/registration-config'),
  });

  const {
    register,
    handleSubmit,
    watch,
    trigger,
    formState: { errors },
  } = useForm<RegisterForm>({
    defaultValues: { country: 'Indonesia' },
  });

  const desiredUsername = watch('desiredUsername', '');

  // Pengecekan username dengan debounce.
  useEffect(() => {
    const timer = setTimeout(() => setUsernameQuery(desiredUsername.trim()), 450);
    return () => clearTimeout(timer);
  }, [desiredUsername]);

  const usernameCheck = useQuery({
    queryKey: ['username-check', usernameQuery],
    queryFn: () => api.post<UsernameCheck>('/public/usernames/check', { desiredUsername: usernameQuery }),
    enabled: usernameQuery.length >= 3,
  });

  const submit = useMutation({
    mutationFn: (values: RegisterForm) =>
      api.post<RegistrationResult>('/public/registrations', {
        businessName: values.businessName,
        businessType: values.businessType || undefined,
        country: values.country || 'Indonesia',
        province: values.province || undefined,
        cityRegency: values.cityRegency || undefined,
        district: values.district || undefined,
        address: values.address || undefined,
        contactPerson: values.contactPerson || undefined,
        contactPhone: values.contactPhone || undefined,
        businessPhone: values.businessPhone || undefined,
        email: values.email,
        desiredUsername: values.desiredUsername,
        generatePassword,
        password: generatePassword ? undefined : values.password,
        passwordConfirmation: generatePassword ? undefined : values.passwordConfirmation,
        acceptTerms,
        acceptPrivacy,
        includeSampleData,
      }),
    onSuccess: (result) => {
      // Credential sementara hanya ada di memori navigasi — tidak disimpan.
      navigate('/daftar/berhasil', { state: { result, plan: searchParams.get('paket') }, replace: true });
    },
    onError: (err) => setError(toMessage(err, (key, fallback) => t(key, fallback ?? key))),
  });

  const canSubmit = useMemo(
    () => acceptTerms && acceptPrivacy && usernameCheck.data?.available === true,
    [acceptTerms, acceptPrivacy, usernameCheck.data],
  );

  const onSubmit = handleSubmit((values) => {
    setError(null);
    if (!canSubmit) {
      setError('Lengkapi nama pengguna yang tersedia dan setujui syarat serta kebijakan privasi.');
      return;
    }
    if (!generatePassword && values.password !== values.passwordConfirmation) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    submit.mutate(values);
  });

  const goNext = async () => {
    const fieldsByStep: Record<number, Array<keyof RegisterForm>> = {
      0: ['businessName'],
      1: [],
      2: ['email'],
      3: ['desiredUsername'],
    };
    const valid = await trigger(fieldsByStep[step] ?? []);
    if (valid) setStep((current) => Math.min(current + 1, STEPS.length - 1));
  };

  return (
    <div className="py-12">
      <div className="container-page max-w-3xl">
        <header className="mb-8 text-center">
          <h1 className="section-heading">{emedikBrand ? emedikBrand.registerTitle : t('register.title')}</h1>
          <p className="section-lead mx-auto">
            {emedikBrand ? emedikBrand.registerSubtitle : t('register.subtitle')}
          </p>
        </header>

        {/* Stepper responsif */}
        <ol className="mb-8 flex flex-wrap items-center justify-center gap-2" aria-label="Langkah pendaftaran">
          {STEPS.map((key, index) => (
            <li key={key} className="flex items-center gap-2">
              <span
                className={clsx(
                  'grid h-8 w-8 place-items-center rounded-full text-xs font-bold',
                  index <= step ? 'bg-brand-700 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-800',
                )}
                aria-current={index === step ? 'step' : undefined}
              >
                {index + 1}
              </span>
              <span
                className={clsx(
                  'hidden text-sm sm:inline',
                  index === step ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500',
                )}
              >
                {stepLabels[index]}
              </span>
              {index < STEPS.length - 1 && <span className="hidden h-px w-6 bg-slate-300 sm:inline-block" />}
            </li>
          ))}
        </ol>

        {error && (
          <div
            role="alert"
            className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
          >
            {error}
          </div>
        )}

        <form className="card p-6 sm:p-8" onSubmit={onSubmit} noValidate>
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <label className="field-label" htmlFor="businessName">
                  {emedikBrand ? emedikBrand.businessNameLabel : t('register.businessName')} *
                </label>
                <input id="businessName" className="field-input" {...register('businessName', { required: true, maxLength: 255 })} />
                {errors.businessName && <p className="field-error">{t('common.required')}</p>}
              </div>
              <div>
                <label className="field-label" htmlFor="businessType">
                  {emedikBrand ? emedikBrand.businessTypeLabel : t('register.businessType')}
                </label>
                <input
                  id="businessType"
                  className="field-input"
                  list="business-types"
                  placeholder={emedikBrand ? emedikBrand.businessTypePlaceholder : 'mis. Kafe, Retail, Distributor'}
                  {...register('businessType')}
                />
                <datalist id="business-types">
                  {(config.data?.businessTypes ?? []).map((type) => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
              </div>

              {/*
                Pilihan data contoh.
                Disebutkan pula APA yang tidak terpengaruh pilihan ini — penyewa
                yang mematikannya perlu tahu bahwa ia tetap memperoleh satuan,
                bagan akun, peran, dan hak akses. Tanpa keterangan itu, pilihan
                ini terasa seperti memilih antara "berisi" dan "kosong sama
                sekali".
              */}
              <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 shrink-0"
                    checked={includeSampleData}
                    onChange={(event) => setIncludeSampleData(event.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-medium">
                      {emedikBrand ? emedikBrand.includeSampleLabel : t('register.includeSample')}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {emedikBrand ? emedikBrand.includeSampleHint : t('register.includeSampleHint')}
                    </span>
                  </span>
                </label>
                <p className="mt-2 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  {emedikBrand ? emedikBrand.includeSampleAlways : t('register.includeSampleAlways')}
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="country">{t('register.country')}</label>
                <input id="country" className="field-input" {...register('country')} />
              </div>
              <div>
                <label className="field-label" htmlFor="province">{t('register.province')}</label>
                <input id="province" className="field-input" {...register('province')} />
              </div>
              <div>
                <label className="field-label" htmlFor="cityRegency">{t('register.cityRegency')}</label>
                <input id="cityRegency" className="field-input" {...register('cityRegency')} />
              </div>
              <div>
                <label className="field-label" htmlFor="district">{t('register.district')}</label>
                <input id="district" className="field-input" {...register('district')} />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="address">{t('register.address')}</label>
                <input id="address" className="field-input" {...register('address')} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="contactPerson">{t('register.contactPerson')}</label>
                <input id="contactPerson" className="field-input" {...register('contactPerson')} />
              </div>
              <div>
                <label className="field-label" htmlFor="contactPhone">{t('register.contactPhone')}</label>
                <input id="contactPhone" className="field-input ltr-code" {...register('contactPhone')} />
              </div>
              <div>
                <label className="field-label" htmlFor="businessPhone">{t('register.businessPhone')}</label>
                <input id="businessPhone" className="field-input ltr-code" {...register('businessPhone')} />
              </div>
              <div>
                <label className="field-label" htmlFor="email">{t('register.email')} *</label>
                <input
                  id="email"
                  type="email"
                  className="field-input ltr-code"
                  {...register('email', { required: true, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ })}
                />
                {errors.email && <p className="field-error">{t('common.required')}</p>}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="field-label" htmlFor="desiredUsername">
                  {t('register.desiredUsername')} *
                </label>
                <input
                  id="desiredUsername"
                  className="field-input ltr-code"
                  autoComplete="off"
                  data-testid="desired-username"
                  {...register('desiredUsername', { required: true, minLength: 3, maxLength: 48 })}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('register.usernameHint')}</p>

                {usernameQuery.length >= 3 && (
                  <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                    {usernameCheck.isFetching ? (
                      <p className="flex items-center gap-2 text-sm text-slate-500">
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        {t('register.checking')}
                      </p>
                    ) : usernameCheck.data ? (
                      <>
                        <p
                          className={clsx(
                            'flex items-center gap-2 text-sm font-medium',
                            usernameCheck.data.available
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-rose-700 dark:text-rose-400',
                          )}
                          data-testid="username-availability"
                        >
                          {usernameCheck.data.available ? (
                            <Check className="h-4 w-4" aria-hidden />
                          ) : (
                            <X className="h-4 w-4" aria-hidden />
                          )}
                          {usernameCheck.data.available ? t('register.available') : t('register.notAvailable')}
                        </p>
                        <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                          {usernameCheck.data.message}
                        </p>
                        <dl className="mt-2 space-y-1 text-xs">
                          <div className="flex gap-2">
                            <dt className="text-slate-500">{t('register.schemaPreview')}:</dt>
                            <dd className="ltr-code font-medium">{usernameCheck.data.schemaName}</dd>
                          </div>
                          <div className="flex gap-2">
                            <dt className="text-slate-500">{t('register.auditSchemaPreview')}:</dt>
                            <dd className="ltr-code font-medium">{usernameCheck.data.auditSchemaName}</dd>
                          </div>
                        </dl>
                        {usernameCheck.data.suggestions.length > 0 && (
                          <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
                            {t('register.suggestions')}:{' '}
                            <span className="ltr-code">{usernameCheck.data.suggestions.join(', ')}</span>
                          </p>
                        )}
                      </>
                    ) : null}
                  </div>
                )}
              </div>

              <fieldset className="space-y-2">
                <legend className="field-label">{t('auth.password')}</legend>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={generatePassword}
                    onChange={() => setGeneratePassword(true)}
                  />
                  <span className="text-slate-700 dark:text-slate-200">{t('register.generatePassword')}</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    className="mt-1"
                    checked={!generatePassword}
                    onChange={() => setGeneratePassword(false)}
                  />
                  <span className="text-slate-700 dark:text-slate-200">{t('register.ownPassword')}</span>
                </label>
              </fieldset>

              {!generatePassword && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="field-label" htmlFor="password">{t('register.password')}</label>
                    <input id="password" type="password" className="field-input" {...register('password')} />
                  </div>
                  <div>
                    <label className="field-label" htmlFor="passwordConfirmation">
                      {t('register.passwordConfirmation')}
                    </label>
                    <input
                      id="passwordConfirmation"
                      type="password"
                      className="field-input"
                      {...register('passwordConfirmation')}
                    />
                  </div>
                  <p className="text-xs text-slate-500 sm:col-span-2 dark:text-slate-400">
                    {t('auth.passwordRules')}
                  </p>
                </div>
              )}

              <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptTerms}
                    onChange={(event) => setAcceptTerms(event.target.checked)}
                    data-testid="accept-terms"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    {t('register.acceptTerms')}{' '}
                    <Link to="/syarat" className="text-brand-700 hover:underline dark:text-brand-300" target="_blank">
                      ↗
                    </Link>
                  </span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={acceptPrivacy}
                    onChange={(event) => setAcceptPrivacy(event.target.checked)}
                    data-testid="accept-privacy"
                  />
                  <span className="text-slate-700 dark:text-slate-200">
                    {t('register.acceptPrivacy')}{' '}
                    <Link to="/privasi" className="text-brand-700 hover:underline dark:text-brand-300" target="_blank">
                      ↗
                    </Link>
                  </span>
                </label>
              </div>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn-outline"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0}
            >
              {t('common.back')}
            </button>

            {step < STEPS.length - 1 ? (
              <button type="button" className="btn-primary" onClick={() => void goNext()}>
                {t('common.next')}
              </button>
            ) : (
              <button
                type="submit"
                className="btn-primary"
                disabled={!canSubmit || submit.isPending}
                data-testid="submit-registration"
              >
                {submit.isPending ? t('register.submitting') : t('register.submit')}
              </button>
            )}
          </div>

          {submit.isPending && (
            <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              {t('register.provisioning')}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
