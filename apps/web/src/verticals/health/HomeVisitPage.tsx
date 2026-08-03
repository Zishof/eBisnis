/**
 * Daftar anak yang perlu dikunjungi ke rumah.
 *
 * ## Satu keputusan menentukan seluruh bentuk layar ini
 *
 * **Urutannya tidak dapat diubah pengguna.**
 *
 * Setiap daftar lain pada aplikasi ini boleh diurut menurut nama, tanggal, atau
 * apa pun yang diinginkan penggunanya. Yang ini tidak. Peladen sudah
 * mengurutkannya menurut kemendesakan — gizi buruk lebih dahulu, lalu berat
 * yang tidak naik, lalu stunting, lalu imunisasi yang paling lama tertunggak —
 * dan kader yang punya waktu untuk lima kunjungan hari ini harus tahu lima
 * siapa.
 *
 * Tajuk kolom yang dapat diklik untuk mengurut ulang akan diklik. Diurut
 * menurut nama, anak dengan gizi buruk berpindah ke tengah daftar dan tidak
 * dikunjungi hari itu — dan tidak ada satu pun galat yang muncul untuk memberi
 * tahu. Karena itu daftarnya `<ol>` bernomor besar, bukan tabel.
 *
 * ## Anak tanpa folder keluarga
 *
 * Peladen menuntut `familyFolderId`, dan daftar kerja dapat memuat anak yang
 * belum punya folder. Tombolnya dimatikan beserta **sebabnya dan jalan
 * keluarnya** — bukan dibiarkan hidup lalu gagal dengan galat 400 di tangan
 * kader yang sedang berdiri di depan rumah orang.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Home, MapPin, TriangleAlert } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, umurDari, RUPA_GIZI, type BarisKunjunganRumah } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

/** Kosakata peladen, disalin dari `ALASAN_KUNJUNGAN` pada controller. */
const ALASAN = [
  { kode: 'SEVERE_WASTING', label: 'Gizi buruk' },
  { kode: 'WEIGHT_FLAT', label: 'Berat tidak naik' },
  { kode: 'STUNTING', label: 'Pendek (stunting)' },
  { kode: 'IMMUNIZATION_OVERDUE', label: 'Imunisasi tertunggak' },
  { kode: 'HIGH_RISK_FAMILY', label: 'Keluarga berisiko tinggi' },
  { kode: 'FOLLOW_UP', label: 'Kunjungan lanjutan' },
  { kode: 'OTHER', label: 'Lainnya' },
];

/**
 * Sebab yang membuat seorang anak masuk daftar, dan alasan kunjungan yang
 * disarankan untuknya.
 *
 * Disarankan, bukan dipaksakan: kader yang sampai di rumah dapat menemukan
 * sebab yang berbeda dari yang tercatat, dan yang ditemukannya di sana lebih
 * benar daripada yang disimpulkan tabel.
 */
function sebabKunjungan(r: BarisKunjunganRumah): Array<{ teks: string; kelas: string; alasan: string }> {
  const sebab: Array<{ teks: string; kelas: string; alasan: string }> = [];
  if (r.severelyWasted)
    sebab.push({ teks: 'Gizi buruk', kelas: RUPA_GIZI.SEVERELY_WASTED.kelas, alasan: 'SEVERE_WASTING' });
  else if (r.wasted)
    sebab.push({ teks: 'Gizi kurang', kelas: RUPA_GIZI.WASTED.kelas, alasan: 'SEVERE_WASTING' });
  if (r.weightFlat)
    sebab.push({
      teks: `Berat tidak naik ${r.weight_flat_count}×`,
      kelas: RUPA_GIZI.UNDERWEIGHT.kelas,
      alasan: 'WEIGHT_FLAT',
    });
  if (r.stunted) sebab.push({ teks: 'Pendek', kelas: RUPA_GIZI.STUNTED.kelas, alasan: 'STUNTING' });
  if (r.overdueDays > 0)
    sebab.push({
      teks: `Imunisasi tertunggak ${r.overdueDays} hari`,
      kelas: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
      alasan: 'IMMUNIZATION_OVERDUE',
    });
  return sebab;
}

export function HomeVisitPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [dikunjungi, setDikunjungi] = useState<BarisKunjunganRumah | null>(null);
  const [alasan, setAlasan] = useState('FOLLOW_UP');
  const [temuan, setTemuan] = useState('');
  const [tindakan, setTindakan] = useState('');
  const [dirujukKe, setDirujukKe] = useState('');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const daftar = useQuery({
    queryKey: ['health', 'home-visits', facilityId],
    queryFn: () => healthApi.homeVisitWorklist(facilityId as string, 100),
    enabled: Boolean(facilityId),
  });

  const catat = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.recordHomeVisit(body, ctx),
    onSuccess: () => {
      toast.push('Kunjungan tercatat.', 'success');
      setDikunjungi(null);
      setTemuan('');
      setTindakan('');
      setDirujukKe('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'home-visits'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  function bukaFormulir(r: BarisKunjunganRumah) {
    setDikunjungi(r);
    setAlasan(sebabKunjungan(r)[0]?.alasan ?? 'FOLLOW_UP');
    setTemuan('');
    setTindakan('');
    setDirujukKe('');
  }

  return (
    <>
      <PageHeader
        title="Kunjungan Rumah"
        description="Diurutkan menurut kemendesakan, bukan menurut nama — dan urutannya tidak dapat diubah."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Kunjungan Rumah' }]}
      />

      <PurposeSelector />

      {daftar.isLoading && <LoadingState label="Menyusun daftar kunjungan…" />}
      {daftar.isError && (
        <ErrorState message={toMessage(daftar.error, (k, f) => f ?? k)} onRetry={() => void daftar.refetch()} />
      )}

      {daftar.data?.length === 0 && (
        <EmptyState
          title="Tidak ada anak yang perlu dikunjungi"
          description="Pada pengukuran terakhir, tidak ada yang bergizi buruk, beratnya tidak naik, pendek, atau imunisasinya tertunggak."
        />
      )}

      {daftar.data && daftar.data.length > 0 && (
        <>
          <p className="mb-3 text-sm text-slate-600 dark:text-slate-300">
            <strong>{daftar.data.length}</strong> anak perlu dikunjungi. Yang paling atas paling
            mendesak — kunjungi berurutan dari atas.
          </p>

          {/*
            Diberi nama supaya pembaca layar mengumumkan "daftar kunjungan
            rumah, 3 butir" — bukan sekadar "daftar". Kader yang memakai
            pembaca layar perlu tahu daftar apa yang sedang dibacakan, sebab
            halaman ini memuat lebih dari satu daftar.
          */}
          <ol className="space-y-2" aria-label="Daftar kunjungan rumah menurut kemendesakan">
            {daftar.data.map((r, i) => (
              <li key={r.patient_id} className="card flex flex-wrap items-start gap-4 px-4 py-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg font-semibold tabular-nums text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                  aria-label={`Urutan ${i + 1}`}
                >
                  {i + 1}
                </span>

                <div className="min-w-[14rem] flex-1">
                  <p className="font-medium text-slate-900 dark:text-slate-100">{r.full_name}</p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {umurDari(r.birth_date)}
                    {r.folder_number && (
                      <>
                        {' · '}
                        <Code>{r.folder_number}</Code>
                      </>
                    )}
                  </p>
                  {(r.village || r.rt || r.rw) && (
                    <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
                      <MapPin className="h-3.5 w-3.5" aria-hidden />
                      {[r.village, r.rt && `RT ${r.rt}`, r.rw && `RW ${r.rw}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  )}
                </div>

                <div className="flex flex-1 flex-wrap items-center gap-1.5">
                  {sebabKunjungan(r).map((s) => (
                    <span key={s.teks} className={`badge ${s.kelas}`}>
                      {s.teks}
                    </span>
                  ))}
                </div>

                <div className="shrink-0">
                  <button
                    type="button"
                    className="btn-secondary"
                    disabled={!r.family_folder_id}
                    onClick={() => bukaFormulir(r)}
                  >
                    <Home className="h-4 w-4" aria-hidden />
                    Catat kunjungan
                  </button>
                  {!r.family_folder_id && (
                    <p className="mt-1 max-w-[16rem] text-xs text-slate-500 dark:text-slate-400">
                      Belum punya folder keluarga. Kunjungan rumah selalu tercatat pada keluarga,
                      bukan pada anak sendirian — buatkan foldernya lebih dahulu pada layar
                      Folder&nbsp;Keluarga.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </>
      )}

      {dikunjungi && (
        <div className="card mt-4 space-y-3 px-4 py-4">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">
            Kunjungan ke {dikunjungi.full_name}
          </h2>

          <div>
            <label className="field-label" htmlFor="alasan-kunjungan">
              Alasan kunjungan
            </label>
            <select
              id="alasan-kunjungan"
              className="field-input"
              value={alasan}
              onChange={(e) => setAlasan(e.target.value)}
            >
              {ALASAN.map((a) => (
                <option key={a.kode} value={a.kode}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label" htmlFor="temuan">
              Yang ditemukan di rumah
            </label>
            <textarea
              id="temuan"
              className="field-input min-h-[5rem]"
              value={temuan}
              onChange={(e) => setTemuan(e.target.value)}
              placeholder="Mis. ibu bekerja di luar kota, anak diasuh nenek; tidak ada sumber air bersih."
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Yang dilihat di rumah, bukan yang sudah diketahui dari angka. Sebab gizi buruk
              hampir selalu ada di rumah, bukan di grafik.
            </p>
          </div>

          <div>
            <label className="field-label" htmlFor="tindakan">
              Tindakan yang diambil
            </label>
            <textarea
              id="tindakan"
              className="field-input min-h-[4rem]"
              value={tindakan}
              onChange={(e) => setTindakan(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="dirujuk">
              Dirujuk ke
            </label>
            <input
              id="dirujuk"
              className="field-input"
              value={dirujukKe}
              onChange={(e) => setDirujukKe(e.target.value)}
              placeholder="Kosongkan bila tidak dirujuk."
            />
          </div>

          {(dikunjungi.severelyWasted || dikunjungi.weightFlat) && !dirujukKe && (
            <p className="inline-flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Anak ini bergizi buruk atau beratnya tidak naik. Bila belum dirujuk, sebutkan
              alasannya pada tindakan — supaya yang membaca berikutnya tahu itu keputusan, bukan
              kelalaian.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={catat.isPending}
              onClick={() =>
                catat.mutate({
                  facilityId,
                  familyFolderId: dikunjungi.family_folder_id,
                  patientId: dikunjungi.patient_id,
                  reason: alasan,
                  findings: temuan || undefined,
                  actionTaken: tindakan || undefined,
                  referredTo: dirujukKe || undefined,
                })
              }
            >
              Simpan
            </button>
            <button type="button" className="btn-ghost" onClick={() => setDikunjungi(null)}>
              Batal
            </button>
          </div>
        </div>
      )}
    </>
  );
}
