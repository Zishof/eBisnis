/**
 * Detail satu berita pondok, di `/santri/pondok/berita/:id`.
 *
 * Sebelumnya tautan berita (dari `PsbGelombangPage`/beranda) tidak punya
 * halaman tujuan sendiri -- kembali ke beranda begitu saja. Halaman ini
 * memanggil `GET /pesantren/public/berita/:id` yang sudah ada sejak awal
 * (dipakai `PesantrenPublicController.berita`) tapi belum pernah punya
 * halaman yang menampilkannya secara utuh (`isi_html`, bukan cuma
 * `ringkasan` yang tampil di kartu daftar berita).
 */

import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { apiRequest, formatDate } from '../../lib/api';

interface BeritaDetail {
  id: string;
  judul: string;
  ringkasan: string | null;
  isi_html: string;
  gambar_url: string | null;
  sumber_url: string | null;
  tanggal_terbit: string | null;
}

export function BeritaDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: berita, isLoading, isError } = useQuery({
    queryKey: ['pesantren', 'berita-publik', id],
    queryFn: () => apiRequest<BeritaDetail>(`/pesantren/public/berita/${id}`),
    retry: false,
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-slate-500">Memuat…</div>;
  }

  if (isError || !berita) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Berita Tidak Ditemukan</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Berita ini mungkin sudah dihapus atau belum diterbitkan.
        </p>
        <Link
          to="/santri/pondok"
          className="mt-6 inline-block rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800"
        >
          Kembali ke Beranda Pondok
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <Link
        to="/santri/pondok"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Kembali ke beranda pondok
      </Link>

      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{berita.judul}</h1>
      {berita.tanggal_terbit && (
        <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400">
          <CalendarDays className="h-4 w-4 shrink-0" aria-hidden />
          {formatDate(berita.tanggal_terbit)}
        </p>
      )}

      {berita.gambar_url && (
        <img src={berita.gambar_url} alt="" className="mt-6 w-full rounded-2xl object-cover" style={{ maxHeight: 360 }} />
      )}

      <div
        className="prose prose-slate mt-6 max-w-none dark:prose-invert"
        // Ditulis pengurus lewat menu Berita, bukan diterima dari pengunjung.
        dangerouslySetInnerHTML={{ __html: berita.isi_html }}
      />

      {berita.sumber_url && (
        <a
          href={berita.sumber_url}
          target="_blank"
          rel="noreferrer"
          className="mt-6 inline-block text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
        >
          Sumber liputan →
        </a>
      )}
    </div>
  );
}
