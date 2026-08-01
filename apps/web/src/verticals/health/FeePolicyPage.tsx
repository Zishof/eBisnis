/**
 * Kebijakan jasa: pembagian jasa medis antara fasilitas dan pemberi layanan.
 *
 * ## Tiga penanda yang harus dibaca bersama
 *
 * ```
 * active               → dipakai menghitung
 * is_sample_data       → ini contoh, bukan kesepakatan sungguhan
 * production_approved  → sudah disetujui untuk dipakai pada uang sungguhan
 * ```
 *
 * Ketiganya berdiri sendiri, dan gabungan yang berbahaya adalah **aktif tetapi
 * belum disetujui untuk produksi**. Kebijakan seperti itu menghitung uang
 * sungguhan memakai persentase yang belum disepakati siapa pun — dan tidak ada
 * satu pun galat yang muncul.
 *
 * Karena itu layar ini menghitungnya sebagai angka tersendiri di bagian atas.
 *
 * ## Persentase yang tidak berjumlah 100
 *
 * `total_percent` datang dari peladen. Kebijakan yang jumlahnya bukan 100
 * berarti ada uang yang tidak diberikan kepada siapa pun, atau diberikan dua
 * kali. Ditandai, bukan dibulatkan diam-diam.
 *
 * ## Yang TIDAK ada di layar ini
 *
 * Tidak ada tombol yang menyetel persentase langsung ke produksi. Persentase
 * jasa datang dari kesepakatan fasilitas, dan kesepakatan yang dapat diubah
 * seorang diri lewat satu layar bukan kesepakatan.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HandCoins, TriangleAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisKebijakanJasa } from './health-api';

const LABEL_BASIS: Record<string, string> = {
  PAID_CLAIM: 'Klaim yang dibayar',
  APPROVED_CLAIM: 'Klaim yang disetujui',
  GROSS_REVENUE: 'Pendapatan kotor',
  NET_REVENUE: 'Pendapatan bersih',
};

const LABEL_PENERIMA: Record<string, string> = {
  DOCTOR_FEE: 'Jasa dokter',
  FACILITY_FEE: 'Jasa fasilitas',
  NURSE_FEE: 'Jasa perawat',
  ANESTHETIST_FEE: 'Jasa anestesi',
  SYSTEM_FEE: 'Fee sistem',
  INVESTOR_FEE: 'Fee investor',
  OTHER: 'Lainnya',
};

const persen = (n: number | null | undefined) => (n == null ? '—' : `${Number(n).toFixed(1)}%`);

export function FeePolicyPage() {
  const toMessage = useErrorMessage();
  const [dibuka, setDibuka] = useState<string | null>(null);

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const kebijakan = useQuery({
    queryKey: ['health', 'fee-policies', dipakai],
    queryFn: () => healthApi.feePolicies(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const rinci = useQuery({
    queryKey: ['health', 'fee-policy', dibuka],
    queryFn: () => healthApi.feePolicy(dibuka as string),
    enabled: Boolean(dibuka),
  });

  const daftar = kebijakan.data ?? [];
  /*
   * Gabungan yang berbahaya: aktif, bukan data contoh, tetapi belum disetujui
   * untuk produksi. Ia menghitung uang sungguhan memakai persentase yang belum
   * disepakati siapa pun.
   */
  const aktifBelumDisetujui = daftar.filter(
    (k) => k.active && !k.is_sample_data && !k.production_approved,
  );
  const jumlahSalah = daftar.filter(
    (k) => k.total_percent != null && Math.abs(Number(k.total_percent) - 100) > 0.01,
  );

  return (
    <>
      <PageHeader
        title="Kebijakan Jasa"
        description="Aktif, data contoh, dan disetujui-untuk-produksi adalah tiga hal berbeda — dan gabungan yang berbahaya tidak menimbulkan galat apa pun."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Kebijakan Jasa' }]}
      />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-jasa">
            Fasilitas
          </label>
          <select
            id="fasilitas-jasa"
            className="field-input"
            value={dipakai ?? ''}
            onChange={(e) => setFacilityId(e.target.value)}
          >
            {(fasilitas.data ?? []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Aktif, belum disetujui produksi
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              aktifBelumDisetujui.length > 0
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-slate-400'
            }`}
          >
            {aktifBelumDisetujui.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Jumlah persen bukan 100
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              jumlahSalah.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
            }`}
          >
            {jumlahSalah.length}
          </p>
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Kebijakan yang jumlahnya bukan 100 berarti ada uang yang tidak diberikan kepada siapa
          pun, atau diberikan dua kali.
        </p>
      </div>

      {kebijakan.isLoading && <LoadingState label="Memuat kebijakan jasa…" />}
      {kebijakan.isError && (
        <ErrorState
          message={toMessage(kebijakan.error, (k, f) => f ?? k)}
          onRetry={() => void kebijakan.refetch()}
        />
      )}
      {kebijakan.data?.length === 0 && (
        <EmptyState
          title="Belum ada kebijakan jasa pada fasilitas ini"
          description="Tanpa kebijakan, tidak ada pembagian yang dapat dihitung — dan settlement tidak dapat dijalankan."
        />
      )}

      {daftar.length > 0 && (
        <div className="card mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Kode</th>
                <th className="px-3 py-2 text-start font-medium">Nama</th>
                <th className="px-3 py-2 text-start font-medium">Dasar hitung</th>
                <th className="px-3 py-2 text-end font-medium">Baris</th>
                <th className="px-3 py-2 text-end font-medium">Jumlah %</th>
                <th className="px-3 py-2 text-start font-medium">Keadaan</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {daftar.map((k: BarisKebijakanJasa) => {
                const jumlahMeleset =
                  k.total_percent != null && Math.abs(Number(k.total_percent) - 100) > 0.01;
                const bahaya = k.active && !k.is_sample_data && !k.production_approved;
                return (
                  <tr
                    key={k.id}
                    className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                      bahaya ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                    }`}
                  >
                    <td className="px-3 py-2">
                      <Code>{k.code}</Code>
                    </td>
                    <td className="px-3 py-2 font-medium">{k.name}</td>
                    <td className="px-3 py-2">{LABEL_BASIS[k.basis] ?? k.basis}</td>
                    <td className="px-3 py-2 text-end tabular-nums">{k.line_count}</td>
                    <td
                      className={`px-3 py-2 text-end tabular-nums ${
                        jumlahMeleset ? 'font-semibold text-rose-700 dark:text-rose-400' : ''
                      }`}
                    >
                      {persen(k.total_percent)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="flex flex-wrap gap-1">
                        {k.active && (
                          <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                            aktif
                          </span>
                        )}
                        {k.is_sample_data && (
                          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            data contoh
                          </span>
                        )}
                        {k.production_approved ? (
                          <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                            disetujui produksi
                          </span>
                        ) : (
                          <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                            belum disetujui produksi
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-sm text-brand-700 hover:underline dark:text-brand-300"
                        onClick={() => setDibuka(k.id === dibuka ? null : k.id)}
                      >
                        {k.id === dibuka ? 'Tutup' : 'Baris'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {aktifBelumDisetujui.length > 0 && (
        <div className="card mb-4 flex items-start gap-2 border-s-4 border-s-rose-400 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" aria-hidden />
          <p className="text-sm text-slate-800 dark:text-slate-200">
            <strong>{aktifBelumDisetujui.length} kebijakan aktif belum disetujui untuk
            produksi.</strong>{' '}
            Ia menghitung uang sungguhan memakai persentase yang belum disepakati siapa pun, dan
            tidak ada satu pun galat yang muncul karenanya. Persetujuan produksi bukan formalitas —
            ia satu-satunya tanda bahwa angkanya sudah dilihat orang yang berhak menyepakatinya.
          </p>
        </div>
      )}

      {dibuka && rinci.data && (
        <div className="card space-y-3 px-4 py-4">
          <h2 className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
            <HandCoins className="h-4 w-4" aria-hidden />
            {rinci.data.name} <Code>versi {rinci.data.version}</Code>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 text-start font-medium">Penerima</th>
                  <th className="px-3 py-2 text-start font-medium">Cara</th>
                  <th className="px-3 py-2 text-end font-medium">Nilai</th>
                  <th className="px-3 py-2 text-start font-medium">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {rinci.data.lines.map((b, i) => (
                  <tr
                    key={`${b.recipient}-${i}`}
                    className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                  >
                    <td className="px-3 py-2">{LABEL_PENERIMA[b.recipient] ?? b.recipient}</td>
                    <td className="px-3 py-2">{b.method}</td>
                    <td className="px-3 py-2 text-end tabular-nums">
                      {b.method === 'PERCENTAGE' ? persen(b.value) : b.value}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {b.note ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/*
            Catatan dari peladen, ditampilkan apa adanya. Ia menerangkan dari
            mana persentasenya berasal — dan itu keterangan yang paling sering
            ditanyakan dokter yang merasa bagiannya keliru.
          */}
          {rinci.data.note && (
            <p className="text-sm text-slate-600 dark:text-slate-300">{rinci.data.note}</p>
          )}
        </div>
      )}
    </>
  );
}
