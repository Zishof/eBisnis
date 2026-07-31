/**
 * Pengaduan anggota.
 *
 * Hak menyatakan keberatan adalah bagian dari tata kelola koperasi, bukan
 * fitur layanan pelanggan. Karena itu:
 *
 *   · Tidak ada tombol hapus. Pengaduan yang dapat dihapus adalah pengaduan
 *     yang dapat dihilangkan oleh orang yang isinya menegur dirinya.
 *   · Tidak ada tombol tutup bagi anggota. Penutupan wewenang pengurus, dan
 *     anggota selalu dapat menanggapi kembali.
 *   · Pengaduan yang sudah dinyatakan selesai dapat dibuka kembali dengan
 *     menanggapinya — tanpa perlu memulai dari nol.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { portalApi } from './portal-api';
import {
  LABEL_KATEGORI_PENGADUAN,
  LABEL_STATUS_PENGADUAN,
  formatTanggal,
} from './portal-menu';

const KATEGORI = Object.entries(LABEL_KATEGORI_PENGADUAN);

function Percakapan({ pengaduanId }: { pengaduanId: string }) {
  const qc = useQueryClient();
  const [balasan, setBalasan] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'complaints', pengaduanId, 'responses'],
    queryFn: () => portalApi.tanggapan(pengaduanId),
    retry: false,
  });

  const kirim = useMutation({
    mutationFn: (body: string) => portalApi.tanggapi(pengaduanId, body),
    onSuccess: () => {
      setBalasan('');
      void qc.invalidateQueries({ queryKey: ['cooperative', 'portal', 'complaints'] });
    },
  });

  return (
    <div className="border-t border-slate-100 p-4 dark:border-slate-800">
      {isLoading ? (
        <p className="text-sm text-slate-500">Memuat tanggapan…</p>
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((t) => (
            <li
              key={t.id}
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                t.author_type === 'MEMBER'
                  ? 'ml-auto bg-emerald-600 text-white'
                  : 'bg-slate-100 dark:bg-slate-800'
              }`}
            >
              <p className="whitespace-pre-wrap">{t.body}</p>
              <p
                className={`mt-1 text-[0.65rem] ${
                  t.author_type === 'MEMBER' ? 'text-emerald-100' : 'text-slate-500'
                }`}
              >
                {t.author_type === 'MEMBER' ? 'Anda' : 'Pengurus'} ·{' '}
                {formatTanggal(t.created_at)}
              </p>
            </li>
          ))}
          {(data ?? []).length === 0 && (
            <li className="text-sm text-slate-500">Belum ada tanggapan dari pengurus.</li>
          )}
        </ul>
      )}

      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (balasan.trim().length >= 2) kirim.mutate(balasan.trim());
        }}
      >
        <input
          value={balasan}
          onChange={(e) => setBalasan(e.target.value)}
          placeholder="Tulis tanggapan…"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="submit"
          disabled={kirim.isPending || balasan.trim().length < 2}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Kirim
        </button>
      </form>
      {kirim.isError && (
        <p className="mt-2 text-sm text-rose-600">{(kirim.error as Error).message}</p>
      )}
    </div>
  );
}

function FormulirBaru({ onSelesai }: { onSelesai: () => void }) {
  const qc = useQueryClient();
  const [category, setCategory] = useState('SERVICE');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);

  const ajukan = useMutation({
    mutationFn: () => portalApi.ajukanPengaduan({ category, subject, body, isAnonymous }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['cooperative', 'portal'] });
      onSelesai();
    },
  });

  return (
    <form
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
      onSubmit={(e) => {
        e.preventDefault();
        ajukan.mutate();
      }}
    >
      <h2 className="font-medium">Pengaduan baru</h2>

      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">Kategori</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        >
          {KATEGORI.map(([kode, label]) => (
            <option key={kode} value={kode}>
              {label}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">Pokok masalah</span>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          minLength={5}
          maxLength={255}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <label className="block text-sm">
        <span className="text-slate-600 dark:text-slate-400">Uraian</span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          minLength={10}
          maxLength={5000}
          rows={5}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(e) => setIsAnonymous(e.target.checked)}
          className="mt-1"
        />
        <span>
          Sampaikan tanpa nama saya
          {/*
            Disebutkan apa adanya. Menjanjikan anonimitas penuh padahal
            sistemnya tetap menyimpan pemiliknya adalah janji yang tidak dapat
            ditepati — dan anggota berhak tahu sebelum menulis.
          */}
          <span className="mt-0.5 block text-xs text-slate-500">
            Nama Anda tidak ditampilkan kepada pengurus. Kepemilikan tetap tercatat dalam sistem
            agar pengaduan dapat ditindaklanjuti dan agar dapat ditelusuri bila diperlukan
            pemeriksaan.
          </span>
        </span>
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={ajukan.isPending}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {ajukan.isPending ? 'Mengirim…' : 'Kirim pengaduan'}
        </button>
        <button
          type="button"
          onClick={onSelesai}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
        >
          Batal
        </button>
      </div>

      {ajukan.isError && (
        <p className="text-sm text-rose-600">{(ajukan.error as Error).message}</p>
      )}
    </form>
  );
}

export function PortalPengaduan() {
  const [baru, setBaru] = useState(false);
  const [terbuka, setTerbuka] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['cooperative', 'portal', 'complaints'],
    queryFn: portalApi.pengaduan,
    retry: false,
  });

  return (
    <div className="space-y-4">
      {!baru && (
        <button
          type="button"
          onClick={() => setBaru(true)}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
        >
          Ajukan pengaduan
        </button>
      )}

      {baru && <FormulirBaru onSelesai={() => setBaru(false)} />}

      {isLoading && <p className="text-sm text-slate-500">Memuat pengaduan…</p>}

      {!isLoading && (data ?? []).length === 0 && !baru && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">
          Anda belum pernah mengajukan pengaduan.
        </div>
      )}

      <ul className="space-y-3">
        {(data ?? []).map((p) => (
          <li
            key={p.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
          >
            <button
              type="button"
              onClick={() => setTerbuka(terbuka === p.id ? null : p.id)}
              className="w-full p-4 text-left"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{p.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {p.complaint_number} · {LABEL_KATEGORI_PENGADUAN[p.category] ?? p.category} ·{' '}
                    {formatTanggal(p.submitted_at)}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    p.status === 'RESOLVED'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                      : p.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {LABEL_STATUS_PENGADUAN[p.status] ?? p.status}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-slate-600 dark:text-slate-400">
                {p.body}
              </p>
              {p.resolution && (
                <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm dark:bg-slate-800/60">
                  <span className="font-medium">Penyelesaian: </span>
                  {p.resolution}
                </p>
              )}
            </button>
            {terbuka === p.id && <Percakapan pengaduanId={p.id} />}
          </li>
        ))}
      </ul>

      {(data ?? []).length > 0 && (
        <p className="text-xs text-slate-500">
          Pengaduan yang sudah dinyatakan selesai dapat Anda buka kembali dengan menanggapinya.
          Penutupan pengaduan merupakan wewenang pengurus.
        </p>
      )}
    </div>
  );
}
