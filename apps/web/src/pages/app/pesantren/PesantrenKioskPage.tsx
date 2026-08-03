import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api, formatMoney } from '../../../lib/api';
import { PageHeader, StatusBadge } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface KioskResult {
  santri?: {
    id: string;
    nis: string;
    nama_lengkap: string;
    status: string;
  };
  kartu?: {
    id: string;
    nomor_kartu: string;
    jenis: string;
    status: string;
  };
  dompet?: {
    id: string;
    saldo: string;
    batas_harian: string | null;
    status: string;
  } | null;
}

export function PesantrenKioskPage() {
  const toMessage = useErrorMessage();
  const [nomorKartu, setNomorKartu] = useState('');
  const [nomorDicari, setNomorDicari] = useState('');

  const hasil = useQuery({
    queryKey: ['pesantren-kiosk-kartu', nomorDicari],
    enabled: nomorDicari.length > 0,
    queryFn: () => api.get<KioskResult>(`/pesantren/kiosk/kartu/${encodeURIComponent(nomorDicari)}`),
  });

  return (
    <>
      <PageHeader
        title="Kiosk Santri"
        description="Pindai atau cari nomor kartu santri untuk melihat identitas dan dompet."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Kiosk' }]}
      />

      <div className="card mb-4 p-5">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            setNomorDicari(nomorKartu.trim());
          }}
        >
          <div className="min-w-[260px] flex-1">
            <label className="field-label" htmlFor="kiosk-nomor-kartu">
              Nomor kartu
            </label>
            <input
              id="kiosk-nomor-kartu"
              className="field-input"
              value={nomorKartu}
              onChange={(e) => setNomorKartu(e.target.value)}
              placeholder="RFID-000123"
            />
          </div>
          <button type="submit" className="btn-primary" disabled={!nomorKartu.trim() || hasil.isFetching}>
            <Search className="h-4 w-4" aria-hidden />
            Cari
          </button>
        </form>
      </div>

      {hasil.isError && (
        <div className="card border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {toMessage(hasil.error, (_key, fallback) => fallback ?? 'Kartu tidak ditemukan atau tidak dapat dipindai.')}
        </div>
      )}

      {hasil.data && (
        <div className="grid gap-4 lg:grid-cols-3">
          <InfoCard title="Santri">
            <Info label="NIS" value={hasil.data.santri?.nis} />
            <Info label="Nama" value={hasil.data.santri?.nama_lengkap} />
            <div className="mt-2">
              <StatusBadge status={hasil.data.santri?.status ?? '-'} />
            </div>
          </InfoCard>
          <InfoCard title="Kartu">
            <Info label="Nomor" value={hasil.data.kartu?.nomor_kartu} />
            <Info label="Jenis" value={hasil.data.kartu?.jenis} />
            <div className="mt-2">
              <StatusBadge status={hasil.data.kartu?.status ?? '-'} />
            </div>
          </InfoCard>
          <InfoCard title="Dompet">
            <Info label="Saldo" value={formatMoney(hasil.data.dompet?.saldo ?? 0)} />
            <Info label="Batas harian" value={hasil.data.dompet?.batas_harian ? formatMoney(hasil.data.dompet.batas_harian) : '-'} />
            <div className="mt-2">
              <StatusBadge status={hasil.data.dompet?.status ?? '-'} />
            </div>
          </InfoCard>
        </div>
      )}
    </>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div>
      <span className="text-slate-500">{label}: </span>
      <span className="font-medium text-slate-900 dark:text-white">{value ?? '-'}</span>
    </div>
  );
}
