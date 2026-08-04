/**
 * Keselamatan pasien: papan insiden, tindakan perbaikan, penutupan.
 *
 * ## Urutannya bukan menurut keparahan
 *
 * Peladen mengurutkannya begini: **yang belum ditutup dan sudah lewat tenggat
 * paling atas**, baru sesudah itu menurut derajatnya.
 *
 * Alasannya perlu ditulis di layar, sebab urutan ini akan terasa keliru bagi
 * yang pertama kali melihatnya: kejadian merah yang sudah ditelaah *sudah
 * dikerjakan*; kejadian hijau yang terlupa dua pekan adalah pekerjaan yang
 * menumpuk diam-diam. Papan yang diurut menurut derajat menampilkan yang merah
 * terus-menerus sampai orang berhenti melihatnya.
 *
 * ## Dua penjaga yang ditegakkan peladen, dan dijelaskan di sini
 *
 * 1. **Insiden tidak dapat ditutup tanpa tindakan perbaikan.** Yang ditutup
 *    tanpa tindakan akan terjadi lagi — itu satu-satunya hal yang dapat
 *    dikatakan dengan pasti tentangnya.
 * 2. **Pelapor tidak menutup laporannya sendiri pada kejadian merah atau
 *    kuning.** Bukan karena ia tidak dapat dipercaya, melainkan karena ia pihak
 *    yang terlibat — dan telaah oleh pihak yang terlibat bukan telaah.
 *
 * Keduanya dijelaskan di layar **sebelum** tombolnya ditekan. Penjaga yang baru
 * menjelaskan dirinya sesudah ditolak terasa sebagai penghalang; penjaga yang
 * menjelaskan lebih dahulu terasa sebagai aturan.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ShieldPlus, TriangleAlert, Wrench } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, type BarisInsiden } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

/** Kosakata peladen, disalin dari `BAHAYA` pada controller. */
const BAHAYA = [
  { kode: 'NEAR_MISS', label: 'Nyaris cedera' },
  { kode: 'NO_HARM', label: 'Tidak cedera' },
  { kode: 'MILD', label: 'Cedera ringan' },
  { kode: 'MODERATE', label: 'Cedera sedang' },
  { kode: 'SEVERE', label: 'Cedera berat' },
  { kode: 'DEATH', label: 'Meninggal' },
];

const JENIS = [
  'MEDICATION',
  'FALL',
  'SURGICAL',
  'INFECTION',
  'IDENTIFICATION',
  'EQUIPMENT',
  'BLOOD',
  'DIAGNOSTIC',
  'OTHER',
];

const LABEL_JENIS: Record<string, string> = {
  MEDICATION: 'Obat',
  FALL: 'Jatuh',
  SURGICAL: 'Bedah',
  INFECTION: 'Infeksi',
  IDENTIFICATION: 'Salah identitas',
  EQUIPMENT: 'Alat',
  BLOOD: 'Darah',
  DIAGNOSTIC: 'Diagnostik',
  OTHER: 'Lainnya',
};

const RUPA_DERAJAT: Record<string, { kelas: string; label: string }> = {
  RED: { kelas: 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200', label: 'Merah' },
  YELLOW: {
    kelas: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200',
    label: 'Kuning',
  },
  GREEN: {
    kelas: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
    label: 'Hijau',
  },
  BLUE: { kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200', label: 'Biru' },
};

const tanggal = (t: string | null) => (t ? t.slice(0, 10) : '—');

function lewatTenggat(i: BarisInsiden): boolean {
  return !i.closed_at && Boolean(i.review_due_at) && Date.parse(i.review_due_at as string) < Date.now();
}

export function SafetyPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [lapor, setLapor] = useState(false);
  const [baru, setBaru] = useState({
    incidentType: 'MEDICATION',
    description: '',
    immediateAction: '',
    harmLevel: 'NEAR_MISS',
    reachedPatient: false,
    anonymous: false,
  });
  const [ditindak, setDitindak] = useState<string | null>(null);
  const [tindakan, setTindakan] = useState('');
  const [jenisTindakan, setJenisTindakan] = useState('PROCESS');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const [facilityId, setFacilityId] = useState<string | null>(null);
  const dipakai = facilityId ?? fasilitas.data?.[0]?.id ?? null;

  const papan = useQuery({
    queryKey: ['health', 'incidents', dipakai],
    queryFn: () => healthApi.incidents(dipakai as string),
    enabled: Boolean(dipakai),
  });

  const laporkan = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.reportIncident(body, ctx),
    onSuccess: () => {
      toast.push('Laporan insiden tercatat.', 'success');
      setLapor(false);
      setBaru({
        incidentType: 'MEDICATION',
        description: '',
        immediateAction: '',
        harmLevel: 'NEAR_MISS',
        reachedPatient: false,
        anonymous: false,
      });
      void queryClient.invalidateQueries({ queryKey: ['health', 'incidents'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const tambahTindakan = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      healthApi.addIncidentAction(id, body, ctx),
    onSuccess: () => {
      toast.push('Tindakan perbaikan tercatat.', 'success');
      setDitindak(null);
      setTindakan('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'incidents'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const tutup = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      healthApi.closeIncident(id, body, ctx),
    onSuccess: () => {
      toast.push('Insiden ditutup.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['health', 'incidents'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const daftar = papan.data ?? [];
  const terbuka = daftar.filter((i) => !i.closed_at);
  const lewat = terbuka.filter(lewatTenggat);

  return (
    <>
      <PageHeader
        title="Keselamatan Pasien"
        description="Diurutkan menurut yang terlupa, bukan menurut yang paling berat."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Keselamatan Pasien' }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setLapor((v) => !v)}>
            <ShieldPlus className="h-4 w-4" aria-hidden />
            Laporkan insiden
          </button>
        }
      />

      <PurposeSelector />

      <div className="card mb-4 flex flex-wrap items-end gap-6 px-4 py-4">
        <div>
          <label className="field-label" htmlFor="fasilitas-keselamatan">
            Fasilitas
          </label>
          <select
            id="fasilitas-keselamatan"
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
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Belum ditutup</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {terbuka.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Lewat tenggat</p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              lewat.length > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-slate-400'
            }`}
          >
            {lewat.length}
          </p>
        </div>
        <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
          Angka kedua yang menentukan. Kejadian berat yang sudah ditelaah sudah dikerjakan;
          kejadian ringan yang terlupa dua pekan adalah pekerjaan yang menumpuk diam-diam.
        </p>
      </div>

      {lapor && (
        <div className="card mb-4 space-y-3 px-4 py-4">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">Laporan insiden baru</h2>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="jenis-insiden">
                Jenis
              </label>
              <select
                id="jenis-insiden"
                className="field-input"
                value={baru.incidentType}
                onChange={(e) => setBaru({ ...baru, incidentType: e.target.value })}
              >
                {JENIS.map((j) => (
                  <option key={j} value={j}>
                    {LABEL_JENIS[j] ?? j}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="tingkat-bahaya">
                Tingkat bahaya
              </label>
              <select
                id="tingkat-bahaya"
                className="field-input"
                value={baru.harmLevel}
                onChange={(e) => setBaru({ ...baru, harmLevel: e.target.value })}
              >
                {BAHAYA.map((b) => (
                  <option key={b.kode} value={b.kode}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="uraian-insiden">
              Apa yang terjadi *
            </label>
            <textarea
              id="uraian-insiden"
              className="field-input min-h-[5rem]"
              value={baru.description}
              onChange={(e) => setBaru({ ...baru, description: e.target.value })}
              placeholder="Urutan kejadiannya, bukan siapa yang salah."
            />
          </div>

          <div>
            <label className="field-label" htmlFor="tindakan-segera">
              Tindakan segera yang diambil
            </label>
            <textarea
              id="tindakan-segera"
              className="field-input min-h-[4rem]"
              value={baru.immediateAction}
              onChange={(e) => setBaru({ ...baru, immediateAction: e.target.value })}
            />
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={baru.reachedPatient}
              onChange={(e) => setBaru({ ...baru, reachedPatient: e.target.checked })}
            />
            <span>Kejadian ini sampai kepada pasien</span>
          </label>

          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={baru.anonymous}
              onChange={(e) => setBaru({ ...baru, anonymous: e.target.checked })}
            />
            <span>
              Laporkan tanpa nama
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                Pelaporan tanpa nama tetap dihitung dan tetap ditelaah. Yang membuat laporan
                keselamatan berhenti mengalir bukan kurangnya formulir, melainkan takut disalahkan.
              </span>
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={laporkan.isPending || baru.description.trim().length < 5 || !dipakai}
              onClick={() =>
                laporkan.mutate({
                  facilityId: dipakai,
                  incidentType: baru.incidentType,
                  occurredAt: new Date().toISOString(),
                  description: baru.description,
                  immediateAction: baru.immediateAction || undefined,
                  harmLevel: baru.harmLevel,
                  reachedPatient: baru.reachedPatient,
                  anonymous: baru.anonymous || undefined,
                })
              }
            >
              Kirim laporan
            </button>
            <button type="button" className="btn-ghost" onClick={() => setLapor(false)}>
              Batal
            </button>
          </div>
        </div>
      )}

      {papan.isLoading && <LoadingState label="Memuat papan insiden…" />}
      {papan.isError && (
        <ErrorState
          message={toMessage(papan.error, (k, f) => f ?? k)}
          onRetry={() => void papan.refetch()}
        />
      )}
      {papan.data?.length === 0 && (
        <EmptyState
          title="Belum ada insiden tercatat"
          description="Papan yang kosong pada rumah sakit yang sibuk lebih sering berarti laporannya tidak mengalir daripada berarti tidak ada kejadian."
        />
      )}

      {daftar.length > 0 && (
        <ol className="space-y-2" aria-label="Papan insiden menurut yang terlupa">
          {daftar.map((i, n) => (
            <li
              key={i.id}
              className={`card px-4 py-3 ${
                lewatTenggat(i) ? 'border-s-4 border-s-rose-400' : ''
              } ${i.closed_at ? 'opacity-70' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-[16rem] flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-sm font-semibold tabular-nums text-slate-400"
                      aria-label={`Urutan ${n + 1}`}
                    >
                      {n + 1}
                    </span>
                    <Code>{i.incident_number}</Code>
                    <span className={`badge ${RUPA_DERAJAT[i.grade]?.kelas ?? ''}`}>
                      {RUPA_DERAJAT[i.grade]?.label ?? i.grade}
                    </span>
                    <span className="text-sm text-slate-600 dark:text-slate-300">
                      {LABEL_JENIS[i.incident_type] ?? i.incident_type}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {BAHAYA.find((b) => b.kode === i.harm_level)?.label ?? i.harm_level}
                    </span>
                    {i.is_anonymous && (
                      <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        tanpa nama
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Terjadi {tanggal(i.occurred_at)} · tenggat telaah {tanggal(i.review_due_at)}
                    {i.closed_at && ` · ditutup ${tanggal(i.closed_at)}`}
                  </p>
                  {lewatTenggat(i) && (
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-rose-700 dark:text-rose-400">
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden />
                      Lewat tenggat telaah
                    </p>
                  )}
                </div>

                <div className="shrink-0 text-end">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {i.action_count} tindakan perbaikan
                  </p>
                  {!i.closed_at && (
                    <div className="mt-1 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => {
                          setDitindak(i.id);
                          setTindakan('');
                        }}
                      >
                        <Wrench className="h-4 w-4" aria-hidden />
                        Tindakan
                      </button>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={i.action_count === 0 || tutup.isPending}
                        onClick={() => tutup.mutate({ id: i.id, body: {} })}
                      >
                        Tutup
                      </button>
                    </div>
                  )}
                  {!i.closed_at && i.action_count === 0 && (
                    <p className="mt-1 max-w-[16rem] text-xs text-slate-500 dark:text-slate-400">
                      Belum dapat ditutup: belum ada tindakan perbaikan. Insiden yang ditutup tanpa
                      tindakan akan terjadi lagi — itu satu-satunya hal yang dapat dikatakan dengan
                      pasti tentangnya.
                    </p>
                  )}
                  {!i.closed_at &&
                    i.action_count > 0 &&
                    (i.grade === 'RED' || i.grade === 'YELLOW') && (
                      <p className="mt-1 max-w-[16rem] text-xs text-slate-500 dark:text-slate-400">
                        Pada kejadian ini pelapor tidak dapat menutup laporannya sendiri — telaah
                        oleh pihak yang terlibat bukan telaah.
                      </p>
                    )}
                </div>
              </div>

              {ditindak === i.id && (
                <div className="mt-3 space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                  <div>
                    <label className="field-label" htmlFor={`tindakan-${i.id}`}>
                      Tindakan perbaikan
                    </label>
                    <textarea
                      id={`tindakan-${i.id}`}
                      className="field-input min-h-[4rem]"
                      value={tindakan}
                      onChange={(e) => setTindakan(e.target.value)}
                      placeholder="Apa yang diubah supaya kejadian ini tidak terulang."
                    />
                  </div>
                  <div>
                    <label className="field-label" htmlFor={`jenis-tindakan-${i.id}`}>
                      Jenis tindakan
                    </label>
                    <select
                      id={`jenis-tindakan-${i.id}`}
                      className="field-input"
                      value={jenisTindakan}
                      onChange={(e) => setJenisTindakan(e.target.value)}
                    >
                      {['PROCESS', 'TRAINING', 'EQUIPMENT', 'STAFFING', 'POLICY', 'SYSTEM', 'OTHER'].map(
                        (t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={tambahTindakan.isPending || tindakan.trim().length < 5}
                      onClick={() =>
                        tambahTindakan.mutate({
                          id: i.id,
                          body: { action: tindakan, actionType: jenisTindakan },
                        })
                      }
                    >
                      Simpan tindakan
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setDitindak(null)}>
                      Batal
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
