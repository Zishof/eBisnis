/**
 * Formulir pendaftaran pondok pesantren.
 *
 * Terpisah dari `/daftar` dengan sengaja. Yang ditanyakan berbeda — NSPP, izin
 * operasional, tipe pesantren, jenjang, pengasuh — dan yang dihasilkan juga
 * berbeda: pendaftaran ini membuat situs pondok, bukan hanya ruang kerja.
 *
 * Formulir gabungan yang mengganti setengah pertanyaannya menurut satu pilihan
 * di awal akan menampilkan pertanyaan retail kepada pengurus pondok setiap kali
 * pilihan itu tergeser.
 *
 * ## Dua nama yang tidak boleh tertukar
 *
 * **Alamat situs** menjadi `<slug>.santri.info` — label DNS, tanpa garis bawah.
 * **Nama pengguna** menjadi nama schema — boleh garis bawah.
 *
 * Keduanya diminta terpisah, dan keduanya diperiksa ke peladen masing-masing.
 * Menyamakannya membuat pondok bernama `raudlatul_ulum` memperoleh host yang
 * tidak sah dan situs yang tidak pernah dapat dibuka.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { Check, Loader2, X } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '../../lib/api';
import { useErrorMessage } from '../../app/auth-context';

interface Pilihan {
  code: string;
  label: string;
}

interface KonfigPesantren {
  tipePesantren: Pilihan[];
  santriDilayani: Pilihan[];
  jenjang: Pilihan[];
  afiliasi: string[];
  domainSitus: string;
  passwordSelaluDibuatPeladen: boolean;
  hargaPerSantriPerBulan: number;
}

interface CekSlug {
  tersedia: boolean;
  slug: string;
  host: string | null;
  alasan: string | null;
  pesan: string;
}

interface CekUsername {
  available: boolean;
  schemaName: string;
  message: string;
  suggestions: string[];
}

export interface HasilPendaftaranPesantren {
  status: string;
  registrationId: string;
  tenantId: string;
  username: string;
  schemaName: string;
  temporaryPassword?: string;
  mustChangePassword: boolean;
  slugSitus: string;
  siteHost: string;
  siteUrl: string;
  loginUrl: string;
}

interface Formulir {
  namaPondok: string;
  slugSitus: string;
  desiredUsername: string;
  email: string;

  tipePesantren: string;
  santriDilayani: string;

  nomorStatistik: string;
  nomorIzinOperasional: string;
  tanggalIzin: string;
  tahunBerdiri: string;
  namaYayasan: string;
  aktaYayasan: string;
  namaPengasuh: string;
  afiliasi: string;

  jumlahSantriMukim: string;
  jumlahSantriNonmukim: string;
  jumlahUstaz: string;

  provinsi: string;
  kabupatenKota: string;
  kecamatan: string;
  desaKelurahan: string;
  alamat: string;
  kodePos: string;

  penanggungJawab: string;
  teleponPenanggungJawab: string;
  teleponPondok: string;
  whatsapp: string;
  situsWeb: string;
}

const LANGKAH = [
  'Identitas pondok',
  'Penyelenggaraan',
  'Alamat',
  'Kontak',
  'Akun dan situs',
] as const;

/** Angka opsional: kosong berarti tidak diisi, bukan nol. */
function angka(nilai: string): number | undefined {
  const bersih = nilai.trim();
  if (!bersih) return undefined;
  const n = Number(bersih);
  return Number.isFinite(n) ? n : undefined;
}

function teks(nilai: string): string | undefined {
  const bersih = nilai.trim();
  return bersih ? bersih : undefined;
}

export function DaftarPesantrenPage() {
  const navigate = useNavigate();
  const toMessage = useErrorMessage();

  const [langkah, setLangkah] = useState(0);
  const [jenjang, setJenjang] = useState<string[]>([]);
  const [setujuSyarat, setSetujuSyarat] = useState(false);
  const [setujuPrivasi, setSetujuPrivasi] = useState(false);
  const [dataContoh, setDataContoh] = useState(true);
  const [galat, setGalat] = useState<string | null>(null);
  const [galatMedan, setGalatMedan] = useState<Record<string, string>>({});
  /*
   * Alamat situs dan nama pengguna diisikan sendiri dari nama pondok.
   *
   * Masing-masing punya penanda "sudah disunting" tersendiri. Satu penanda
   * bersama akan membuat pengurus yang menyunting alamat situs kehilangan usulan
   * nama pengguna — dua kolom yang berbeda, dikunci oleh satu sentuhan.
   */
  const [slugDisunting, setSlugDisunting] = useState(false);
  const [usernameDisunting, setUsernameDisunting] = useState(false);

  const konfig = useQuery({
    queryKey: ['pesantren-registration-config'],
    queryFn: () => api.get<KonfigPesantren>('/public/pesantren/registration-config'),
  });

  const { register, handleSubmit, watch, setValue, trigger, formState } = useForm<Formulir>({
    defaultValues: { tipePesantren: 'KOMBINASI', santriDilayani: 'PUTRA_PUTRI' },
  });

  const namaPondok = watch('namaPondok', '');
  const slugSitus = watch('slugSitus', '');
  const username = watch('desiredUsername', '');

  // Usulan alamat situs dan nama pengguna dari nama pondok. Satu panggilan,
  // dua bentuk: tanda hubung untuk alamat situs, garis bawah untuk nama
  // pengguna. Peladen yang menyusun keduanya, bukan peramban — supaya bentuknya
  // tidak berselisih dengan pemeriksa yang menerima kirimannya.
  useEffect(() => {
    if ((slugDisunting && usernameDisunting) || !namaPondok.trim()) return;
    const timer = setTimeout(() => {
      api
        .get<{ slug: string; username: string }>(
          `/public/pesantren/site-slug/suggest?nama=${encodeURIComponent(namaPondok)}`,
        )
        .then((jawaban) => {
          if (!slugDisunting) setValue('slugSitus', jawaban.slug);
          if (!usernameDisunting) setValue('desiredUsername', jawaban.username);
        })
        .catch(() => {
          /* Usulan yang gagal bukan kegagalan pendaftaran. Kolomnya tetap dapat diisi tangan. */
        });
    }, 500);
    return () => clearTimeout(timer);
  }, [namaPondok, slugDisunting, usernameDisunting, setValue]);

  const [slugQuery, setSlugQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSlugQuery(slugSitus.trim()), 450);
    return () => clearTimeout(timer);
  }, [slugSitus]);

  const cekSlug = useQuery({
    queryKey: ['pesantren-slug', slugQuery],
    queryFn: () =>
      api.get<CekSlug>(`/public/pesantren/site-slug/check?slug=${encodeURIComponent(slugQuery)}`),
    enabled: slugQuery.length >= 3,
  });

  const [usernameQuery, setUsernameQuery] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setUsernameQuery(username.trim()), 450);
    return () => clearTimeout(timer);
  }, [username]);

  const cekUsername = useQuery({
    queryKey: ['pesantren-username', usernameQuery],
    queryFn: () =>
      api.post<CekUsername>('/public/usernames/check', { desiredUsername: usernameQuery }),
    enabled: usernameQuery.length >= 3,
  });

  const kirim = useMutation({
    mutationFn: (nilai: Formulir) =>
      api.post<HasilPendaftaranPesantren>('/public/pesantren/registrations', {
        namaPondok: nilai.namaPondok.trim(),
        slugSitus: nilai.slugSitus.trim().toLowerCase(),
        desiredUsername: nilai.desiredUsername.trim().toLowerCase(),
        email: nilai.email.trim(),

        tipePesantren: nilai.tipePesantren,
        santriDilayani: nilai.santriDilayani,
        jenjang,

        nomorStatistik: teks(nilai.nomorStatistik),
        nomorIzinOperasional: teks(nilai.nomorIzinOperasional),
        tanggalIzin: teks(nilai.tanggalIzin),
        tahunBerdiri: angka(nilai.tahunBerdiri),
        namaYayasan: teks(nilai.namaYayasan),
        aktaYayasan: teks(nilai.aktaYayasan),
        namaPengasuh: teks(nilai.namaPengasuh),
        afiliasi: teks(nilai.afiliasi),

        jumlahSantriMukim: angka(nilai.jumlahSantriMukim),
        jumlahSantriNonmukim: angka(nilai.jumlahSantriNonmukim),
        jumlahUstaz: angka(nilai.jumlahUstaz),

        provinsi: teks(nilai.provinsi),
        kabupatenKota: teks(nilai.kabupatenKota),
        kecamatan: teks(nilai.kecamatan),
        desaKelurahan: teks(nilai.desaKelurahan),
        alamat: teks(nilai.alamat),
        kodePos: teks(nilai.kodePos),

        penanggungJawab: teks(nilai.penanggungJawab),
        teleponPenanggungJawab: teks(nilai.teleponPenanggungJawab),
        teleponPondok: teks(nilai.teleponPondok),
        whatsapp: teks(nilai.whatsapp),
        situsWeb: teks(nilai.situsWeb),

        acceptTerms: setujuSyarat,
        acceptPrivacy: setujuPrivasi,
        includeSampleData: dataContoh,
      }),
    onSuccess: (hasil) => {
      /*
       * Credential hanya ada di memori navigasi — tidak ditulis ke penyimpanan
       * peramban, tidak masuk alamat, dan tidak dapat dibuka lagi dengan tombol
       * kembali setelah halaman berikutnya menggantikannya.
       */
      navigate('/daftar-pesantren/berhasil', { state: { hasil }, replace: true });
    },
    onError: (err) => {
      setGalatMedan(kumpulkanGalatMedan(err));
      setGalat(toMessage(err, (_k, fallback) => fallback ?? 'Pendaftaran gagal.'));
    },
  });

  const bolehKirim =
    setujuSyarat &&
    setujuPrivasi &&
    jenjang.length > 0 &&
    cekSlug.data?.tersedia === true &&
    cekUsername.data?.available === true;

  const onSubmit = handleSubmit((nilai) => {
    setGalat(null);
    setGalatMedan({});
    if (!bolehKirim) {
      setGalat(
        'Lengkapi alamat situs dan nama pengguna yang tersedia, pilih jenjang, ' +
          'dan setujui syarat serta kebijakan privasi.',
      );
      return;
    }
    kirim.mutate(nilai);
  });

  const lanjut = async () => {
    const medan: Record<number, Array<keyof Formulir>> = {
      0: ['namaPondok'],
      1: [],
      2: [],
      3: ['email'],
      4: ['slugSitus', 'desiredUsername'],
    };
    if (await trigger(medan[langkah] ?? [])) {
      setLangkah((n) => Math.min(n + 1, LANGKAH.length - 1));
    }
  };

  const domain = konfig.data?.domainSitus ?? 'santri.info';

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="mb-8 text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          Pendaftaran pondok pesantren
        </p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 dark:text-white">
          Daftarkan pondok Anda
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-slate-600 dark:text-slate-300">
          Isian ini menyiapkan ruang kerja pondok beserta alamat situsnya. Yang
          bertanda * wajib diisi; sisanya dapat dilengkapi kemudian dari dalam
          aplikasi.
        </p>
      </header>

      <ol className="mb-8 flex flex-wrap items-center justify-center gap-2" aria-label="Langkah pendaftaran">
        {LANGKAH.map((judul, i) => (
          <li key={judul} className="flex items-center gap-2">
            <span
              className={clsx(
                'grid h-8 w-8 place-items-center rounded-full text-xs font-bold',
                i <= langkah ? 'bg-emerald-700 text-white' : 'bg-slate-200 text-slate-500 dark:bg-slate-800',
              )}
              aria-current={i === langkah ? 'step' : undefined}
            >
              {i + 1}
            </span>
            <span
              className={clsx(
                'hidden text-sm sm:inline',
                i === langkah ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-500',
              )}
            >
              {judul}
            </span>
            {i < LANGKAH.length - 1 && <span className="hidden h-px w-5 bg-slate-300 sm:inline-block" />}
          </li>
        ))}
      </ol>

      {galat && (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-200"
        >
          {galat}
          {Object.keys(galatMedan).length > 0 && (
            <ul className="mt-2 list-inside list-disc">
              {Object.entries(galatMedan).map(([medan, pesan]) => (
                <li key={medan}>{pesan}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <form
        className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-700 dark:bg-slate-900"
        onSubmit={onSubmit}
        noValidate
      >
        {/* --- 1. Identitas --------------------------------------------- */}
        {langkah === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="namaPondok">Nama pondok pesantren *</label>
              <input
                id="namaPondok"
                className="field-input"
                placeholder="Pondok Pesantren Raudlatul Ulum"
                {...register('namaPondok', { required: true, maxLength: 255 })}
              />
              {formState.errors.namaPondok && <p className="field-error">Wajib diisi.</p>}
            </div>
            <div>
              <label className="field-label" htmlFor="nomorStatistik">Nomor Statistik Pesantren (NSPP)</label>
              <input id="nomorStatistik" className="field-input ltr-code" {...register('nomorStatistik')} />
            </div>
            <div>
              <label className="field-label" htmlFor="nomorIzinOperasional">Nomor izin operasional</label>
              <input
                id="nomorIzinOperasional"
                className="field-input ltr-code"
                {...register('nomorIzinOperasional')}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="tanggalIzin">Tanggal izin</label>
              <input id="tanggalIzin" type="date" className="field-input" {...register('tanggalIzin')} />
            </div>
            <div>
              <label className="field-label" htmlFor="tahunBerdiri">Tahun berdiri</label>
              <input
                id="tahunBerdiri"
                type="number"
                inputMode="numeric"
                className="field-input"
                placeholder="1975"
                {...register('tahunBerdiri')}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="namaYayasan">Nama yayasan</label>
              <input id="namaYayasan" className="field-input" {...register('namaYayasan')} />
            </div>
            <div>
              <label className="field-label" htmlFor="aktaYayasan">Nomor akta yayasan</label>
              <input id="aktaYayasan" className="field-input ltr-code" {...register('aktaYayasan')} />
            </div>
            <div>
              <label className="field-label" htmlFor="namaPengasuh">Nama pengasuh</label>
              <input id="namaPengasuh" className="field-input" {...register('namaPengasuh')} />
            </div>
            <div>
              <label className="field-label" htmlFor="afiliasi">Afiliasi</label>
              <input id="afiliasi" className="field-input" list="daftar-afiliasi" {...register('afiliasi')} />
              <datalist id="daftar-afiliasi">
                {(konfig.data?.afiliasi ?? []).map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </div>
          </div>
        )}

        {/* --- 2. Penyelenggaraan --------------------------------------- */}
        {langkah === 1 && (
          <div className="space-y-6">
            <fieldset>
              <legend className="field-label">Tipe pesantren *</legend>
              <div className="mt-2 space-y-2">
                {(konfig.data?.tipePesantren ?? []).map((p) => (
                  <label key={p.code} className="flex items-start gap-2 text-sm">
                    <input type="radio" className="mt-1" value={p.code} {...register('tipePesantren')} />
                    <span className="text-slate-700 dark:text-slate-200">{p.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="field-label">Santri yang dilayani *</legend>
              <div className="mt-2 space-y-2">
                {(konfig.data?.santriDilayani ?? []).map((p) => (
                  <label key={p.code} className="flex items-start gap-2 text-sm">
                    <input type="radio" className="mt-1" value={p.code} {...register('santriDilayani')} />
                    <span className="text-slate-700 dark:text-slate-200">{p.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="field-label">Jenjang yang diselenggarakan *</legend>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Pilih sedikitnya satu. Dapat ditambah kemudian tanpa mendaftar ulang.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(konfig.data?.jenjang ?? []).map((j) => (
                  <label
                    key={j.code}
                    className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-700"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={jenjang.includes(j.code)}
                      onChange={(e) =>
                        setJenjang((sebelum) =>
                          e.target.checked
                            ? [...sebelum, j.code]
                            : sebelum.filter((k) => k !== j.code),
                        )
                      }
                    />
                    <span className="text-slate-700 dark:text-slate-200">{j.label}</span>
                  </label>
                ))}
              </div>
              {jenjang.length === 0 && (
                <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
                  Belum ada jenjang yang dipilih.
                </p>
              )}
            </fieldset>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="field-label" htmlFor="jumlahSantriMukim">Santri mukim</label>
                <input
                  id="jumlahSantriMukim"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="field-input"
                  {...register('jumlahSantriMukim')}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="jumlahSantriNonmukim">Santri nonmukim</label>
                <input
                  id="jumlahSantriNonmukim"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="field-input"
                  {...register('jumlahSantriNonmukim')}
                />
              </div>
              <div>
                <label className="field-label" htmlFor="jumlahUstaz">Ustaz dan pegawai</label>
                <input
                  id="jumlahUstaz"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  className="field-input"
                  {...register('jumlahUstaz')}
                />
              </div>
              <p className="text-xs text-slate-500 sm:col-span-3 dark:text-slate-400">
                Dipakai menyusun penawaran, bukan untuk menagih. Yang ditagih adalah
                santri berstatus aktif pada bulan berjalan.
              </p>
            </div>
          </div>
        )}

        {/* --- 3. Alamat ------------------------------------------------ */}
        {langkah === 2 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="provinsi">Provinsi</label>
              <input id="provinsi" className="field-input" {...register('provinsi')} />
            </div>
            <div>
              <label className="field-label" htmlFor="kabupatenKota">Kabupaten / Kota</label>
              <input id="kabupatenKota" className="field-input" {...register('kabupatenKota')} />
            </div>
            <div>
              <label className="field-label" htmlFor="kecamatan">Kecamatan</label>
              <input id="kecamatan" className="field-input" {...register('kecamatan')} />
            </div>
            <div>
              <label className="field-label" htmlFor="desaKelurahan">Desa / Kelurahan</label>
              <input id="desaKelurahan" className="field-input" {...register('desaKelurahan')} />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="alamat">Alamat lengkap</label>
              <input id="alamat" className="field-input" {...register('alamat')} />
            </div>
            <div>
              <label className="field-label" htmlFor="kodePos">Kode pos</label>
              <input
                id="kodePos"
                className="field-input ltr-code"
                inputMode="numeric"
                placeholder="61152"
                {...register('kodePos')}
              />
            </div>
          </div>
        )}

        {/* --- 4. Kontak ------------------------------------------------ */}
        {langkah === 3 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="penanggungJawab">Penanggung jawab</label>
              <input id="penanggungJawab" className="field-input" {...register('penanggungJawab')} />
            </div>
            <div>
              <label className="field-label" htmlFor="teleponPenanggungJawab">Telepon penanggung jawab</label>
              <input
                id="teleponPenanggungJawab"
                className="field-input ltr-code"
                {...register('teleponPenanggungJawab')}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="teleponPondok">Telepon pondok</label>
              <input id="teleponPondok" className="field-input ltr-code" {...register('teleponPondok')} />
            </div>
            <div>
              <label className="field-label" htmlFor="whatsapp">WhatsApp</label>
              <input id="whatsapp" className="field-input ltr-code" {...register('whatsapp')} />
            </div>
            <div>
              <label className="field-label" htmlFor="email">Surel *</label>
              <input
                id="email"
                type="email"
                className="field-input ltr-code"
                {...register('email', { required: true, pattern: /^[^@\s]+@[^@\s]+\.[^@\s]+$/ })}
              />
              {formState.errors.email && <p className="field-error">Surel wajib diisi dengan benar.</p>}
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Dipakai untuk pemulihan akun. Pastikan yang mengaksesnya adalah pengurus.
              </p>
            </div>
            <div>
              <label className="field-label" htmlFor="situsWeb">Situs pondok yang sudah ada</label>
              <input
                id="situsWeb"
                className="field-input ltr-code"
                placeholder="https://..."
                {...register('situsWeb')}
              />
            </div>
          </div>
        )}

        {/* --- 5. Akun dan situs ---------------------------------------- */}
        {langkah === 4 && (
          <div className="space-y-6">
            <div>
              <label className="field-label" htmlFor="slugSitus">Alamat situs pondok *</label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="slugSitus"
                  className="field-input ltr-code"
                  autoComplete="off"
                  {...register('slugSitus', {
                    required: true,
                    onChange: () => setSlugDisunting(true),
                  })}
                />
                <span className="ltr-code shrink-0 text-sm text-slate-500 dark:text-slate-400">
                  .{domain}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Huruf kecil, angka, dan tanda hubung. Garis bawah tidak dapat dipakai
                pada alamat situs.
              </p>
              <KotakPeriksa
                aktif={slugQuery.length >= 3}
                memuat={cekSlug.isFetching}
                tersedia={cekSlug.data?.tersedia}
                pesan={cekSlug.data?.pesan}
                keterangan={cekSlug.data?.host ? `https://${cekSlug.data.host}` : undefined}
              />
            </div>

            <div>
              <label className="field-label" htmlFor="desiredUsername">Nama pengguna *</label>
              <input
                id="desiredUsername"
                className="field-input ltr-code"
                autoComplete="off"
                {...register('desiredUsername', {
                  required: true,
                  minLength: 3,
                  maxLength: 48,
                  onChange: () => setUsernameDisunting(true),
                })}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Diusulkan dari nama pondok dan dapat diubah. Dipakai untuk masuk, dan
                menjadi nama ruang penyimpanan data pondok. Huruf kecil, angka, dan
                garis bawah — berbeda dari alamat situs di atas, yang memakai tanda
                hubung.
              </p>
              <KotakPeriksa
                aktif={usernameQuery.length >= 3}
                memuat={cekUsername.isFetching}
                tersedia={cekUsername.data?.available}
                pesan={cekUsername.data?.message}
                usulan={cekUsername.data?.suggestions}
              />
            </div>

            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm dark:border-emerald-800 dark:bg-emerald-950/40">
              <p className="font-medium text-emerald-900 dark:text-emerald-100">
                Kata sandi dibuatkan otomatis
              </p>
              <p className="mt-1 text-emerald-800 dark:text-emerald-200">
                Setelah pendaftaran berhasil, nama pengguna dan kata sandi ditampilkan
                satu kali di layar berikutnya. Kata sandi itu wajib diganti saat masuk
                pertama.
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0"
                  checked={dataContoh}
                  onChange={(e) => setDataContoh(e.target.checked)}
                />
                <span>
                  <span className="block text-sm font-medium">Isi dengan data contoh</span>
                  <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                    Beberapa santri, kelas, dan tagihan contoh supaya aplikasinya dapat
                    langsung dicoba. Dapat dihapus kapan saja, dan tidak pernah ditagihkan.
                  </span>
                </span>
              </label>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={setujuSyarat}
                  onChange={(e) => setSetujuSyarat(e.target.checked)}
                />
                <span className="text-slate-700 dark:text-slate-200">
                  Saya menyetujui{' '}
                  <Link to="/syarat" target="_blank" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    syarat dan ketentuan
                  </Link>
                  .
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={setujuPrivasi}
                  onChange={(e) => setSetujuPrivasi(e.target.checked)}
                />
                <span className="text-slate-700 dark:text-slate-200">
                  Saya menyetujui{' '}
                  <Link to="/privasi" target="_blank" className="text-emerald-700 hover:underline dark:text-emerald-400">
                    kebijakan privasi
                  </Link>
                  .
                </span>
              </label>
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium disabled:opacity-40 dark:border-slate-700"
            onClick={() => setLangkah((n) => Math.max(0, n - 1))}
            disabled={langkah === 0}
          >
            Kembali
          </button>

          {langkah < LANGKAH.length - 1 ? (
            <button
              type="button"
              className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
              onClick={() => void lanjut()}
            >
              Lanjut
            </button>
          ) : (
            <button
              type="submit"
              className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800 disabled:opacity-40"
              disabled={!bolehKirim || kirim.isPending}
              data-testid="kirim-pendaftaran-pesantren"
            >
              {kirim.isPending ? 'Menyiapkan…' : 'Daftarkan pondok'}
            </button>
          )}
        </div>

        {kirim.isPending && (
          <p className="mt-4 flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Menyiapkan ruang kerja dan alamat situs pondok. Mohon jangan menutup halaman ini.
          </p>
        )}
      </form>
    </div>
  );
}

function KotakPeriksa({
  aktif,
  memuat,
  tersedia,
  pesan,
  keterangan,
  usulan,
}: {
  aktif: boolean;
  memuat: boolean;
  tersedia?: boolean;
  pesan?: string;
  keterangan?: string;
  usulan?: string[];
}) {
  if (!aktif) return null;

  return (
    <div className="mt-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      {memuat ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Memeriksa…
        </p>
      ) : tersedia === undefined ? null : (
        <>
          <p
            className={clsx(
              'flex items-center gap-2 text-sm font-medium',
              tersedia ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400',
            )}
          >
            {tersedia ? <Check className="h-4 w-4" aria-hidden /> : <X className="h-4 w-4" aria-hidden />}
            {tersedia ? 'Tersedia' : 'Tidak tersedia'}
          </p>
          {pesan && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{pesan}</p>}
          {keterangan && (
            <p className="ltr-code mt-1 text-xs font-medium text-slate-700 dark:text-slate-300">
              {keterangan}
            </p>
          )}
          {usulan && usulan.length > 0 && (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Usulan: <span className="ltr-code">{usulan.join(', ')}</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Mengambil galat per medan dari jawaban peladen.
 *
 * Peladen memulangkan SELURUH galat sekaligus supaya formulir sepanjang ini
 * tidak perlu dikirim belasan kali. Bentuknya dibaca dengan hati-hati: jawaban
 * yang tidak berbentuk seperti dugaan diabaikan, bukan membuat halaman jatuh
 * tepat saat pengguna sedang gagal mengirim.
 */
function kumpulkanGalatMedan(err: unknown): Record<string, string> {
  const rincian = (err as { details?: { errors?: unknown } } | null)?.details?.errors;
  if (!Array.isArray(rincian)) return {};

  const hasil: Record<string, string> = {};
  for (const item of rincian) {
    if (
      item &&
      typeof item === 'object' &&
      typeof (item as { field?: unknown }).field === 'string' &&
      typeof (item as { message?: unknown }).message === 'string'
    ) {
      hasil[(item as { field: string }).field] = (item as { message: string }).message;
    }
  }
  return hasil;
}
