import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Award, Building2, ClipboardList, Download, Receipt, Users, X } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api, formatNumber } from '../../../lib/api';
import { PageHeader, LoadingState, StatusBadge } from '../../../components/ui';
import { useAuth } from '../../../app/auth-context';
import { downloadExcel, downloadPdf, type ExportColumn } from '../../../lib/export-table';

/*
 * Variabel warna grafik -- dua langkah (terang/gelap) dari palet kategorikal
 * baku (lihat skill dataviz `references/palette.md`), disesuaikan ke
 * konvensi gelap aplikasi ini (kelas `.dark` pada `<html>`, bukan
 * `prefers-color-scheme`/`data-theme`). Sudah lolos validator enam
 * pemeriksaan (`validate_palette.js`) untuk kedua permukaan.
 */
const VIZ_STYLE = `
  .viz-root {
    --series-1: #2a78d6;
    --series-2: #eb6834;
    --series-3: #1baf7a;
    --viz-grid: #e2e8f0;
    --viz-text: #64748b;
  }
  .dark .viz-root {
    --series-1: #3987e5;
    --series-2: #d95926;
    --series-3: #199e70;
    --viz-grid: #334155;
    --viz-text: #94a3b8;
  }
`;

interface SantriRingkasanRow {
  [key: string]: unknown;
  status: string;
  jenis_kelamin: string;
  status_tinggal: string;
  jumlah: number;
}

interface SantriPerTahunRow {
  [key: string]: unknown;
  tahun: number;
  jumlah: number;
}

interface TagihanRekapRow {
  [key: string]: unknown;
  periode: string;
  status: string;
  jumlah: number;
  total: string;
}

interface AsramaHunianRow {
  [key: string]: unknown;
  asrama: string;
  jenis: string;
  nomor: string;
  kapasitas: number;
  terisi: number;
}

interface RombonganHunianRow {
  [key: string]: unknown;
  rombongan: string;
  tingkat: string;
  kapasitas: number;
  terisi: number;
}

interface PsbFunnelRow {
  [key: string]: unknown;
  gelombang_id: string;
  gelombang: string;
  status: string;
  jumlah: number;
}

interface DasborPesantren {
  santri: SantriRingkasanRow[];
  santriPerTahunMasuk: SantriPerTahunRow[];
  santriPerTahunLulus: SantriPerTahunRow[];
  tagihan: TagihanRekapRow[];
  asrama: AsramaHunianRow[];
  rombongan: RombonganHunianRow[];
  psb: PsbFunnelRow[];
}

const TAGIHAN_LUNAS = new Set(['PAID', 'VOID']);

/*
 * Tidak digenerikkan atas satu T -- satu dialog (mis. "Ringkasan Santri")
 * boleh menggabungkan beberapa tab yang bentuk barisnya berbeda (status vs.
 * tahun masuk vs. tahun lulus). Setiap baris sumber sudah punya index
 * signature `[key: string]: unknown`, jadi tetap cocok dengan
 * `Record<string, unknown>` tanpa perlu penyeragaman tipe di sini.
 */
interface DetailTab {
  label: string;
  filename: string;
  columns: ExportColumn<Record<string, unknown>>[];
  rows: Record<string, unknown>[];
  href?: string;
  hrefLabel?: string;
}

interface DetailDataset {
  title: string;
  tabs: DetailTab[];
}

/**
 * Dasbor ePesantren -- pengganti `DashboardPage` (ERP/POS generik) untuk
 * tenant vertikal PESANTREN. Seluruh angkanya dihitung dari
 * `GET /pesantren/laporan/dasbor` (EP-P, sudah ada), bukan tabel ringkasan
 * baru -- konsisten dengan larangan §6 menduplikasi kebenaran modul lain.
 *
 * Setiap kartu/bagian dapat diklik untuk membuka rincian datanya (data yang
 * SAMA yang sudah dimuat, tidak ada panggilan tambahan) dengan opsi unduh
 * Excel/PDF -- keduanya dibangkitkan di peramban (`lib/export-table.ts`),
 * bukan janji fitur yang belum ada.
 */
export function PesantrenDashboardPage() {
  const { user } = useAuth();
  const [detail, setDetail] = useState<DetailDataset | null>(null);

  const dasbor = useQuery({
    queryKey: ['pesantren-dasbor'],
    queryFn: () => api.get<DasborPesantren>('/pesantren/laporan/dasbor'),
  });

  const data = dasbor.data;
  const santriAktif = (data?.santri ?? [])
    .filter((row) => row.status === 'AKTIF')
    .reduce((sum, row) => sum + row.jumlah, 0);

  const tagihanBelumLunas = (data?.tagihan ?? [])
    .filter((row) => !TAGIHAN_LUNAS.has(row.status))
    .reduce((sum, row) => sum + row.jumlah, 0);

  const kamarTerisi = (data?.asrama ?? []).reduce((sum, row) => sum + row.terisi, 0);
  const kamarKapasitas = (data?.asrama ?? []).reduce((sum, row) => sum + row.kapasitas, 0);

  const pendaftarPsb = (data?.psb ?? []).reduce((sum, row) => sum + row.jumlah, 0);

  const rombonganTerurut = [...(data?.rombongan ?? [])].sort((a, b) => a.tingkat.localeCompare(b.tingkat));

  // -- Data grafik: turunan langsung dari `data` yang sudah dimuat, tanpa
  // panggilan tambahan -- sama seperti kartu dan tabel rincian di atas.
  const trenTahun = (() => {
    const per = new Map<number, { tahun: number; masuk: number; lulus: number }>();
    for (const row of data?.santriPerTahunMasuk ?? []) {
      per.set(row.tahun, { ...(per.get(row.tahun) ?? { tahun: row.tahun, masuk: 0, lulus: 0 }), masuk: row.jumlah });
    }
    for (const row of data?.santriPerTahunLulus ?? []) {
      per.set(row.tahun, { ...(per.get(row.tahun) ?? { tahun: row.tahun, masuk: 0, lulus: 0 }), lulus: row.jumlah });
    }
    return [...per.values()].sort((a, b) => a.tahun - b.tahun);
  })();

  const tagihanPerStatus = (() => {
    const per = new Map<string, number>();
    for (const row of data?.tagihan ?? []) {
      per.set(row.status, (per.get(row.status) ?? 0) + row.jumlah);
    }
    return [...per.entries()].map(([status, jumlah]) => ({ status, jumlah }));
  })();

  const hunianPerTingkat = (() => {
    const per = new Map<string, { tingkat: string; kapasitas: number; terisi: number }>();
    for (const row of data?.rombongan ?? []) {
      const existing = per.get(row.tingkat) ?? { tingkat: row.tingkat, kapasitas: 0, terisi: 0 };
      per.set(row.tingkat, {
        tingkat: row.tingkat,
        kapasitas: existing.kapasitas + row.kapasitas,
        terisi: existing.terisi + row.terisi,
      });
    }
    return [...per.values()].sort((a, b) => a.tingkat.localeCompare(b.tingkat));
  })();

  const psbPerGelombang = new Map<string, { gelombang: string; rows: PsbFunnelRow[] }>();
  for (const row of data?.psb ?? []) {
    const entri = psbPerGelombang.get(row.gelombang_id) ?? { gelombang: row.gelombang, rows: [] };
    entri.rows.push(row);
    psbPerGelombang.set(row.gelombang_id, entri);
  }

  const bukaDetail = (dataset: DetailDataset) => setDetail(dataset);

  return (
    <>
      <PageHeader
        title="Dasbor Pondok"
        description={`Selamat datang, ${user?.displayName ?? ''}`}
      />

      {dasbor.isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              icon={<Users className="h-5 w-5" aria-hidden />}
              label="Santri Aktif"
              value={formatNumber(santriAktif)}
              onClick={() =>
                bukaDetail({
                  title: 'Ringkasan Santri',
                  tabs: [
                    {
                      label: 'Status',
                      filename: 'ringkasan-santri',
                      columns: [
                        { key: 'status', label: 'Status' },
                        { key: 'jenis_kelamin', label: 'Jenis Kelamin' },
                        { key: 'status_tinggal', label: 'Status Tinggal' },
                        { key: 'jumlah', label: 'Jumlah' },
                      ],
                      rows: data?.santri ?? [],
                      href: '/app/pesantren/santri',
                      hrefLabel: 'Buka Data Santri',
                    },
                    {
                      label: 'Per Tahun Masuk',
                      filename: 'santri-per-tahun-masuk',
                      columns: [
                        { key: 'tahun', label: 'Tahun Masuk' },
                        { key: 'jumlah', label: 'Jumlah Santri' },
                      ],
                      rows: data?.santriPerTahunMasuk ?? [],
                    },
                    {
                      label: 'Per Tahun Lulus',
                      filename: 'santri-per-tahun-lulus',
                      columns: [
                        { key: 'tahun', label: 'Tahun Lulus' },
                        { key: 'jumlah', label: 'Jumlah Santri' },
                      ],
                      rows: data?.santriPerTahunLulus ?? [],
                    },
                  ],
                })
              }
            />
            <StatCard
              icon={<Building2 className="h-5 w-5" aria-hidden />}
              label="Kamar Terisi"
              value={`${formatNumber(kamarTerisi)} / ${formatNumber(kamarKapasitas)}`}
              onClick={() =>
                bukaDetail({
                  title: 'Hunian Asrama',
                  tabs: [
                    {
                      label: 'Hunian Asrama',
                      filename: 'hunian-asrama',
                      columns: [
                        { key: 'asrama', label: 'Asrama' },
                        { key: 'jenis', label: 'Jenis' },
                        { key: 'nomor', label: 'Nomor Kamar' },
                        { key: 'kapasitas', label: 'Kapasitas' },
                        { key: 'terisi', label: 'Terisi' },
                      ],
                      rows: data?.asrama ?? [],
                      href: '/app/pesantren/asrama',
                      hrefLabel: 'Buka Asrama dan Kamar',
                    },
                  ],
                })
              }
            />
            <StatCard
              icon={<Receipt className="h-5 w-5" aria-hidden />}
              label="Tagihan Belum Lunas"
              value={formatNumber(tagihanBelumLunas)}
              onClick={() =>
                bukaDetail({
                  title: 'Rekap Tagihan SPP',
                  tabs: [
                    {
                      label: 'Rekap Tagihan SPP',
                      filename: 'rekap-tagihan-spp',
                      columns: [
                        { key: 'periode', label: 'Periode' },
                        { key: 'status', label: 'Status' },
                        { key: 'jumlah', label: 'Jumlah Tagihan' },
                        { key: 'total', label: 'Total (Rp)' },
                      ],
                      rows: data?.tagihan ?? [],
                      href: '/app/pesantren/tagihan',
                      hrefLabel: 'Buka Tagihan SPP',
                    },
                  ],
                })
              }
            />
            <StatCard
              icon={<ClipboardList className="h-5 w-5" aria-hidden />}
              label="Pendaftar PSB"
              value={formatNumber(pendaftarPsb)}
              onClick={() =>
                bukaDetail({
                  title: 'Pendaftar PSB/PPDB',
                  tabs: [
                    {
                      label: 'Pendaftar PSB/PPDB',
                      filename: 'pendaftar-psb',
                      columns: [
                        { key: 'gelombang', label: 'Gelombang' },
                        { key: 'status', label: 'Status' },
                        { key: 'jumlah', label: 'Jumlah' },
                      ],
                      rows: data?.psb ?? [],
                      href: '/app/pesantren/psb',
                      hrefLabel: 'Buka PSB/PPDB',
                    },
                  ],
                })
              }
            />
          </div>

          <style>{VIZ_STYLE}</style>
          <div className="viz-root mt-6 grid gap-6 lg:grid-cols-3">
            <section className="card p-5 lg:col-span-2">
              <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Tren Santri: Masuk vs Lulus</h2>
              {trenTahun.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada data tahun ajaran.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trenTahun}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--viz-grid)" vertical={false} />
                    <XAxis dataKey="tahun" tick={{ fill: 'var(--viz-text)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--viz-text)', fontSize: 12 }} axisLine={false} tickLine={false} width={36} />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: number) => formatNumber(value)}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="masuk" name="Santri Masuk" fill="var(--series-1)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="lulus" name="Santri Lulus" fill="var(--series-2)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="card p-5">
              <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Hunian per Tingkat</h2>
              {hunianPerTingkat.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada rombongan belajar.</p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={hunianPerTingkat} outerRadius="75%">
                    <PolarGrid stroke="var(--viz-grid)" />
                    <PolarAngleAxis dataKey="tingkat" tick={{ fill: 'var(--viz-text)', fontSize: 12 }} />
                    <PolarRadiusAxis tick={{ fill: 'var(--viz-text)', fontSize: 10 }} axisLine={false} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Radar name="Kapasitas" dataKey="kapasitas" stroke="var(--series-2)" fill="var(--series-2)" fillOpacity={0.15} />
                    <Radar name="Terisi" dataKey="terisi" stroke="var(--series-1)" fill="var(--series-1)" fillOpacity={0.35} />
                  </RadarChart>
                </ResponsiveContainer>
              )}
            </section>

            <section className="card p-5 lg:col-span-3">
              <h2 className="mb-3 font-semibold text-slate-900 dark:text-white">Tagihan SPP per Status</h2>
              {tagihanPerStatus.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada tagihan SPP.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={tagihanPerStatus} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--viz-grid)" horizontal={false} />
                    <XAxis type="number" tick={{ fill: 'var(--viz-text)', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <YAxis
                      type="category"
                      dataKey="status"
                      tick={{ fill: 'var(--viz-text)', fontSize: 12 }}
                      axisLine={false}
                      tickLine={false}
                      width={110}
                    />
                    <Tooltip
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      formatter={(value: number) => formatNumber(value)}
                    />
                    <Bar dataKey="jumlah" name="Jumlah Tagihan" fill="var(--series-3)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <section className="card p-5">
              <button
                type="button"
                className="mb-3 flex w-full items-center gap-2 text-start font-semibold text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                onClick={() =>
                  bukaDetail({
                    title: 'Rombongan Belajar',
                    tabs: [
                      {
                        label: 'Rombongan Belajar',
                        filename: 'rombongan-belajar',
                        columns: [
                          { key: 'rombongan', label: 'Rombongan' },
                          { key: 'tingkat', label: 'Tingkat' },
                          { key: 'terisi', label: 'Terisi' },
                          { key: 'kapasitas', label: 'Kapasitas' },
                        ],
                        rows: rombonganTerurut,
                        href: '/app/pesantren/rombongan',
                        hrefLabel: 'Buka Rombongan Belajar',
                      },
                    ],
                  })
                }
              >
                <Award className="h-4 w-4 shrink-0" aria-hidden />
                Rombongan Belajar
              </button>
              {rombonganTerurut.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada rombongan belajar.</p>
              ) : (
                <ul className="space-y-2">
                  {rombonganTerurut.map((row) => (
                    <li
                      key={row.rombongan}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800"
                    >
                      <span>
                        {row.rombongan}
                        <span className="ms-2 text-xs text-slate-500">({row.tingkat})</span>
                      </span>
                      <span className="font-semibold">
                        {row.terisi} / {row.kapasitas}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/app/pesantren/rombongan" className="btn-outline mt-4 w-full">
                Rombongan Belajar
              </Link>
            </section>

            <section className="card p-5">
              <button
                type="button"
                className="mb-3 flex w-full items-center gap-2 text-start font-semibold text-slate-900 hover:text-brand-700 dark:text-white dark:hover:text-brand-300"
                onClick={() =>
                  bukaDetail({
                    title: 'PSB/PPDB per Gelombang',
                    tabs: [
                      {
                        label: 'PSB/PPDB per Gelombang',
                        filename: 'psb-per-gelombang',
                        columns: [
                          { key: 'gelombang', label: 'Gelombang' },
                          { key: 'status', label: 'Status' },
                          { key: 'jumlah', label: 'Jumlah' },
                        ],
                        rows: data?.psb ?? [],
                        href: '/app/pesantren/psb',
                        hrefLabel: 'Buka PSB/PPDB',
                      },
                    ],
                  })
                }
              >
                <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
                PSB/PPDB per Gelombang
              </button>
              {psbPerGelombang.size === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">Belum ada gelombang PSB.</p>
              ) : (
                <ul className="space-y-3">
                  {[...psbPerGelombang.values()].map((entri) => (
                    <li key={entri.gelombang} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-800">
                      <p className="mb-1.5 text-sm font-medium">{entri.gelombang}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {entri.rows.map((row) => (
                          <span key={row.status} className="flex items-center gap-1 text-xs">
                            <StatusBadge status={row.status} />
                            <span className="text-slate-500 dark:text-slate-400">{row.jumlah}</span>
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/app/pesantren/psb" className="btn-outline mt-4 w-full">
                PSB/PPDB
              </Link>
            </section>
          </div>
        </>
      )}

      {detail && <DetailDialog dataset={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function StatCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="card flex items-center gap-4 p-5 text-start transition-shadow hover:shadow-md"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      </div>
    </button>
  );
}

/**
 * Popup rincian data satu kartu/bagian dasbor -- tabel apa adanya (tanpa
 * penghitungan ulang) plus unduh Excel/PDF yang dibangkitkan di peramban.
 *
 * Lebih dari satu tab dipakai untuk data yang punya beberapa sudut pandang
 * atas sumber yang sama, mis. santri dihitung per status, per tahun masuk,
 * dan per tahun lulus -- ketiganya dari `pesantren_santri` yang sama, bukan
 * tiga tabel baru.
 */
function DetailDialog({
  dataset,
  onClose,
}: {
  dataset: DetailDataset;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState(0);
  const tab = dataset.tabs[Math.min(activeTab, dataset.tabs.length - 1)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={dataset.title}
    >
      <div className="card flex max-h-[85vh] w-full max-w-2xl flex-col p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{dataset.title}</h2>
          <button type="button" className="btn-ghost px-2 py-1.5" onClick={onClose} aria-label="Tutup">
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        {dataset.tabs.length > 1 && (
          <div className="mt-3 flex gap-1 border-b border-slate-200 dark:border-slate-800">
            {dataset.tabs.map((t, index) => (
              <button
                key={t.label}
                type="button"
                onClick={() => setActiveTab(index)}
                className={
                  index === activeTab
                    ? 'border-b-2 border-brand-700 px-3 py-2 text-sm font-medium text-brand-700 dark:border-brand-400 dark:text-brand-300'
                    : 'border-b-2 border-transparent px-3 py-2 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 flex-1 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
              <tr>
                {tab.columns.map((col) => (
                  <th key={String(col.key)} className="px-3 py-2 text-start font-medium text-slate-600 dark:text-slate-300">
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tab.rows.length === 0 ? (
                <tr>
                  <td colSpan={tab.columns.length} className="px-3 py-6 text-center text-slate-500 dark:text-slate-400">
                    Tidak ada data.
                  </td>
                </tr>
              ) : (
                tab.rows.map((row, index) => (
                  <tr key={index} className="border-t border-slate-100 dark:border-slate-800">
                    {tab.columns.map((col) => (
                      <td key={String(col.key)} className="px-3 py-2">
                        {String(row[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-outline"
              onClick={() => downloadExcel(tab.filename, tab.columns, tab.rows)}
            >
              <Download className="h-4 w-4" aria-hidden />
              Excel
            </button>
            <button
              type="button"
              className="btn-outline"
              onClick={() => downloadPdf(tab.filename, `${dataset.title} -- ${tab.label}`, tab.columns, tab.rows)}
            >
              <Download className="h-4 w-4" aria-hidden />
              PDF
            </button>
          </div>
          {tab.href && (
            <Link to={tab.href} className="btn-primary" onClick={onClose}>
              {tab.hrefLabel ?? 'Buka halaman'}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
