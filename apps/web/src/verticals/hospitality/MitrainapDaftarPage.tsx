/**
 * Formulir pendaftaran properti hospitality (MI-3).
 *
 * Jauh lebih ringkas daripada `DaftarPesantrenPage` -- pendaftaran ini
 * hanya menyiapkan ruang kerja (schema, akun pemilik, situs
 * `<slug>.mitrainap.id`). Properti (tipe kamar, kamar, rate plan) dicatat
 * pengurus SESUDAH masuk lewat `/app/hospitality/properti` (MI-5) yang
 * sudah ada, bukan diulang di formulir ini.
 *
 * Dua nama yang tidak boleh tertukar (sama seperti pendaftaran pesantren):
 * **alamat situs** (`<slug>.mitrainap.id`, label DNS, tanpa garis bawah)
 * dan **nama pengguna** (nama schema, boleh garis bawah).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AlertCircle, Check, Loader2, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';

interface KonfigHospitality {
  domainSitus: string;
  passwordSelaluDibuatPeladen: boolean;
}

interface CekSlug {
  tersedia: boolean;
  slug: string;
  host: string | null;
  alasan: string | null;
  pesan: string;
}

interface CekUsername {
  available: boolean;
  schemaName: string;
  message: string;
  suggestions: string[];
}

export interface HasilPendaftaranHospitality {
  status: string;
  registrationId: string;
  tenantId: string;
  username: string;
  schemaName: string;
  temporaryPassword?: string;
  mustChangePassword: boolean;
  slugSitus: string;
  siteHost: string;
  siteUrl: string;
  loginUrl: string;
}

interface Formulir {
  namaProperti: string;
  slugSitus: string;
  desiredUsername: string;
  email: string;
  teleponPenanggungJawab: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
}

const KOSONG: Formulir = {
  namaProperti: '',
  slugSitus: '',
  desiredUsername: '',
  email: '',
  teleponPenanggungJawab: '',
  acceptTerms: false,
  acceptPrivacy: false,
};

function useDebounced<T>(nilai: T, tunda = 500): T {
  const [hasil, setHasil] = useState(nilai);
  useEffect(() => {
    const t = setTimeout(() => setHasil(nilai), tunda);
    return () => clearTimeout(t);
  }, [nilai, tunda]);
  return hasil;
}

export function MitrainapDaftarPage() {
  const navigate = useNavigate();
  const toMessage = useErrorMessage();
  const [form, setForm] = useState<Formulir>(KOSONG);
  const [diusulkan, setDiusulkan] = useState(false);

  const konfig = useQuery({
    queryKey: ['hospitality-registration-config'],
    queryFn: () => api.get<KonfigHospitality>('/public/hospitality/registration-config'),
  });

  const namaDebounced = useDebounced(form.namaProperti);
  useEffect(() => {
    if (diusulkan || !namaDebounced.trim()) return;
    api
      .get<{ slug: string; username: string }>(
        `/public/hospitality/site-slug/suggest?nama=${encodeURIComponent(namaDebounced)}`,
      )
      .then((usulan) => {
        setForm((f) =>
          f.slugSitus || f.desiredUsername
            ? f
            : { ...f, slugSitus: usulan.slug, desiredUsername: usulan.username },
        );
      })
      .catch(() => {});
  }, [namaDebounced, diusulkan]);

  const slugDebounced = useDebounced(form.slugSitus);
  const cekSlug = useQuery({
    queryKey: ['hospitality-cek-slug', slugDebounced],
    queryFn: () => api.get<CekSlug>(`/public/hospitality/site-slug/check?slug=${encodeURIComponent(slugDebounced)}`),
    enabled: slugDebounced.trim().length >= 3,
  });

  const usernameDebounced = useDebounced(form.desiredUsername);
  const cekUsername = useQuery({
    queryKey: ['hospitality-cek-username', usernameDebounced],
    queryFn: () => api.post<CekUsername>('/public/usernames/check', { desiredUsername: usernameDebounced }),
    enabled: usernameDebounced.trim().length >= 3,
  });

  const daftar = useMutation({
    mutationFn: () => api.post<HasilPendaftaranHospitality>('/public/hospitality/registrations', form),
    onSuccess: (hasil) => {
      navigate('/mitrainap/daftar/berhasil', { state: { hasil } });
    },
  });

  const bolehKirim =
    form.namaProperti.trim() &&
    form.email.trim() &&
    form.slugSitus.trim() &&
    form.desiredUsername.trim() &&
    form.acceptTerms &&
    form.acceptPrivacy &&
    cekSlug.data?.tersedia !== false &&
    cekUsername.data?.available !== false &&
    !daftar.isPending;

  return (
    <div className="mx-auto max-w-xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Daftarkan Properti Anda</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Buat ruang kerja MitraInap.id untuk properti Anda. Kata sandi dibuat sistem dan hanya
        ditampilkan sekali setelah pendaftaran berhasil.
      </p>

      {daftar.isError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/30 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {toMessage(daftar.error, (_key, fallback) => fallback ?? 'Pendaftaran gagal.')}
        </div>
      )}

      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          daftar.mutate();
        }}
      >
        <Field label="Nama Properti *">
          <input
            className="field-input"
            value={form.namaProperti}
            onChange={(e) => {
              setForm({ ...form, namaProperti: e.target.value });
              setDiusulkan(false);
            }}
          />
        </Field>

        <Field label={`Alamat Situs * (${konfig.data?.domainSitus ?? 'mitrainap.id'})`}>
          <div className="flex items-center gap-2">
            <input
              className="field-input"
              value={form.slugSitus}
              onChange={(e) => {
                setDiusulkan(true);
                setForm({ ...form, slugSitus: e.target.value.toLowerCase() });
              }}
            />
            <StatusCek
              memuat={cekSlug.isFetching}
              tersedia={cekSlug.data?.tersedia}
              tampil={slugDebounced.trim().length >= 3}
            />
          </div>
          {cekSlug.data && !cekSlug.data.tersedia && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{cekSlug.data.pesan}</p>
          )}
          {form.slugSitus.trim() && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Situs Anda: <span className="ltr-code">{form.slugSitus.trim().toLowerCase()}.mitrainap.id</span>
            </p>
          )}
        </Field>

        <Field label="Nama Pengguna * (untuk masuk, tidak dapat diubah)">
          <div className="flex items-center gap-2">
            <input
              className="field-input"
              value={form.desiredUsername}
              onChange={(e) => {
                setDiusulkan(true);
                setForm({ ...form, desiredUsername: e.target.value.toLowerCase() });
              }}
            />
            <StatusCek
              memuat={cekUsername.isFetching}
              tersedia={cekUsername.data?.available}
              tampil={usernameDebounced.trim().length >= 3}
            />
          </div>
          {cekUsername.data && !cekUsername.data.available && (
            <p className="mt-1 text-xs text-rose-600 dark:text-rose-400">{cekUsername.data.message}</p>
          )}
        </Field>

        <Field label="Surel *">
          <input
            type="email"
            className="field-input"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>

        <Field label="Telepon Penanggung Jawab">
          <input
            className="field-input"
            value={form.teleponPenanggungJawab}
            onChange={(e) => setForm({ ...form, teleponPenanggungJawab: e.target.value })}
          />
        </Field>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.acceptTerms}
            onChange={(e) => setForm({ ...form, acceptTerms: e.target.checked })}
          />
          Saya menyetujui syarat penggunaan.
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={form.acceptPrivacy}
            onChange={(e) => setForm({ ...form, acceptPrivacy: e.target.checked })}
          />
          Saya menyetujui kebijakan privasi.
        </label>

        <button type="submit" className="btn-primary w-full" disabled={!bolehKirim}>
          {daftar.isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Memproses...
            </span>
          ) : (
            'Daftar Sekarang'
          )}
        </button>

        <p className="text-center text-sm text-slate-600 dark:text-slate-400">
          Sudah punya akun?{' '}
          <Link to="/mitrainap/masuk" className="font-semibold text-indigo-700 hover:underline dark:text-indigo-300">
            Masuk
          </Link>
        </p>
      </form>
    </div>
  );
}

function StatusCek({ memuat, tersedia, tampil }: { memuat: boolean; tersedia?: boolean; tampil: boolean }) {
  if (!tampil) return null;
  if (memuat) return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-slate-400" aria-hidden />;
  if (tersedia === true) return <Check className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />;
  if (tersedia === false) return <X className="h-4 w-4 shrink-0 text-rose-600" aria-hidden />;
  return null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
