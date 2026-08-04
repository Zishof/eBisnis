import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Database, FileCheck2, Pill, ShieldCheck } from 'lucide-react';
import { Code, EmptyState, PageHeader, StatusBadge } from '../../components/ui';
import { healthApi } from './health-api';

type Mode = 'services' | 'terminology' | 'kfa';

export function MasterDataPage({ mode = 'services' }: { mode?: Mode }) {
  const fasilitas = useQuery({ queryKey: ['health', 'facilities'], queryFn: () => healthApi.facilities() });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const layanan = useQuery({
    queryKey: ['health', 'master-services', facilityId],
    queryFn: () => healthApi.serviceCatalog(facilityId as string),
    enabled: mode === 'services' && Boolean(facilityId),
  });
  const gaps = useQuery({
    queryKey: ['health', 'master-service-gaps', facilityId],
    queryFn: () => healthApi.serviceMappingGaps(facilityId as string),
    enabled: mode === 'services' && Boolean(facilityId),
  });
  const kode = useQuery({
    queryKey: ['health', 'master-code-mappings'],
    queryFn: () => healthApi.codeMappings(),
    enabled: mode === 'services',
  });
  const katalogTerminologi = useQuery({
    queryKey: ['health', 'terminology-catalog'],
    queryFn: () => healthApi.terminologyCatalog(),
    enabled: mode === 'terminology',
  });
  const kesiapan = useQuery({
    queryKey: ['health', 'terminology-readiness'],
    queryFn: () => healthApi.terminologyReadiness(),
    enabled: mode === 'terminology',
  });
  const impor = useQuery({
    queryKey: ['health', 'terminology-imports', facilityId],
    queryFn: () => healthApi.terminologyImports(facilityId as string),
    enabled: (mode === 'terminology' || mode === 'kfa') && Boolean(facilityId),
  });
  const kfa = useQuery({
    queryKey: ['health', 'kfa-mappings', facilityId],
    queryFn: () => healthApi.kfaMappings(facilityId as string),
    enabled: mode === 'kfa' && Boolean(facilityId),
  });

  const meta = {
    services: {
      title: 'Master Data Layanan',
      description: 'Katalog layanan, kekurangan pemetaan, dan peta kode lokal ke terminologi resmi.',
      icon: Database,
    },
    terminology: {
      title: 'Terminologi',
      description: 'Kesiapan katalog ICD, LOINC, SNOMED, KFA, serta riwayat impor resmi/non-resmi.',
      icon: FileCheck2,
    },
    kfa: {
      title: 'Pemetaan KFA',
      description: 'Pemetaan produk lokal ke KFA, dengan pemisahan antara dapat dipakai dan dapat dikirim.',
      icon: Pill,
    },
  }[mode];
  const Icon = meta.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        title={meta.title}
        description={meta.description}
        breadcrumbs={[{ label: 'eMedik' }, { label: meta.title }]}
        actions={<StatusBadge status={facilityId ? 'FASILITAS TERPILIH' : 'MEMUAT FASILITAS'} tone={facilityId ? 'success' : 'warning'} />}
      />

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-200">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-semibold text-slate-950 dark:text-white">Ringkasan kerja</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Layar ini sengaja membuka data yang sudah tersedia lebih dahulu. Aksi yang berdampak
              besar seperti aktivasi layanan, penerapan impor terminologi, dan pemetaan KFA tetap
              harus lewat endpoint berizin dan validasi peladen.
            </p>
          </div>
        </div>
      </section>

      {mode === 'services' && (
        <>
          <SummaryGrid
            items={[
              ['Layanan', layanan.data?.length ?? 0],
              ['Slot kurang', gaps.data?.length ?? 0],
              ['Pemetaan kode', kode.data?.length ?? 0],
            ]}
          />
          <RecordList title="Katalog layanan" rows={layanan.data ?? []} loading={layanan.isLoading} preferred={['code', 'name', 'service_type', 'care_setting', 'is_active', 'missing_count', 'blocking_count']} />
          <RecordList title="Kekurangan pemetaan" rows={gaps.data ?? []} loading={gaps.isLoading} preferred={['slot', 'missing_slot', 'count', 'sample_services', 'blocking']} />
          <RecordList title="Pemetaan kode lokal" rows={kode.data ?? []} loading={kode.isLoading} preferred={['local_code', 'local_display', 'target_system', 'target_code', 'target_display', 'retired_at']} />
        </>
      )}

      {mode === 'terminology' && (
        <>
          <TerminologyCatalog data={katalogTerminologi.data} loading={katalogTerminologi.isLoading} />
          <RecordList title="Kesiapan katalog" rows={kesiapan.data?.items ?? []} loading={kesiapan.isLoading} preferred={['code', 'name', 'dataSource', 'editionRef', 'rowCount', 'blocker']} />
          <RecordList title="Riwayat impor" rows={impor.data ?? []} loading={impor.isLoading} preferred={['catalog_code', 'file_name', 'status', 'row_total', 'row_error', 'data_source', 'created_at']} />
        </>
      )}

      {mode === 'kfa' && (
        <>
          <RecordList title="Pemetaan KFA" rows={kfa.data ?? []} loading={kfa.isLoading} preferred={['local_id', 'local_name', 'kfa_code', 'kfa_name', 'mapping_type', 'status']} />
          <RecordList title="Impor terkait" rows={impor.data ?? []} loading={impor.isLoading} preferred={['catalog_code', 'file_name', 'status', 'row_total', 'row_error', 'data_source']} />
        </>
      )}
    </div>
  );
}

function SummaryGrid({ items }: { items: Array<[string, number]> }) {
  return (
    <section className="grid gap-3 sm:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-black text-slate-950 dark:text-white">{value}</p>
        </div>
      ))}
    </section>
  );
}

function TerminologyCatalog({ data, loading }: { data?: Record<string, unknown>; loading: boolean }) {
  const terminologies = Array.isArray(data?.terminologies) ? data.terminologies as Array<Record<string, unknown>> : [];
  const withoutKfa = data?.withoutKfa as Record<string, unknown> | undefined;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-emerald-600" aria-hidden />
        <h2 className="font-semibold text-slate-950 dark:text-white">Aturan terminologi</h2>
      </div>
      {loading ? <p className="mt-4 text-sm text-slate-500">Memuat katalog...</p> : (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {terminologies.map((row) => <RecordCard key={String(row.kode ?? row.code ?? row.nama)} row={row} preferred={['kode', 'nama', 'kegunaan', 'penghalang']} />)}
          {withoutKfa ? <RecordCard row={withoutKfa} preferred={['bolehDipakai', 'bolehDikirim', 'reason', 'message']} /> : null}
        </div>
      )}
    </section>
  );
}

function RecordList({
  title,
  rows,
  loading,
  preferred,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  loading: boolean;
  preferred: string[];
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-950 dark:text-white">{title}</h2>
        <Code>{rows.length} baris</Code>
      </div>
      {loading ? <p className="mt-4 text-sm text-slate-500">Memuat data...</p> : rows.length === 0 ? (
        <EmptyState title="Belum ada data" description="Data akan muncul setelah tenant memiliki konfigurasi atau impor terkait." />
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {rows.slice(0, 50).map((row, index) => <RecordCard key={String(row.id ?? index)} row={row} preferred={preferred} />)}
        </div>
      )}
    </section>
  );
}

function RecordCard({ row, preferred }: { row: Record<string, unknown>; preferred: string[] }) {
  const entries = useMemo(() => {
    const seen = new Set<string>();
    const chosen = preferred.filter((key) => key in row && row[key] !== null && row[key] !== undefined);
    const fallback = Object.keys(row).filter((key) => !seen.has(key)).slice(0, 6);
    return [...chosen, ...fallback].filter((key) => {
      if (seen.has(key)) return false;
      seen.add(key);
      return key in row;
    }).slice(0, 8);
  }, [preferred, row]);

  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/60">
      <div className="grid gap-2 sm:grid-cols-2">
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

export default MasterDataPage;
