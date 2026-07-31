/**
 * Antrian farmasi: telaah apoteker dan penyerahan obat.
 *
 * Dua hal yang menentukan bentuk layar ini, dan keduanya soal apa yang
 * benar-benar terbaca ketika apotek sedang ramai.
 *
 * 1. **Obat terkendali dan obat berisiko tinggi ditandai di daftar, bukan hanya
 *    di rincian.** Apoteker yang harus membuka satu per satu untuk mengetahui
 *    mana yang menuntut kehati-hatian akan berhenti membukanya pada resep
 *    kelima belas.
 *
 * 2. **Hanya peringatan yang menahan yang berwarna merah pekat.** Bila semua
 *    peringatan tampak sama mendesak, tidak ada yang tampak mendesak — dan yang
 *    benar-benar berbahaya tenggelam di antara pengingat biasa.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Lock, PackageCheck, ShieldCheck, Siren } from 'lucide-react';
import { EmptyState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  LABEL_GOLONGAN_OBAT,
  LABEL_STATUS_RESEP,
  RUPA_PERINGATAN,
  umurDari,
  type AntrianResep,
  type BarisResep,
  type PeringatanObat,
} from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

export function PharmacyPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dipilih, setDipilih] = useState<string | null>(null);
  const [catatanTelaah, setCatatanTelaah] = useState('');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const antrian = useQuery({
    queryKey: ['health', 'pharmacy-queue', facilityId],
    queryFn: () => healthApi.pharmacyQueue(facilityId as string),
    enabled: Boolean(facilityId),
    // Resep masuk sepanjang hari dari poliklinik. Menuntut apoteker menekan
    // muat ulang berarti resep menunggu selama ia tidak menekannya.
    refetchInterval: 15_000,
  });

  const resep = useQuery({
    queryKey: ['health', 'prescription', dipilih],
    queryFn: () => healthApi.prescription(dipilih as string, ctx),
    enabled: Boolean(dipilih && ctx.purpose),
  });

  const telaah = useMutation({
    mutationFn: (setuju: boolean) =>
      healthApi.reviewPrescription(dipilih as string, { approve: setuju, note: catatanTelaah }, ctx),
    onSuccess: (hasil) => {
      toast.push(
        hasil.status === 'REVIEWED' ? 'Resep disetujui apoteker.' : 'Resep ditolak dan dikembalikan.',
        hasil.status === 'REVIEWED' ? 'success' : 'info',
      );
      setCatatanTelaah('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'pharmacy-queue'] });
      void queryClient.invalidateQueries({ queryKey: ['health', 'prescription', dipilih] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  if (!ctx.purpose) return <PurposeSelector />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Farmasi"
        description="Telaah resep dan penyerahan obat. Yang meresepkan bukan yang menelaah."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,26rem)_1fr]">
        {/* --- Antrian --- */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            Menunggu telaah dan penyerahan
          </h2>

          {antrian.isLoading ? (
            <p className="text-sm text-slate-500">Memuat antrian…</p>
          ) : !antrian.data?.length ? (
            <EmptyState
              title="Tidak ada resep menunggu"
              description="Resep yang baru ditulis dokter akan muncul di sini dalam beberapa detik."
            />
          ) : (
            <ul className="space-y-2">
              {antrian.data.map((r) => (
                <BarisAntrian
                  key={r.id}
                  resep={r}
                  aktif={r.id === dipilih}
                  onPilih={() => setDipilih(r.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* --- Rincian --- */}
        <section>
          {!dipilih ? (
            <EmptyState
              title="Pilih satu resep"
              description="Rincian obat, peringatan yang pernah muncul, dan tombol telaah tampil di sini."
            />
          ) : resep.isLoading ? (
            <p className="text-sm text-slate-500">Memuat resep…</p>
          ) : !resep.data ? (
            <EmptyState title="Resep tidak dapat dibaca" description="Coba pilih ulang dari daftar." />
          ) : (
            <div className="space-y-5 rounded-xl border border-slate-200 p-5 dark:border-slate-700">
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-sm text-slate-500">{resep.data.prescription_number}</p>
                  <h3 className="text-lg font-semibold">{resep.data.patient_name}</h3>
                  <p className="text-sm text-slate-500">
                    {resep.data.medical_record_number ?? 'tanpa nomor rekam medis'} ·{' '}
                    {umurDari(resep.data.birth_date)}
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium dark:bg-slate-800">
                  {LABEL_STATUS_RESEP[resep.data.status] ?? resep.data.status}
                </span>
              </header>

              <ul className="space-y-4">
                {resep.data.lines.map((b) => (
                  <BarisObat key={b.id} baris={b} />
                ))}
              </ul>

              {/* --- Telaah --- */}
              {['PRESCRIBED', 'UNDER_REVIEW'].includes(resep.data.status) ? (
                <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-900/40">
                  <label className="block text-sm font-medium" htmlFor="catatan-telaah">
                    Catatan telaah
                  </label>
                  <textarea
                    id="catatan-telaah"
                    rows={2}
                    value={catatanTelaah}
                    onChange={(e) => setCatatanTelaah(e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
                    placeholder="Wajib diisi bila resep ditolak, agar dokter dapat menindaklanjuti."
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={telaah.isPending}
                      onClick={() => telaah.mutate(true)}
                      className="inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <ShieldCheck className="h-4 w-4" aria-hidden />
                      Setujui
                    </button>
                    <button
                      type="button"
                      disabled={telaah.isPending || !catatanTelaah.trim()}
                      onClick={() => telaah.mutate(false)}
                      className="inline-flex items-center gap-2 rounded-md border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
                    >
                      Tolak dan kembalikan
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Penolakan menuntut alasan; persetujuan tidak. Menuntut catatan pada langkah yang
                    dijalankan ratusan kali sehari hanya menghasilkan ratusan catatan bertuliskan
                    &ldquo;ok&rdquo;, dan catatan semacam itu mengubur yang bermakna.
                  </p>
                </div>
              ) : resep.data.reviewed_at ? (
                <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                  <ShieldCheck className="h-4 w-4" aria-hidden />
                  Sudah ditelaah apoteker
                  {resep.data.review_note ? ` — ${resep.data.review_note}` : ''}
                </p>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// --- Bagian tampilan ---------------------------------------------------------

function BarisAntrian({
  resep,
  aktif,
  onPilih,
}: {
  resep: AntrianResep;
  aktif: boolean;
  onPilih: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPilih}
        className={`w-full rounded-lg border p-3 text-left transition ${
          aktif
            ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/40'
            : 'border-slate-200 hover:border-slate-300 dark:border-slate-700'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium">{resep.patient_name}</p>
            <p className="font-mono text-xs text-slate-500">{resep.prescription_number}</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] dark:bg-slate-800">
            {LABEL_STATUS_RESEP[resep.status] ?? resep.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>{resep.line_count} obat</span>
          {/*
           * Ditandai di daftar, bukan hanya di rincian. Apoteker yang harus
           * membuka satu per satu untuk tahu mana yang menuntut kehati-hatian
           * akan berhenti membukanya pada resep kelima belas.
           */}
          {resep.has_controlled ? (
            <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
              <Lock className="h-3 w-3" aria-hidden />
              Terkendali
            </span>
          ) : null}
          {resep.has_high_alert ? (
            <span className="inline-flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
              <Siren className="h-3 w-3" aria-hidden />
              Risiko tinggi
            </span>
          ) : null}
        </div>
      </button>
    </li>
  );
}

function BarisObat({ baris }: { baris: BarisResep }) {
  const sisa = baris.quantity - baris.dispensed_qty;
  const peringatan = baris.override_alerts?.alerts ?? [];

  return (
    <li className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-medium">
            {baris.line_no}. {baris.generic_name}
            {baris.brand_name ? (
              <span className="ml-2 text-sm font-normal text-slate-500">({baris.brand_name})</span>
            ) : null}
          </p>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {baris.dose_value} {baris.dose_unit} · {baris.frequency_code} · {baris.route}
            {baris.duration_days ? ` · ${baris.duration_days} hari` : ''}
            {baris.is_prn ? ' · bila perlu' : ''}
          </p>
          {baris.instruction ? (
            <p className="mt-1 text-sm italic text-slate-500">{baris.instruction}</p>
          ) : null}
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">
            {baris.dispensed_qty} / {baris.quantity}
          </p>
          <p className="text-xs text-slate-500">{sisa > 0 ? `sisa ${sisa}` : 'lengkap'}</p>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">
          {LABEL_GOLONGAN_OBAT[baris.drug_class] ?? baris.drug_class}
        </span>
        {baris.is_controlled ? (
          <span className="inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 font-medium text-rose-800 dark:bg-rose-950/60 dark:text-rose-200">
            <Lock className="h-3 w-3" aria-hidden />
            Terkendali
          </span>
        ) : null}
        {baris.is_high_alert ? (
          <span className="rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800 dark:bg-orange-950/60 dark:text-orange-200">
            Perlu pemeriksaan ganda
          </span>
        ) : null}
        {baris.is_lasa ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
            LASA — nama mirip
          </span>
        ) : null}
      </div>

      {peringatan.length ? (
        <div className="mt-3 space-y-2">
          {peringatan.map((p, i) => (
            <Peringatan key={`${p.type}-${i}`} peringatan={p} />
          ))}
          {baris.override_alerts?.overrideReason ? (
            <p className="rounded bg-slate-50 p-2 text-xs text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
              <strong>Alasan dokter meneruskan:</strong> {baris.override_alerts.overrideReason}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function Peringatan({ peringatan }: { peringatan: PeringatanObat }) {
  const rupa = RUPA_PERINGATAN[peringatan.severity] ?? RUPA_PERINGATAN.INFO;
  return (
    <p className={`flex items-start gap-2 rounded border-l-4 px-3 py-2 text-sm ${rupa.kelas}`}>
      {peringatan.blocking ? (
        <Siren className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      )}
      <span>
        <span className="font-semibold">{rupa.label}: </span>
        {peringatan.message}
      </span>
    </p>
  );
}

export default PharmacyPage;

/** Ikon yang belum terpakai di layar ini tetapi dipakai layar penyerahan. */
export const IKON_PENYERAHAN = PackageCheck;
