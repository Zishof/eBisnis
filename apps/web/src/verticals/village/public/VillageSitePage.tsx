/**
 * Situs desa — halaman publik.
 *
 * Hanya membaca. Tidak ada formulir, tidak ada tombol kirim, tidak ada satu pun
 * pemanggilan selain `GET`.
 *
 * Tiga hal yang menentukan tampilannya, dan seluruhnya berasal dari siapa yang
 * membukanya:
 *
 * 1. **Gagal memuat dan "belum ada isi" ditampilkan berbeda.** Warga yang
 *    melihat "belum ada berita" padahal servernya bermasalah akan berhenti
 *    membukanya lagi.
 * 2. **Tarif destinasi selalu dinyatakan**, termasuk bila gratis. Yang belum
 *    dicantumkan ditulis apa adanya, bukan dikosongkan.
 * 3. **APBDes yang ditayangkan menyebut peraturan desanya.** Angka anggaran
 *    tanpa dasar hukum adalah angka yang tidak dapat ditanyakan kepada siapa
 *    pun.
 */

import { Link, useParams } from 'react-router-dom';
import {
  Building2,
  CalendarDays,
  Landmark,
  MapPin,
  Newspaper,
  Phone,
  Store,
  Trees,
} from 'lucide-react';
import { EmptyState, ErrorState, LoadingState } from '../../../components/ui';
import { formatDate, formatDateTime } from '../../../lib/api';
import {
  rupiah,
  tarifMasuk,
  useAgendaDesa,
  useApbdesDesa,
  useBeritaDesa,
  useProfilDesa,
  useUmkmDesa,
  useWisataDesa,
} from './useVillagePublic';

function Bagian({
  judul,
  ikon,
  keterangan,
  children,
}: {
  judul: string;
  ikon: React.ReactNode;
  keterangan?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 py-10 dark:border-slate-800">
      <div className="mb-6 flex items-start gap-3">
        <span className="mt-1 text-slate-500 dark:text-slate-400">{ikon}</span>
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{judul}</h2>
          {keterangan ? (
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{keterangan}</p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

export function VillageSitePage() {
  const { slug = '' } = useParams();

  const profil = useProfilDesa(slug);
  const berita = useBeritaDesa(slug, 6);
  const agenda = useAgendaDesa(slug);
  const wisata = useWisataDesa(slug);
  const umkm = useUmkmDesa(slug);
  const apbdes = useApbdesDesa(slug);

  if (profil.isLoading) return <LoadingState label="Memuat profil desa…" />;
  if (profil.isError) {
    return (
      <div className="container-page py-16">
        <ErrorState
          message="Situs desa ini tidak dapat dimuat."
          onRetry={() => void profil.refetch()}
        />
      </div>
    );
  }

  const p = profil.data!;
  const sebutan = p.profileType === 'DESA' ? 'Desa' : 'Kelurahan';

  return (
    <div className="container-page py-10">
      {/* --- Kepala ------------------------------------------------------- */}
      <header className="pb-8">
        <p className="text-sm uppercase tracking-wide text-slate-500 dark:text-slate-400">
          Pemerintah {sebutan}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">{p.name}</h1>
        {p.motto ? (
          <p className="mt-2 text-lg italic text-slate-600 dark:text-slate-300">“{p.motto}”</p>
        ) : null}

        <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {p.districtName ? (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Kecamatan</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{p.districtName}</dd>
            </div>
          ) : null}
          {p.regencyName ? (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Kabupaten/Kota</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{p.regencyName}</dd>
            </div>
          ) : null}
          {p.provinceName ? (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Provinsi</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">{p.provinceName}</dd>
            </div>
          ) : null}
          {p.administrativeCode ? (
            <div>
              <dt className="text-slate-500 dark:text-slate-400">Kode wilayah</dt>
              <dd className="font-medium text-slate-900 dark:text-slate-100">
                {p.administrativeCode}
              </dd>
            </div>
          ) : null}
        </dl>

        {(p.address || p.phone || p.email) && (
          <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
            {p.address ? (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} aria-hidden /> {p.address}
              </span>
            ) : null}
            {p.phone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone size={15} aria-hidden /> {p.phone}
              </span>
            ) : null}
            {p.email ? <span>{p.email}</span> : null}
          </div>
        )}
      </header>

      {/* --- Berita ------------------------------------------------------- */}
      <Bagian judul="Berita" ikon={<Newspaper size={20} aria-hidden />}>
        {berita.isLoading ? (
          <LoadingState />
        ) : berita.isError ? (
          // Gagal memuat TIDAK ditampilkan sama dengan "belum ada berita".
          <ErrorState message="Berita tidak dapat dimuat." onRetry={() => void berita.refetch()} />
        ) : !berita.data?.length ? (
          <EmptyState title="Belum ada berita" description="Pemerintah desa belum menayangkan berita." />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {berita.data.map((b) => (
              <li
                key={b.id}
                className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
              >
                <Link
                  to={`/desa/${slug}/berita/${b.slug}`}
                  className="font-semibold text-slate-900 hover:underline dark:text-slate-100"
                >
                  {b.title}
                </Link>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {b.publishedAt ? formatDate(b.publishedAt) : '—'}
                  {b.authorName ? ` · ${b.authorName}` : ''}
                </p>
                {b.summary ? (
                  <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-300">
                    {b.summary}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      {/* --- Agenda ------------------------------------------------------- */}
      <Bagian
        judul="Agenda"
        ikon={<CalendarDays size={20} aria-hidden />}
        keterangan="Kegiatan yang terbuka untuk warga. Rapat internal perangkat desa tidak ditayangkan di sini."
      >
        {agenda.isLoading ? (
          <LoadingState />
        ) : agenda.isError ? (
          <ErrorState message="Agenda tidak dapat dimuat." onRetry={() => void agenda.refetch()} />
        ) : !agenda.data?.length ? (
          <EmptyState title="Belum ada agenda" description="Tidak ada kegiatan yang dijadwalkan." />
        ) : (
          <ul className="divide-y divide-slate-200 dark:divide-slate-800">
            {agenda.data.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-3">
                <span className="min-w-[11rem] text-sm text-slate-500 dark:text-slate-400">
                  {formatDateTime(a.startAt)}
                </span>
                <span className="font-medium text-slate-900 dark:text-slate-100">{a.title}</span>
                {a.location ? (
                  <span className="text-sm text-slate-600 dark:text-slate-300">· {a.location}</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      {/* --- Wisata ------------------------------------------------------- */}
      <Bagian judul="Wisata Desa" ikon={<Trees size={20} aria-hidden />}>
        {wisata.isLoading ? (
          <LoadingState />
        ) : wisata.isError ? (
          <ErrorState message="Data wisata tidak dapat dimuat." onRetry={() => void wisata.refetch()} />
        ) : !wisata.data?.length ? (
          <EmptyState title="Belum ada destinasi" />
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2">
            {wisata.data.map((w) => (
              <li key={w.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{w.name}</p>
                {w.category ? (
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {w.category}
                  </p>
                ) : null}
                {w.description ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{w.description}</p>
                ) : null}
                <dl className="mt-3 grid gap-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-slate-500 dark:text-slate-400">Tarif masuk</dt>
                    {/* Selalu dinyatakan. Destinasi tanpa tarif yang tercantum
                        adalah destinasi yang tarifnya ditentukan di pintu masuk. */}
                    <dd className="font-medium text-slate-900 dark:text-slate-100">
                      {tarifMasuk(w)}
                    </dd>
                  </div>
                  {w.openHours ? (
                    <div className="flex gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Jam buka</dt>
                      <dd className="text-slate-900 dark:text-slate-100">{w.openHours}</dd>
                    </div>
                  ) : null}
                  {w.managerName ? (
                    <div className="flex gap-2">
                      <dt className="text-slate-500 dark:text-slate-400">Pengelola</dt>
                      <dd className="text-slate-900 dark:text-slate-100">
                        {w.managerName}
                        {w.managerContact ? ` · ${w.managerContact}` : ''}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      {/* --- UMKM --------------------------------------------------------- */}
      <Bagian judul="UMKM Desa" ikon={<Store size={20} aria-hidden />}>
        {umkm.isLoading ? (
          <LoadingState />
        ) : umkm.isError ? (
          <ErrorState message="Data UMKM tidak dapat dimuat." onRetry={() => void umkm.refetch()} />
        ) : !umkm.data?.length ? (
          <EmptyState title="Belum ada UMKM yang ditayangkan" />
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {umkm.data.map((u) => (
              <li key={u.id} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                <p className="font-semibold text-slate-900 dark:text-slate-100">{u.businessName}</p>
                {u.businessSector ? (
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {u.businessSector}
                  </p>
                ) : null}
                {u.description ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{u.description}</p>
                ) : null}
                {u.phone ? (
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{u.phone}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Bagian>

      {/* --- APBDes ------------------------------------------------------- */}
      <Bagian
        judul="Transparansi APBDes"
        ikon={<Landmark size={20} aria-hidden />}
        keterangan="Ringkasan anggaran yang sudah ditetapkan beserta peraturan desanya."
      >
        {apbdes.isLoading ? (
          <LoadingState />
        ) : apbdes.isError ? (
          <ErrorState message="Ringkasan APBDes tidak dapat dimuat." onRetry={() => void apbdes.refetch()} />
        ) : !apbdes.data?.length ? (
          <EmptyState
            title="Belum ada APBDes yang ditetapkan"
            description="Anggaran yang masih dibahas belum ditayangkan."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                  <th className="py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">Tahun</th>
                  <th className="py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">
                    Pendapatan
                  </th>
                  <th className="py-2 pr-4 font-medium text-slate-500 dark:text-slate-400">Belanja</th>
                  <th className="py-2 font-medium text-slate-500 dark:text-slate-400">
                    Dasar penetapan
                  </th>
                </tr>
              </thead>
              <tbody>
                {apbdes.data.map((a) => (
                  <tr
                    key={a.fiscalYear}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800/60"
                  >
                    <td className="py-2 pr-4 font-medium text-slate-900 dark:text-slate-100">
                      {a.fiscalYear}
                    </td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">
                      {rupiah(a.totalRevenue)}
                    </td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">
                      {rupiah(a.totalExpenditure)}
                    </td>
                    {/* Angka anggaran tanpa dasar hukum adalah angka yang tidak
                        dapat ditanyakan kepada siapa pun. */}
                    <td className="py-2 text-slate-700 dark:text-slate-200">
                      {a.regulationNumber ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bagian>

      <footer className="border-t border-slate-200 py-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
        <p className="inline-flex items-center gap-1.5">
          <Building2 size={15} aria-hidden /> Situs resmi Pemerintah {sebutan} {p.name}
        </p>
        <p className="mt-1">
          Halaman ini hanya menampilkan informasi. Layanan yang memerlukan identitas dilakukan
          melalui portal warga setelah masuk.
        </p>
      </footer>
    </div>
  );
}
