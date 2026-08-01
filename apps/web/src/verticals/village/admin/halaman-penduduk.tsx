/**
 * Layar D-2: kependudukan.
 *
 * ## Keterangan cakupan selalu tampil, dan itu bukan hiasan
 *
 * Petugas RT hanya melihat RT-nya. Ketika ia tidak melihat apa pun, sebabnya
 * dapat dua: memang tidak ada penduduk yang cocok, atau kewenangannya tidak
 * mencapai ke sana. Keduanya sangat berbeda, dan yang kedua tidak dapat
 * diperbaiki dengan mengubah kata pencarian.
 *
 * Layar yang menyamakan keduanya membuat petugas mencoba berulang kali,
 * menyimpulkan sistemnya rusak, lalu menelepon orang yang juga tidak tahu.
 *
 * ## NIK ditampilkan sebagian
 *
 * Empat angka terakhir cukup untuk membedakan dua orang yang namanya sama —
 * itulah satu-satunya keperluan NIK pada sebuah daftar. Nomor utuhnya ada pada
 * rincian, dan pembukaan rincian tercatat satu per satu.
 *
 * Daftar yang menampilkan NIK utuh berbaris-baris adalah daftar nomor identitas
 * yang terbaca dari antrean yang berdiri di belakang layar, dan dapat difoto
 * dalam satu kali jepret.
 */

import { useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { DataGrid, PageHeader, StatusBadge, Code, type GridColumn } from '../../../components/ui';
import { formatDate } from '../../../lib/api';
import { useBercakupan, type BarisDaftar, type Cakupan,
  usePesanGalat,
} from './useVillageAdmin';
import { cacahKolom, statusKolom, tanggalKolom, teksKolom, rtRwKolom } from './kolom';

/**
 * Keterangan cakupan.
 *
 * Nadanya sengaja netral, bukan peringatan. Cakupan yang sempit adalah keadaan
 * normal bagi ketua RT, bukan kesalahan yang perlu diperbaiki — dan kotak merah
 * di atas layar yang ia buka setiap hari akan berhenti terbaca dalam seminggu.
 */
function KeteranganCakupan({ scope, jumlah }: { scope?: Cakupan; jumlah: number }) {
  if (!scope) return null;
  const seluruhnya = scope.level === 'UNIT';

  return (
    <div
      className={`mb-4 flex items-start gap-2 rounded-lg border p-3 text-sm ${
        seluruhnya
          ? 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300'
          : 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200'
      }`}
    >
      <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
      <div>
        <span>{scope.description ?? `Cakupan: ${scope.level}`}</span>
        {!seluruhnya && jumlah === 0 && (
          <span className="mt-1 block text-xs">
            Daftar kosong bisa berarti dua hal: memang tidak ada yang cocok, atau datanya berada di
            luar cakupan Anda. Bila Anda memerlukan cakupan yang lebih luas, mintalah kepada
            operator desa — jangan mencoba mencari dengan kata lain.
          </span>
        )}
      </div>
    </div>
  );
}

/** Empat angka terakhir NIK. Sisanya diganti titik, bukan dihapus. */
function nikSebagian(nilai: unknown): string {
  const s = String(nilai ?? '');
  if (s.length < 4) return '—';
  return `••••••••••••${s.slice(-4)}`;
}

// --- Data penduduk -----------------------------------------------------------

export function PendudukPage() {
  const toMessage = usePesanGalat();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');

  const kueri = useBercakupan('/village/residents', 'residents', { q, status });
  const rows = kueri.data?.rows ?? [];

  const kolom: Array<GridColumn<BarisDaftar>> = [
    {
      key: 'full_name',
      header: 'Nama',
      render: (r) => (
        <div>
          <div className="text-sm text-slate-900 dark:text-slate-100">{String(r.full_name)}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            <Code>{nikSebagian(r.national_id)}</Code>
            {/*
              NIK yang ditandai bermasalah ditunjukkan di sini. Menyembunyikannya
              berarti petugas menerbitkan surat memakai nomor yang sudah
              diketahui keliru, lalu warga yang menanggung akibatnya di kantor
              lain.
            */}
            {(r.national_id_flagged === true || r.national_id_flagged === 'true') && (
              <span className="ms-2 text-amber-700 dark:text-amber-400">NIK perlu diperiksa</span>
            )}
          </div>
        </div>
      ),
    },
    teksKolom('gender', 'Jenis Kelamin'),
    {
      key: 'birth_date',
      header: 'Lahir',
      render: (r) => formatDate(r.birth_date as string | null),
    },
    teksKolom('family_relation', 'Hubungan Keluarga'),
    rtRwKolom(),
    statusKolom('resident_status', 'Status'),
  ];

  return (
    <div>
      <PageHeader
        title="Data Penduduk"
        description="Setiap pembacaan pada layar ini tercatat, termasuk pencarian."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Cari nama atau NIK
          </span>
          <input
            className="field-input w-72 py-1.5 text-sm"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
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
            <option value="TETAP">Tetap</option>
            <option value="SEMENTARA">Sementara</option>
            <option value="PINDAH">Pindah</option>
            <option value="MENINGGAL">Meninggal</option>
          </select>
        </label>
      </div>

      <KeteranganCakupan scope={kueri.data?.scope} jumlah={rows.length} />

      <DataGrid<BarisDaftar>
        columns={kolom}
        rows={rows}
        loading={kueri.isLoading}
        error={kueri.isError ? toMessage(kueri.error) : undefined}
        onRetry={() => kueri.refetch()}
        emptyTitle="Tidak ada penduduk yang cocok"
        rowKey={(r) => String(r.id)}
      />

      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
        NIK ditampilkan empat angka terakhir. Itu cukup untuk membedakan dua orang yang namanya
        sama, dan itulah satu-satunya keperluan NIK pada sebuah daftar. Nomor utuhnya ada pada
        rincian, dan pembukaan rincian tercatat satu per satu.
      </p>
    </div>
  );
}

// --- Kartu keluarga ----------------------------------------------------------

export function KeluargaPage() {
  const toMessage = usePesanGalat();
  const [q, setQ] = useState('');

  const kueri = useBercakupan('/village/families', 'families', { q });
  const rows = kueri.data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Kartu Keluarga"
        description="Susunan keluarga beserta kepala keluarganya."
      />

      <div className="mb-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Cari alamat
          </span>
          <input
            className="field-input w-72 py-1.5 text-sm"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
      </div>

      <KeteranganCakupan scope={kueri.data?.scope} jumlah={rows.length} />

      <DataGrid<BarisDaftar>
        columns={[
          teksKolom('head_name', 'Kepala Keluarga'),
          cacahKolom('member_count', 'Anggota', 'orang'),
          teksKolom('address', 'Alamat'),
          rtRwKolom(),
          teksKolom('welfare_status', 'Kesejahteraan'),
          teksKolom('house_ownership', 'Status Rumah'),
        ]}
        rows={rows}
        loading={kueri.isLoading}
        error={kueri.isError ? toMessage(kueri.error) : undefined}
        onRetry={() => kueri.refetch()}
        emptyTitle="Tidak ada kartu keluarga yang cocok"
        rowKey={(r) => String(r.id)}
      />

      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
        Nomor kartu keluarga tidak ditampilkan. Ia dipakai sebagai pengenal pada banyak layanan di
        luar sistem ini, sehingga daftar yang menampilkannya berbaris-baris di layar loket adalah
        daftar nomor identitas yang terbaca dari antrean.
      </p>
    </div>
  );
}

// --- Peristiwa penting -------------------------------------------------------

export function PeristiwaPage() {
  const toMessage = usePesanGalat();
  const [jenis, setJenis] = useState('');
  const [status, setStatus] = useState('');

  const kueri = useBercakupan('/village/vital-events', 'vital-events', { jenis, status });
  const rows = kueri.data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Kelahiran, Kematian, dan Mutasi"
        description="Peristiwa penting kependudukan yang dicatat desa."
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Jenis peristiwa
          </span>
          <select
            className="field-input w-44 py-1.5 text-sm"
            value={jenis}
            onChange={(e) => setJenis(e.target.value)}
          >
            <option value="">Semua</option>
            <option value="KELAHIRAN">Kelahiran</option>
            <option value="KEMATIAN">Kematian</option>
            <option value="PINDAH_KELUAR">Pindah keluar</option>
            <option value="PINDAH_MASUK">Pindah masuk</option>
          </select>
        </label>
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
            <option value="DIAJUKAN">Diajukan</option>
            <option value="DISETUJUI">Disetujui</option>
            <option value="DITOLAK">Ditolak</option>
          </select>
        </label>
      </div>

      <KeteranganCakupan scope={kueri.data?.scope} jumlah={rows.length} />

      <DataGrid<BarisDaftar>
        columns={[
          tanggalKolom('event_date', 'Tanggal'),
          {
            key: 'event_type',
            header: 'Peristiwa',
            render: (r) => <StatusBadge status={String(r.event_type ?? '-')} tone="neutral" />,
          },
          teksKolom('resident_name', 'Penduduk'),
          teksKolom('child_name', 'Nama Anak'),
          teksKolom('event_place', 'Tempat'),
          rtRwKolom(),
          statusKolom('status'),
        ]}
        rows={rows}
        loading={kueri.isLoading}
        error={kueri.isError ? toMessage(kueri.error) : undefined}
        onRetry={() => kueri.refetch()}
        emptyTitle="Belum ada peristiwa yang tercatat"
        rowKey={(r) => String(r.id)}
      />

      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
        Sebab kematian tidak ditampilkan di daftar ini. Ia keterangan medis yang masuk lewat surat
        keterangan, dan daftar yang menampilkannya membuat riwayat penyakit satu keluarga terbaca
        siapa pun yang membuka layar ini.
      </p>
    </div>
  );
}

// --- Penduduk rentan ---------------------------------------------------------

export function RentanPage() {
  const toMessage = usePesanGalat();
  const [jenis, setJenis] = useState('');

  const kueri = useBercakupan('/village/vulnerable', 'vulnerable', { jenis });
  const rows = kueri.data?.rows ?? [];

  return (
    <div>
      <PageHeader
        title="Penduduk Rentan"
        description="Penyandang disabilitas, lanjut usia, dan warga yang memerlukan perhatian khusus."
      />

      {/*
        Peringatan ini berbeda dari keterangan cakupan, dan sengaja ada di layar
        ini saja. Isinya persis daftar yang paling ingin dipegang orang untuk
        keperluan yang bukan pelayanan, dan petugas yang membukanya perlu tahu
        bahwa pembukaannya tercatat — bukan sebagai ancaman, melainkan supaya ia
        tidak membukanya untuk keperluan yang tidak dapat ia jelaskan kemudian.
      */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
        <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
        <span>
          Pembacaan daftar ini tercatat tersendiri, terpisah dari pembacaan data penduduk biasa.
          Gunakan hanya untuk keperluan pelayanan.
        </span>
      </div>

      <div className="mb-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
            Jenis disabilitas
          </span>
          <input
            className="field-input w-56 py-1.5 text-sm"
            type="search"
            value={jenis}
            onChange={(e) => setJenis(e.target.value)}
          />
        </label>
      </div>

      <KeteranganCakupan scope={kueri.data?.scope} jumlah={rows.length} />

      <DataGrid<BarisDaftar>
        columns={[
          teksKolom('full_name', 'Nama'),
          teksKolom('gender', 'Jenis Kelamin'),
          {
            key: 'birth_date',
            header: 'Lahir',
            render: (r) => formatDate(r.birth_date as string | null),
          },
          teksKolom('disability_type', 'Disabilitas'),
          teksKolom('social_condition', 'Keadaan Sosial'),
          rtRwKolom(),
          statusKolom('resident_status', 'Status'),
        ]}
        rows={rows}
        loading={kueri.isLoading}
        error={kueri.isError ? toMessage(kueri.error) : undefined}
        onRetry={() => kueri.refetch()}
        emptyTitle="Tidak ada penduduk rentan yang cocok"
        rowKey={(r) => String(r.id)}
      />

      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
        Alamat dan nomor telepon tidak ditampilkan di daftar ini. Yang dibutuhkan dari layar ini
        adalah siapa dan di RT mana; petugas yang memang perlu mendatangi membuka rinciannya
        seorang demi seorang.
      </p>
    </div>
  );
}
