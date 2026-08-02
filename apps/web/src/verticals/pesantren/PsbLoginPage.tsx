/**
 * Masuk ke portal pendaftar PSB -- "nama pengguna" nomor pendaftaran (yang
 * ditunjukkan `PsbPendaftaranPage` sesaat setelah mendaftar), "kata sandi"
 * tanggal lahir yang sudah diisi saat mendaftar. Pola sama dengan sistem
 * lama (`_header_ppdb.jsp`: nomor registrasi + tanggal lahir).
 *
 * Token yang diterima BUKAN token staf -- lihat `psb-portal-auth.ts` dan
 * backend `psb-applicant-auth.guard.ts` untuk alasan keduanya terpisah.
 */

import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '../../lib/api';
import { setPsbApplicantToken } from './psb-portal-auth';

interface HasilMasuk {
  accessToken: string;
  pendaftar: { id: string; nomorPendaftaran: string; namaLengkap: string; status: string };
}

export function PsbLoginPage() {
  const navigate = useNavigate();
  const [nomorPendaftaran, setNomorPendaftaran] = useState('');
  const [tanggalLahir, setTanggalLahir] = useState('');
  const [error, setError] = useState<string | null>(null);

  const masuk = useMutation({
    mutationFn: () =>
      apiRequest<HasilMasuk>('/pesantren/public/psb/masuk', {
        method: 'POST',
        body: { nomorPendaftaran: nomorPendaftaran.trim(), tanggalLahir },
      }),
    onSuccess: (hasil) => {
      setPsbApplicantToken(hasil.accessToken);
      navigate('/santri/pondok/psb/status');
    },
    onError: (err: unknown) => {
      const pesan = err instanceof Error ? err.message : 'Gagal masuk. Silakan periksa kembali isian Anda.';
      setError(pesan);
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    masuk.mutate();
  };

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Portal Pendaftar</h1>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
        Masuk dengan nomor pendaftaran dan tanggal lahir yang Anda isi saat mendaftar.
      </p>

      {error && (
        <div role="alert" className="mt-5 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
          {error}
        </div>
      )}

      <form className="mt-6 space-y-4" onSubmit={submit}>
        <div>
          <label className="field-label">Nomor Pendaftaran</label>
          <input
            type="text"
            className="field-input font-mono"
            value={nomorPendaftaran}
            onChange={(e) => setNomorPendaftaran(e.target.value)}
            placeholder="PSB-2026-G1-00001"
            required
          />
        </div>
        <div>
          <label className="field-label">Tanggal Lahir</label>
          <input
            type="date"
            className="field-input"
            value={tanggalLahir}
            onChange={(e) => setTanggalLahir(e.target.value)}
            required
          />
        </div>
        <button type="submit" className="btn-primary w-full" disabled={masuk.isPending}>
          {masuk.isPending ? 'Memeriksa…' : 'Masuk'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Belum mendaftar?{' '}
        <Link to="/santri/pondok/psb" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          Daftar sebagai calon santri baru
        </Link>
      </p>
    </div>
  );
}
