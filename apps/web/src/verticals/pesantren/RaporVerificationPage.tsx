import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, FileCheck2, ShieldCheck, XCircle } from 'lucide-react';
import { api, formatDateTime } from '../../lib/api';

interface RaporVerification {
  valid: boolean;
  verificationCode: string;
  checksum: string;
  checksumShort: string;
  finalizedAt: string;
  signed: {
    waliKelas: boolean;
    kepalaSatuan: boolean;
  };
  institusi: {
    nama: string;
    logoUrl: string | null;
  };
  santri: {
    nis: string;
    nisn: string | null;
    namaLengkap: string;
    status: string;
  };
  tahunAjaran: {
    code: string;
    name: string;
  };
  ringkasan: {
    jumlahMapel?: number;
    rataRata?: number | null;
    predikatDominan?: string | null;
  };
}

export function RaporVerificationPage() {
  const { code = '' } = useParams();
  const verification = useQuery({
    queryKey: ['rapor-verification', code],
    queryFn: () => api.get<RaporVerification>(`/pesantren/public/rapor/verifikasi/${code}`, { skipRefresh: true }),
    retry: false,
  });

  const data = verification.data;

  return (
    <main className="min-h-[calc(100vh-96px)] bg-slate-50 px-4 py-10 text-slate-950">
      <div className="mx-auto max-w-3xl">
        <Link to="/santri/pondok" className="text-sm font-semibold text-emerald-700">
          Situs pondok
        </Link>

        <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ShieldCheck className="h-6 w-6" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Verifikasi Rapor</p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight">Dokumen rapor digital</h1>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Halaman ini memeriksa kode verifikasi terhadap data finalisasi rapor yang tersimpan di server pondok.
                </p>
              </div>
            </div>
            {data?.institusi.logoUrl && (
              <img src={data.institusi.logoUrl} alt="" className="h-14 w-14 rounded-xl object-contain" />
            )}
          </div>

          {verification.isLoading ? (
            <div className="mt-8 rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
              Memeriksa kode verifikasi...
            </div>
          ) : verification.isError || !data?.valid ? (
            <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-800">
              <div className="flex items-center gap-2 font-semibold">
                <XCircle className="h-5 w-5" aria-hidden />
                Dokumen tidak ditemukan
              </div>
              <p className="mt-2 text-sm">Kode ini tidak cocok dengan rapor final aktif pada situs pondok ini.</p>
            </div>
          ) : (
            <div className="mt-8 space-y-5">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-900">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5" aria-hidden />
                  Dokumen valid
                </div>
                <p className="mt-2 text-sm">
                  Rapor ini final pada {formatDateTime(data.finalizedAt)} dan cocok dengan checksum tersimpan.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <Info label="Institusi" value={data.institusi.nama} />
                <Info label="Tahun ajaran" value={`${data.tahunAjaran.code} - ${data.tahunAjaran.name}`} />
                <Info label="Nama santri" value={data.santri.namaLengkap} />
                <Info label="NIS / NISN" value={`${data.santri.nis}${data.santri.nisn ? ` / ${data.santri.nisn}` : ''}`} />
                <Info label="Kode verifikasi" value={data.verificationCode} mono />
                <Info label="Checksum" value={data.checksumShort} mono />
              </div>

              <div className="rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-2 font-semibold">
                  <FileCheck2 className="h-5 w-5 text-emerald-700" aria-hidden />
                  Ringkasan final
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <Metric label="Mata pelajaran" value={String(data.ringkasan.jumlahMapel ?? '-')} />
                  <Metric label="Rata-rata" value={data.ringkasan.rataRata == null ? '-' : String(data.ringkasan.rataRata)} />
                  <Metric label="Predikat" value={data.ringkasan.predikatDominan ?? '-'} />
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Status label="Tanda tangan wali kelas" active={data.signed.waliKelas} />
                  <Status label="Tanda tangan kepala satuan" active={data.signed.kepalaSatuan} />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Info({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 break-all text-sm font-semibold text-slate-950 ${mono ? 'font-mono' : ''}`}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}

function Status({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <span className={active ? 'font-semibold text-emerald-700' : 'font-semibold text-slate-500'}>
        {active ? 'Tertaut' : 'Belum tertaut'}
      </span>
    </div>
  );
}
