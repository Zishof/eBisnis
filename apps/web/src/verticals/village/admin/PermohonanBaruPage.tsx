/**
 * Formulir loket: membuatkan permohonan surat untuk warga yang datang.
 *
 * ## Urutannya mengikuti percakapan di meja, bukan bentuk tabelnya
 *
 * Warga datang dan berkata "saya mau surat domisili". Karena itu **jenis
 * layanan dipilih lebih dahulu**, dan begitu terpilih, syaratnya langsung
 * tampil — supaya petugas dapat memberi tahu apa yang harus dibawa sebelum
 * permohonannya dibuat.
 *
 * Urutan sebaliknya menghasilkan permohonan yang terlanjur ada padahal
 * warganya harus pulang mengambil fotokopi KK, dan permohonan berstatus kurang
 * yang harus ia urus lagi.
 *
 * ## Pemohon dicari dari data kependudukan, bukan diketik
 *
 * Nama yang diketik ulang setiap kali menghasilkan "Sumiati", "Sumiyati", dan
 * "Sumiati binti Karto" sebagai tiga orang berbeda pada satu desa. Pencarian
 * penduduk **tercatat** pada log akses — itu memang seharusnya, dan bukan
 * alasan untuk menghindarinya.
 *
 * Mengetik manual tetap disediakan untuk pemohon yang belum terdaftar, dan
 * layar menyatakan terus terang bahwa NIK yang diketik **tidak diperiksa**
 * terhadap data kependudukan.
 */

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleAlert, Search, UserPlus } from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Code,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  useToast,
} from '../../../components/ui';
import { api, formatMoney } from '../../../lib/api';
import { useBercakupan, useDaftarDesa, usePesanGalat, type BarisDaftar } from './useVillageAdmin';

interface Syarat {
  code: string;
  name: string;
  description?: string | null;
  is_mandatory: boolean;
}

interface JenisLayanan {
  service: Record<string, unknown>;
  requirements: Syarat[];
}

/** Pemohon: dipilih dari kependudukan, atau diketik untuk yang belum terdaftar. */
type Pemohon =
  | { jenis: 'PENDUDUK'; residentId: string; nama: string; nik?: string | null }
  | { jenis: 'MANUAL'; nama: string; nik?: string; telepon?: string };

export function PermohonanBaruPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const toMessage = usePesanGalat();

  const [kodeLayanan, setKodeLayanan] = useState('');
  const [pemohon, setPemohon] = useState<Pemohon | null>(null);
  const [keperluan, setKeperluan] = useState('');

  const layananAktif = useDaftarDesa('jenis-layanan', { aktif: 'true' }, { limit: 200, offset: 0 });

  const jenis = useQuery({
    queryKey: ['village-service', kodeLayanan],
    queryFn: () => api.get<JenisLayanan>(`/village/services/${encodeURIComponent(kodeLayanan)}`),
    enabled: Boolean(kodeLayanan),
    staleTime: 5 * 60_000,
  });

  const kirim = useMutation({
    mutationFn: (v: {
      serviceCode: string;
      residentId?: string;
      applicantName: string;
      applicantNik?: string;
      applicantPhone?: string;
      purpose?: string;
    }) =>
      api.post<{ id: string; requestNumber: string; processableByCreator: boolean }>(
        '/village/requests',
        v,
      ),
  });

  const bolehKirim = Boolean(kodeLayanan) && Boolean(pemohon) && !kirim.isPending;

  const ajukan = async () => {
    if (!pemohon) return;
    try {
      const hasil = await kirim.mutateAsync({
        serviceCode: kodeLayanan,
        residentId: pemohon.jenis === 'PENDUDUK' ? pemohon.residentId : undefined,
        applicantName: pemohon.nama,
        applicantNik: pemohon.jenis === 'MANUAL' ? pemohon.nik || undefined : undefined,
        applicantPhone: pemohon.jenis === 'MANUAL' ? pemohon.telepon || undefined : undefined,
        purpose: keperluan.trim() || undefined,
      });

      // Dinyatakan seketika, bukan ditemukan sesudah menekan tombol verifikasi.
      toast.push(
        hasil.processableByCreator
          ? `Permohonan ${hasil.requestNumber} dibuat.`
          : `Permohonan ${hasil.requestNumber} dibuat. Permohonan ini atas nama Anda sendiri, ` +
              'sehingga petugas lain yang harus memverifikasinya.',
        'success',
      );

      // Langsung ke rinciannya: langkah berikutnya adalah menandai berkas yang
      // warganya sedang pegang, dan ia masih berdiri di depan meja.
      navigate(`/app/info-desa/layanan/permohonan/${hasil.id}`);
    } catch (e) {
      toast.push(toMessage(e), 'error');
    }
  };

  const layanan = jenis.data?.service;
  const wajib = (jenis.data?.requirements ?? []).filter((s) => s.is_mandatory);
  const opsional = (jenis.data?.requirements ?? []).filter((s) => !s.is_mandatory);

  return (
    <div>
      <PageHeader
        title="Buat Permohonan Baru"
        description="Untuk warga yang datang ke loket tanpa mengajukan lewat aplikasi."
        breadcrumbs={[
          { label: 'Permohonan', href: '/app/info-desa/layanan/permohonan' },
          { label: 'Baru' },
        ]}
        actions={
          <Link to="/app/info-desa/layanan/permohonan" className="btn-outline px-3 py-1.5 text-xs">
            <ArrowLeft size={14} aria-hidden className="me-1.5 inline" />
            Kembali ke daftar
          </Link>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* --- 1. Jenis layanan --- */}
          <section className="card p-5">
            <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
              1. Warga mau surat apa?
            </h2>
            <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
              Dipilih lebih dahulu supaya syaratnya langsung tampil, dan Anda dapat memberi tahu apa
              yang harus dibawa sebelum permohonannya dibuat.
            </p>

            {layananAktif.isError ? (
              <ErrorState
                message={toMessage(layananAktif.error)}
                onRetry={() => layananAktif.refetch()}
              />
            ) : (
              <select
                className="field-input text-sm"
                value={kodeLayanan}
                onChange={(e) => setKodeLayanan(e.target.value)}
                disabled={layananAktif.isLoading}
              >
                <option value="">— pilih jenis layanan —</option>
                {(layananAktif.data?.rows ?? []).map((l: BarisDaftar) => (
                  <option key={String(l.id)} value={String(l.code)}>
                    {String(l.name)}
                  </option>
                ))}
              </select>
            )}

            {layananAktif.data && layananAktif.data.rows.length === 0 && (
              <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                Belum ada jenis layanan yang aktif. Aturlah lebih dahulu pada menu Jenis Layanan.
              </p>
            )}
          </section>

          {/* --- 2. Pemohon --- */}
          {kodeLayanan && (
            <PilihPemohon pemohon={pemohon} onPilih={setPemohon} />
          )}

          {/* --- 3. Keperluan --- */}
          {pemohon && (
            <section className="card p-5">
              <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">
                3. Untuk keperluan apa?
              </h2>
              <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
                Keperluan ikut tercetak pada sebagian surat, dan ia yang ditanyakan pihak penerima.
                Tulis sebagaimana warga menyebutkannya.
              </p>
              <input
                className="field-input text-sm"
                value={keperluan}
                onChange={(e) => setKeperluan(e.target.value)}
                placeholder="Contoh: melamar pekerjaan, pendaftaran sekolah anak"
                maxLength={1000}
              />
            </section>
          )}
        </div>

        {/* --- Kolom kanan: syarat dan tombol --- */}
        <div className="space-y-4">
          {kodeLayanan && jenis.isLoading && <LoadingState />}

          {jenis.isError && (
            <ErrorState message={toMessage(jenis.error)} onRetry={() => jenis.refetch()} />
          )}

          {layanan && (
            <>
              <section className="card p-5">
                <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                  Yang perlu dibawa
                </h2>

                {wajib.length === 0 && opsional.length === 0 ? (
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Layanan ini tidak memerlukan berkas apa pun.
                  </p>
                ) : (
                  <>
                    {wajib.length > 0 && (
                      <ul className="mb-3 space-y-2">
                        {wajib.map((s) => (
                          <li key={s.code} className="text-sm">
                            <span className="text-slate-900 dark:text-slate-100">{s.name}</span>
                            {s.description && (
                              <span className="block text-xs text-slate-500 dark:text-slate-400">
                                {s.description}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    {opsional.length > 0 && (
                      <>
                        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                          Tidak wajib
                        </p>
                        <ul className="space-y-1">
                          {opsional.map((s) => (
                            <li key={s.code} className="text-sm text-slate-600 dark:text-slate-300">
                              {s.name}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </>
                )}

                <dl className="mt-4 space-y-2 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">Janji selesai</dt>
                    <dd className="text-slate-900 dark:text-slate-100">
                      {`${Number(layanan.sla_working_days ?? 0)} hari kerja`}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-slate-500 dark:text-slate-400">Biaya</dt>
                    <dd className="text-slate-900 dark:text-slate-100">
                      {formatMoney(layanan.fee_amount as string)}
                    </dd>
                  </div>
                </dl>

                {/*
                  Janji penyelesaian baru mulai berjalan ketika berkasnya
                  dinyatakan lengkap, bukan hari ini. Petugas yang menjanjikan
                  "tiga hari lagi" kepada warga yang berkasnya belum lengkap
                  sedang membuat janji yang tidak akan ditepati sistemnya.
                */}
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Janji penyelesaian mulai dihitung saat berkas dinyatakan lengkap, bukan hari
                  permohonan dibuat.
                </p>
              </section>

              <button
                type="button"
                className="btn-primary w-full justify-center px-3 py-2.5 text-sm"
                disabled={!bolehKirim}
                onClick={ajukan}
              >
                {kirim.isPending ? 'Menyimpan…' : 'Buat permohonan'}
              </button>

              {!pemohon && (
                <p className="text-center text-xs text-slate-500 dark:text-slate-400">
                  Pilih pemohonnya lebih dahulu.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Pemilihan pemohon -------------------------------------------------------

function PilihPemohon({
  pemohon,
  onPilih,
}: {
  pemohon: Pemohon | null;
  onPilih: (p: Pemohon | null) => void;
}) {
  const toMessage = usePesanGalat();
  const [cara, setCara] = useState<'CARI' | 'KETIK'>('CARI');
  const [q, setQ] = useState('');
  const [namaManual, setNamaManual] = useState('');
  const [nikManual, setNikManual] = useState('');
  const [teleponManual, setTeleponManual] = useState('');

  // Pencarian baru berjalan setelah tiga huruf. Pencarian satu huruf
  // mengembalikan hampir seluruh desa dan ikut tercatat pada log akses sebagai
  // pembacaan massal — yang memang begitu adanya.
  const cari = useBercakupan('/village/residents', 'residents-loket', { q }, q.trim().length >= 3);

  if (pemohon) {
    return (
      <section className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
          2. Pemohon
        </h2>
        <div className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {pemohon.nama}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {pemohon.jenis === 'PENDUDUK' ? (
                <>
                  <StatusBadge status="Terdaftar" tone="success" />
                  <span className="ms-2">Data diambil dari kependudukan desa.</span>
                </>
              ) : (
                <>
                  <StatusBadge status="Belum terdaftar" tone="warning" />
                  <span className="ms-2">Diketik manual.</span>
                </>
              )}
            </div>
          </div>
          <button
            type="button"
            className="btn-outline shrink-0 px-2.5 py-1 text-xs"
            onClick={() => onPilih(null)}
          >
            Ganti
          </button>
        </div>

        {pemohon.jenis === 'MANUAL' && (
          /*
            Dinyatakan terus terang. NIK yang diketik petugas dari kartu yang
            dilihat sekilas akan menjadi NIK yang tercetak pada surat resmi, dan
            warga yang menanggung akibatnya di kantor lain.
          */
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
            <CircleAlert size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              NIK yang diketik <strong>tidak diperiksa</strong> terhadap data kependudukan. Bila
              warga ini sebenarnya penduduk desa, carilah datanya — supaya suratnya memakai nomor
              yang sudah terverifikasi.
            </span>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">2. Siapa pemohonnya?</h2>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Carilah dari data kependudukan bila ia penduduk desa ini. Nama yang diketik ulang setiap
        kali menghasilkan satu orang tercatat sebagai beberapa orang berbeda.
      </p>

      <div className="mb-4 flex gap-1 border-b border-slate-200 dark:border-slate-800">
        {(
          [
            ['CARI', 'Cari penduduk'],
            ['KETIK', 'Belum terdaftar'],
          ] as const
        ).map(([nilai, label]) => (
          <button
            key={nilai}
            type="button"
            onClick={() => setCara(nilai)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              cara === nilai
                ? 'border-brand-700 text-brand-800 dark:border-brand-400 dark:text-brand-300'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {cara === 'CARI' ? (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Nama atau NIK
            </span>
            <div className="relative">
              <Search
                size={15}
                aria-hidden
                className="pointer-events-none absolute start-3 top-2.5 text-slate-400"
              />
              <input
                className="field-input py-1.5 ps-9 text-sm"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="ketik minimal 3 huruf"
              />
            </div>
          </label>

          {q.trim().length > 0 && q.trim().length < 3 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Ketik minimal tiga huruf. Pencarian satu huruf mengembalikan hampir seluruh desa.
            </p>
          )}

          {cari.isLoading && <div className="mt-3"><LoadingState /></div>}
          {cari.isError && (
            <div className="mt-3">
              <ErrorState message={toMessage(cari.error)} onRetry={() => cari.refetch()} />
            </div>
          )}

          {cari.data && (
            <>
              {cari.data.scope.level !== 'UNIT' && (
                <p className="mt-3 text-xs text-sky-800 dark:text-sky-300">
                  {cari.data.scope.description ?? `Cakupan Anda: ${cari.data.scope.level}`}
                </p>
              )}

              {cari.data.rows.length === 0 ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Tidak ada yang cocok. Bila warga ini memang belum terdaftar, pakai tab{' '}
                  <strong>Belum terdaftar</strong>.
                </p>
              ) : (
                <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto">
                  {cari.data.rows.map((w) => (
                    <li key={String(w.id)}>
                      <button
                        type="button"
                        className="w-full rounded-lg border border-slate-200 p-2.5 text-start hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800"
                        onClick={() =>
                          onPilih({
                            jenis: 'PENDUDUK',
                            residentId: String(w.id),
                            nama: String(w.full_name),
                            nik: (w.national_id as string) ?? null,
                          })
                        }
                      >
                        <span className="block text-sm text-slate-900 dark:text-slate-100">
                          {String(w.full_name)}
                        </span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {/*
                            Empat angka terakhir saja, sama seperti daftar
                            penduduk. Yang membedakan dua orang bernama sama
                            adalah RT-nya dan tanggal lahirnya, bukan NIK utuh
                            yang terbaca dari antrean.
                          */}
                          <Code>
                            {String(w.national_id ?? '').length >= 4
                              ? `••••${String(w.national_id).slice(-4)}`
                              : '—'}
                          </Code>
                          {w.rt_number != null && (
                            <span className="ms-2">
                              RT {String(w.rt_number)}/{String(w.rw_number ?? '—')}
                            </span>
                          )}
                          {w.birth_date != null && (
                            <span className="ms-2">lahir {String(w.birth_date)}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Nama lengkap
            </span>
            <input
              className="field-input py-1.5 text-sm"
              value={namaManual}
              onChange={(e) => setNamaManual(e.target.value)}
              maxLength={200}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                NIK (bila ada)
              </span>
              <input
                className="field-input py-1.5 text-sm"
                value={nikManual}
                onChange={(e) => setNikManual(e.target.value)}
                maxLength={24}
                inputMode="numeric"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Telepon (bila ada)
              </span>
              <input
                className="field-input py-1.5 text-sm"
                value={teleponManual}
                onChange={(e) => setTeleponManual(e.target.value)}
                maxLength={40}
                inputMode="tel"
              />
            </label>
          </div>

          <button
            type="button"
            className="btn-outline w-full justify-center px-3 py-2 text-sm"
            disabled={namaManual.trim().length < 2}
            onClick={() =>
              onPilih({
                jenis: 'MANUAL',
                nama: namaManual.trim(),
                nik: nikManual.trim() || undefined,
                telepon: teleponManual.trim() || undefined,
              })
            }
          >
            <UserPlus size={15} aria-hidden className="me-1.5" />
            Pakai data ini
          </button>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dipakai untuk pemohon yang belum terdaftar pada kependudukan desa. Data yang diketik di
            sini tidak menambah data penduduk — pendaftarannya lewat menu Kependudukan.
          </p>
        </div>
      )}
    </section>
  );
}
