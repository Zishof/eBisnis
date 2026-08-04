/**
 * Pelepasan informasi rekam medis.
 *
 * ## Dua dasar, dan salah satunya harus ada
 *
 * Rekam medis dilepaskan kepada pihak luar hanya atas **persetujuan pasien**
 * atau **dasar hukum**. Layar ini memaksa memilih salah satunya, dan menyimpan
 * rujukannya — bukan sekadar mencentang kotak.
 *
 * Kotak centang tanpa rujukan menghasilkan berkas yang dilepaskan dengan
 * keterangan "ada persetujuan", dan enam bulan kemudian tidak seorang pun dapat
 * menunjukkan kertasnya.
 *
 * ## Cakupan diminta, bukan seluruhnya
 *
 * `requestedScope` daftar bagian yang diminta. Perusahaan asuransi yang
 * menanyakan satu tindakan tidak berhak atas seluruh riwayat jiwa pasiennya,
 * dan layar yang hanya punya tombol "lepaskan berkas" akan melepaskan
 * seluruhnya karena itu satu-satunya yang dapat ditekan.
 */

import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { FileOutput, Search, TriangleAlert } from 'lucide-react';
import { Code, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi, umurDari, type RingkasPasien } from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

/** Kosakata peladen, disalin dari `PEMINTA` pada controller. */
const PEMINTA = [
  { kode: 'PATIENT', label: 'Pasien sendiri', perluDasarHukum: false },
  { kode: 'LEGAL_GUARDIAN', label: 'Wali sah', perluDasarHukum: false },
  { kode: 'INSURER', label: 'Penjamin / asuransi', perluDasarHukum: false },
  { kode: 'COURT', label: 'Pengadilan', perluDasarHukum: true },
  { kode: 'POLICE', label: 'Kepolisian', perluDasarHukum: true },
  { kode: 'OTHER_FACILITY', label: 'Fasilitas kesehatan lain', perluDasarHukum: false },
  { kode: 'RESEARCHER', label: 'Peneliti', perluDasarHukum: true },
  { kode: 'EMPLOYER', label: 'Pemberi kerja', perluDasarHukum: true },
  { kode: 'OTHER', label: 'Lainnya', perluDasarHukum: true },
];

const CAKUPAN = [
  { kode: 'SUMMARY', label: 'Ringkasan pulang' },
  { kode: 'DIAGNOSIS', label: 'Diagnosis' },
  { kode: 'PROCEDURE', label: 'Tindakan' },
  { kode: 'LAB_RESULT', label: 'Hasil laboratorium' },
  { kode: 'PRESCRIPTION', label: 'Resep' },
  { kode: 'CLINICAL_NOTE', label: 'Catatan klinis' },
  { kode: 'IMAGING', label: 'Radiologi' },
];

export function InfoReleasePage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();

  const [kata, setKata] = useState('');
  const [dicari, setDicari] = useState('');
  const [pasien, setPasien] = useState<RingkasPasien | null>(null);

  const [jenisPeminta, setJenisPeminta] = useState('PATIENT');
  const [namaPeminta, setNamaPeminta] = useState('');
  const [tujuan, setTujuan] = useState('');
  const [cakupan, setCakupan] = useState<string[]>([]);
  const [adaPersetujuan, setAdaPersetujuan] = useState(false);
  const [rujukanPersetujuan, setRujukanPersetujuan] = useState('');
  const [adaDasarHukum, setAdaDasarHukum] = useState(false);
  const [dokumenHukum, setDokumenHukum] = useState('');
  const [hasil, setHasil] = useState<Record<string, unknown> | null>(null);

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
  const hasilCari = pencarian.data?.results ?? [];

  const minta = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.requestRelease(body, ctx),
    onSuccess: (r) => {
      setHasil(r);
      toast.push('Permintaan pelepasan tercatat.', 'success');
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const peminta = PEMINTA.find((p) => p.kode === jenisPeminta);
  const adaDasar = adaPersetujuan || adaDasarHukum;
  const lengkap =
    Boolean(pasien) &&
    namaPeminta.trim().length >= 2 &&
    tujuan.trim().length >= 5 &&
    cakupan.length > 0 &&
    adaDasar &&
    (!adaPersetujuan || rujukanPersetujuan.trim().length > 0) &&
    (!adaDasarHukum || dokumenHukum.trim().length > 0);

  return (
    <>
      <PageHeader
        title="Pelepasan Informasi"
        description="Rekam medis dilepaskan hanya atas persetujuan pasien atau dasar hukum — dan rujukannya disimpan, bukan sekadar dicentang."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pelepasan Informasi' }]}
      />

      <PurposeSelector />

      <div className="card mb-4 px-4 py-4">
        <label className="field-label" htmlFor="cari-pasien-pelepasan">
          Pasien yang berkasnya diminta
        </label>
        <div className="flex gap-2">
          <input
            id="cari-pasien-pelepasan"
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

        {hasilCari.length > 0 && !pasien && (
          <ul className="mt-3 space-y-1">
            {hasilCari.slice(0, 8).map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  onClick={() => setPasien(p)}
                >
                  <span className="font-medium">{p.full_name}</span>
                  <span className="text-slate-500 dark:text-slate-400">{umurDari(p.birth_date)}</span>
                  {p.mrn && <Code>{p.mrn}</Code>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {pasien && (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-slate-900 dark:text-slate-100">
              {pasien.full_name}{' '}
              <span className="font-normal text-slate-500 dark:text-slate-400">
                {umurDari(pasien.birth_date)}
              </span>
            </p>
            <button type="button" className="btn-ghost" onClick={() => setPasien(null)}>
              Ganti pasien
            </button>
          </div>
        )}
      </div>

      {pasien && (
        <div className="card space-y-4 px-4 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="jenis-peminta">
                Yang meminta
              </label>
              <select
                id="jenis-peminta"
                className="field-input"
                value={jenisPeminta}
                onChange={(e) => setJenisPeminta(e.target.value)}
              >
                {PEMINTA.map((p) => (
                  <option key={p.kode} value={p.kode}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="nama-peminta">
                Nama peminta *
              </label>
              <input
                id="nama-peminta"
                className="field-input"
                value={namaPeminta}
                onChange={(e) => setNamaPeminta(e.target.value)}
                placeholder="Nama orang atau lembaganya"
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="tujuan-pelepasan">
              Untuk apa berkasnya dipakai *
            </label>
            <textarea
              id="tujuan-pelepasan"
              className="field-input min-h-[4rem]"
              value={tujuan}
              onChange={(e) => setTujuan(e.target.value)}
              placeholder="Mis. pengurusan klaim asuransi jiwa nomor ..."
            />
          </div>

          <fieldset>
            <legend className="field-label">Bagian yang diminta *</legend>
            <div className="flex flex-wrap gap-2">
              {CAKUPAN.map((c) => {
                const dipilih = cakupan.includes(c.kode);
                return (
                  <button
                    key={c.kode}
                    type="button"
                    aria-pressed={dipilih}
                    className={dipilih ? 'btn-secondary' : 'btn-ghost'}
                    onClick={() =>
                      setCakupan((v) =>
                        v.includes(c.kode) ? v.filter((x) => x !== c.kode) : [...v, c.kode],
                      )
                    }
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Pilih hanya yang diminta. Penjamin yang menanyakan satu tindakan tidak berhak atas
              seluruh riwayat pasiennya — dan layar yang hanya punya tombol &ldquo;lepaskan
              berkas&rdquo; akan melepaskan seluruhnya karena itu satu-satunya yang dapat ditekan.
            </p>
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="field-label">Dasar pelepasan — salah satu wajib *</legend>

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={adaPersetujuan}
                onChange={(e) => setAdaPersetujuan(e.target.checked)}
              />
              <span>Ada persetujuan pasien</span>
            </label>
            {adaPersetujuan && (
              <input
                className="field-input"
                value={rujukanPersetujuan}
                onChange={(e) => setRujukanPersetujuan(e.target.value)}
                placeholder="Nomor / rujukan dokumen persetujuan"
                aria-label="Rujukan persetujuan"
              />
            )}

            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={adaDasarHukum}
                onChange={(e) => setAdaDasarHukum(e.target.checked)}
              />
              <span>Ada dasar hukum</span>
            </label>
            {adaDasarHukum && (
              <input
                className="field-input"
                value={dokumenHukum}
                onChange={(e) => setDokumenHukum(e.target.value)}
                placeholder="Nomor surat / penetapan"
                aria-label="Dokumen dasar hukum"
              />
            )}

            {peminta?.perluDasarHukum && !adaDasarHukum && (
              <p className="inline-flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                Permintaan dari {peminta.label.toLowerCase()} lazimnya menuntut dasar hukum
                tertulis, bukan persetujuan lisan pasien.
              </p>
            )}

            {!adaDasar && (
              <p className="text-xs text-rose-700 dark:text-rose-400">
                Tanpa salah satu dasar, permintaannya tidak dapat dicatat.
              </p>
            )}
          </fieldset>

          <button
            type="button"
            className="btn-primary"
            disabled={minta.isPending || !lengkap}
            onClick={() =>
              minta.mutate({
                patientId: pasien.id,
                facilityId,
                requesterType: jenisPeminta,
                requesterName: namaPeminta,
                purpose: tujuan,
                requestedScope: cakupan,
                hasPatientConsent: adaPersetujuan || undefined,
                consentReference: adaPersetujuan ? rujukanPersetujuan : undefined,
                hasLegalBasis: adaDasarHukum || undefined,
                legalBasisDocument: adaDasarHukum ? dokumenHukum : undefined,
              })
            }
          >
            <FileOutput className="h-4 w-4" aria-hidden />
            Catat permintaan
          </button>

          {hasil && (
            <pre className="overflow-x-auto rounded-lg bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {JSON.stringify(hasil, null, 2)}
            </pre>
          )}
        </div>
      )}
    </>
  );
}
