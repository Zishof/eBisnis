/**
 * Layar data contoh koperasi — dua tombol.
 *
 * Yang dijaga di sini bukan tampilannya melainkan **kejelasan akibatnya**.
 * Tombol yang menghapus 1.700 baris harus mengatakan berapa yang dihapus dan
 * apa yang sengaja dipertahankan, sebelum ditekan dan sesudahnya.
 *
 * Penghapusan meminta konfirmasi ketik. Dialog "Anda yakin?" ditekan orang
 * tanpa dibaca; mengetik kata tertentu menuntut perhatian selama satu detik,
 * dan satu detik itu yang membedakan.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Database, Loader2, Trash2 } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface Status {
  terpasang: boolean;
  anggota: number;
  totalBaris: number;
  tahunBuku: number;
}

interface HasilPasang {
  koperasi: string;
  koperasiDibuatDisini: boolean;
  anggota: number;
  rekeningSimpanan: number;
  mutasiSimpanan: number;
  pinjaman: number;
  angsuran: number;
  suara: number;
  shuDibagikan: number;
}

interface HasilHapus {
  totalBaris: number;
  terhapus: Record<string, number>;
  dipertahankan: string[];
}

const KATA_KONFIRMASI = 'HAPUS';

export function DataContohPage() {
  const qc = useQueryClient();
  const [ketikan, setKetikan] = useState('');
  const [hasilPasang, setHasilPasang] = useState<HasilPasang | null>(null);
  const [hasilHapus, setHasilHapus] = useState<HasilHapus | null>(null);

  const { data: status, isLoading } = useQuery({
    queryKey: ['cooperative', 'sample'],
    queryFn: () => apiRequest<Status>('/cooperative/sample'),
    retry: false,
  });

  const segarkan = () => {
    void qc.invalidateQueries({ queryKey: ['cooperative'] });
  };

  const pasang = useMutation({
    mutationFn: () => apiRequest<HasilPasang>('/cooperative/sample/install', { method: 'POST' }),
    onSuccess: (d) => {
      setHasilPasang(d);
      setHasilHapus(null);
      segarkan();
    },
  });

  const hapus = useMutation({
    mutationFn: () => apiRequest<HasilHapus>('/cooperative/sample/remove', { method: 'POST' }),
    onSuccess: (d) => {
      setHasilHapus(d);
      setHasilPasang(null);
      setKetikan('');
      segarkan();
    },
  });

  const sibuk = pasang.isPending || hapus.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Data Contoh Koperasi</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Satu koperasi lengkap untuk mempelajari sistem dan melihat bentuk laporannya: 60
          anggota, setahun simpanan wajib, 21 pinjaman pada berbagai keadaan, satu Rapat Anggota
          Tahunan beserta kuorum dan pemungutan suaranya, dan satu perhitungan SHU yang dibagikan.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-slate-500">Memeriksa keadaan…</p>
      ) : (
        <div
          className={`rounded-xl border p-4 ${
            status?.terpasang
              ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40'
              : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
          }`}
        >
          <p className="flex items-center gap-2 font-medium">
            <Database className="h-4 w-4" aria-hidden />
            {status?.terpasang
              ? `Data contoh terpasang — ${status.anggota} anggota, tahun buku ${status.tahunBuku}`
              : 'Data contoh belum terpasang'}
          </p>
          {status?.terpasang && (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Sekitar {status.totalBaris.toLocaleString('id-ID')} baris pokok. Laporan RAT, SHU,
              dan rekapitulasi simpanan sudah dapat dicetak.
            </p>
          )}
        </div>
      )}

      {/* --- Pasang --------------------------------------------------- */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-medium">Masukkan data contoh</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Bila koperasi Anda sudah punya profil, data contoh menumpang padanya — Anda tidak akan
          memperoleh koperasi kedua. Profil itu tidak ikut terhapus nanti.
        </p>
        <button
          type="button"
          onClick={() => pasang.mutate()}
          disabled={sibuk || status?.terpasang}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pasang.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          Masukkan data contoh
        </button>
        {pasang.isError && (
          <p className="mt-2 text-sm text-rose-600">{(pasang.error as Error).message}</p>
        )}
      </section>

      {/* --- Hapus ---------------------------------------------------- */}
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
        <h2 className="flex items-center gap-2 font-medium text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          Hapus data contoh
        </h2>
        <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
          Hanya baris berkode <code className="font-mono">CONTOH-</code> yang dihapus. Data
          koperasi Anda yang sungguhan, beserta peran dan hak aksesnya, tidak tersentuh.
        </p>

        <label className="mt-3 block text-sm text-amber-900 dark:text-amber-200">
          Ketik <strong className="font-mono">{KATA_KONFIRMASI}</strong> untuk mengaktifkan tombol
          <input
            value={ketikan}
            onChange={(e) => setKetikan(e.target.value)}
            className="mt-1 block w-40 rounded-lg border border-amber-300 px-3 py-2 font-mono dark:border-amber-800 dark:bg-slate-950"
            aria-label={`Ketik ${KATA_KONFIRMASI} untuk mengonfirmasi penghapusan`}
          />
        </label>

        <button
          type="button"
          onClick={() => hapus.mutate()}
          disabled={sibuk || ketikan !== KATA_KONFIRMASI || !status?.terpasang}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {hapus.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden />
          )}
          Hapus data contoh
        </button>
        {hapus.isError && (
          <p className="mt-2 text-sm text-rose-700">{(hapus.error as Error).message}</p>
        )}
      </section>

      {/* --- Hasil ---------------------------------------------------- */}
      {hasilPasang && (
        <section className="rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-900 dark:bg-slate-900">
          <h2 className="font-medium">Data contoh terpasang</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            {hasilPasang.koperasiDibuatDisini
              ? `Koperasi "${hasilPasang.koperasi}" dibuat sebagai contoh.`
              : `Data contoh ditumpangkan pada koperasi Anda, "${hasilPasang.koperasi}".`}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
            {[
              ['Anggota', hasilPasang.anggota],
              ['Rekening simpanan', hasilPasang.rekeningSimpanan],
              ['Mutasi simpanan', hasilPasang.mutasiSimpanan],
              ['Pinjaman', hasilPasang.pinjaman],
              ['Baris angsuran', hasilPasang.angsuran],
              ['Suara pada RAT', hasilPasang.suara],
              ['Anggota penerima SHU', hasilPasang.shuDibagikan],
            ].map(([label, nilai]) => (
              <div key={String(label)}>
                <dt className="text-xs text-slate-500">{label}</dt>
                <dd className="tabular-nums">{Number(nilai).toLocaleString('id-ID')}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {hasilHapus && (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="font-medium">
            Data contoh dihapus — {hasilHapus.totalBaris.toLocaleString('id-ID')} baris
          </h2>
          {/*
            Yang dipertahankan disebutkan pada hasilnya, bukan hanya pada
            dokumentasi. Penyewa berhak tahu apa yang SENGAJA tidak ikut hilang.
          */}
          <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
            Yang sengaja dipertahankan:
          </p>
          <ul className="mt-1 list-inside list-disc text-sm text-slate-600 dark:text-slate-400">
            {hasilHapus.dipertahankan.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
