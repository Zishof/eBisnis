/**
 * Pencarian dan pendaftaran pasien.
 *
 * Tiga hal yang sengaja terlihat di layar, bukan disembunyikan:
 *
 * 1. **Cakupan pencarian.** Selama indeks lintas fasilitas belum ada, hasilnya
 *    hanya mencakup fasilitas ini — dan itu dikatakan, bukan dibiarkan
 *    tampak lebih luas. Petugas yang mengira sudah melihat seluruh riwayat
 *    pasien akan menyimpulkan hal yang salah tentang alerginya.
 *
 * 2. **Dugaan rekam medis ganda.** Ditampilkan sebagai halangan, bukan sebagai
 *    peringatan yang dapat dilewati tanpa membaca.
 *
 * 3. **Alergi.** Yang berat ditampilkan mencolok pada kartu pasien, sebelum
 *    apa pun yang lain.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Info, Search, ShieldAlert, UserPlus } from 'lucide-react';
import {
  Code,
  EmptyState,
  ErrorState,
  PageHeader,
  useToast,
} from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  LABEL_KEGAWATAN,
  LABEL_KEYAKINAN,
  umurDari,
  type RingkasPasien,
} from './health-api';
import { BreakGlassDialog, PurposeSelector, usePurpose } from './PurposeGate';

interface CalonGanda {
  patientId: string;
  fullName: string;
  birthDate: string | null;
  mrn: string | null;
  score: number;
  reasons: Array<{ field: string; weight: number; detail: string }>;
}

export function PatientPage() {
  const { ctx, mintaBreakGlass } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [kueri, setKueri] = useState('');
  const [dijalankan, setDijalankan] = useState('');
  const [terpilih, setTerpilih] = useState<string | null>(null);
  const [bukaForm, setBukaForm] = useState(false);
  const [ganda, setGanda] = useState<CalonGanda[] | null>(null);
  const [bgOpen, setBgOpen] = useState(false);
  const [bgTarget, setBgTarget] = useState<string | null>(null);

  const [form, setForm] = useState({
    fullName: '',
    birthDate: '',
    gender: '',
    nik: '',
    phone: '',
    motherName: '',
  });

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const cari = useQuery({
    queryKey: ['health', 'patients', dijalankan, ctx.purpose],
    queryFn: () =>
      healthApi.searchPatients(
        /^\d{16}$/.test(dijalankan) ? { nik: dijalankan } : { q: dijalankan },
        { ...ctx, facilityId },
      ),
    enabled: dijalankan.trim().length >= 2,
  });

  const detail = useQuery({
    queryKey: ['health', 'patient', terpilih, ctx.purpose, ctx.breakGlass],
    queryFn: () => healthApi.patient(terpilih as string, { ...ctx, facilityId }),
    enabled: Boolean(terpilih),
    retry: false,
  });

  const daftar = useMutation({
    mutationFn: (paksa: boolean) =>
      healthApi.createPatient(
        {
          fullName: form.fullName,
          birthDate: form.birthDate || undefined,
          gender: form.gender || undefined,
          nik: form.nik || undefined,
          phone: form.phone || undefined,
          motherName: form.motherName || undefined,
          facilityId,
          confirmedNotDuplicate: paksa,
        },
        { ...ctx, facilityId },
      ),
    onSuccess: (hasil) => {
      toast.push(`Pasien terdaftar. Nomor rekam medis ${hasil.medicalRecordNumber}.`, 'success');
      setBukaForm(false);
      setGanda(null);
      setForm({ fullName: '', birthDate: '', gender: '', nik: '', phone: '', motherName: '' });
      void queryClient.invalidateQueries({ queryKey: ['health', 'patients'] });
    },
    onError: (error: unknown) => {
      const err = error as { params?: { candidates?: CalonGanda[] } };
      const calon = err?.params?.candidates;
      if (calon?.length) {
        // Bukan sekadar pesan galat: calonnya ditampilkan supaya petugas dapat
        // memutuskan dengan melihat, bukan dengan menebak.
        setGanda(calon);
        return;
      }
      toast.push(toMessage(error, (k, f) => f ?? k), 'error');
    },
  });

  const alergiBerat = (detail.data?.allergies ?? []).filter(
    (a) => a.severity === 'SEVERE' || a.severity === 'FATAL',
  );

  return (
    <>
      <PageHeader
        title="Pasien"
        description="Mencari, membuka, dan mendaftarkan pasien."
        breadcrumbs={[{ label: 'eMedik' }, { label: 'Pasien' }]}
        actions={
          <>
            <PurposeSelector />
            <button type="button" className="btn-primary" onClick={() => setBukaForm((v) => !v)}>
              <UserPlus className="h-4 w-4" aria-hidden />
              Pasien baru
            </button>
          </>
        }
      />

      {/* --- Pencarian --------------------------------------------------- */}
      <form
        className="mb-4 flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setDijalankan(kueri);
        }}
      >
        <input
          className="field-input max-w-md"
          placeholder="Nama atau NIK 16 angka"
          value={kueri}
          onChange={(e) => setKueri(e.target.value)}
          aria-label="Cari pasien"
        />
        <button type="submit" className="btn-outline">
          <Search className="h-4 w-4" aria-hidden />
          Cari
        </button>
      </form>

      {cari.data && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-sky-300 bg-sky-50 p-3 text-sm text-sky-900 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-100">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{cari.data.scopeNote}</p>
        </div>
      )}

      {cari.isError && (
        <ErrorState
          message={toMessage(cari.error, (k, f) => f ?? k)}
          onRetry={() => void cari.refetch()}
        />
      )}

      {cari.data && cari.data.results.length === 0 && (
        <EmptyState
          title="Tidak ada pasien yang cocok"
          description="Periksa ejaan namanya, atau daftarkan sebagai pasien baru."
        />
      )}

      {(cari.data?.results ?? []).length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(cari.data?.results ?? []).map((p: RingkasPasien) => {
            const yakin = LABEL_KEYAKINAN[p.identity_confidence] ?? LABEL_KEYAKINAN.LOW;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTerpilih(p.id)}
                className={
                  p.id === terpilih
                    ? 'card border-2 border-brand-500 p-4 text-start'
                    : 'card p-4 text-start hover:border-brand-400'
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-medium text-slate-900 dark:text-white">{p.full_name}</h3>
                  <span className={`badge ${yakin.kelas}`}>{yakin.teks}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {p.mrn ? <Code>{p.mrn}</Code> : 'tanpa nomor rekam medis'} · {umurDari(p.birth_date)}
                  {p.gender ? ` · ${p.gender === 'FEMALE' ? 'P' : p.gender === 'MALE' ? 'L' : '—'}` : ''}
                </p>
                {p.safety_alert && (
                  <p className="mt-2 flex items-start gap-1 text-xs text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                    {p.safety_alert}
                  </p>
                )}
                {p.deceased_at && (
                  <p className="mt-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                    Pasien telah meninggal
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* --- Detail pasien ------------------------------------------------ */}
      {terpilih && detail.isError && (
        <section className="mt-6">
          <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-950/30">
            <p className="text-sm text-rose-900 dark:text-rose-100">
              {toMessage(detail.error, (k, f) => f ?? k)}
            </p>
            <button
              type="button"
              className="btn mt-3 bg-rose-600 text-white hover:bg-rose-700"
              onClick={() => {
                setBgTarget(terpilih);
                setBgOpen(true);
              }}
            >
              <ShieldAlert className="h-4 w-4" aria-hidden />
              Buka sebagai akses darurat
            </button>
          </div>
        </section>
      )}

      {detail.data && (
        <section className="mt-6 card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {detail.data.full_name}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {umurDari(detail.data.birth_date)} · {detail.data.birth_date ?? 'tanggal lahir tidak diketahui'}
                {detail.data.phone ? ` · ${detail.data.phone}` : ''}
              </p>
            </div>
            {ctx.breakGlass && (
              <span className="badge bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200">
                Dibuka lewat akses darurat — tercatat
              </span>
            )}
          </div>

          {/* Alergi berat lebih dahulu, sebelum apa pun yang lain. */}
          {alergiBerat.length > 0 && (
            <div className="mt-4 rounded-lg border-2 border-rose-400 bg-rose-50 p-4 dark:border-rose-700 dark:bg-rose-950/40">
              <h3 className="flex items-center gap-2 font-semibold text-rose-900 dark:text-rose-100">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                Alergi berat
              </h3>
              <ul className="mt-2 space-y-1 text-sm text-rose-900 dark:text-rose-100">
                {alergiBerat.map((a) => (
                  <li key={a.id}>
                    <strong>{a.name}</strong> — {LABEL_KEGAWATAN[a.severity] ?? a.severity}
                    {a.reaction ? `, ${a.reaction}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Pengenal
              </dt>
              <dd className="mt-1 space-y-1 text-sm">
                {(detail.data.identifiers ?? []).map((i) => (
                  <p key={`${i.type}-${i.value}`}>
                    {i.type}: <Code>{i.value}</Code>
                    {i.verified ? ' ✓' : ''}
                  </p>
                ))}
                {!(detail.data.identifiers ?? []).length && <p className="text-slate-500">—</p>}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Alergi lain
              </dt>
              <dd className="mt-1 space-y-1 text-sm">
                {(detail.data.allergies ?? [])
                  .filter((a) => a.severity !== 'SEVERE' && a.severity !== 'FATAL')
                  .map((a) => (
                    <p key={a.id}>
                      {a.name} — {LABEL_KEGAWATAN[a.severity] ?? a.severity}
                    </p>
                  ))}
                {(detail.data.allergies ?? []).length === 0 && (
                  <p className="text-slate-500">Belum ada alergi tercatat.</p>
                )}
              </dd>
            </div>
          </dl>
        </section>
      )}

      {/* --- Form pasien baru --------------------------------------------- */}
      {bukaForm && (
        <section className="mt-6 card p-5">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Pasien baru</h2>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="p-name">Nama lengkap *</label>
              <input
                id="p-name"
                className="field-input"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="p-nik">NIK</label>
              <input
                id="p-nik"
                className="field-input"
                inputMode="numeric"
                maxLength={16}
                value={form.nik}
                onChange={(e) => setForm({ ...form, nik: e.target.value.replace(/\D/g, '') })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="p-birth">Tanggal lahir</label>
              <input
                id="p-birth"
                type="date"
                className="field-input"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="p-gender">Jenis kelamin</label>
              <select
                id="p-gender"
                className="field-input"
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
              >
                <option value="">—</option>
                <option value="FEMALE">Perempuan</option>
                <option value="MALE">Laki-laki</option>
                <option value="UNKNOWN">Tidak diketahui</option>
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="p-phone">Telepon</label>
              <input
                id="p-phone"
                className="field-input"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="p-mother">Nama ibu kandung</label>
              <input
                id="p-mother"
                className="field-input"
                value={form.motherName}
                onChange={(e) => setForm({ ...form, motherName: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Pembeda terkuat sesudah NIK. Dua orang bernama sama dengan tanggal lahir sama masih
                mungkin; ditambah nama ibu yang sama, hampir tidak.
              </p>
            </div>
          </div>

          {/* Dugaan penggandaan sebagai HALANGAN, bukan peringatan lewat. */}
          {ganda && (
            <div className="mt-4 rounded-lg border-2 border-amber-400 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
              <h3 className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-100">
                <AlertTriangle className="h-5 w-5" aria-hidden />
                Pasien ini kemungkinan besar sudah terdaftar
              </h3>
              <p className="mt-1 text-sm text-amber-900 dark:text-amber-100">
                Membuat rekam medis kedua untuk orang yang sama berarti alergi yang tercatat di satu
                berkas tidak akan terlihat saat meresepkan dari berkas lain.
              </p>
              <ul className="mt-3 space-y-2">
                {ganda.map((c) => (
                  <li key={c.patientId} className="rounded bg-white/70 p-3 text-sm dark:bg-slate-900/40">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {c.fullName} {c.mrn ? <Code>{c.mrn}</Code> : null}
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Lahir {c.birthDate ?? '—'} · kemiripan {c.score}%
                    </p>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                      {c.reasons.map((r) => r.detail).join(' · ')}
                    </p>
                    <button
                      type="button"
                      className="btn-outline mt-2 py-1 text-xs"
                      onClick={() => {
                        setTerpilih(c.patientId);
                        setBukaForm(false);
                        setGanda(null);
                      }}
                    >
                      Pakai rekam medis ini
                    </button>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn mt-3 bg-amber-600 text-white hover:bg-amber-700"
                onClick={() => daftar.mutate(true)}
                disabled={daftar.isPending}
              >
                Saya sudah memeriksa — ini orang yang berbeda
              </button>
            </div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => { setBukaForm(false); setGanda(null); }}>
              Batal
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!form.fullName.trim() || !facilityId || daftar.isPending}
              onClick={() => daftar.mutate(false)}
            >
              Daftarkan
            </button>
          </div>
        </section>
      )}

      <BreakGlassDialog
        open={bgOpen}
        onCancel={() => setBgOpen(false)}
        onConfirm={(reason) => {
          mintaBreakGlass(reason);
          setBgOpen(false);
          if (bgTarget) setTerpilih(bgTarget);
        }}
      />
    </>
  );
}
