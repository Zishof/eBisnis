/**
 * Layar D-1: profil wilayah, dusun/RW/RT, domain, dan potensi.
 *
 * Tidak memakai kerangka daftar umum, sebab keempatnya bukan tabel panjang
 * melainkan susunan yang saling bertingkat dan keterangan yang perlu dibaca
 * sekaligus.
 */

import { useState } from 'react';
import { Globe, Landmark, MapPin } from 'lucide-react';
import {
  DataGrid,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  Code,
  type GridColumn,
} from '../../../components/ui';
import { formatDateTime, formatNumber } from '../../../lib/api';
import {
  useBacaDesa,
  useKelayakan,
  useUnitDesa,
  type BarisDaftar,
  usePesanGalat,
} from './useVillageAdmin';
import { cacahKolom, kodeKolom, teksKolom, yaTidakKolom } from './kolom';

// --- Profil ------------------------------------------------------------------

export function ProfilWilayahPage() {
  const toMessage = usePesanGalat();
  const unit = useUnitDesa();
  const kelayakan = useKelayakan();
  const batas = useBacaDesa<Array<{ direction: string; adjacent_name: string; note?: string }>>(
    '/village/boundaries',
    ['boundaries'],
  );

  if (unit.isLoading) return <LoadingState />;
  if (unit.isError) {
    return <ErrorState message={toMessage(unit.error)} onRetry={() => unit.refetch()} />;
  }

  const u = unit.data!;
  const desa = u.profileType === 'DESA';

  // Fitur yang dapat dinyalakan penyewa, dipisahkan dari yang memang tidak
  // berlaku bagi profilnya. Keduanya sama-sama "tidak aktif" di layar lain, dan
  // menyamakannya membuat petugas kelurahan mencari sakelar yang tidak ada.
  const fitur = Object.entries(kelayakan.data?.features ?? {});
  const dapatDinyalakan = fitur.filter(([, f]) => f.eligibility === 'CONFIGURABLE');
  const tidakBerlaku = fitur.filter(([, f]) => !f.allowed && f.eligibility !== 'CONFIGURABLE');

  return (
    <div>
      <PageHeader
        title={u.name}
        description={`Profil ${desa ? 'desa' : 'kelurahan'} dan fitur yang berlaku baginya.`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <Landmark size={16} aria-hidden />
            Identitas
          </h2>
          <dl className="space-y-3 text-sm">
            <Baris label="Nama">{u.name}</Baris>
            <Baris label="Jenis">
              <StatusBadge status={desa ? 'Desa' : 'Kelurahan'} tone="brand" />
            </Baris>
            <Baris label="Kode">
              <Code>{u.code}</Code>
            </Baris>
            <Baris label="Kode Wilayah">
              {u.administrativeCode ? <Code>{u.administrativeCode}</Code> : '—'}
            </Baris>
            <Baris label="Alamat Situs">
              <Code>{`/desa/${u.slug}`}</Code>
            </Baris>
          </dl>

          {/*
            Perbedaan desa dan kelurahan bukan istilah. Desa mengelola anggaran
            sendiri; kelurahan menerima pagu dari pemerintah kota/kabupaten.
            Ditulis di sini supaya petugas yang bertanya "mengapa menu APBDes
            tidak ada" menemukan jawabannya tanpa menghubungi siapa pun.
          */}
          <p className="mt-4 border-t border-slate-200 pt-4 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
            {desa
              ? 'Desa menyusun dan menetapkan anggarannya sendiri lewat APBDes, memiliki BPD, dan dapat mendirikan BUMDes.'
              : 'Kelurahan menerima pagu dari pemerintah daerah, tidak menyusun APBDes, dan tidak memiliki BPD maupun BUMDes. Menu-menu itu memang tidak tersedia — bukan belum disiapkan.'}
          </p>
        </section>

        <section className="card p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
            <MapPin size={16} aria-hidden />
            Batas Wilayah
          </h2>
          {batas.isLoading ? (
            <LoadingState />
          ) : batas.isError ? (
            <ErrorState message={toMessage(batas.error)} onRetry={() => batas.refetch()} />
          ) : !batas.data?.length ? (
            <EmptyState title="Batas wilayah belum diisi" />
          ) : (
            <dl className="space-y-3 text-sm">
              {batas.data.map((b) => (
                <Baris key={b.direction} label={b.direction}>
                  {b.adjacent_name}
                  {b.note && (
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{b.note}</span>
                  )}
                </Baris>
              ))}
            </dl>
          )}
        </section>
      </div>

      {dapatDinyalakan.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Fitur yang dapat dinyalakan
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Bawaannya <strong>mati</strong>. Kewenangan yang tidak dinyatakan tidak dianggap ada.
          </p>
          <div className="flex flex-wrap gap-2">
            {dapatDinyalakan.map(([kode, f]) => (
              <span
                key={kode}
                className={`badge ${
                  f.allowed
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}
                title={f.reason ?? undefined}
              >
                {kode}
              </span>
            ))}
          </div>
        </section>
      )}

      {tidakBerlaku.length > 0 && (
        <section className="card mt-4 p-5">
          <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
            Tidak berlaku bagi {desa ? 'desa' : 'kelurahan'}
          </h2>
          <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
            Bukan belum disiapkan, dan tidak dapat dinyalakan. Endpoint-nya menolak, bukan hanya
            menunya disembunyikan.
          </p>
          <div className="flex flex-wrap gap-2">
            {tidakBerlaku.map(([kode]) => (
              <span key={kode} className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                {kode}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="shrink-0 text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {label}
      </dt>
      <dd className="text-end text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

// --- Dusun, RW, RT -----------------------------------------------------------

const KOLOM_SUB: Array<GridColumn<BarisDaftar>> = [
  kodeKolom('code', 'Kode'),
  teksKolom('name', 'Nama'),
  teksKolom('kind', 'Jenis'),
  teksKolom('head_name', 'Kepala'),
  teksKolom('head_phone', 'Telepon'),
  teksKolom('area_km2', 'Luas (km²)'),
];

const KOLOM_RW: Array<GridColumn<BarisDaftar>> = [
  kodeKolom('number', 'Nomor RW'),
  teksKolom('name', 'Nama'),
  teksKolom('sub_area_name', 'Dusun/Lingkungan'),
  teksKolom('head_name', 'Ketua'),
  cacahKolom('rt_count', 'Jumlah RT'),
];

const KOLOM_RT: Array<GridColumn<BarisDaftar>> = [
  kodeKolom('number', 'Nomor RT'),
  kodeKolom('rw_number', 'RW'),
  teksKolom('head_name', 'Ketua'),
  cacahKolom('household_count', 'Jumlah KK'),
];

export function WilayahPage() {
  const toMessage = usePesanGalat();
  const unit = useUnitDesa();
  const [tab, setTab] = useState<'sub' | 'rw' | 'rt'>('sub');

  const sub = useBacaDesa<BarisDaftar[]>('/village/sub-areas', ['sub-areas'], tab === 'sub');
  const rw = useBacaDesa<BarisDaftar[]>('/village/rw', ['rw'], tab === 'rw');
  const rt = useBacaDesa<BarisDaftar[]>('/village/rt', ['rt'], tab === 'rt');

  const desa = unit.data?.profileType !== 'KELURAHAN';
  const namaSub = desa ? 'Dusun' : 'Lingkungan';
  const aktif = tab === 'sub' ? sub : tab === 'rw' ? rw : rt;
  const kolom = tab === 'sub' ? KOLOM_SUB : tab === 'rw' ? KOLOM_RW : KOLOM_RT;

  return (
    <div>
      <PageHeader
        title="Pembagian Wilayah"
        description={`${namaSub}, RW, dan RT. Jenis sub-wilayah ditentukan profil ${desa ? 'desa' : 'kelurahan'}, bukan dipilih.`}
      />

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            ['sub', namaSub],
            ['rw', 'RW'],
            ['rt', 'RT'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            type="button"
            onClick={() => setTab(nilai)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === nilai
                ? 'border-brand-700 text-brand-800 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <DataGrid<BarisDaftar>
        columns={kolom}
        rows={aktif.data ?? []}
        loading={aktif.isLoading}
        error={aktif.isError ? toMessage(aktif.error) : undefined}
        onRetry={() => aktif.refetch()}
        emptyTitle={`Belum ada ${tab === 'sub' ? namaSub.toLowerCase() : tab.toUpperCase()}`}
        rowKey={(r) => String(r.id)}
      />
    </div>
  );
}

// --- Domain ------------------------------------------------------------------

export function DomainPage() {
  const toMessage = usePesanGalat();
  const domain = useBacaDesa<BarisDaftar[]>('/village/domains', ['domains']);

  return (
    <div>
      <PageHeader
        title="Domain Situs Desa"
        description="Alamat yang mengarah ke situs publik desa."
      />

      <DataGrid<BarisDaftar>
        columns={[
          {
            key: 'hostname',
            header: 'Alamat',
            render: (r) => (
              <span className="inline-flex items-center gap-2">
                <Globe size={14} aria-hidden className="text-slate-400" />
                <Code>{String(r.hostname)}</Code>
              </span>
            ),
          },
          teksKolom('domain_type', 'Jenis'),
          {
            key: 'verification_status',
            header: 'Pembuktian',
            render: (r) => {
              const s = String(r.verification_status ?? '');
              return (
                <StatusBadge
                  status={s === 'VERIFIED' ? 'Terbukti' : s === 'PENDING' ? 'Menunggu bukti' : s}
                  tone={s === 'VERIFIED' ? 'success' : 'warning'}
                />
              );
            },
          },
          {
            key: 'verified_at',
            header: 'Dibuktikan',
            render: (r) => formatDateTime(r.verified_at as string | null),
          },
          yaTidakKolom('is_primary', 'Utama', 'Utama', '—'),
          yaTidakKolom('is_active', 'Keadaan', 'Aktif', 'Tidak aktif'),
        ]}
        rows={domain.data ?? []}
        loading={domain.isLoading}
        error={domain.isError ? toMessage(domain.error) : undefined}
        onRetry={() => domain.refetch()}
        emptyTitle="Belum ada domain khusus"
        rowKey={(r) => String(r.id)}
      />

      <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">
        Domain baru berstatus <strong>menunggu bukti</strong> sampai kepemilikannya dibuktikan.
        Tanpa itu, siapa pun dapat mengarahkan domain milik orang lain ke situs desanya — dan
        pengunjung yang membuka alamat tersebut akan melihat halaman resmi desa di alamat yang
        bukan milik desa.
      </p>
    </div>
  );
}

// --- Potensi -----------------------------------------------------------------

export function PotensiPage() {
  const toMessage = usePesanGalat();
  const potensi = useBacaDesa<BarisDaftar[]>('/village/potentials', ['potentials']);

  return (
    <div>
      <PageHeader
        title="Potensi Wilayah"
        description="Sumber daya dan potensi yang dimiliki desa."
      />

      <DataGrid<BarisDaftar>
        columns={[
          teksKolom('category', 'Kategori'),
          teksKolom('name', 'Nama'),
          teksKolom('description', 'Keterangan'),
          {
            key: 'quantity',
            header: 'Jumlah',
            className: 'text-end tabular-nums',
            render: (r) =>
              r.quantity ? `${formatNumber(r.quantity as string)} ${r.unit ?? ''}`.trim() : '—',
          },
          yaTidakKolom('is_published', 'Situs Desa', 'Tayang', 'Tidak tayang'),
        ]}
        rows={potensi.data ?? []}
        loading={potensi.isLoading}
        error={potensi.isError ? toMessage(potensi.error) : undefined}
        onRetry={() => potensi.refetch()}
        emptyTitle="Belum ada potensi yang tercatat"
        rowKey={(r) => String(r.id)}
      />
    </div>
  );
}
