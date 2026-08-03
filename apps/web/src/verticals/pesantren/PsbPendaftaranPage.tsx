/**
 * Formulir Penerimaan Santri Baru (PSB) publik, di `<pondok>.santri.info`.
 *
 * Diakses lewat `/santri/pondok/psb/daftar/:gelombangId` -- pengunjung
 * memilih gelombangnya di `PsbGelombangPage` (landing PSB) dulu, formulir
 * ini karena itu tidak lagi punya combobox gelombang sendiri (dulu ada,
 * dipindah supaya alur pendaftaran punya dua langkah yang jelas, sama
 * seperti sistem lama: daftar gelombang -> pilih -> formulir).
 *
 * Referensi UX: modul PSB pada sistem lama (`psb.zul`/`CalonSiswaAction.java`,
 * `C:\opt\AIS\ais\...\action\master\sekolah\psb\`) -- portal publik tanpa
 * gerbang masuk, formulir pendaftaran sebagai pintu utamanya. Sesudah
 * mendaftar, pendaftar melanjutkan lewat `PsbLoginPage`/`PsbDashboardPage`
 * (nomor pendaftaran + tanggal lahir) untuk melengkapi biodata, mengunggah
 * bukti bayar, dan melihat jadwal wawancara -- lihat berkas itu. Kemampuan
 * dari referensi yang TIDAK dibawa (ujian online/CBT, pembayaran via payment
 * gateway) sengaja belum dibangun -- keduanya subsistem tersendiri yang
 * disepakati menyusul, bukan bagian tahap ini.
 *
 * Memanggil tiga endpoint publik (tanpa sesi, tanpa hak akses):
 *   GET  /pesantren/public/psb/gelombang -- seluruh gelombang (untuk validasi :gelombangId)
 *   GET  /pesantren/public/agama         -- combobox agama (tabel referensi)
 *   POST /pesantren/public/psb/daftar    -- pendaftaran itu sendiri
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface Agama {
  code: string;
  nama: string;
}

interface Gelombang {
  id: string;
  kode: string;
  nama: string;
  tanggal_buka: string;
  tanggal_tutup: string;
  biaya_pendaftaran: string;
  status: string;
}

interface UnitPendidikan {
  code: string;
  name: string;
  jenis: string;
}

interface IsiSitus {
  profil: { nama_tampilan: string | null; theme_code: string };
  unitPendidikan: UnitPendidikan[];
}

interface DataOrangTua {
  nama?: string;
  nik?: string;
  tahunLahir?: number;
  pendidikan?: string;
  pekerjaan?: string;
  penghasilan?: string;
}

interface FormPendaftaran {
  namaLengkap: string;
  jenisKelamin: string;
  tempatLahir: string;
  tanggalLahir: string;
  namaOrangTua: string;
  noHpOrangTua: string;
  alamat: string;
  asalSekolah: string;
  unitPendidikanTujuanId: string;
  nik: string;
  nisn: string;
  agama: string;
  telepon: string;
  hp: string;
  email: string;
  ayah: DataOrangTua;
  ibu: DataOrangTua;
}

const AWAL: FormPendaftaran = {
  namaLengkap: '',
  jenisKelamin: 'L',
  tempatLahir: '',
  tanggalLahir: '',
  namaOrangTua: '',
  noHpOrangTua: '',
  alamat: '',
  asalSekolah: '',
  unitPendidikanTujuanId: '',
  nik: '',
  nisn: '',
  agama: '',
  telepon: '',
  hp: '',
  email: '',
  ayah: {},
  ibu: {},
};

function bersihkanTeks(nilai: string): string | undefined {
  const bersih = nilai.trim();
  return bersih ? bersih : undefined;
}

function bersihkanOrangTua(data: DataOrangTua): DataOrangTua | undefined {
  const isi = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== '' && !(typeof v === 'number' && Number.isNaN(v))),
  );
  return Object.keys(isi).length > 0 ? isi : undefined;
}

export function PsbPendaftaranPage() {
  const { gelombangId } = useParams<{ gelombangId: string }>();
  const [form, setForm] = useState<FormPendaftaran>(AWAL);
  const [error, setError] = useState<string | null>(null);
  const [nomorPendaftaran, setNomorPendaftaran] = useState<string | null>(null);

  const { data: situs } = useQuery({
    queryKey: ['pesantren', 'situs-publik', 'psb'],
    queryFn: () => apiRequest<IsiSitus>('/pesantren/public/site'),
    retry: false,
  });

  const { data: gelombangList, isLoading: gelombangMemuat } = useQuery({
    queryKey: ['pesantren', 'psb-gelombang-publik'],
    queryFn: () => apiRequest<Gelombang[]>('/pesantren/public/psb/gelombang'),
    retry: false,
  });

  const { data: agamaList } = useQuery({
    queryKey: ['pesantren', 'agama-publik'],
    queryFn: () => apiRequest<Agama[]>('/pesantren/public/agama'),
    retry: false,
  });

  const gelombang = gelombangList?.find((g) => g.id === gelombangId);

  const daftar = useMutation({
    mutationFn: () =>
      apiRequest<{ nomor_pendaftaran: string }>('/pesantren/public/psb/daftar', {
        method: 'POST',
        body: {
          gelombangId,
          namaLengkap: form.namaLengkap,
          jenisKelamin: form.jenisKelamin,
          tempatLahir: bersihkanTeks(form.tempatLahir),
          tanggalLahir: bersihkanTeks(form.tanggalLahir),
          namaOrangTua: bersihkanTeks(form.namaOrangTua),
          noHpOrangTua: bersihkanTeks(form.noHpOrangTua),
          alamat: bersihkanTeks(form.alamat),
          asalSekolah: bersihkanTeks(form.asalSekolah),
          unitPendidikanTujuanId: bersihkanTeks(form.unitPendidikanTujuanId),
          nik: bersihkanTeks(form.nik),
          nisn: bersihkanTeks(form.nisn),
          agama: bersihkanTeks(form.agama),
          telepon: bersihkanTeks(form.telepon),
          hp: bersihkanTeks(form.hp),
          email: bersihkanTeks(form.email),
          ayah: bersihkanOrangTua(form.ayah),
          ibu: bersihkanOrangTua(form.ibu),
        },
      }),
    onSuccess: (hasil) => setNomorPendaftaran(hasil.nomor_pendaftaran),
    onError: (err: unknown) => {
      const pesan = err instanceof Error ? err.message : 'Pendaftaran gagal. Silakan periksa kembali isian Anda.';
      setError(pesan);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    daftar.mutate();
  };

  const namaPondok = situs?.profil.nama_tampilan;

  if (nomorPendaftaran) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden />
          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Alhamdulillah, Pendaftaran Diterima</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Simpan nomor pendaftaran berikut. Pengurus {namaPondok ?? 'pondok'} akan menghubungi Anda untuk proses
            selanjutnya (verifikasi berkas, jadwal ujian/wawancara).
          </p>
          <p className="mt-4 rounded-lg bg-white px-4 py-3 font-mono text-lg font-bold text-emerald-700 dark:bg-slate-900 dark:text-emerald-400">
            {nomorPendaftaran}
          </p>
          <Link
            to="/santri/pondok/psb/masuk"
            className="mt-6 block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
          >
            Masuk ke Portal Pendaftar
          </Link>
          <Link to="/santri/pondok" className="mt-3 inline-block text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
            Kembali ke beranda pondok
          </Link>
        </div>
      </div>
    );
  }

  // Gelombang belum termuat -- jangan tampilkan galat sebelum sempat tahu.
  if (gelombangMemuat) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500">Memuat…</div>;
  }

  // :gelombangId tidak cocok gelombang mana pun, atau sudah tidak DIBUKA
  // lagi (mis. tautan lama, atau ditutup pengurus tepat saat pengunjung
  // sedang mengisi) -- jangan biarkan tetap mengirim ke gelombang yang
  // sudah tidak menerima; arahkan kembali ke daftar gelombang.
  if (!gelombang || gelombang.status !== 'DIBUKA') {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          {gelombang ? 'Gelombang Ini Sudah Ditutup' : 'Gelombang Tidak Ditemukan'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {gelombang
            ? 'Pendaftaran untuk gelombang ini sudah tidak dibuka lagi. Silakan pilih gelombang lain yang masih aktif.'
            : 'Tautan pendaftaran tidak valid. Silakan pilih gelombang dari daftar berikut.'}
        </p>
        <Link
          to="/santri/pondok/psb"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Lihat Gelombang Pendaftaran
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        Penerimaan Santri Baru{namaPondok ? ` — ${namaPondok}` : ''}
      </h1>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
        Bismillah, lengkapi formulir berikut untuk mendaftarkan calon santri. Data lengkap lainnya dapat dilengkapi
        pengurus saat verifikasi berkas.
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Sudah pernah mendaftar?{' '}
        <Link to="/santri/pondok/psb/masuk" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          Masuk ke portal pendaftar
        </Link>
      </p>

      <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/40">
        <span className="font-semibold text-emerald-800 dark:text-emerald-300">Gelombang:</span>{' '}
        <span className="text-emerald-700 dark:text-emerald-400">
          {gelombang.nama} ({gelombang.kode})
        </span>
      </div>

      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </div>
      )}

      <form className="mt-6 space-y-8" onSubmit={submit}>
        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900 dark:text-white">Data Calon Santri</legend>
          <Field label="Nama Lengkap" required value={form.namaLengkap} onChange={(v) => setForm((f) => ({ ...f, namaLengkap: v }))} />
          <div>
            <label className="field-label">Jenis Kelamin</label>
            <select className="field-input" value={form.jenisKelamin} onChange={(e) => setForm((f) => ({ ...f, jenisKelamin: e.target.value }))}>
              <option value="L">Laki-laki</option>
              <option value="P">Perempuan</option>
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tempat Lahir" value={form.tempatLahir} onChange={(v) => setForm((f) => ({ ...f, tempatLahir: v }))} />
            <Field label="Tanggal Lahir" type="date" value={form.tanggalLahir} onChange={(v) => setForm((f) => ({ ...f, tanggalLahir: v }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="NIK" value={form.nik} onChange={(v) => setForm((f) => ({ ...f, nik: v }))} maxLength={16} />
            <Field label="NISN" value={form.nisn} onChange={(v) => setForm((f) => ({ ...f, nisn: v }))} maxLength={10} />
          </div>
          <div>
            <label className="field-label">Agama</label>
            <select
              className="field-input"
              value={form.agama}
              onChange={(e) => setForm((f) => ({ ...f, agama: e.target.value }))}
            >
              <option value="">Pilih agama…</option>
              {(agamaList ?? []).map((a) => (
                <option key={a.code} value={a.nama}>
                  {a.nama}
                </option>
              ))}
            </select>
          </div>
          <Field label="Asal Sekolah" value={form.asalSekolah} onChange={(v) => setForm((f) => ({ ...f, asalSekolah: v }))} />
          {situs && situs.unitPendidikan.length > 0 && (
            <div>
              <label className="field-label">Unit Pendidikan yang Dituju</label>
              <select
                className="field-input"
                value={form.unitPendidikanTujuanId}
                onChange={(e) => setForm((f) => ({ ...f, unitPendidikanTujuanId: e.target.value }))}
              >
                <option value="">Belum menentukan</option>
                {situs.unitPendidikan.map((u) => (
                  <option key={u.code} value={u.code}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900 dark:text-white">Kontak dan Alamat</legend>
          <Field label="Alamat" value={form.alamat} onChange={(v) => setForm((f) => ({ ...f, alamat: v }))} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="No. HP/WhatsApp" value={form.hp} onChange={(v) => setForm((f) => ({ ...f, hp: v }))} />
            <Field label="Surel (opsional)" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          </div>
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-sm font-semibold text-slate-900 dark:text-white">Data Orang Tua</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Orang Tua/Wali" value={form.namaOrangTua} onChange={(v) => setForm((f) => ({ ...f, namaOrangTua: v }))} />
            <Field label="No. HP Orang Tua/Wali" value={form.noHpOrangTua} onChange={(v) => setForm((f) => ({ ...f, noHpOrangTua: v }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Ayah" value={form.ayah.nama ?? ''} onChange={(v) => setForm((f) => ({ ...f, ayah: { ...f.ayah, nama: v } }))} />
            <Field label="Pekerjaan Ayah" value={form.ayah.pekerjaan ?? ''} onChange={(v) => setForm((f) => ({ ...f, ayah: { ...f.ayah, pekerjaan: v } }))} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama Ibu" value={form.ibu.nama ?? ''} onChange={(v) => setForm((f) => ({ ...f, ibu: { ...f.ibu, nama: v } }))} />
            <Field label="Pekerjaan Ibu" value={form.ibu.pekerjaan ?? ''} onChange={(v) => setForm((f) => ({ ...f, ibu: { ...f.ibu, pekerjaan: v } }))} />
          </div>
        </fieldset>

        <button type="submit" className="btn-primary w-full" disabled={daftar.isPending}>
          {daftar.isPending ? 'Mengirim…' : 'Kirim Pendaftaran'}
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required = false,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="field-label">
        {label} {required && <span className="text-rose-600">*</span>}
      </label>
      <input
        type={type}
        className="field-input"
        value={value}
        maxLength={maxLength}
        required={required}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
