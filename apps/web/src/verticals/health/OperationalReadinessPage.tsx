import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bot,
  Building2,
  DatabaseZap,
  FileText,
  Network,
  Shield,
  WalletCards,
} from 'lucide-react';
import { Code, EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import { useAuth } from '../../app/auth-context';
import { healthApi } from './health-api';

type Mode = 'satusehat' | 'portal' | 'sample' | 'report' | 'accounting' | 'investor' | 'security' | 'ai';

type Panel = {
  title: string;
  rows: Array<Record<string, unknown>>;
  loading: boolean;
  preferred: string[];
  note?: string;
};

const today = new Date();
const tahunIni = today.getFullYear();

export function OperationalReadinessPage({ mode }: { mode: Mode }) {
  const { user } = useAuth();
  const fasilitas = useQuery({ queryKey: ['health', 'facilities'], queryFn: () => healthApi.facilities() });
  const facilityId = fasilitas.data?.[0]?.id ?? null;
  const schema = user?.tenant?.schemaName ?? 'demo';

  const satusehatCatalog = useQuery({
    queryKey: ['health', 'satusehat-catalog'],
    queryFn: () => healthApi.satusehatCatalog(),
    enabled: mode === 'satusehat',
  });
  const satusehatEnvironments = useQuery({
    queryKey: ['health', 'satusehat-environments', facilityId],
    queryFn: () => healthApi.satusehatEnvironments(facilityId as string),
    enabled: mode === 'satusehat' && Boolean(facilityId),
  });
  const satusehatCapabilities = useQuery({
    queryKey: ['health', 'satusehat-capabilities', facilityId, mode],
    queryFn: () => healthApi.satusehatCapabilities(facilityId as string),
    enabled: (mode === 'satusehat' || mode === 'report') && Boolean(facilityId),
  });
  const satusehatTransmissions = useQuery({
    queryKey: ['health', 'satusehat-transmissions', facilityId],
    queryFn: () => healthApi.satusehatTransmissions(facilityId as string),
    enabled: mode === 'satusehat' && Boolean(facilityId),
  });
  const satusehatReconciliation = useQuery({
    queryKey: ['health', 'satusehat-reconciliation', facilityId],
    queryFn: () => healthApi.satusehatReconciliation(facilityId as string),
    enabled: mode === 'satusehat' && Boolean(facilityId),
  });

  const portalQueue = useQuery({
    queryKey: ['health', 'portal-queue', facilityId],
    queryFn: () => healthApi.portalQueue(facilityId as string),
    enabled: mode === 'portal' && Boolean(facilityId),
  });
  const portalLabResults = useQuery({
    queryKey: ['health', 'portal-lab-results', facilityId],
    queryFn: () => healthApi.portalLabResults(facilityId as string),
    enabled: mode === 'portal' && Boolean(facilityId),
  });
  const portalWebsite = useQuery({
    queryKey: ['health', 'portal-website', schema],
    queryFn: () => healthApi.portalWebsite(schema),
    enabled: mode === 'portal',
  });

  const sampleCatalog = useQuery({
    queryKey: ['health', 'sample-catalog'],
    queryFn: () => healthApi.sampleCatalog(),
    enabled: mode === 'sample' || mode === 'report',
  });
  const sampleTables = useQuery({
    queryKey: ['health', 'sample-tables'],
    queryFn: () => healthApi.sampleTables(),
    enabled: mode === 'sample',
  });
  const sampleRuns = useQuery({
    queryKey: ['health', 'sample-runs'],
    queryFn: () => healthApi.sampleRuns(),
    enabled: mode === 'sample',
  });
  const sampleBlockers = useQuery({
    queryKey: ['health', 'sample-blockers'],
    queryFn: () => healthApi.sampleBlockers(),
    enabled: mode === 'sample' || mode === 'report',
  });
  const sampleRoles = useQuery({
    queryKey: ['health', 'sample-roles'],
    queryFn: () => healthApi.sampleRoles(),
    enabled: mode === 'sample',
  });

  const accountingRoles = useQuery({
    queryKey: ['health', 'accounting-roles'],
    queryFn: () => healthApi.accountingRoles(),
    enabled: mode === 'accounting',
  });
  const accountingEvents = useQuery({
    queryKey: ['health', 'accounting-events'],
    queryFn: () => healthApi.accountingEvents(),
    enabled: mode === 'accounting',
  });
  const accountingCoa = useQuery({
    queryKey: ['health', 'accounting-coa'],
    queryFn: () => healthApi.accountingCoaTemplate(),
    enabled: mode === 'accounting',
  });

  const investor = useQuery({
    queryKey: ['health', 'investor-summary', facilityId, tahunIni],
    queryFn: () => healthApi.investorSummary(facilityId as string, tahunIni),
    enabled: mode === 'investor' && Boolean(facilityId),
  });

  const securityZones = useQuery({
    queryKey: ['health', 'security-zones', facilityId],
    queryFn: () => healthApi.securityZones(facilityId as string),
    enabled: mode === 'security' && Boolean(facilityId),
  });
  const securityFields = useQuery({
    queryKey: ['health', 'security-fields', facilityId],
    queryFn: () => healthApi.securityFields(facilityId as string),
    enabled: mode === 'security' && Boolean(facilityId),
  });
  const securityPurposes = useQuery({
    queryKey: ['health', 'security-purposes'],
    queryFn: () => healthApi.securityPurposes(),
    enabled: mode === 'security',
  });
  const aiLog = useQuery({
    queryKey: ['health', 'ai-log', facilityId],
    queryFn: () => healthApi.securityAiLog(facilityId as string),
    enabled: mode === 'ai' && Boolean(facilityId),
  });
  const aiForbidden = useQuery({
    queryKey: ['health', 'ai-forbidden-actions'],
    queryFn: () => healthApi.securityAiForbiddenActions(),
    enabled: mode === 'ai',
  });
  const posture = useQuery({
    queryKey: ['health', 'security-posture', facilityId],
    queryFn: () => healthApi.securityPosture(facilityId as string),
    enabled: (mode === 'security' || mode === 'ai') && Boolean(facilityId),
  });

  const meta = {
    satusehat: {
      title: 'SATUSEHAT',
      description: 'Kesiapan lingkungan, capability, jejak pengiriman, dan rekonsiliasi tanpa menyimpan kredensial mentah.',
      icon: Network,
      blocker: 'Kredensial SATUSEHAT harus berupa rujukan brankas. Tanpa itu, layar tetap menampilkan kesiapan dan kemampuan yang belum lolos.',
    },
    portal: {
      title: 'Portal Pasien dan Website',
      description: 'Antrean portal, hasil yang siap dilepas, dan konten publik fasilitas dalam satu tempat kerja.',
      icon: Building2,
      blocker: 'Verifikasi akun dan pelepasan hasil dipisahkan. Petugas yang memverifikasi akun tidak otomatis melepas hasil.',
    },
    sample: {
      title: 'Data Contoh',
      description: 'Penyemaian demo, tabel terdampak, penghalang pembersihan, dan peran pemisahan wewenang.',
      icon: DatabaseZap,
      blocker: 'Pembersihan sample data menyembunyikan, bukan menghapus. Nama aksi tetap keras supaya operator membaca risikonya.',
    },
    report: {
      title: 'Laporan eMedik',
      description: 'Laporan agregat fasilitas dengan status ekspor yang sengaja ditahan sampai pipeline dokumen tersedia.',
      icon: BarChart3,
      blocker: 'Ekspor Excel/PDF belum berlayar. Tombol ekspor harus menyatakan penolakan, bukan berpura-pura bekerja.',
    },
    accounting: {
      title: 'Akuntansi Kesehatan',
      description: 'Peran akun, peristiwa kesehatan, dan templat COA untuk mapping jurnal fasilitas.',
      icon: WalletCards,
      blocker: 'Posting otomatis menunggu katalog peristiwa HEALTH_* dari Core. Mapping tetap bisa disiapkan.',
    },
    investor: {
      title: 'Investor dan Waterfall',
      description: 'Ringkasan investor yang hanya memakai data finansial tersaring, bukan data pasien.',
      icon: FileText,
      blocker: 'Layar investor tidak boleh membuka data pasien. Jumlah medan yang tersaring harus tetap terlihat.',
    },
    security: {
      title: 'Zona Data',
      description: 'Klasifikasi medan, purpose of use, masking, dan posture keamanan fasilitas.',
      icon: Shield,
      blocker: 'Masking dan audit harus mengikuti purpose of use. Data sensitif tidak ditampilkan sebagai isi mentah.',
    },
    ai: {
      title: 'Penjaga AI',
      description: 'Larangan tindakan AI, log pemeriksaan, dan percobaan yang tertahan sebelum menyentuh gateway AI.',
      icon: Bot,
      blocker: 'Penjaga AI mencatat permintaan yang ditolak sebelum sampai gateway, sehingga pelanggaran tidak hilang dari audit.',
    },
  }[mode];

  const panels = useMemo<Panel[]>(() => {
    if (mode === 'satusehat') {
      return [
        { title: 'Katalog FHIR', rows: asRows(satusehatCatalog.data), loading: satusehatCatalog.isLoading, preferred: ['resourceType', 'profile', 'canSend', 'blocker', 'note'] },
        { title: 'Lingkungan', rows: satusehatEnvironments.data ?? [], loading: satusehatEnvironments.isLoading, preferred: ['name', 'environment', 'status', 'credential_ref', 'activated_at'] },
        { title: 'Kemampuan', rows: satusehatCapabilities.data ?? [], loading: satusehatCapabilities.isLoading, preferred: ['resource_type', 'status', 'last_tested_at', 'blocker', 'note'] },
        { title: 'Jejak pengiriman', rows: satusehatTransmissions.data ?? [], loading: satusehatTransmissions.isLoading, preferred: ['resource_type', 'status', 'sent_at', 'rejected_reason'] },
        { title: 'Rekonsiliasi', rows: satusehatReconciliation.data ?? [], loading: satusehatReconciliation.isLoading, preferred: ['resource_type', 'local_count', 'remote_count', 'difference', 'status'] },
      ];
    }
    if (mode === 'portal') {
      return [
        { title: 'Antrean portal', rows: portalQueue.data ?? [], loading: portalQueue.isLoading, preferred: ['patient_name', 'status', 'requested_at', 'verified_at', 'request_type'] },
        { title: 'Hasil lab siap dilepas', rows: portalLabResults.data ?? [], loading: portalLabResults.isLoading, preferred: ['patient_name', 'order_code', 'result_status', 'released_at'] },
        { title: 'Konten website fasilitas', rows: asRows(portalWebsite.data), loading: portalWebsite.isLoading, preferred: ['title', 'status', 'published_at', 'updated_at', 'slug'] },
      ];
    }
    if (mode === 'sample' || mode === 'report') {
      return [
        { title: 'Katalog demo/laporan', rows: asRows(sampleCatalog.data), loading: sampleCatalog.isLoading, preferred: ['code', 'name', 'scope', 'isExportable', 'blocker'] },
        { title: 'Penghalang', rows: sampleBlockers.data ?? [], loading: sampleBlockers.isLoading, preferred: ['code', 'message', 'severity', 'workaround'] },
        ...(mode === 'sample'
          ? [
              { title: 'Tabel terdampak', rows: sampleTables.data ?? [], loading: sampleTables.isLoading, preferred: ['table_name', 'sample_rows', 'hidden_rows', 'last_run_at'] },
              { title: 'Run penyemaian', rows: sampleRuns.data ?? [], loading: sampleRuns.isLoading, preferred: ['sample_run_id', 'profile', 'status', 'seeded_at', 'cleaned_at'] },
              { title: 'Peran sample', rows: sampleRoles.data ?? [], loading: sampleRoles.isLoading, preferred: ['role_code', 'can_seed', 'can_clean', 'separation_note'] },
            ]
          : [
              { title: 'Kemampuan SATUSEHAT pendukung laporan', rows: satusehatCapabilities.data ?? [], loading: satusehatCapabilities.isLoading, preferred: ['resource_type', 'status', 'blocker'] },
            ]),
      ];
    }
    if (mode === 'accounting') {
      return [
        { title: 'Peran akun', rows: accountingRoles.data ?? [], loading: accountingRoles.isLoading, preferred: ['role', 'normal_balance', 'description', 'required'] },
        { title: 'Peristiwa', rows: accountingEvents.data ?? [], loading: accountingEvents.isLoading, preferred: ['event_code', 'name', 'required_roles', 'blocked_by_core'] },
        { title: 'Templat COA', rows: accountingCoa.data ?? [], loading: accountingCoa.isLoading, preferred: ['account_code', 'account_name', 'role', 'normal_balance'] },
      ];
    }
    if (mode === 'investor') {
      return [
        { title: 'Ringkasan investor', rows: asRows(investor.data), loading: investor.isLoading, preferred: ['facility_id', 'year', 'gross_revenue', 'net_revenue', 'distributed_amount', '_filtered'] },
      ];
    }
    if (mode === 'security') {
      return [
        { title: 'Posture', rows: asRows(posture.data), loading: posture.isLoading, preferred: ['facility_id', 'risk_level', 'open_items', 'last_reviewed_at'] },
        { title: 'Zona', rows: securityZones.data ?? [], loading: securityZones.isLoading, preferred: ['zone_code', 'name', 'classification', 'masking_policy'] },
        { title: 'Medan sensitif', rows: securityFields.data ?? [], loading: securityFields.isLoading, preferred: ['field_name', 'zone_code', 'classification', 'masking_policy'] },
        { title: 'Purpose of use', rows: securityPurposes.data ?? [], loading: securityPurposes.isLoading, preferred: ['code', 'name', 'requires_reason', 'allowed_roles'] },
      ];
    }
    return [
      { title: 'Posture keamanan', rows: asRows(posture.data), loading: posture.isLoading, preferred: ['facility_id', 'risk_level', 'open_items', 'last_reviewed_at'] },
      { title: 'Log penjaga AI', rows: aiLog.data ?? [], loading: aiLog.isLoading, preferred: ['created_at', 'actor_name', 'action_code', 'decision', 'reason'] },
      { title: 'Tindakan terlarang', rows: aiForbidden.data ?? [], loading: aiForbidden.isLoading, preferred: ['code', 'name', 'reason', 'severity'] },
    ];
  }, [
    mode,
    satusehatCatalog.data,
    satusehatCatalog.isLoading,
    satusehatEnvironments.data,
    satusehatEnvironments.isLoading,
    satusehatCapabilities.data,
    satusehatCapabilities.isLoading,
    satusehatTransmissions.data,
    satusehatTransmissions.isLoading,
    satusehatReconciliation.data,
    satusehatReconciliation.isLoading,
    portalQueue.data,
    portalQueue.isLoading,
    portalLabResults.data,
    portalLabResults.isLoading,
    portalWebsite.data,
    portalWebsite.isLoading,
    sampleCatalog.data,
    sampleCatalog.isLoading,
    sampleBlockers.data,
    sampleBlockers.isLoading,
    sampleTables.data,
    sampleTables.isLoading,
    sampleRuns.data,
    sampleRuns.isLoading,
    sampleRoles.data,
    sampleRoles.isLoading,
    accountingRoles.data,
    accountingRoles.isLoading,
    accountingEvents.data,
    accountingEvents.isLoading,
    accountingCoa.data,
    accountingCoa.isLoading,
    investor.data,
    investor.isLoading,
    posture.data,
    posture.isLoading,
    securityZones.data,
    securityZones.isLoading,
    securityFields.data,
    securityFields.isLoading,
    securityPurposes.data,
    securityPurposes.isLoading,
    aiLog.data,
    aiLog.isLoading,
    aiForbidden.data,
    aiForbidden.isLoading,
  ]);

  const totalRows = panels.reduce((sum, panel) => sum + panel.rows.length, 0);
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.description}
        breadcrumbs={[{ label: 'eMedik' }, { label: meta.title }]}
        actions={<StatusBadge status={facilityId ? `${totalRows} BARIS` : 'MEMUAT FASILITAS'} tone={facilityId ? 'success' : 'warning'} />}
      />

      <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:grid-cols-[auto_1fr]">
        <span className="grid h-12 w-12 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold text-slate-950 dark:text-white">Status operasional</h2>
          <p className="mt-1 max-w-4xl text-sm leading-6 text-slate-600 dark:text-slate-300">{meta.blocker}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <Metric label="Fasilitas" value={facilityId ? '1' : '0'} />
        <Metric label="Panel" value={String(panels.length)} />
        <Metric label="Baris terbaca" value={String(totalRows)} />
      </section>

      {panels.map((panel) => (
        <RecordList key={panel.title} {...panel} />
      ))}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
    </article>
  );
}

function RecordList({ title, rows, loading, preferred, note }: Panel) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold text-slate-950 dark:text-white">{title}</h2>
          {note ? <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{note}</p> : null}
        </div>
        <Code>{rows.length} baris</Code>
      </div>
      {loading ? (
        <p className="mt-4 text-sm text-slate-500">Memuat data...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Belum ada data" description="Panel akan terisi setelah konfigurasi, transaksi, atau impor terkait tersedia." />
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.slice(0, 50).map((row, index) => <RecordCard key={String(row.id ?? row.code ?? row.kode ?? index)} row={row} preferred={preferred} />)}
        </div>
      )}
    </section>
  );
}

function RecordCard({ row, preferred }: { row: Record<string, unknown>; preferred: string[] }) {
  const entries = useMemo(() => {
    const seen = new Set<string>();
    const chosen = preferred.filter((key) => row[key] !== null && row[key] !== undefined);
    const fallback = Object.keys(row).slice(0, 6);
    return [...chosen, ...fallback].filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return key in row;
    }).slice(0, 8);
  }, [preferred, row]);

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="grid gap-3 sm:grid-cols-2">
        {entries.map((key) => (
          <div key={key}>
            <p className="text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400">{labelKey(key)}</p>
            <p className="mt-0.5 break-words text-sm text-slate-900 dark:text-white">{formatValue(row[key])}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function asRows(data?: unknown): Array<Record<string, unknown>> {
  if (!data) return [];
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data)) {
    const arrayValue = Object.values(data).find((value) => Array.isArray(value));
    if (Array.isArray(arrayValue)) return arrayValue.filter(isRecord);
    return [data];
  }
  return [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function labelKey(key: string) {
  return key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2');
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  if (typeof value === 'boolean') return value ? 'Ya' : 'Tidak';
  if (Array.isArray(value)) return value.map(formatValue).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export default OperationalReadinessPage;
