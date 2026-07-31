/**
 * Daftar fasilitas kesehatan beserta unit layanannya.
 *
 * Halaman ini tidak menyentuh rekam medis, sehingga tidak menuntut tujuan
 * penggunaan — dan itu perbedaan yang sengaja terlihat: yang menyentuh pasien
 * memakai gerbang tujuan, yang tidak, tidak.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight } from 'lucide-react';
import { Code, DataGrid, EmptyState, PageHeader, StatusBadge, type GridColumn } from '../../components/ui';
import { healthApi, type Fasilitas } from './health-api';

const LABEL_KATEGORI: Record<string, string> = {
  HOSPITAL: 'Rumah Sakit',
  CLINIC: 'Klinik',
  PUSKESMAS: 'Puskesmas',
  POSYANDU: 'Posyandu',
  POSKESDES: 'Poskesdes',
  LABORATORY: 'Laboratorium',
  PHARMACY: 'Apotek',
  OTHER: 'Lainnya',
};

const LABEL_UNIT: Record<string, string> = {
  POLYCLINIC: 'Poliklinik',
  WARD: 'Bangsal',
  EMERGENCY: 'IGD',
  OPERATING_THEATRE: 'Kamar Operasi',
  ICU: 'Perawatan Intensif',
  LABORATORY: 'Laboratorium',
  RADIOLOGY: 'Radiologi',
  PHARMACY: 'Farmasi',
  BLOOD_BANK: 'Bank Darah',
  CSSD: 'CSSD',
  AMBULANCE: 'Ambulans',
  MORGUE: 'Kamar Jenazah',
  HOMECARE: 'Perawatan Rumah',
  NUTRITION: 'Gizi',
  REHAB: 'Rehabilitasi',
  ADMINISTRATION: 'Administrasi',
  SERVICE_POINT: 'Titik Layanan',
  OTHER: 'Lainnya',
};

export function FacilityPage() {
  const [terpilih, setTerpilih] = useState<string | null>(null);

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });

  const unit = useQuery({
    queryKey: ['health', 'units', terpilih],
    queryFn: () => healthApi.units(terpilih as string),
    enabled: Boolean(terpilih),
  });

  const kolom: Array<GridColumn<Fasilitas & Record<string, unknown>>> = [
    { key: 'code', header: 'Kode', render: (r) => <Code>{r.code}</Code> },
    { key: 'name', header: 'Nama' },
    {
      key: 'facility_type_code',
      header: 'Jenis',
      render: (r) => (
        <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {LABEL_KATEGORI[r.category] ?? r.facility_type_name}
        </span>
      ),
    },
    {
      key: 'hospital_class',
      header: 'Kelas',
      render: (r) => (r.hospital_class ? <Code>{r.hospital_class}</Code> : '—'),
    },
    { key: 'timezone', header: 'Zona waktu' },
    {
      key: 'is_active',
      header: 'Status',
      render: (r) => <StatusBadge status={r.is_active ? 'ACTIVE' : 'SUSPENDED'} />,
    },
    {
      key: 'id',
      header: '',
      render: (r) => (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-sm text-brand-700 hover:underline dark:text-brand-300"
          onClick={() => setTerpilih(r.id === terpilih ? null : r.id)}
        >
          Unit layanan
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Fasilitas Kesehatan"
        description="Rumah sakit, klinik, puskesmas, posyandu, dan apotek pada ruang kerja ini."
        breadcrumbs={[{ label: 'eMedik' }, { label: 'Fasilitas' }]}
      />

      <DataGrid
        columns={kolom}
        rows={(fasilitas.data ?? []) as Array<Fasilitas & Record<string, unknown>>}
        loading={fasilitas.isLoading}
        error={fasilitas.isError ? 'Daftar fasilitas tidak dapat dimuat.' : undefined}
        rowKey={(r) => r.id}
        onRetry={() => void fasilitas.refetch()}
      />

      {terpilih && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white">
            <Building2 className="h-4 w-4" aria-hidden />
            Unit layanan
          </h2>

          {unit.isLoading && <p className="text-sm text-slate-500">Memuat…</p>}

          {!unit.isLoading && (unit.data ?? []).length === 0 && (
            <EmptyState
              title="Belum ada unit layanan"
              description={
                'Unit layanan menentukan ke mana pasien didaftarkan. Poliklinik menerima rawat ' +
                'jalan; bangsal menerima rawat inap — dan jenis unit yang tidak sesuai kemampuan ' +
                'fasilitasnya akan ditolak saat dibuat.'
              }
            />
          )}

          {(unit.data ?? []).length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(unit.data ?? []).map((u) => {
                const r = u as Record<string, string | boolean>;
                return (
                  <article key={String(r.id)} className="card p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-medium text-slate-900 dark:text-white">{String(r.name)}</h3>
                      <span className="badge bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {LABEL_UNIT[String(r.unit_type)] ?? String(r.unit_type)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      <Code>{String(r.code)}</Code>
                    </p>
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                      {r.accepts_outpatient ? 'Menerima rawat jalan' : null}
                      {r.accepts_outpatient && r.accepts_inpatient ? ' · ' : null}
                      {r.accepts_inpatient ? 'Menerima rawat inap' : null}
                      {!r.accepts_outpatient && !r.accepts_inpatient ? 'Unit penunjang' : null}
                    </p>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      )}
    </>
  );
}
