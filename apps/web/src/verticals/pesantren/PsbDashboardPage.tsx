/**
 * Dasbor portal pendaftar PSB -- status pendaftaran, lengkapi biodata,
 * unggah bukti bayar, dan lihat jadwal ujian/wawancara. Semua lewat token
 * portal (`psb-portal-auth.ts`), BUKAN sesi staf -- lihat
 * `psb-applicant-auth.guard.ts` di backend untuk alasannya.
 *
 * Ujian online (CBT) sengaja BELUM ada di sini -- disepakati sebagai epik
 * terpisah menyusul, bukan bagian tahap ini (subsistem sendiri di sistem
 * lama: bank soal, timer, penilaian otomatis).
 */

import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut } from 'lucide-react';
import { apiRequest, API_BASE, ApiError } from '../../lib/api';
import { clearPsbApplicantToken, getPsbApplicantToken } from './psb-portal-auth';

interface Pendaftar {
  id: string;
  nomor_pendaftaran: string;
  nama_lengkap: string;
  status: string;
  alamat: string | null;
  telepon: string | null;
  hp: string | null;
  email: string | null;
  nama_orang_tua: string | null;
  no_hp_orang_tua: string | null;
  nama_ayah: string | null;
  pekerjaan_ayah: string | null;
  nama_ibu: string | null;
  pekerjaan_ibu: string | null;
}

interface Jadwal {
  id: string;
  jenis: string;
  tanggal: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  lokasi: string | null;
  penguji: string | null;
  status: string;
  nilai: string | null;
  catatan_hasil: string | null;
}

const LABEL_STATUS: Record<string, string> = {
  TERDAFTAR: 'Terdaftar, menunggu verifikasi berkas',
  VERIFIKASI: 'Sedang diverifikasi pengurus',
  DIJADWALKAN: 'Dijadwalkan ujian/wawancara',
  LULUS_SELEKSI: 'Lulus seleksi',
  TIDAK_LULUS: 'Tidak lulus seleksi',
  DITERIMA: 'Diterima sebagai santri baru',
  DAFTAR_ULANG: 'Sudah daftar ulang',
  DIBATALKAN: 'Dibatalkan',
};

const LABEL_JENIS_JADWAL: Record<string, string> = {
  UJIAN_TULIS: 'Ujian Tulis',
  TES_BACA_QURAN: 'Tes Baca Al-Quran',
  WAWANCARA: 'Wawancara',
  TES_KESEHATAN: 'Tes Kesehatan',
  LAINNYA: 'Lainnya',
};

function authHeader(): Record<string, string> {
  const token = getPsbApplicantToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function PsbDashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!getPsbApplicantToken()) {
      navigate('/santri/pondok/psb/masuk', { replace: true });
    }
  }, [navigate]);

  const keluar = () => {
    clearPsbApplicantToken();
    navigate('/santri/pondok/psb/masuk', { replace: true });
  };

  const saya = useQuery({
    queryKey: ['pesantren', 'psb-portal', 'saya'],
    queryFn: () => apiRequest<Pendaftar>('/pesantren/psb-portal/saya', { headers: authHeader() }),
    retry: false,
    enabled: !!getPsbApplicantToken(),
  });

  useEffect(() => {
    if (saya.error instanceof ApiError && saya.error.status === 401) {
      keluar();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saya.error]);

  const jadwal = useQuery({
    queryKey: ['pesantren', 'psb-portal', 'jadwal'],
    queryFn: () => apiRequest<Jadwal[]>('/pesantren/psb-portal/jadwal', { headers: authHeader() }),
    retry: false,
    enabled: !!saya.data,
  });

  const [form, setForm] = useState<Partial<Pendaftar> | null>(null);
  useEffect(() => {
    if (saya.data && !form) setForm(saya.data);
  }, [saya.data, form]);

  const [simpanSukses, setSimpanSukses] = useState(false);
  const simpanBiodata = useMutation({
    mutationFn: () =>
      apiRequest<Pendaftar>('/pesantren/psb-portal/biodata', {
        method: 'PUT',
        headers: authHeader(),
        body: {
          alamat: form?.alamat || undefined,
          telepon: form?.telepon || undefined,
          hp: form?.hp || undefined,
          email: form?.email || undefined,
          namaOrangTua: form?.nama_orang_tua || undefined,
          noHpOrangTua: form?.no_hp_orang_tua || undefined,
          ayah: form?.nama_ayah || form?.pekerjaan_ayah ? { nama: form?.nama_ayah, pekerjaan: form?.pekerjaan_ayah } : undefined,
          ibu: form?.nama_ibu || form?.pekerjaan_ibu ? { nama: form?.nama_ibu, pekerjaan: form?.pekerjaan_ibu } : undefined,
        },
      }),
    onSuccess: (hasil) => {
      queryClient.setQueryData(['pesantren', 'psb-portal', 'saya'], hasil);
      setSimpanSukses(true);
      setTimeout(() => setSimpanSukses(false), 3000);
    },
  });

  const [fileBukti, setFileBukti] = useState<File | null>(null);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'sukses' | 'gagal'>('idle');
  const unggahBukti = async () => {
    if (!fileBukti) return;
    setUploadStatus('uploading');
    try {
      const body = new FormData();
      body.append('file', fileBukti);
      const res = await fetch(`${API_BASE}/pesantren/psb-portal/bukti-bayar`, {
        method: 'POST',
        headers: authHeader(),
        body,
      });
      if (!res.ok) throw new Error('Gagal mengunggah');
      setUploadStatus('sukses');
      setFileBukti(null);
    } catch {
      setUploadStatus('gagal');
    }
  };

  if (saya.isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500">Memuat…</div>;
  }

  if (!saya.data || !form) {
    return null;
  }

  const p = saya.data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{p.nama_lengkap}</h1>
          <p className="mt-1 font-mono text-sm text-slate-500 dark:text-slate-400">{p.nomor_pendaftaran}</p>
        </div>
        <button
          type="button"
          onClick={keluar}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Keluar
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
        Status: {LABEL_STATUS[p.status] ?? p.status}
      </div>

      {/* --- Jadwal ------------------------------------------------------ */}
      {jadwal.data && jadwal.data.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Jadwal Ujian/Wawancara</h2>
          <div className="mt-3 space-y-3">
            {jadwal.data.map((j) => (
              <div key={j.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-white">{LABEL_JENIS_JADWAL[j.jenis] ?? j.jenis}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {new Date(j.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {j.waktu_mulai && ` · ${j.waktu_mulai.slice(0, 5)}${j.waktu_selesai ? ` – ${j.waktu_selesai.slice(0, 5)}` : ''}`}
                </p>
                {j.lokasi && <p className="text-sm text-slate-500 dark:text-slate-400">Lokasi: {j.lokasi}</p>}
                {j.penguji && <p className="text-sm text-slate-500 dark:text-slate-400">Penguji: {j.penguji}</p>}
                {j.status === 'SELESAI' && j.nilai != null && (
                  <p className="mt-1 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Nilai: {j.nilai}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* --- Bukti bayar --------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Bukti Pembayaran Pendaftaran</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Unggah bukti transfer biaya pendaftaran (JPEG, PNG, WEBP, atau PDF, maksimal 5 MB).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            onChange={(e) => setFileBukti(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 dark:text-slate-300"
          />
          <button
            type="button"
            className="btn-primary"
            disabled={!fileBukti || uploadStatus === 'uploading'}
            onClick={unggahBukti}
          >
            {uploadStatus === 'uploading' ? 'Mengunggah…' : 'Unggah'}
          </button>
        </div>
        {uploadStatus === 'sukses' && (
          <p className="mt-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400">Bukti pembayaran tersimpan.</p>
        )}
        {uploadStatus === 'gagal' && (
          <p className="mt-2 text-sm font-semibold text-rose-700 dark:text-rose-400">Gagal mengunggah. Silakan coba lagi.</p>
        )}
      </section>

      {/* --- Biodata --------------------------------------------------- */}
      <section className="mt-8">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Lengkapi Biodata</h2>
        <form
          className="mt-3 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            simpanBiodata.mutate();
          }}
        >
          <Field label="Alamat" value={form.alamat ?? ''} onChange={(v) => setForm((f) => ({ ...f, alamat: v }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="No. HP/WhatsApp" value={form.hp ?? ''} onChange={(v) => setForm((f) => ({ ...f, hp: v }))} />
            <Field label="Surel" type="email" value={form.email ?? ''} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Nama Orang Tua/Wali"
              value={form.nama_orang_tua ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, nama_orang_tua: v }))}
            />
            <Field
              label="No. HP Orang Tua/Wali"
              value={form.no_hp_orang_tua ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, no_hp_orang_tua: v }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Ayah" value={form.nama_ayah ?? ''} onChange={(v) => setForm((f) => ({ ...f, nama_ayah: v }))} />
            <Field
              label="Pekerjaan Ayah"
              value={form.pekerjaan_ayah ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, pekerjaan_ayah: v }))}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Ibu" value={form.nama_ibu ?? ''} onChange={(v) => setForm((f) => ({ ...f, nama_ibu: v }))} />
            <Field
              label="Pekerjaan Ibu"
              value={form.pekerjaan_ibu ?? ''}
              onChange={(v) => setForm((f) => ({ ...f, pekerjaan_ibu: v }))}
            />
          </div>
          <button type="submit" className="btn-primary w-full" disabled={simpanBiodata.isPending}>
            {simpanBiodata.isPending ? 'Menyimpan…' : 'Simpan Biodata'}
          </button>
          {simpanSukses && (
            <p className="text-center text-sm font-semibold text-emerald-700 dark:text-emerald-400">Biodata tersimpan.</p>
          )}
        </form>
      </section>

      <Link
        to="/santri/pondok"
        className="mt-8 block text-center text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
      >
        Kembali ke beranda pondok
      </Link>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input type={type} className="field-input" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
