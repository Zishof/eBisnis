import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { api } from '../../lib/api';
import { useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

const contactSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email().max(255),
  phone: z.string().max(64).optional().or(z.literal('')),
  subject: z.string().min(3).max(255),
  message: z.string().min(10).max(4000),
});

type ContactForm = z.infer<typeof contactSchema>;

export function ContactPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const toMessage = useErrorMessage();

  const offices = useQuery({
    queryKey: ['contact-offices'],
    queryFn: () =>
      api.get<{ contactOffices: Array<{ code: string; name: string; address: string; phone?: string | null; email?: string | null; openingHours?: string | null }> }>(
        '/public/marketing',
      ),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ContactForm>();

  const submit = useMutation({
    mutationFn: (values: ContactForm) => api.post('/public/contact', values),
    onSuccess: () => {
      toast.push(t('web.contactSuccess'), 'success');
      reset();
    },
    onError: (error) => toast.push(toMessage(error, (key, fallback) => t(key, fallback ?? key)), 'error'),
  });

  const onSubmit = handleSubmit((values) => {
    const parsed = contactSchema.safeParse(values);
    if (!parsed.success) {
      toast.push(t('error.VALIDATION_FAILED'), 'error');
      return;
    }
    submit.mutate(parsed.data);
  });

  return (
    <div className="py-14">
      <div className="container-page grid gap-10 lg:grid-cols-2">
        <div>
          <p className="section-eyebrow">{t('nav.contact')}</p>
          <h1 className="section-heading">Hubungi Kami</h1>
          <p className="section-lead">
            Tim kami siap membantu memetakan kebutuhan bisnis Anda ke dalam sistem.
          </p>
          <div className="mt-8 space-y-4">
            {(offices.data?.contactOffices ?? []).map((office) => (
              <div key={office.code} className="card p-5">
                <h2 className="font-semibold text-slate-900 dark:text-white">{office.name}</h2>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{office.address}</p>
                {office.phone && (
                  <p className="mt-1 text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Telepon: </span>
                    <span className="ltr-code">{office.phone}</span>
                  </p>
                )}
                {office.email && (
                  <p className="text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Surel: </span>
                    <span className="ltr-code">{office.email}</span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <form className="card p-6" onSubmit={onSubmit} noValidate>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('web.contactForm')}</h2>
          <div className="mt-5 space-y-4">
            <div>
              <label className="field-label" htmlFor="contact-name">{t('web.contactName')}</label>
              <input id="contact-name" className="field-input" {...register('name', { required: true })} />
              {errors.name && <p className="field-error">{t('common.required')}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="contact-email">{t('web.contactEmail')}</label>
              <input id="contact-email" type="email" className="field-input" {...register('email', { required: true })} />
              {errors.email && <p className="field-error">{t('common.required')}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="contact-phone">{t('web.contactPhone')}</label>
              <input id="contact-phone" className="field-input ltr-code" {...register('phone')} />
            </div>
            <div>
              <label className="field-label" htmlFor="contact-subject">{t('web.contactSubject')}</label>
              <input id="contact-subject" className="field-input" {...register('subject', { required: true })} />
              {errors.subject && <p className="field-error">{t('common.required')}</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="contact-message">{t('web.contactMessage')}</label>
              <textarea id="contact-message" rows={5} className="field-input" {...register('message', { required: true })} />
              {errors.message && <p className="field-error">{t('common.required')}</p>}
            </div>
          </div>
          <button type="submit" className="btn-primary mt-6 w-full" disabled={isSubmitting || submit.isPending}>
            {submit.isPending ? t('common.loading') : t('web.contactSend')}
          </button>
        </form>
      </div>
    </div>
  );
}
