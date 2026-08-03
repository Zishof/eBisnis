/**
 * Landing PSB publik -- daftar gelombang penerimaan (dibuka/ditutup/selesai),
 * BUKAN langsung formulir pendaftaran. Referensi UX sistem lama:
 * `_gelombang_ppdb.jsp` (kartu gelombang + lencana status + tombol) dan
 * `_sebelum_login.jsp` (tata letak dua kolom: gelombang di kolom utama,
 * "Informasi Terkini" di kolom samping).
 *
 * Gelombang yang sudah DITUTUP/SELESAI tetap ditampilkan DAN tetap
 * mengarah ke formulir (`PsbPendaftaranPage`, di
 * `/santri/pondok/psb/daftar/:gelombangId`) -- sengaja BUKAN tombol mati.
 * Halaman formulir sendiri yang menolak dan menjelaskan gelombangnya
 * sudah tutup (lihat guard di sana). Pengunjung yang penasaran ("kok
 * gelombang lama masih kelihatan, apa masih bisa daftar?") karena itu
 * selalu mendapat jawaban eksplisit lewat klik, bukan tombol yang diam
 * saja tanpa penjelasan.
 *
 * Kolom "Informasi" memakai BERITA yang sudah diterbitkan pengurus (tidak
 * ada tabel pengumuman PSB terpisah -- berita yang sudah ada di beranda
 * pondok sudah menjawab kebutuhan yang sama: "apa yang sedang terjadi").
 */

import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Newspaper } from 'lucide-react';
import { apiRequest, formatDate, formatMoney } from '../../lib/api';

interface Gelombang {
  id: string;
  kode: string;
  nama: string;
  tanggal_buka: string;
  tanggal_tutup: string;
  biaya_pendaftaran: string;
  status: string;
  unit_pendidikan_id: string | null;
  unit_pendidikan_nama: string | null;
}

/** Gelombang tanpa unit -- berlaku lintas seluruh unit pendidikan. */
const KUNCI_UMUM = '__umum__';
const LABEL_UMUM = 'Umum (Seluruh Unit)';

/**
 * Dikelompokkan per unit -- gelombang MI bisa berbeda jadwal/kuota/biaya
 * dari gelombang Madrasah Diniyah atau BLK, jadi tidak digabung jadi satu
 * daftar rata (lihat migrasi `20260803T070000`). Kelompok "Umum" (gelombang
 * lintas-unit) selalu ditaruh PALING AKHIR -- bukan sesuatu yang dicari
 * pengunjung yang sudah tahu unit mana yang dituju anaknya.
 */
function kelompokkanPerUnit(daftar: Gelombang[]): Array<{ kunci: string; label: string; item: Gelombang[] }> {
  const kelompok = new Map<string, { label: string; item: Gelombang[] }>();
  for (const g of daftar) {
    const kunci = g.unit_pendidikan_id ?? KUNCI_UMUM;
    const label = g.unit_pendidikan_nama ?? LABEL_UMUM;
    if (!kelompok.has(kunci)) kelompok.set(kunci, { label, item: [] });
    kelompok.get(kunci)!.item.push(g);
  }
  const hasil = Array.from(kelompok.entries()).map(([kunci, v]) => ({ kunci, ...v }));
  hasil.sort((a, b) => {
    if (a.kunci === KUNCI_UMUM) return 1;
    if (b.kunci === KUNCI_UMUM) return -1;
    return a.label.localeCompare(b.label, 'id');
  });
  return hasil;
}

interface Berita {
  id: string;
  judul: string;
  ringkasan: string | null;
  tanggal_terbit: string | null;
}

interface IsiSitus {
  profil: { nama_tampilan: string | null };
  berita: Berita[];
}

const LENCANA_STATUS: Record<string, { label: string; kelas: string }> = {
  DIBUKA: { label: 'Sedang Dibuka', kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' },
  DITUTUP: { label: 'Telah Ditutup', kelas: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
  SELESAI: { label: 'Selesai', kelas: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

export function PsbGelombangPage() {
  const { data: situs } = useQuery({
    queryKey: ['pesantren', 'situs-publik', 'psb-landing'],
    queryFn: () => apiRequest<IsiSitus>('/pesantren/public/site'),
    retry: false,
  });

  const { data: gelombang, isLoading } = useQuery({
    queryKey: ['pesantren', 'psb-gelombang-publik'],
    queryFn: () => apiRequest<Gelombang[]>('/pesantren/public/psb/gelombang'),
    retry: false,
  });

  const namaPondok = situs?.profil.nama_tampilan;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
        Penerimaan Santri Baru{namaPondok ? ` — ${namaPondok}` : ''}
      </h1>
      <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">
        Bismillah, pilih gelombang pendaftaran yang sedang dibuka untuk melanjutkan ke formulir.
      </p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Sudah pernah mendaftar?{' '}
        <Link to="/santri/pondok/psb/masuk" className="font-semibold text-emerald-700 hover:underline dark:text-emerald-400">
          Masuk ke portal pendaftar
        </Link>
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-3">
        {/* --- Kolom utama: daftar gelombang ------------------------------ */}
        <div className="space-y-4 lg:col-span-2">
          {isLoading ? (
            <p className="text-sm text-slate-500">Memuat gelombang…</p>
          ) : !gelombang || gelombang.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Belum ada gelombang pendaftaran yang pernah dibuka. Silakan hubungi pengurus pondok.
              </p>
            </div>
          ) : (
            kelompokkanPerUnit(gelombang).map((kelompok) => (
              <section key={kelompok.kunci}>
                <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {kelompok.label}
                </h2>
                <div className="mt-3 space-y-4">
                  {kelompok.item.map((g) => {
                    const lencana = LENCANA_STATUS[g.status] ?? LENCANA_STATUS.DITUTUP;
                    const bukaKembali = g.status === 'DIBUKA';
                    return (
                      <div
                        key={g.id}
                        className={`rounded-2xl border p-5 sm:flex sm:items-center sm:justify-between sm:gap-4 ${
                          bukaKembali
                            ? 'border-emerald-200 bg-white dark:border-emerald-900 dark:bg-slate-900'
                            : 'border-slate-200 bg-slate-50 opacity-80 dark:border-slate-800 dark:bg-slate-900/40'
                        }`}
                      >
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${lencana.kelas}`}>
                              {lencana.label}
                            </span>
                            <span className="text-xs text-slate-400">{g.kode}</span>
                          </div>
                          <h3 className="mt-2 font-bold text-slate-900 dark:text-white">{g.nama}</h3>
                          <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                            <CalendarDays className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                            {formatDate(g.tanggal_buka)} – {formatDate(g.tanggal_tutup)}
                          </p>
                          {Number(g.biaya_pendaftaran) > 0 && (
                            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                              Biaya pendaftaran: {formatMoney(g.biaya_pendaftaran)}
                            </p>
                          )}
                        </div>
                        <div className="mt-4 sm:mt-0">
                          <Link
                            to={`/santri/pondok/psb/daftar/${g.id}`}
                            className={`block rounded-lg px-5 py-2.5 text-center text-sm font-semibold ${
                              bukaKembali
                                ? 'bg-emerald-700 text-white hover:bg-emerald-800'
                                : 'border border-slate-300 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
                            }`}
                          >
                            {bukaKembali ? 'Daftar Sekarang' : 'Lihat Detail'}
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>

        {/* --- Kolom samping: informasi/kabar pondok ----------------------- */}
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
            <h2 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <Newspaper className="h-4 w-4" aria-hidden />
              Informasi Terkini
            </h2>
            {situs && situs.berita.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {situs.berita.slice(0, 5).map((b) => (
                  <li key={b.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0 dark:border-slate-800">
                    {b.tanggal_terbit && <p className="text-xs text-slate-400">{formatDate(b.tanggal_terbit)}</p>}
                    <Link
                      to={`/santri/pondok/berita/${b.id}`}
                      className="mt-1 block text-sm font-semibold text-slate-800 hover:text-emerald-700 dark:text-slate-200 dark:hover:text-emerald-400"
                    >
                      {b.judul}
                    </Link>
                    {b.ringkasan && <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">{b.ringkasan}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Belum ada informasi terbaru.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
