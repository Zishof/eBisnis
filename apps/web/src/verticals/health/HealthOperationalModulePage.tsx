import { Link, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BedDouble,
  FileText,
  HeartPulse,
  Microscope,
  Pill,
  ShieldCheck,
  TimerReset,
  Stethoscope,
  Syringe,
} from 'lucide-react';
import { PageHeader, StatusBadge } from '../../components/ui';
import { emedikPublicBrandFor, isApotikHost } from '../../pages/public/emedik-host';

type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface HealthModuleConfig {
  title: string;
  group: string;
  description: string;
  icon: typeof Activity;
  safetyNote: string;
  focus: Array<{ label: string; body: string; tone: Tone }>;
  stats: Array<{ label: string; value: string; note: string }>;
  lanes: Array<{ label: string; value: string; tone: Tone }>;
  actions: Array<{ label: string; href: string }>;
}

const DEMO_ROW_COUNT = 50;

const MODULES: Array<{ match: RegExp; config: HealthModuleConfig }> = [
  {
    match: /pendaftaran|antrean|rawat-jalan|kunjungan/,
    config: {
      title: 'Command Center Rawat Jalan',
      group: 'Pelayanan Klinik',
      description: 'Pantau pendaftaran, antrean, asesmen, SOAP, order, resep, billing, dan follow-up pasien harian.',
      icon: Stethoscope,
      safetyNote: 'Akses detail pasien tetap melewati purpose of use dan audit akses.',
      focus: [
        { label: 'Mulai dari antrean', body: 'Dokter melihat daftar kunjungan sendiri tanpa harus kembali ke pendaftaran.', tone: 'info' },
        { label: 'Tutup catatan', body: 'SOAP yang belum ditandatangani tetap naik ke ringkasan shift.', tone: 'warning' },
        { label: 'Rujuk farmasi', body: 'Resep aktif masuk antrean telaah sebelum pasien diarahkan ke kasir.', tone: 'success' },
      ],
      stats: [
        { label: 'Pasien hari ini', value: '86', note: '22 sudah selesai' },
        { label: 'Rata-rata tunggu', value: '14 menit', note: 'Target < 20 menit' },
        { label: 'SOAP tertandatangani', value: '91%', note: '8 catatan perlu finalisasi' },
        { label: 'Resep aktif', value: '34', note: '6 menunggu telaah' },
      ],
      lanes: [
        { label: 'Check-in', value: '18', tone: 'info' },
        { label: 'Sedang dilayani', value: '11', tone: 'warning' },
        { label: 'Farmasi', value: '6', tone: 'warning' },
        { label: 'Selesai', value: '22', tone: 'success' },
      ],
      actions: [
        { label: 'Pendaftaran', href: '/app/emedik/pendaftaran' },
        { label: 'Data pasien', href: '/app/emedik/pasien' },
        { label: 'Farmasi', href: '/app/emedik/resep' },
      ],
    },
  },
  {
    match: /resep|penyerahan|formularium|pemberian|kfa/,
    config: {
      title: 'Command Center Farmasi',
      group: 'Farmasi dan Apotik',
      description: 'Kelola telaah resep, dispensing, formularium, KFA, eMAR, batch-expiry, dan penyerahan obat.',
      icon: Pill,
      safetyNote: 'Obat high-alert, LASA, alergi, interaksi, dan obat terkendali dinaikkan ke prioritas sebelum obat diserahkan.',
      focus: [
        { label: 'Telaah dulu', body: 'Resep high-alert dan controlled drug ditahan sebelum pembayaran.', tone: 'danger' },
        { label: 'Scan obat', body: 'Barcode, batch, dan expiry dibuat terlihat sebelum item masuk keranjang.', tone: 'info' },
        { label: 'Pisah POS', body: 'POS Apotik memakai mesin POS sama, tetapi guardrail farmasi tetap terpisah.', tone: 'success' },
      ],
      stats: [
        { label: 'Resep menunggu', value: '27', note: '6 butuh telaah apoteker' },
        { label: 'Obat high-alert', value: '5', note: 'Wajib verifikasi ganda' },
        { label: 'Batch hampir kedaluwarsa', value: '18', note: '30 hari ke depan' },
        { label: 'Ketersediaan formularium', value: '96%', note: '12 substitusi tersedia' },
      ],
      lanes: [
        { label: 'Telaah', value: '6', tone: 'warning' },
        { label: 'Racikan', value: '4', tone: 'info' },
        { label: 'Siap bayar', value: '12', tone: 'success' },
        { label: 'Ditahan', value: '3', tone: 'danger' },
      ],
      actions: [
        { label: 'Resep', href: '/app/emedik/resep' },
        { label: 'POS Apotik', href: '/app/apotik/pos' },
        { label: 'Master obat', href: '/app/products' },
      ],
    },
  },
  {
    match: /lab|alat|gateway|hasil-alat|pemeliharaan-alat|keamanan-alat|pesan-alat|pemetaan-kode/,
    config: {
      title: 'Command Center Penunjang',
      group: 'Laboratorium dan Alat',
      description: 'Pantau order lab, spesimen, hasil kritis, adapter alat, maintenance, keamanan alat, dan rekonsiliasi kode.',
      icon: Microscope,
      safetyNote: 'Hasil kritis dan kegagalan alat harus memiliki eskalasi, penerima, dan waktu tindak lanjut.',
      focus: [
        { label: 'Hasil kritis', body: 'Nilai kritis harus punya penerima dan waktu tindak lanjut.', tone: 'danger' },
        { label: 'Mapping kode', body: 'Kode alat dipetakan oleh analis yang paham pemeriksaannya.', tone: 'warning' },
        { label: 'Adapter sehat', body: 'Koneksi alat dibaca sebagai status operasional, bukan log teknis tersembunyi.', tone: 'info' },
      ],
      stats: [
        { label: 'Order penunjang', value: '64', note: '19 spesimen diterima' },
        { label: 'Hasil kritis', value: '3', note: '2 sudah dikonfirmasi' },
        { label: 'Adapter aktif', value: '7/8', note: '1 maintenance' },
        { label: 'SLA hasil', value: '93%', note: '7 hari terakhir' },
      ],
      lanes: [
        { label: 'Order', value: '19', tone: 'info' },
        { label: 'Diproses', value: '21', tone: 'warning' },
        { label: 'Kritis', value: '3', tone: 'danger' },
        { label: 'Rilis', value: '41', tone: 'success' },
      ],
      actions: [
        { label: 'Pesanan lab', href: '/app/emedik/lab/pesanan' },
        { label: 'Hasil alat', href: '/app/emedik/hasil-alat' },
        { label: 'Keamanan alat', href: '/app/emedik/keamanan-alat' },
      ],
    },
  },
  {
    match: /rawat-inap|keperawatan|tempat-tidur|igd|operasi|intensif/,
    config: {
      title: 'Command Center Rawat Inap dan Akut',
      group: 'Rawat Inap',
      description: 'Pantau bed, admisi, IGD, operasi, ICU, handover keperawatan, observasi, dan discharge planning.',
      icon: BedDouble,
      safetyNote: 'Handover, instruksi dokter, obat, dan observasi kritis harus terbaca cepat pada layar desktop maupun tablet.',
      focus: [
        { label: 'Operasi aman', body: 'Site marking, checklist tiga fase, dan hitung kasa ditampilkan sebagai penahan alur.', tone: 'danger' },
        { label: 'ICU ringkas', body: 'Skor, dukungan organ, dan eskalasi terlihat tanpa membuka banyak tab.', tone: 'warning' },
        { label: 'Handover', body: 'Catatan shift menjaga instruksi terakhir tetap berada di konteks pasien.', tone: 'info' },
      ],
      stats: [
        { label: 'BOR', value: '72%', note: '18 bed kosong' },
        { label: 'Pasien IGD', value: '14', note: '3 triase merah/kuning' },
        { label: 'Jadwal operasi', value: '9', note: '2 menunggu pre-op' },
        { label: 'ICU aktif', value: '6', note: '1 eskalasi ventilator' },
      ],
      lanes: [
        { label: 'Admisi', value: '8', tone: 'info' },
        { label: 'Observasi', value: '37', tone: 'warning' },
        { label: 'Kritis', value: '4', tone: 'danger' },
        { label: 'Pulang', value: '11', tone: 'success' },
      ],
      actions: [
        { label: 'Rawat inap', href: '/app/emedik/rawat-inap' },
        { label: 'IGD', href: '/app/emedik/igd' },
        { label: 'ICU', href: '/app/emedik/intensif' },
      ],
    },
  },
  {
    match: /keluarga|pertumbuhan|imunisasi|kunjungan-rumah|cakupan/,
    config: {
      title: 'Command Center Kesehatan Komunitas',
      group: 'Puskesmas dan Posyandu',
      description: 'Pantau keluarga, tumbuh kembang, imunisasi, kunjungan rumah, cakupan program, dan rujukan komunitas.',
      icon: Syringe,
      safetyNote: 'Data keluarga dan anak tetap ditampilkan agregat kecuali petugas membuka detail dengan tujuan penggunaan yang sah.',
      focus: [
        { label: 'Sasaran program', body: 'Keluarga, bumil, balita, dan lansia dibaca dari status program yang sama.', tone: 'info' },
        { label: 'Risiko tinggi', body: 'Follow-up komunitas dinaikkan sebelum target cakupan terlihat hijau.', tone: 'warning' },
        { label: 'Rujukan', body: 'Kader dan puskesmas melihat status rujukan tanpa menyalin data ulang.', tone: 'success' },
      ],
      stats: [
        { label: 'Sasaran aktif', value: '1.284', note: 'Balita, bumil, lansia' },
        { label: 'Imunisasi due', value: '76', note: '14 perlu follow-up' },
        { label: 'Kunjungan rumah', value: '38', note: 'Minggu ini' },
        { label: 'Cakupan program', value: '88%', note: 'Target 90%' },
      ],
      lanes: [
        { label: 'Terjadwal', value: '42', tone: 'info' },
        { label: 'Perlu rujukan', value: '9', tone: 'warning' },
        { label: 'Risiko tinggi', value: '6', tone: 'danger' },
        { label: 'Selesai', value: '117', tone: 'success' },
      ],
      actions: [
        { label: 'Pertumbuhan', href: '/app/emedik/pertumbuhan' },
        { label: 'Imunisasi', href: '/app/emedik/imunisasi' },
        { label: 'Cakupan', href: '/app/emedik/cakupan' },
      ],
    },
  },
  {
    match: /koding|klaim|bpjs|sep|kepesertaan|rekonsiliasi|telaah-klaim/,
    config: {
      title: 'Command Center Klaim dan Penjamin',
      group: 'Klaim',
      description: 'Pantau eligibility, SEP, koding, telaah klaim, rekonsiliasi penjamin, dan koreksi dokumen.',
      icon: FileText,
      safetyNote: 'Koreksi klaim dan koding diberi jejak alasan, versi, dan pemisahan peran agar audit tetap akuntabel.',
      focus: [
        { label: 'Pisah peran', body: 'Yang mengode tidak memverifikasi klaimnya sendiri.', tone: 'danger' },
        { label: 'Dokumen kurang', body: 'Berkas pending ditampilkan sebagai pekerjaan, bukan sekadar status gagal.', tone: 'warning' },
        { label: 'Rekonsiliasi', body: 'Sisa bayar, dispute, dan koreksi ditautkan ke episode layanan.', tone: 'info' },
      ],
      stats: [
        { label: 'Klaim bulan ini', value: '412', note: 'Rp 2,8 M diajukan' },
        { label: 'Pending penjamin', value: '38', note: '12 butuh dokumen' },
        { label: 'SEP valid', value: '97%', note: 'Kepesertaan tersinkron' },
        { label: 'Potensi dispute', value: '9', note: 'Perlu telaah coder' },
      ],
      lanes: [
        { label: 'Draft', value: '42', tone: 'neutral' },
        { label: 'Telaah', value: '38', tone: 'warning' },
        { label: 'Ditolak', value: '7', tone: 'danger' },
        { label: 'Lolos', value: '325', tone: 'success' },
      ],
      actions: [
        { label: 'Koding', href: '/app/emedik/koding' },
        { label: 'Klaim', href: '/app/emedik/klaim' },
        { label: 'BPJS', href: '/app/emedik/bpjs' },
      ],
    },
  },
  {
    match: /satusehat|portal|website|laporan|akuntansi|investor|waterfall|zona-data|penjaga-ai|keselamatan|mutu|penahanan|pelepasan|telaah-darurat|jejak-akses/,
    config: {
      title: 'Command Center Tata Kelola eMedik',
      group: 'Governance',
      description: 'Pantau integrasi nasional, portal pasien, laporan, akuntansi, investor, keamanan data, mutu, dan keselamatan pasien.',
      icon: ShieldCheck,
      safetyNote: 'Dashboard tata kelola mengutamakan agregat, masking, audit, dan indikator tindakan yang dapat ditindaklanjuti.',
      focus: [
        { label: 'Privasi dulu', body: 'Investor dan laporan melihat agregat, bukan data pasien.', tone: 'success' },
        { label: 'Hambatan jelas', body: 'SATUSEHAT, ekspor, dan akuntansi menyatakan dependency yang belum tersedia.', tone: 'warning' },
        { label: 'Audit aktif', body: 'Break-glass, masking, dan penjaga AI tetap terlihat sebagai pekerjaan telaah.', tone: 'info' },
      ],
      stats: [
        { label: 'Posture keamanan', value: 'A-', note: '2 kontrol perlu review' },
        { label: 'SATUSEHAT siap', value: '82%', note: 'Capability bertahap' },
        { label: 'Insiden mutu', value: '5', note: '3 RCA selesai' },
        { label: 'Akses darurat', value: '2', note: 'Wajib telaah' },
      ],
      lanes: [
        { label: 'Aman', value: '41', tone: 'success' },
        { label: 'Perlu review', value: '12', tone: 'warning' },
        { label: 'Ditahan', value: '4', tone: 'danger' },
        { label: 'Otomatis', value: '28', tone: 'info' },
      ],
      actions: [
        { label: 'Zona data', href: '/app/emedik/zona-data' },
        { label: 'Laporan', href: '/app/emedik/laporan' },
        { label: 'Penjaga AI', href: '/app/emedik/penjaga-ai' },
      ],
    },
  },
];

const DEFAULT_CONFIG: HealthModuleConfig = {
  title: 'Command Center eMedik',
  group: 'Operasional Kesehatan',
  description: 'Layar kerja responsif untuk modul eMedik yang baru aktif, dengan data demo cukup padat agar calon tenant bisa mengevaluasi alur nyata.',
  icon: HeartPulse,
  safetyNote: 'Tidak ada data pasien asli pada layar demo. Detail sensitif harus lewat hak akses, purpose of use, dan audit.',
  focus: [
    { label: 'Mulai dari konteks', body: 'Baca status kerja, prioritas risiko, dan tindakan berikutnya dari satu layar.', tone: 'info' },
    { label: 'Data demo', body: 'Angka padat dibuat untuk simulasi, bukan untuk menyerupai data pasien asli.', tone: 'warning' },
    { label: 'Akses aman', body: 'Detail pasien tetap melewati hak akses dan audit sebelum dibuka.', tone: 'success' },
  ],
  stats: [
    { label: 'Aktivitas terbuka', value: '50', note: 'Dataset demo minimum' },
    { label: 'Prioritas tinggi', value: '7', note: 'Butuh tindak lanjut' },
    { label: 'SLA operasional', value: '94%', note: 'Simulasi 7 hari' },
    { label: 'Sinkronisasi', value: 'Online', note: 'API tenant aktif' },
  ],
  lanes: [
    { label: 'Masuk', value: '18', tone: 'info' },
    { label: 'Proses', value: '16', tone: 'warning' },
    { label: 'Tahan', value: '3', tone: 'danger' },
    { label: 'Selesai', value: '13', tone: 'success' },
  ],
  actions: [
    { label: 'Dashboard', href: '/app' },
    { label: 'Pasien', href: '/app/emedik/pasien' },
    { label: 'Laporan eMedik', href: '/app/emedik/laporan' },
  ],
};

const TASKS = [
  'Validasi pendaftaran dan identitas',
  'Telaah catatan klinis',
  'Tindak lanjut order penunjang',
  'Verifikasi obat dan edukasi pasien',
  'Rekonsiliasi billing dan penjamin',
  'Review keselamatan dan mutu',
  'Sinkronisasi portal pasien',
  'Audit akses data sensitif',
];

const OWNERS = ['Dokter', 'Perawat', 'Farmasi', 'Kasir', 'Admin Fasilitas', 'Manajemen', 'Mutu', 'IT Integrasi'];
const STATUSES: Array<{ label: string; tone: Tone }> = [
  { label: 'READY', tone: 'success' },
  { label: 'PENDING', tone: 'warning' },
  { label: 'REVIEW', tone: 'info' },
  { label: 'BLOCKED', tone: 'danger' },
  { label: 'DONE', tone: 'success' },
];

const tonePanel: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100',
  danger: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-100',
  info: 'border-cyan-200 bg-cyan-50 text-cyan-900 dark:border-cyan-900 dark:bg-cyan-950/30 dark:text-cyan-100',
  neutral: 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200',
};

function configFor(pathname: string, apotik: boolean): HealthModuleConfig {
  const path = pathname.toLowerCase();
  if (apotik && !path.includes('/app/emedik/')) {
    return MODULES[1].config;
  }
  return MODULES.find((module) => module.match.test(path))?.config ?? DEFAULT_CONFIG;
}

function demoRows(config: HealthModuleConfig, pathname: string) {
  const seed = pathname.length + config.title.length;
  return Array.from({ length: DEMO_ROW_COUNT }, (_, index) => {
    const status = STATUSES[(index + seed) % STATUSES.length];
    return {
      id: `${config.group.toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 10)}-${String(index + 1).padStart(3, '0')}`,
      time: new Date(Date.now() - index * 3_600_000).toISOString().slice(0, 16).replace('T', ' '),
      task: `${TASKS[(index + seed) % TASKS.length]} #${String(index + 1).padStart(2, '0')}`,
      owner: OWNERS[(index + config.group.length) % OWNERS.length],
      risk: index % 11 === 0 ? 'Tinggi' : index % 4 === 0 ? 'Sedang' : 'Rendah',
      status: status.label,
      tone: status.tone,
    };
  });
}

export function HealthOperationalModulePage() {
  const location = useLocation();
  const apotik = isApotikHost();
  const brand = emedikPublicBrandFor();
  const config = configFor(location.pathname, apotik);
  const Icon = config.icon;
  const rows = useMemo(() => demoRows(config, location.pathname), [config, location.pathname]);
  const urgentRows = rows.filter((row) => row.risk !== 'Rendah').slice(0, 4);

  return (
    <>
      <PageHeader
        title={config.title}
        description={config.description}
        breadcrumbs={[
          { label: 'Dashboard', href: '/app' },
          { label: config.group },
          { label: config.title },
        ]}
        actions={
          <Link to={apotik ? '/app/apotik/pos' : '/app/emedik/laporan'} className="btn-primary">
            {apotik ? 'Buka POS Apotik' : 'Buka Laporan'}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        }
      />

      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-0 lg:grid-cols-[0.74fr_0.26fr]">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-teal-50 text-teal-700 dark:bg-teal-950 dark:text-teal-300">
                  <Icon className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-950 dark:text-white">Ringkasan operasional</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{config.safetyNote}</p>
                  {brand && (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-teal-700 dark:text-teal-300">
                      {brand.name} · {brand.homeUrl.replace(/^https?:\/\//, '')}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {config.stats.map((stat) => (
                <div key={stat.label} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{stat.label}</p>
                  <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{stat.value}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{stat.note}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-3">
              {config.focus.map((item) => (
                <article key={item.label} className={`rounded-lg border p-4 ${tonePanel[item.tone]}`}>
                  <h3 className="font-bold">{item.label}</h3>
                  <p className="mt-2 text-sm leading-6 opacity-90">{item.body}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950 lg:border-s lg:border-t-0">
            <h3 className="font-semibold text-slate-950 dark:text-white">Alur status</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {config.lanes.map((lane) => (
                <div key={lane.label} className="flex items-center justify-between rounded-lg bg-white px-4 py-3 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
                  <span className="text-sm text-slate-600 dark:text-slate-300">{lane.label}</span>
                  <StatusBadge status={lane.value} tone={lane.tone} />
                </div>
              ))}
            </div>
            <div className="mt-5 space-y-2">
              {config.actions.map((action) => (
                <Link key={action.href} to={action.href} className="btn-outline w-full justify-between">
                  {action.label}
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-5 grid gap-4 lg:grid-cols-[0.38fr_0.62fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cyan-50 text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
              <TimerReset className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-bold text-slate-950 dark:text-white">Prioritas shift</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Tampilkan sedikit pekerjaan yang perlu keputusan, lalu biarkan daftar lengkap tetap tersedia di bawah.
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {urgentRows.map((row) => (
            <article key={row.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.id}</p>
                  <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{row.task}</h3>
                </div>
                <StatusBadge status={row.status} tone={row.tone} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500 dark:text-slate-400">
                <div>
                  <dt className="font-semibold uppercase tracking-wide">Peran</dt>
                  <dd className="mt-1 text-slate-700 dark:text-slate-200">{row.owner}</dd>
                </div>
                <div>
                  <dt className="font-semibold uppercase tracking-wide">Risiko</dt>
                  <dd className="mt-1 text-slate-700 dark:text-slate-200">{row.risk}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-950 dark:text-white">Daftar kerja demo</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">Minimum {DEMO_ROW_COUNT} data contoh untuk simulasi kondisi lapangan.</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-100 dark:ring-amber-800">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            Demo, bukan data pasien asli
          </div>
        </div>
        <div className="grid gap-3 p-4 md:hidden">
          {rows.slice(0, 12).map((row) => (
            <article key={row.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">{row.time}</p>
                  <h3 className="mt-1 font-semibold text-slate-950 dark:text-white">{row.task}</h3>
                </div>
                <StatusBadge status={row.status} tone={row.tone} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-300">
                <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">{row.id}</span>
                <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">{row.owner}</span>
                <span className="rounded-full bg-white px-2 py-1 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">Risiko {row.risk}</span>
              </div>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              <tr>
                <th className="px-5 py-3 text-start font-semibold">Waktu</th>
                <th className="px-5 py-3 text-start font-semibold">Referensi</th>
                <th className="px-5 py-3 text-start font-semibold">Pekerjaan</th>
                <th className="px-5 py-3 text-start font-semibold">Peran</th>
                <th className="px-5 py-3 text-start font-semibold">Risiko</th>
                <th className="px-5 py-3 text-start font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{row.time}</td>
                  <td className="whitespace-nowrap px-5 py-4 font-mono text-xs text-slate-500 dark:text-slate-400">{row.id}</td>
                  <td className="px-5 py-4 font-medium text-slate-950 dark:text-white">{row.task}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{row.owner}</td>
                  <td className="px-5 py-4 text-slate-600 dark:text-slate-300">{row.risk}</td>
                  <td className="px-5 py-4">
                    <StatusBadge status={row.status} tone={row.tone} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
