/**
 * Situs pondok publik di `<pondok>.santri.info`.
 *
 * Memanggil `/pesantren/public/site` — tanpa sesi, tanpa hak akses. Pondok
 * mana yang ditampilkan ditentukan HOST PERMINTAAN, dicocokkan ke baris
 * terdaftar di control plane (IR-005) -- pola sama dengan `SitusKoperasi.tsx`.
 *
 * Situs yang belum diterbitkan pengurus (atau host yang tidak/belum terdaftar)
 * menjawab 404 yang sama -- ditangani dengan menampilkan halaman "sedang
 * disiapkan" yang sebelumnya menjadi SATU-SATUNYA isi berkas ini.
 *
 * ## Tema per pondok
 *
 * `theme_code` (dipilih pengurus lewat menu "Profil dan Tema Situs") memetakan
 * ke satu set warna tetap lewat `TEMA` di bawah -- pola yang sama dengan
 * pemilihan tema per instansi pada sistem lama (`PerguruanTinggiAction.java`,
 * `buatTema()`: combobox berisi nama tema tetap, bukan warna bebas). Warna
 * bebas dapat menghasilkan teks yang tidak terbaca; tema dari daftar tetap
 * sudah diperiksa kontrasnya sekali di sini untuk seluruh pondok yang memakainya.
 */

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { GraduationCap, Mail, MapPin, Newspaper, Phone } from 'lucide-react';
import { apiRequest } from '../../lib/api';

interface Profil {
  is_published: boolean;
  theme_code: string;
  nama_tampilan: string | null;
  tagline: string | null;
  sejarah_html: string | null;
  visi: string | null;
  misi: string | null;
  pengasuh: string | null;
  tahun_berdiri: number | null;
  afiliasi: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  alamat_publik: string | null;
  kontak_telepon: string | null;
  kontak_whatsapp: string | null;
  kontak_email: string | null;
  map_embed_url: string | null;
  instagram_url: string | null;
}

interface Berita {
  id: string;
  judul: string;
  ringkasan: string | null;
  gambar_url: string | null;
  sumber_url: string | null;
  tanggal_terbit: string | null;
}

interface UnitPendidikan {
  code: string;
  name: string;
  jenis: string;
}

interface IsiSitus {
  profil: Profil;
  berita: Berita[];
  unitPendidikan: UnitPendidikan[];
}

const TEMA: Record<string, { grad: string; ring: string; badge: string; tombol: string; aksen: string }> = {
  HIJAU_ISLAMI: {
    grad: 'from-emerald-800 via-emerald-700 to-teal-700',
    ring: 'ring-emerald-300/40',
    badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300',
    tombol: 'bg-emerald-700 hover:bg-emerald-800',
    aksen: 'text-emerald-700 dark:text-emerald-400',
  },
  EMAS_KHATULISTIWA: {
    grad: 'from-amber-800 via-amber-700 to-yellow-700',
    ring: 'ring-amber-300/40',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
    tombol: 'bg-amber-700 hover:bg-amber-800',
    aksen: 'text-amber-700 dark:text-amber-400',
  },
  BIRU_LANGIT: {
    grad: 'from-sky-800 via-sky-700 to-cyan-700',
    ring: 'ring-sky-300/40',
    badge: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300',
    tombol: 'bg-sky-700 hover:bg-sky-800',
    aksen: 'text-sky-700 dark:text-sky-400',
  },
  COKLAT_KAYU: {
    grad: 'from-stone-800 via-amber-900 to-stone-700',
    ring: 'ring-stone-300/40',
    badge: 'bg-stone-100 text-stone-800 dark:bg-stone-800/60 dark:text-stone-300',
    tombol: 'bg-stone-700 hover:bg-stone-800',
    aksen: 'text-stone-700 dark:text-stone-300',
  },
  UNGU_LEMBUT: {
    grad: 'from-violet-800 via-purple-700 to-violet-700',
    ring: 'ring-violet-300/40',
    badge: 'bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300',
    tombol: 'bg-violet-700 hover:bg-violet-800',
    aksen: 'text-violet-700 dark:text-violet-400',
  },
};

function temaDari(kode: string) {
  return TEMA[kode] ?? TEMA.HIJAU_ISLAMI;
}

const LABEL_JENIS_UNIT: Record<string, string> = {
  SEKOLAH_FORMAL: 'Pendidikan Formal',
  DINIYAH: 'Madrasah Diniyah',
  TAHFIZ: 'Tahfizul Qur’an',
  LAINNYA: 'Pendidikan Nonformal',
};

export function SitusPondokPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pesantren', 'situs-publik'],
    queryFn: () => apiRequest<IsiSitus>('/pesantren/public/site'),
    retry: false,
  });

  useEffect(() => {
    const sebelumnya = document.title;
    document.title = data?.profil.nama_tampilan
      ? `${data.profil.nama_tampilan} — Pondok Pesantren`
      : 'Situs pondok sedang disiapkan';
    return () => {
      document.title = sebelumnya;
    };
  }, [data?.profil.nama_tampilan]);

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Memuat situs…</div>;
  }

  if (isError || !data) {
    return <SitusBelumDisiapkan />;
  }

  const { profil, berita, unitPendidikan } = data;
  const tema = temaDari(profil.theme_code);

  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* --- Hero -------------------------------------------------------- */}
      <header className={`relative overflow-hidden bg-gradient-to-br ${tema.grad} text-white`}>
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='60' viewBox='0 0 60 60'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M30 0L36 24L60 30L36 36L30 60L24 36L0 30L24 24Z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
          }}
          aria-hidden
        />
        {profil.hero_image_url && (
          <img
            src={profil.hero_image_url}
            alt=""
            className="absolute inset-0 h-full w-full object-cover opacity-25"
          />
        )}
        <div className="container-page relative py-16 sm:py-24">
          <p className="text-sm font-medium uppercase tracking-widest text-white/70">
            Bismillahirrahmanirrahim
          </p>
          <div className="mt-4 flex items-center gap-4">
            {profil.logo_url && (
              <img src={profil.logo_url} alt="" className={`h-16 w-16 rounded-full ring-4 ${tema.ring}`} />
            )}
            <div>
              <h1 className="text-3xl font-bold sm:text-4xl">Pondok Pesantren {profil.nama_tampilan}</h1>
              {profil.tagline && <p className="mt-2 max-w-2xl text-lg text-white/90">{profil.tagline}</p>}
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3 text-sm">
            {profil.tahun_berdiri && (
              <span className="rounded-full bg-white/15 px-4 py-1.5 backdrop-blur">
                Berdiri sejak {profil.tahun_berdiri}
              </span>
            )}
            {profil.afiliasi && (
              <span className="rounded-full bg-white/15 px-4 py-1.5 backdrop-blur">{profil.afiliasi}</span>
            )}
            {profil.pengasuh && (
              <span className="rounded-full bg-white/15 px-4 py-1.5 backdrop-blur">
                Pengasuh: {profil.pengasuh}
              </span>
            )}
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/santri/masuk"
              className={`rounded-lg px-5 py-2.5 font-semibold text-white ${tema.tombol}`}
            >
              Masuk Sistem Informasi Santri
            </Link>
            {profil.instagram_url && (
              <a
                href={profil.instagram_url}
                target="_blank"
                rel="noreferrer"
                className="rounded-lg border border-white/40 px-5 py-2.5 font-semibold text-white hover:bg-white/10"
              >
                Instagram
              </a>
            )}
          </div>
        </div>
      </header>

      <main className="container-page space-y-16 py-14">
        {/* --- Sejarah, Visi, Misi ---------------------------------------- */}
        {(profil.sejarah_html || profil.visi || profil.misi) && (
          <section className="grid gap-10 lg:grid-cols-3">
            {profil.sejarah_html && (
              <div className="lg:col-span-2">
                <h2 className={`text-xl font-bold ${tema.aksen}`}>Sejarah Pondok</h2>
                <div
                  className="prose prose-slate mt-4 max-w-none dark:prose-invert"
                  // Ditulis pengurus lewat menu Profil, bukan diterima dari pengunjung.
                  dangerouslySetInnerHTML={{ __html: profil.sejarah_html }}
                />
              </div>
            )}
            {(profil.visi || profil.misi) && (
              <div className="space-y-6 rounded-2xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/60">
                {profil.visi && (
                  <div>
                    <h3 className={`font-bold ${tema.aksen}`}>Visi</h3>
                    <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">{profil.visi}</p>
                  </div>
                )}
                {profil.misi && (
                  <div>
                    <h3 className={`font-bold ${tema.aksen}`}>Misi</h3>
                    <p className="mt-2 whitespace-pre-line text-sm text-slate-700 dark:text-slate-300">
                      {profil.misi}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* --- Unit pendidikan --------------------------------------------- */}
        {unitPendidikan.length > 0 && (
          <section>
            <h2 className={`text-xl font-bold ${tema.aksen}`}>Unit Pendidikan</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Jenjang dan satuan pendidikan yang diselenggarakan pondok.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {unitPendidikan.map((u) => (
                <div
                  key={u.code}
                  className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
                >
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tema.badge}`}>
                    <GraduationCap className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {LABEL_JENIS_UNIT[u.jenis] ?? u.jenis}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* --- Berita -------------------------------------------------------- */}
        {berita.length > 0 && (
          <section>
            <h2 className={`flex items-center gap-2 text-xl font-bold ${tema.aksen}`}>
              <Newspaper className="h-5 w-5" aria-hidden />
              Kabar Pondok
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {berita.map((b) => (
                <article
                  key={b.id}
                  className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800"
                >
                  {b.gambar_url && <img src={b.gambar_url} alt="" className="h-36 w-full object-cover" />}
                  <div className="p-4">
                    {b.tanggal_terbit && (
                      <p className="text-xs text-slate-400">
                        {new Date(b.tanggal_terbit).toLocaleDateString('id-ID', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                    <h3 className="mt-1 font-semibold text-slate-900 dark:text-white">{b.judul}</h3>
                    {b.ringkasan && (
                      <p className="mt-2 line-clamp-3 text-sm text-slate-600 dark:text-slate-400">
                        {b.ringkasan}
                      </p>
                    )}
                    {b.sumber_url && (
                      <a
                        href={b.sumber_url}
                        target="_blank"
                        rel="noreferrer"
                        className={`mt-3 inline-block text-xs font-medium ${tema.aksen}`}
                      >
                        Sumber liputan →
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* --- Kontak ---------------------------------------------------------- */}
        <section className="rounded-2xl border border-slate-200 p-8 dark:border-slate-800">
          <h2 className={`text-xl font-bold ${tema.aksen}`}>Hubungi Kami</h2>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {profil.alamat_publik && (
              <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                {profil.alamat_publik}
              </p>
            )}
            {profil.kontak_telepon && (
              <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Phone className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                {profil.kontak_telepon}
              </p>
            )}
            {profil.kontak_email && (
              <p className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                {profil.kontak_email}
              </p>
            )}
          </div>
          {profil.map_embed_url && (
            <iframe
              title="Peta lokasi pondok"
              src={profil.map_embed_url}
              className="mt-6 h-72 w-full rounded-xl border-0"
              loading="lazy"
            />
          )}
        </section>

        <footer className="border-t border-slate-200 pt-8 text-center text-sm text-slate-400 dark:border-slate-800">
          <p>وَبِاللّٰهِ التَّوْفِيْقُ وَالْهِدَايَةُ</p>
          <p className="mt-2">
            © {new Date().getFullYear()} Pondok Pesantren {profil.nama_tampilan}. Dikelola dengan{' '}
            <a href="https://santri.info" className={tema.aksen}>
              santri.info
            </a>
            .
          </p>
        </footer>
      </main>
    </div>
  );
}

function SitusBelumDisiapkan() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 py-16 dark:bg-slate-950">
      <div className="max-w-lg text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-emerald-700 text-lg font-black text-white">
          ص
        </span>
        <h1 className="mt-6 text-2xl font-bold text-slate-900 dark:text-white">
          Situs pondok sedang disiapkan
        </h1>
        <p className="mt-4 text-slate-600 dark:text-slate-300">
          Alamat ini sudah aktif. Halaman profil, berita, dan pendaftaran santri
          baru akan tampil di sini setelah pengurus pondok mengisinya.
        </p>
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          Pengurus pondok dapat masuk untuk mulai mengisi.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link
            to="/santri/masuk"
            className="rounded-lg bg-emerald-700 px-5 py-2.5 font-semibold text-white hover:bg-emerald-800"
          >
            Masuk
          </Link>
          <a
            href="https://santri.info"
            className="rounded-lg border border-slate-300 px-5 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Tentang santri.info
          </a>
        </div>
      </div>
    </div>
  );
}
