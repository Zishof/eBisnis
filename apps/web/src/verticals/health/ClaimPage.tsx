/**
 * Klaim: daftar kerja, satu klaim beserta temuannya, dan sebab penolakan.
 *
 * ## Selisih ditampilkan sebagai uang, bukan sebagai status
 *
 * `approvalGap` dan `paymentGap` adalah selisih antara yang diajukan, yang
 * disetujui, dan yang dibayar. Layar yang hanya menampilkan status
 * (`APPROVED`, `PAID`) menyembunyikan bahwa klaim sepuluh juta yang "dibayar"
 * ternyata dibayar enam setengah juta.
 *
 * Rumah sakit yang tidak melihat selisihnya akan mengira klaimnya beres, dan
 * baru menyadari kekurangannya ketika arus kasnya tidak cocok — biasanya
 * sesudah beberapa bulan, ketika alasannya sudah tidak dapat ditelusuri.
 *
 * ## Yang MENGHALANGI pengajuan dibedakan dari yang tidak
 *
 * Sama seperti kekurangan berkas pada W-2: `blocks_submission` menentukan warna
 * dan urutan. Temuan yang menghalangi menahan klaimnya; yang tidak, sekadar
 * catatan. Menyamakan keduanya membuat petugas mengejar yang mudah lebih
 * dahulu.
 *
 * ## Kelas yang tidak sama
 *
 * `billedClass` berbeda dari `entitledClass` berarti pasien naik kelas. Itu
 * bukan galat — ia sah dan lazim — tetapi ia mengubah siapa yang membayar
 * selisihnya, dan karena itu ditandai, bukan disembunyikan.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpDown, ReceiptText, TriangleAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisKlaim } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

const RUPA_STATUS: Record<string, { kelas: string; label: string }> = {
  DRAFT: { kelas: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200', label: 'Draf' },
  VERIFIED: { kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', label: 'Terverifikasi' },
  SUBMITTED: { kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', label: 'Diajukan' },
  APPROVED: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Disetujui',
  },
  PARTIALLY_APPROVED: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Disetujui sebagian',
  },
  REJECTED: { kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200', label: 'Ditolak' },
  PAID: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Dibayar',
  },
  RECONCILED: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Direkonsiliasi',
  },
  CANCELLED: { kelas: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400', label: 'Batal' },
};

const LABEL_SEBAB_TOLAK: Record<string, string> = {
  CODING_ERROR: 'Kesalahan pengkodean',
  MISSING_DOCUMENT: 'Berkas tidak lengkap',
  NOT_ELIGIBLE: 'Peserta tidak berhak',
  DUPLICATE: 'Klaim ganda',
  SERVICE_NOT_COVERED: 'Layanan tidak dijamin',
  LATE_SUBMISSION: 'Pengajuan terlambat',
  CLASS_MISMATCH: 'Kelas tidak sesuai',
  OTHER: 'Lainnya',
};

const rupiah = (n: number | null | undefined) =>
  n == null ? '—' : n.toLocaleString('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 });

export function ClaimPage() {
  const { ctx } = usePurpose();
  const toMessage = useErrorMessage();
  const [dibuka, setDibuka] = useState<string | null>(null);
  const [tahun, setTahun] = useState(new Date().getFullYear());

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const daftar = useQuery({
    queryKey: ['health', 'claims', dipakai],
    queryFn: () => healthApi.claims(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const tolak = useQuery({
    queryKey: ['health', 'claim-rejections', dipakai, tahun],
    queryFn: () => healthApi.claimRejectionReport(dipakai as string, tahun),
    enabled: Boolean(dipakai),
  });

  const detail = useQuery({
    queryKey: ['health', 'claim', dibuka],
    queryFn: () => healthApi.claim(dibuka as string, ctx),
    enabled: Boolean(dibuka),
  });

  const baris = daftar.data ?? [];
  const terhalang = baris.filter((k) => k.blocking_findings > 0);
  const selisihSetuju = baris.reduce(
    (n, k) => n + Math.max(0, (k.submitted_amount ?? 0) - (k.approved_amount ?? k.submitted_amount ?? 0)),
    0,
  );
  const selisihBayar = baris.reduce(
    (n, k) => n + Math.max(0, (k.approved_amount ?? 0) - (k.paid_amount ?? k.approved_amount ?? 0)),
    0,
  );

  return (
    <>
      <PageHeader
        title="Klaim"
        description="Selisih ditampilkan sebagai uang, bukan sebagai status — klaim yang 'dibayar' belum tentu dibayar penuh."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Klaim' }]}
      />

      <PurposeSelector />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-klaim">
            Fasilitas
          </label>
          <select
            id="fasilitas-klaim"
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
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Klaim tertahan</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              terhalang.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
            }`}
          >
            {terhalang.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Tidak disetujui</p>
          <p className="text-xl font-semibold tabular-nums text-amber-700 dark:text-amber-400">
            {rupiah(selisihSetuju)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Belum dibayar</p>
          <p className="text-xl font-semibold tabular-nums text-rose-700 dark:text-rose-400">
            {rupiah(selisihBayar)}
          </p>
        </div>
        <p className="max-w-sm text-xs text-slate-500 dark:text-slate-400">
          Dua angka terakhir tidak muncul pada layar berbasis status. Rumah sakit yang tidak
          melihatnya baru menyadari kekurangannya ketika arus kasnya tidak cocok — biasanya sesudah
          alasannya tidak lagi dapat ditelusuri.
        </p>
      </div>

      {daftar.isLoading && <LoadingState label="Memuat daftar kerja klaim…" />}
      {daftar.isError && (
        <ErrorState
          message={toMessage(daftar.error, (k, f) => f ?? k)}
          onRetry={() => void daftar.refetch()}
        />
      )}
      {daftar.data?.length === 0 && (
        <EmptyState
          title="Tidak ada klaim pada fasilitas ini"
          description="Klaim terbentuk dari kunjungan atau rawat inap yang sudah dikode."
        />
      )}

      {baris.length > 0 && (
        <div className="card mb-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Nomor</th>
                <th className="px-3 py-2 text-start font-medium">Pasien</th>
                <th className="px-3 py-2 text-start font-medium">Tanggal</th>
                <th className="px-3 py-2 text-start font-medium">Status</th>
                <th className="px-3 py-2 text-end font-medium">Diajukan</th>
                <th className="px-3 py-2 text-end font-medium">Disetujui</th>
                <th className="px-3 py-2 text-end font-medium">Dibayar</th>
                <th className="px-3 py-2 text-end font-medium">Menghalangi</th>
                <th className="px-3 py-2 text-start font-medium" />
              </tr>
            </thead>
            <tbody>
              {baris.map((k: BarisKlaim) => (
                <tr
                  key={k.id}
                  className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                    k.blocking_findings > 0 ? 'bg-rose-50/40 dark:bg-rose-950/20' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <Code>{k.claim_number}</Code>
                  </td>
                  <td className="px-3 py-2 font-medium">{k.patient_name}</td>
                  <td className="px-3 py-2">{k.service_date ?? '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`badge ${RUPA_STATUS[k.status]?.kelas ?? ''}`}>
                      {RUPA_STATUS[k.status]?.label ?? k.status}
                    </span>
                    {k.rejection_reason && (
                      <span className="mt-0.5 block text-xs text-rose-700 dark:text-rose-400">
                        {LABEL_SEBAB_TOLAK[k.rejection_reason] ?? k.rejection_reason}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{rupiah(k.submitted_amount)}</td>
                  <td
                    className={`px-3 py-2 text-end tabular-nums ${
                      k.approved_amount != null &&
                      k.submitted_amount != null &&
                      k.approved_amount < k.submitted_amount
                        ? 'text-amber-700 dark:text-amber-400'
                        : ''
                    }`}
                  >
                    {rupiah(k.approved_amount)}
                  </td>
                  <td
                    className={`px-3 py-2 text-end tabular-nums ${
                      k.paid_amount != null &&
                      k.approved_amount != null &&
                      k.paid_amount < k.approved_amount
                        ? 'text-rose-700 dark:text-rose-400'
                        : ''
                    }`}
                  >
                    {rupiah(k.paid_amount)}
                  </td>
                  <td
                    className={`px-3 py-2 text-end font-semibold tabular-nums ${
                      k.blocking_findings > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
                    }`}
                  >
                    {k.blocking_findings}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      className="text-sm text-brand-700 hover:underline dark:text-brand-300"
                      onClick={() => setDibuka(k.id === dibuka ? null : k.id)}
                    >
                      {k.id === dibuka ? 'Tutup' : 'Rincian'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dibuka && detail.data && (
        <div className="card mb-4 space-y-3 px-4 py-4">
          <h2 className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
            <ReceiptText className="h-4 w-4" aria-hidden />
            <Code>{detail.data.claimNumber}</Code>
          </h2>

          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Selisih persetujuan</dt>
              <dd className="tabular-nums">{rupiah(detail.data.approvalGap)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Selisih pembayaran</dt>
              <dd className="tabular-nums">{rupiah(detail.data.paymentGap)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500 dark:text-slate-400">Nomor SEP</dt>
              <dd>{detail.data.sepNumber ? <Code>{detail.data.sepNumber}</Code> : '—'}</dd>
            </div>
          </dl>

          {detail.data.billedClass !== detail.data.entitledClass && (
            <p className="inline-flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <ArrowUpDown className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Kelas ditagih <Code>{detail.data.billedClass}</Code>, kelas hak{' '}
              <Code>{detail.data.entitledClass}</Code>. Naik kelas itu sah dan lazim — tetapi ia
              mengubah siapa yang membayar selisihnya, jadi ditandai di sini alih-alih dibiarkan
              muncul sebagai penolakan kemudian.
            </p>
          )}

          {detail.data.message && (
            <p className="text-sm text-slate-700 dark:text-slate-200">{detail.data.message}</p>
          )}

          {detail.data.findings.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                Temuan ({detail.data.findings.length})
              </h3>
              <ul className="space-y-1.5">
                {detail.data.findings.map((t, i) => (
                  <li
                    key={`${t.finding_type}-${i}`}
                    className={`rounded-lg px-3 py-2 text-sm ${
                      t.blocks_submission
                        ? 'bg-rose-50 text-rose-900 dark:bg-rose-950 dark:text-rose-200'
                        : 'bg-slate-50 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      {t.blocks_submission && (
                        <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      )}
                      <Code>{t.finding_type}</Code>
                      {t.responsible_role && (
                        <span className="text-xs opacity-80">→ {t.responsible_role}</span>
                      )}
                      {t.resolved_at && <span className="text-xs opacity-70">selesai</span>}
                    </span>
                    <span className="mt-0.5 block">{t.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {detail.data.flags.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-slate-900 dark:text-slate-100">
                Penanda telaah ({detail.data.flags.length})
              </h3>
              <ul className="space-y-1.5">
                {detail.data.flags.map((p) => (
                  <li key={p.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800">
                    <span className="flex flex-wrap items-center gap-2">
                      <Code>{p.flag_type}</Code>
                      {p.reviewed_at ? (
                        <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          sudah ditelaah{p.review_outcome ? `: ${p.review_outcome}` : ''}
                        </span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          menunggu telaah
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block text-slate-700 dark:text-slate-200">{p.message}</span>
                    {p.review_note && (
                      <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                        {p.review_note}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* --- Sebab penolakan ------------------------------------------------ */}
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-medium text-slate-900 dark:text-slate-100">Sebab penolakan</h2>
        <div>
          <label className="field-label" htmlFor="tahun-tolak">
            Tahun
          </label>
          <input
            id="tahun-tolak"
            className="field-input w-28"
            inputMode="numeric"
            value={tahun}
            onChange={(e) => setTahun(Number(e.target.value) || new Date().getFullYear())}
          />
        </div>
      </div>

      {tolak.data?.length === 0 && (
        <EmptyState
          title="Belum ada klaim yang ditolak pada tahun ini"
          description="Laporan ini menghitung uang yang hilang per sebab, bukan hanya jumlah klaimnya."
        />
      )}

      {tolak.data && tolak.data.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Sebab</th>
                <th className="px-3 py-2 text-end font-medium">Jumlah klaim</th>
                <th className="px-3 py-2 text-end font-medium">Uang yang hilang</th>
              </tr>
            </thead>
            <tbody>
              {tolak.data.map((r) => (
                <tr
                  key={r.rejection_reason}
                  className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                >
                  <td className="px-3 py-2">
                    {LABEL_SEBAB_TOLAK[r.rejection_reason] ?? r.rejection_reason}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums">{r.claim_count}</td>
                  <td className="px-3 py-2 text-end font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                    {rupiah(r.total_gap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
            Diurut menurut UANG yang hilang, bukan menurut jumlah klaimnya. Sebab yang mengenai tiga
            klaim besar merugikan lebih banyak daripada sebab yang mengenai tiga puluh klaim kecil —
            dan yang diurut menurut jumlah akan menyuruh petugas mengejar yang salah.
          </p>
        </div>
      )}
    </>
  );
}
