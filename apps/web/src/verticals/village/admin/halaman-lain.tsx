/**
 * Dua layar yang tidak muat pada kerangka daftar umum.
 *
 * **Penerima bantuan** memerlukan program dipilih lebih dahulu, dan itu bukan
 * keterbatasan teknis melainkan keputusan: tidak ada satu daftar berisi seluruh
 * penerima bantuan desa. Daftar semacam itu adalah pengumuman siapa yang miskin
 * di desa ini, dan begitu ia ada, ia akan difoto layar dan disebarkan.
 *
 * **Infrastruktur** menampilkan umur penilaian bersama kondisinya. "Jalan rusak
 * berat" yang dinilai tiga tahun lalu akan tetap masuk RKP setelah jalannya
 * diaspal — dan anggaran mengikuti pernyataan itu.
 */

import { useState } from 'react';
import { CalendarClock, HandHeart } from 'lucide-react';
import { DataGrid, EmptyState, PageHeader, StatusBadge, Code } from '../../../components/ui';
import { formatDate, formatDateTime, formatNumber } from '../../../lib/api';
import {
  useBacaDesa,
  useDaftarDesa,
  usePesanGalat,
  type BarisDaftar,
} from './useVillageAdmin';
import { cacahKolom, kodeKolom, statusKolom, teksKolom } from './kolom';

// --- Penerima bantuan --------------------------------------------------------

function nikSebagian(nilai: unknown): string {
  const s = String(nilai ?? '');
  return s.length < 4 ? '—' : `••••••••••••${s.slice(-4)}`;
}

export function PenerimaPage() {
  const toMessage = usePesanGalat();
  const [programId, setProgramId] = useState('');
  const [status, setStatus] = useState('');

  const program = useDaftarDesa('program-bantuan', {}, { limit: 200, offset: 0 });
  const calon = useBacaDesa<BarisDaftar[]>(
    `/village/aid/programs/${programId}/candidates${status ? `?status=${status}` : ''}`,
    ['aid-candidates', programId, status],
    Boolean(programId),
  );

  return (
    <div>
      <PageHeader
        title="Penerima Bantuan"
        description="Calon dan penerima, per program. Pilih programnya lebih dahulu."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Program bantuan
          </span>
          <select
            className="field-input w-80 py-1.5 text-sm"
            value={programId}
            onChange={(e) => setProgramId(e.target.value)}
          >
            <option value="">— pilih program —</option>
            {(program.data?.rows ?? []).map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {String(p.name)} ({String(p.fiscal_year ?? '')})
              </option>
            ))}
          </select>
        </label>
        {programId && (
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Keadaan
            </span>
            <select
              className="field-input w-52 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">Semua</option>
              <option value="DIUSULKAN">Diusulkan</option>
              <option value="DIVERIFIKASI">Sudah diverifikasi</option>
              <option value="LAYAK">Layak</option>
              <option value="TIDAK_LAYAK">Tidak layak</option>
              <option value="DITETAPKAN">Ditetapkan sebagai penerima</option>
            </select>
          </label>
        )}
      </div>

      {!programId ? (
        <div className="card p-8">
          <EmptyState
            title="Pilih program terlebih dahulu"
            description="Tidak ada satu daftar berisi seluruh penerima bantuan desa. Daftar semacam itu adalah pengumuman siapa yang miskin di desa ini — dan pada layar yang terbuka di kantor, ia dapat difoto dalam satu kali jepret."
          />
        </div>
      ) : (
        <>
          <DataGrid<BarisDaftar>
            columns={[
              {
                key: 'full_name',
                header: 'Nama',
                render: (r) => (
                  <div>
                    <div className="text-sm text-slate-900 dark:text-slate-100">
                      {String(r.full_name)}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      <Code>{nikSebagian(r.national_id)}</Code>
                    </div>
                  </div>
                ),
              },
              teksKolom('source', 'Sumber Usulan'),
              {
                key: 'score',
                header: 'Skor',
                className: 'text-end tabular-nums',
                render: (r) => (r.score === null || r.score === undefined ? '—' : formatNumber(r.score as string)),
              },
              {
                key: 'proposed_at',
                header: 'Diusulkan',
                render: (r) => formatDateTime(r.proposed_at as string | null),
              },
              {
                key: 'verified_at',
                header: 'Diverifikasi',
                render: (r) => formatDateTime(r.verified_at as string | null),
              },
              teksKolom('verification_note', 'Catatan Kunjungan'),
              teksKolom('rejection_reason', 'Alasan Tidak Layak'),
              statusKolom('status'),
            ]}
            rows={calon.data ?? []}
            loading={calon.isLoading}
            error={calon.isError ? toMessage(calon.error) : undefined}
            onRetry={() => calon.refetch()}
            emptyTitle="Belum ada calon pada program ini"
            rowKey={(r) => String(r.id)}
          />

          <div className="mt-4 flex max-w-3xl items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
            <HandHeart size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              Alasan tidak layak tampil di sini untuk petugas, <strong>bukan</strong> di aplikasi
              warga. Warga yang tidak menerima bantuan berhak mendapat jawaban dari seseorang yang
              dapat ditanyai balik dan mencatat keberatannya — kalimat penolakan yang muncul
              sendirian di layar ponsel lebih melukai daripada menjelaskan.
              <br />
              Penetapan penerima tidak dapat dilakukan sistem sendiri. Setiap penetapan menyimpan
              sesi petugas yang memutuskannya, ditegakkan basis data.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// --- Infrastruktur dan lingkungan --------------------------------------------

interface BarisInfra extends BarisDaftar {
  /** Bentuknya `TilikanKondisi` dari `village-safety.ts` di peladen. */
  assessment?: {
    kondisi: string;
    umurHari: number;
    kedaluwarsa: boolean;
    keterangan: string;
  } | null;
}

export function LingkunganPage() {
  const toMessage = usePesanGalat();
  const infra = useBacaDesa<BarisInfra[]>('/village/infrastructure', ['infrastructure']);

  return (
    <div>
      <PageHeader
        title="Infrastruktur dan Lingkungan"
        description="Jalan, jembatan, saluran, dan bangunan desa beserta kondisinya."
      />

      <DataGrid<BarisInfra>
        columns={[
          kodeKolom('code', 'Kode'),
          teksKolom('name', 'Nama'),
          teksKolom('infra_type', 'Jenis'),
          teksKolom('location_note', 'Lokasi'),
          {
            key: 'length_m',
            header: 'Ukuran',
            className: 'text-end tabular-nums',
            render: (r) => {
              const p = r.length_m ? `${formatNumber(r.length_m as string)} m` : null;
              const l = r.width_m ? `${formatNumber(r.width_m as string)} m` : null;
              if (!p && !l) return '—';
              return [p, l].filter(Boolean).join(' × ');
            },
          },
          cacahKolom('built_year', 'Dibangun'),
          {
            key: 'condition',
            header: 'Kondisi',
            render: (r) =>
              r.condition ? (
                <StatusBadge
                  status={String(r.condition).replace(/_/g, ' ')}
                  tone={
                    String(r.condition) === 'BAIK'
                      ? 'success'
                      : String(r.condition) === 'RUSAK_BERAT'
                        ? 'danger'
                        : 'warning'
                  }
                />
              ) : (
                <span className="text-xs italic text-slate-500 dark:text-slate-400">
                  belum dinilai
                </span>
              ),
          },
          {
            key: 'condition_assessed_at',
            header: 'Dinilai',
            // Umur penilaian tampil bersama tanggalnya. Angka kondisi tanpa
            // umurnya membuat penilaian tiga tahun lalu terbaca sama dengan
            // penilaian minggu lalu — dan anggaran mengikuti pernyataan itu.
            render: (r) => (
              <div>
                <div className="text-sm">{formatDate(r.condition_assessed_at as string | null)}</div>
                {r.assessment?.keterangan && (
                  <div
                    className={`text-xs ${
                      r.assessment.kedaluwarsa
                        ? 'text-amber-700 dark:text-amber-400'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {r.assessment.keterangan}
                  </div>
                )}
              </div>
            ),
          },
        ]}
        rows={infra.data ?? []}
        loading={infra.isLoading}
        error={infra.isError ? toMessage(infra.error) : undefined}
        onRetry={() => infra.refetch()}
        emptyTitle="Belum ada infrastruktur yang tercatat"
        rowKey={(r) => String(r.id)}
      />

      <div className="mt-4 flex max-w-3xl items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
        <CalendarClock size={14} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Kondisi yang sudah lama dinilai ditandai. Penilaian yang kedaluwarsa tetap dipakai
          menyusun RKP bila tidak ada yang menandainya, sehingga jalan yang sudah diaspal tahun lalu
          masih dianggarkan sebagai rusak berat.
        </span>
      </div>
    </div>
  );
}

// --- Aset desa ---------------------------------------------------------------

/**
 * Daftar aset beserta siapa yang sedang meminjamnya.
 *
 * Peminjaman ditampilkan pada baris asetnya, bukan pada layar terpisah. Petugas
 * yang ditanyai "kursinya masih ada?" sedang berdiri di depan warga yang ingin
 * meminjam; menyuruhnya membuka layar lain berarti ia akan menjawab dari
 * ingatan.
 */
export function AsetPage() {
  const toMessage = usePesanGalat();
  const [status, setStatus] = useState('');
  const [kondisi, setKondisi] = useState('');

  const q = new URLSearchParams();
  if (status) q.set('status', status);
  if (kondisi) q.set('kondisi', kondisi);
  const kueri = q.toString();

  const aset = useBacaDesa<BarisDaftar[]>(
    `/village/assets${kueri ? `?${kueri}` : ''}`,
    ['assets', status, kondisi],
  );

  return (
    <div>
      <PageHeader
        title="Aset Desa"
        description="Barang milik desa beserta keadaan dan peminjamannya."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Status
          </span>
          <select
            className="field-input w-44 py-1.5 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="TERSEDIA">Tersedia</option>
            <option value="DIPINJAM">Sedang dipinjam</option>
            <option value="DIPELIHARA">Dipelihara</option>
            <option value="DIHAPUSKAN">Dihapuskan</option>
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Kondisi
          </span>
          <select
            className="field-input w-44 py-1.5 text-sm"
            value={kondisi}
            onChange={(e) => setKondisi(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="BAIK">Baik</option>
            <option value="RUSAK_RINGAN">Rusak ringan</option>
            <option value="RUSAK_BERAT">Rusak berat</option>
          </select>
        </label>
      </div>

      <DataGrid<BarisDaftar>
        columns={[
          kodeKolom('register_number', 'Nomor Register'),
          teksKolom('name', 'Nama Barang'),
          teksKolom('category_name', 'Kategori'),
          kodeKolom('kib_group', 'KIB'),
          teksKolom('ownership', 'Kepemilikan'),
          {
            key: 'quantity',
            header: 'Jumlah',
            className: 'text-end tabular-nums',
            render: (r) =>
              r.quantity ? `${formatNumber(r.quantity as string)} ${r.unit ?? ''}`.trim() : '—',
          },
          teksKolom('location_note', 'Letak'),
          {
            key: 'condition',
            header: 'Kondisi',
            render: (r) =>
              r.condition ? (
                <StatusBadge
                  status={String(r.condition).replace(/_/g, ' ')}
                  tone={
                    String(r.condition) === 'BAIK'
                      ? 'success'
                      : String(r.condition) === 'RUSAK_BERAT'
                        ? 'danger'
                        : 'warning'
                  }
                />
              ) : (
                '—'
              ),
          },
          statusKolom('status'),
          {
            key: 'borrower_name',
            header: 'Dipinjam',
            // Nama peminjam DAN tenggatnya bersama-sama. Nama tanpa tenggat
            // tidak memberi tahu apakah ia sudah terlambat, dan itulah
            // satu-satunya hal yang perlu diketahui petugas dari kolom ini.
            render: (r) =>
              r.borrower_name ? (
                <div>
                  <div className="text-sm">{String(r.borrower_name)}</div>
                  {r.due_at != null && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      kembali {formatDate(r.due_at as string)}
                    </div>
                  )}
                </div>
              ) : (
                '—'
              ),
          },
        ]}
        rows={aset.data ?? []}
        loading={aset.isLoading}
        error={aset.isError ? toMessage(aset.error) : undefined}
        onRetry={() => aset.refetch()}
        emptyTitle="Belum ada aset yang tercatat"
        rowKey={(r) => String(r.id)}
      />

      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
        Satu barang tidak dapat dipinjamkan dua kali pada waktu yang sama, dan batas itu ditegakkan
        basis data — bukan hanya diperiksa layar. Dua petugas yang meminjamkan kursi yang sama pada
        detik yang sama tetap menghasilkan satu peminjaman.
      </p>
    </div>
  );
}
