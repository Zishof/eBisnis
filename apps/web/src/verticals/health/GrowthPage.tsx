/**
 * Penimbangan dan pengukuran anak di Posyandu.
 *
 * ## Yang membedakannya dari formulir pengukuran biasa
 *
 * **Penilaiannya datang dari peladen, dan ditampilkan sebelum kader beranjak.**
 *
 * Kader menimbang dua puluh anak dalam satu pagi. Bila status gizinya baru
 * terlihat pada laporan bulan depan, anak yang bergizi buruk pagi ini pulang
 * tanpa ada yang tahu — dan yang membacanya bulan depan tidak tahu rumahnya di
 * mana.
 *
 * Karena itu hasil penilaian muncul di layar segera sesudah disimpan, dengan
 * warna yang membedakan yang menuntut tindakan dari yang tidak, dan jalan
 * langsung ke pencatatan kunjungan rumah.
 *
 * ## Berat yang tidak naik
 *
 * `weight_flat_count` dihitung peladen dan ditampilkan apa adanya. Ia sering
 * lebih penting daripada status gizi sesaat: anak yang beratnya tetap selama
 * tiga bulan sedang menuju gizi buruk sekalipun angkanya hari ini masih
 * "normal" — dan grafik yang hanya menunjukkan titik terakhir menyembunyikannya.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Baby, LineChart, Search, TriangleAlert } from 'lucide-react';
import {
  Code,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  useToast,
} from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  umurDari,
  RUPA_GIZI,
  type BarisPertumbuhan,
  type HasilPengukuran,
  type RingkasPasien,
} from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

function Lencana({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const rupa = RUPA_GIZI[status];
  if (!rupa) return <Code>{status}</Code>;
  return <span className={`badge ${rupa.kelas}`}>{rupa.label}</span>;
}

function angka(v: number | null, digit = 2): string {
  return v == null ? '—' : v.toFixed(digit);
}

export function GrowthPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [kata, setKata] = useState('');
  const [dicari, setDicari] = useState('');
  const [anak, setAnak] = useState<RingkasPasien | null>(null);
  const [hasilTerakhir, setHasilTerakhir] = useState<HasilPengukuran | null>(null);

  const [berat, setBerat] = useState('');
  const [tinggi, setTinggi] = useState('');
  const [caraUkur, setCaraUkur] = useState<'RECUMBENT' | 'STANDING'>('STANDING');
  const [lila, setLila] = useState('');
  const [lingkarKepala, setLingkarKepala] = useState('');
  const [posyandu, setPosyandu] = useState('');

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const pencarian = useQuery({
    queryKey: ['health', 'patients', dicari],
    queryFn: () => healthApi.searchPatients({ q: dicari }, ctx),
    enabled: dicari.length >= 2,
  });
  /*
   * `searchPatients` mengembalikan objek berlingkup, bukan larik — dan
   * lingkupnya penting: pencarian pasien SELALU terbatas pada fasilitas yang
   * sedang dibuka. Diambil di sini supaya lingkupnya tidak hilang diam-diam.
   */
  const hasilCari = pencarian.data?.results ?? [];

  const riwayat = useQuery({
    queryKey: ['health', 'growth', anak?.id],
    queryFn: () => healthApi.growthHistory(anak?.id as string, ctx),
    enabled: Boolean(anak),
  });

  const simpan = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.recordGrowth(body, ctx),
    onSuccess: (hasil) => {
      setHasilTerakhir(hasil);
      toast.push('Pengukuran tersimpan dan dinilai.', 'success');
      setBerat('');
      setTinggi('');
      setLila('');
      setLingkarKepala('');
      void queryClient.invalidateQueries({ queryKey: ['health', 'growth'] });
      void queryClient.invalidateQueries({ queryKey: ['health', 'home-visits'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const adaYangMendesak =
    hasilTerakhir != null &&
    [hasilTerakhir.wazStatus, hasilTerakhir.hazStatus, hasilTerakhir.whzStatus].some(
      (s) => s && RUPA_GIZI[s]?.mendesak,
    );

  return (
    <>
      <PageHeader
        title="Pertumbuhan Anak"
        description="Penimbangan Posyandu. Penilaiannya muncul di layar sebelum kader beranjak, bukan pada laporan bulan depan."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pertumbuhan' }]}
      />

      <PurposeSelector />

      <div className="card mb-4 px-4 py-4">
        <label className="field-label" htmlFor="cari-anak">
          Cari anak
        </label>
        <div className="flex gap-2">
          <input
            id="cari-anak"
            className="field-input"
            value={kata}
            onChange={(e) => setKata(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setDicari(kata.trim());
            }}
            placeholder="Nama atau nomor rekam medis"
          />
          <button type="button" className="btn-secondary" onClick={() => setDicari(kata.trim())}>
            <Search className="h-4 w-4" aria-hidden />
            Cari
          </button>
        </div>

        {hasilCari.length > 0 && !anak && (
          <ul className="mt-3 space-y-1">
            {hasilCari.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => {
                    setAnak(p);
                    setHasilTerakhir(null);
                  }}
                >
                  <Baby className="h-4 w-4 text-slate-400" aria-hidden />
                  <span className="font-medium">{p.full_name}</span>
                  <span className="text-slate-500 dark:text-slate-400">
                    {umurDari(p.birth_date)}
                  </span>
                  {p.mrn && <Code>{p.mrn}</Code>}
                </button>
              </li>
            ))}
          </ul>
        )}
        {pencarian.data && hasilCari.length === 0 && (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Tidak ada pasien yang cocok.
          </p>
        )}
      </div>

      {anak && (
        <>
          <div className="card mb-4 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div>
              <p className="font-medium text-slate-900 dark:text-slate-100">{anak.full_name}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {umurDari(anak.birth_date)}
                {anak.mrn && (
                  <>
                    {' · '}
                    <Code>{anak.mrn}</Code>
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setAnak(null);
                setHasilTerakhir(null);
              }}
            >
              Ganti anak
            </button>
          </div>

          <div className="card mb-4 space-y-3 px-4 py-4">
            <h2 className="font-medium text-slate-900 dark:text-slate-100">Pengukuran hari ini</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="berat">
                  Berat (kg)
                </label>
                <input
                  id="berat"
                  className="field-input"
                  inputMode="decimal"
                  value={berat}
                  onChange={(e) => setBerat(e.target.value)}
                  placeholder="mis. 8.4"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="tinggi">
                  Panjang / tinggi (cm)
                </label>
                <input
                  id="tinggi"
                  className="field-input"
                  inputMode="decimal"
                  value={tinggi}
                  onChange={(e) => setTinggi(e.target.value)}
                  placeholder="mis. 72.5"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="cara-ukur">
                  Cara mengukur
                </label>
                <select
                  id="cara-ukur"
                  className="field-input"
                  value={caraUkur}
                  onChange={(e) => setCaraUkur(e.target.value as 'RECUMBENT' | 'STANDING')}
                >
                  <option value="RECUMBENT">Telentang (panjang badan)</option>
                  <option value="STANDING">Berdiri (tinggi badan)</option>
                </select>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Bukan pilihan gaya: keduanya berbeda kira-kira 0,7 cm, dan peladen
                  menyesuaikannya menurut umur anak sebelum menghitung.
                </p>
              </div>
              <div>
                <label className="field-label" htmlFor="lila">
                  LILA (cm)
                </label>
                <input
                  id="lila"
                  className="field-input"
                  inputMode="decimal"
                  value={lila}
                  onChange={(e) => setLila(e.target.value)}
                  placeholder="Boleh dikosongkan"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="lingkar-kepala">
                  Lingkar kepala (cm)
                </label>
                <input
                  id="lingkar-kepala"
                  className="field-input"
                  inputMode="decimal"
                  value={lingkarKepala}
                  onChange={(e) => setLingkarKepala(e.target.value)}
                  placeholder="Boleh dikosongkan"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="posyandu">
                  Posyandu
                </label>
                <input
                  id="posyandu"
                  className="field-input"
                  value={posyandu}
                  onChange={(e) => setPosyandu(e.target.value)}
                  placeholder="Nama Posyandu"
                />
              </div>
            </div>

            <button
              type="button"
              className="btn-primary"
              disabled={simpan.isPending || (!berat && !tinggi)}
              onClick={() =>
                simpan.mutate({
                  patientId: anak.id,
                  facilityId,
                  weightKg: berat ? Number(berat) : undefined,
                  heightCm: tinggi ? Number(tinggi) : undefined,
                  heightMeasuredAs: tinggi ? caraUkur : undefined,
                  muacCm: lila ? Number(lila) : undefined,
                  headCircumferenceCm: lingkarKepala ? Number(lingkarKepala) : undefined,
                  posyanduName: posyandu || undefined,
                })
              }
            >
              Simpan dan nilai
            </button>
          </div>

          {hasilTerakhir && (
            <div
              className={`card mb-4 space-y-3 px-4 py-4 ${
                adaYangMendesak ? 'border-2 border-rose-300 dark:border-rose-800' : ''
              }`}
            >
              <h2 className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
                <LineChart className="h-4 w-4" aria-hidden />
                Penilaian
              </h2>
              <dl className="grid gap-3 sm:grid-cols-3">
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    Berat menurut umur (WAZ {angka(hasilTerakhir.waz)})
                  </dt>
                  <dd className="mt-1">
                    <Lencana status={hasilTerakhir.wazStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    Tinggi menurut umur (HAZ {angka(hasilTerakhir.haz)})
                  </dt>
                  <dd className="mt-1">
                    <Lencana status={hasilTerakhir.hazStatus} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">
                    Berat menurut tinggi (WHZ {angka(hasilTerakhir.whz)})
                  </dt>
                  <dd className="mt-1">
                    <Lencana status={hasilTerakhir.whzStatus} />
                  </dd>
                </div>
              </dl>

              {(hasilTerakhir.weightFlatCount ?? 0) >= 2 && (
                <p className="inline-flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  Berat tidak naik {hasilTerakhir.weightFlatCount} kali berturut-turut. Ini sering
                  lebih penting daripada status gizi hari ini: anak yang beratnya tetap sedang
                  menuju gizi buruk sekalipun angkanya masih normal.
                </p>
              )}

              {adaYangMendesak && (
                <p className="text-sm text-rose-800 dark:text-rose-300">
                  Anak ini kini masuk daftar kunjungan rumah. Buka layar{' '}
                  <strong>Kunjungan Rumah</strong> — ia sudah berada pada urutannya.
                </p>
              )}
            </div>
          )}

          <h2 className="mb-2 font-medium text-slate-900 dark:text-slate-100">Riwayat pengukuran</h2>
          {riwayat.isLoading && <LoadingState label="Memuat riwayat…" />}
          {riwayat.isError && (
            <ErrorState message={toMessage(riwayat.error, (k, f) => f ?? k)} onRetry={() => void riwayat.refetch()} />
          )}
          {riwayat.data?.length === 0 && (
            <EmptyState
              title="Belum ada pengukuran"
              description="Pengukuran pertama menjadi titik awalnya; kecenderungan baru terlihat pada pengukuran kedua."
            />
          )}
          {riwayat.data && riwayat.data.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 text-start dark:border-slate-800">
                  <tr className="text-start text-xs uppercase text-slate-500 dark:text-slate-400">
                    <th className="px-3 py-2 text-start font-medium">Tanggal</th>
                    <th className="px-3 py-2 text-start font-medium">Umur</th>
                    <th className="px-3 py-2 text-end font-medium">Berat</th>
                    <th className="px-3 py-2 text-end font-medium">Tinggi</th>
                    <th className="px-3 py-2 text-start font-medium">BB/U</th>
                    <th className="px-3 py-2 text-start font-medium">TB/U</th>
                    <th className="px-3 py-2 text-start font-medium">BB/TB</th>
                  </tr>
                </thead>
                <tbody>
                  {[...riwayat.data]
                    .reverse()
                    .map((r: BarisPertumbuhan) => (
                      <tr
                        key={r.id}
                        className="border-b border-slate-100 last:border-0 dark:border-slate-800"
                      >
                        <td className="px-3 py-2">{r.measured_at?.slice(0, 10)}</td>
                        <td className="px-3 py-2">{r.age_months?.toFixed(0)} bln</td>
                        <td className="px-3 py-2 text-end tabular-nums">{angka(r.weight_kg, 1)}</td>
                        <td className="px-3 py-2 text-end tabular-nums">
                          {angka(r.height_cm, 1)}
                          {r.height_adjusted && (
                            <span
                              className="ms-1 text-xs text-slate-400"
                              title="Disesuaikan menurut cara mengukur"
                            >
                              *
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <Lencana status={r.waz_status} />
                        </td>
                        <td className="px-3 py-2">
                          <Lencana status={r.haz_status} />
                        </td>
                        <td className="px-3 py-2">
                          <Lencana status={r.whz_status} />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
                Tanda <span aria-hidden>*</span> berarti tingginya disesuaikan karena cara
                mengukurnya berbeda dari yang lazim pada umur itu.
              </p>
            </div>
          )}
        </>
      )}
    </>
  );
}
