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
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Building2, CalendarDays, CheckCircle2, ExternalLink, GraduationCap, Mail, MapPin, Newspaper, Phone, PlayCircle } from 'lucide-react';
import { apiRequest } from '../../lib/api';
import { usePondokFavicon } from './use-pondok-favicon';
import { usePondokSeo } from './use-pondok-seo';

interface Profil {
  is_published: boolean;
  theme_code: string;
  nama_tampilan: string | null;
  tagline: string | null;
  muqodimah_html: string | null;
  sejarah_html: string | null;
  visi: string | null;
  misi: string | null;
  pengasuh: string | null;
  tahun_berdiri: number | null;
  afiliasi: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  hero_image_attribution: string | null;
  alamat_publik: string | null;
  kontak_telepon: string | null;
  kontak_whatsapp: string | null;
  kontak_email: string | null;
  map_embed_url: string | null;
  instagram_url: string | null;
  meta_description: string | null;
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
  website_enabled: boolean;
  public_slug: string | null;
  santri_subdomain: string | null;
  custom_domain: string | null;
  logo_url: string | null;
  hero_image_url: string | null;
  welcome_title: string | null;
}

interface MediaPublik {
  id: string;
  kategori: string;
  judul: string;
  deskripsi: string | null;
  image_url: string | null;
  alt_text: string | null;
  attribution: string | null;
}

interface KajianPublik {
  id: string;
  judul: string;
  pemateri: string | null;
  tanggal_mulai: string;
  tanggal_selesai: string | null;
  lokasi: string | null;
  ringkasan: string | null;
  materi_url: string | null;
  rekaman_url: string | null;
  gambar_url: string | null;
}

interface IsiSitus {
  profil: Profil;
  berita: Berita[];
  unitPendidikan: UnitPendidikan[];
  media?: MediaPublik[];
  kajian?: KajianPublik[];
  currentUnit?: { public_slug: string | null } | null;
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

function urlUnitPendidikan(unit: UnitPendidikan): { href: string; eksternal: boolean; label: string } | null {
  if (unit.custom_domain) {
    return { href: `https://${unit.custom_domain}`, eksternal: true, label: unit.custom_domain };
  }
  if (unit.santri_subdomain) {
    const host = `${unit.santri_subdomain}.santri.info`;
    return { href: `https://${host}`, eksternal: true, label: host };
  }
  if (unit.public_slug) {
    return { href: `/santri/pondok/unit/${unit.public_slug}`, eksternal: false, label: `/unit/${unit.public_slug}` };
  }
  return null;
}

const LABEL_JENIS_UNIT: Record<string, string> = {
  SEKOLAH_FORMAL: 'Pendidikan Formal',
  DINIYAH: 'Madrasah Diniyah',
  TAHFIZ: 'Tahfizul Qur’an',
  LAINNYA: 'Pendidikan Nonformal',
};

export function SitusPondokPage() {
  const navigate = useNavigate();
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

  useEffect(() => {
    if (data?.currentUnit?.public_slug) {
      navigate(`/santri/pondok/unit/${data.currentUnit.public_slug}`, { replace: true });
    }
  }, [data?.currentUnit?.public_slug, navigate]);

  usePondokFavicon(data?.profil.logo_url);

  usePondokSeo(
    data
      ? {
          nama: data.profil.nama_tampilan,
          // Diutamakan deskripsi yang ditulis pengurus khusus untuk mesin
          // pencari; tagline sebagai cadangan bila belum diisi -- lebih baik
          // daripada tidak ada deskripsi sama sekali.
          deskripsi: data.profil.meta_description || data.profil.tagline,
          logoUrl: data.profil.logo_url,
          heroImageUrl: data.profil.hero_image_url,
          alamat: data.profil.alamat_publik,
          telepon: data.profil.kontak_telepon,
        }
      : undefined,
  );

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center text-slate-500">Memuat situs…</div>;
  }

  if (isError || !data) {
    return <SitusBelumDisiapkan />;
  }

  const { profil, berita, unitPendidikan } = data;
  const media = data.media ?? [];
  const kajian = data.kajian ?? [];
  const tema = temaDari(profil.theme_code);
  const beritaUtama = berita.slice(0, 3);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 dark:bg-slate-950">
      {/* --- Hero -------------------------------------------------------- */}
      <header className="relative overflow-hidden border-b border-emerald-100 bg-[radial-gradient(circle_at_top_left,#ecfdf5,transparent_34%),linear-gradient(135deg,#ffffff,#f8fafc_52%,#ecfeff)] text-slate-950">
        {profil.hero_image_url ? (
          <>
            {/*
              Foto sungguhan MENJADI latarnya (bukan lapisan tipis di atas
              gradien) -- gradien berpindah menjadi SCRIM tipis di atasnya,
              cukup gelap untuk membuat judul dan tombol tetap terbaca, tidak
              cukup gelap untuk menenggelamkan fotonya sendiri.
            */}
            <img
              src={profil.hero_image_url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-[0.16]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white via-white/95 to-white/70" aria-hidden />
          </>
        ) : (
          // Belum ada foto sungguhan diunggah -- ilustrasi asli sebagai bawaan.
          <IlustrasiHeroSantri />
        )}
        {profil.hero_image_attribution && (
          // Lisensi gambar bawaan (CC BY-SA dsb.) mewajibkan atribusi ini --
          // lihat scripts/onboard-raudlatul-ulum/assets/ATTRIBUTION.md.
          <p className="absolute bottom-1.5 end-2 text-[10px] text-slate-500">
            {profil.hero_image_attribution}
          </p>
        )}
        <div className="container-page relative grid gap-8 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center">
          <div>
            <p className={`text-sm font-semibold uppercase tracking-widest ${tema.aksen}`}>
              Bismillahirrahmanirrahim
            </p>
            <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
              {profil.logo_url && (
                <img src={profil.logo_url} alt="" className="h-16 w-16 shrink-0 rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200" />
              )}
              <div>
                <h1 className="max-w-3xl text-3xl font-bold leading-tight sm:text-4xl lg:text-5xl">Pondok Pesantren {profil.nama_tampilan}</h1>
                {profil.tagline && <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-700">{profil.tagline}</p>}
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3 text-sm">
              {profil.tahun_berdiri && (
                <span className="rounded-full border border-emerald-100 bg-white px-4 py-1.5 font-semibold text-slate-700 shadow-sm">
                  Berdiri sejak {profil.tahun_berdiri}
                </span>
              )}
              {profil.afiliasi && (
                <span className="rounded-full border border-emerald-100 bg-white px-4 py-1.5 font-semibold text-slate-700 shadow-sm">{profil.afiliasi}</span>
              )}
              {profil.pengasuh && (
                <span className="rounded-full border border-emerald-100 bg-white px-4 py-1.5 font-semibold text-slate-700 shadow-sm">
                  Pengasuh: {profil.pengasuh}
                </span>
              )}
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                to="/santri/pondok/psb"
                className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg px-5 py-3 font-semibold text-white shadow-sm ${tema.tombol}`}
              >
                Penerimaan Santri Baru
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                to="/santri/masuk"
                className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm hover:border-emerald-300 hover:text-emerald-800"
              >
                Masuk Sistem Informasi Santri
              </Link>
              {profil.instagram_url && (
                <a
                  href={profil.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-12 items-center justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 shadow-sm hover:border-emerald-300 hover:text-emerald-800"
                >
                  Instagram
                </a>
              )}
            </div>
          </div>
          <div className="overflow-hidden rounded-3xl border border-white bg-white p-3 shadow-sm ring-1 ring-slate-200/80">
            <div className="grid gap-3">
              <div className="h-56 overflow-hidden rounded-2xl bg-emerald-50 sm:h-64">
                {profil.hero_image_url ? (
                  <img src={profil.hero_image_url} alt="" className="h-full w-full object-cover" loading="eager" />
                ) : (
                  <VisualPendidikan className="h-full w-full text-emerald-700/80" />
                )}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <HeroMini icon={<BookOpen className="h-5 w-5" aria-hidden />} label="Ngaji" />
                <HeroMini icon={<GraduationCap className="h-5 w-5" aria-hidden />} label="Sekolah" />
                <HeroMini icon={<Building2 className="h-5 w-5" aria-hidden />} label="Asrama" />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="container-page space-y-16 py-14">
        <section className="-mt-10 grid gap-4 sm:grid-cols-3">
          <HighlightCard icon={<CheckCircle2 className="h-5 w-5" aria-hidden />} label="Profil Pondok" value={profil.is_published ? 'Situs aktif' : 'Draft'} />
          <HighlightCard icon={<GraduationCap className="h-5 w-5" aria-hidden />} label="Unit Pendidikan" value={`${unitPendidikan.length} unit`} />
          <HighlightCard icon={<Newspaper className="h-5 w-5" aria-hidden />} label="Kabar Pondok" value={`${berita.length} berita`} />
        </section>

        {/* --- Muqodimah ----------------------------------------------------- */}
        {profil.muqodimah_html && (
          <section
            className={`rounded-2xl border-s-4 bg-slate-50 p-8 dark:bg-slate-900/60 ${tema.aksen} border-current`}
          >
            <p className="text-center font-arabic text-lg text-slate-800 dark:text-slate-100" dir="rtl" lang="ar">
              بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
            </p>
            <div
              className="prose prose-slate mt-4 max-w-none text-center dark:prose-invert sm:text-start"
              // Ditulis pengurus lewat menu Profil, bukan diterima dari pengunjung.
              dangerouslySetInnerHTML={{ __html: profil.muqodimah_html }}
            />
          </section>
        )}

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
              {unitPendidikan.map((u) => {
                const target = urlUnitPendidikan(u);
                const isi = (
                  <>
                    <div className="relative h-28 overflow-hidden rounded-t-xl bg-emerald-50 dark:bg-slate-900">
                      {u.hero_image_url || profil.hero_image_url ? (
                        <img src={u.hero_image_url || profil.hero_image_url || ''} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                      ) : (
                        <VisualPendidikan className="h-full w-full text-emerald-700/80 dark:text-emerald-300/70" />
                      )}
                      {u.logo_url && (
                        <img src={u.logo_url} alt="" className="absolute bottom-3 start-3 h-12 w-12 rounded-xl bg-white p-1 shadow-sm ring-1 ring-white/80" />
                      )}
                    </div>
                    <div className="flex items-start gap-3 p-4">
                      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tema.badge}`}>
                        <GraduationCap className="h-5 w-5" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-slate-900 dark:text-white">{u.name}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {LABEL_JENIS_UNIT[u.jenis] ?? u.jenis}
                        </p>
                        {target && <p className="mt-1 break-all text-xs text-slate-400">{target.label}</p>}
                      </div>
                      {target && <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-slate-300" aria-hidden />}
                    </div>
                  </>
                );
                const kelas =
                  'group overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-emerald-500';
                if (!target) {
                  return (
                    <div key={u.code} className={`${kelas} opacity-70`}>
                      {isi}
                    </div>
                  );
                }
                if (target.eksternal) {
                  return (
                    <a key={u.code} href={target.href} className={kelas}>
                      {isi}
                    </a>
                  );
                }
                return (
                  <Link key={u.code} to={target.href} className={kelas}>
                    {isi}
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {/* --- Galeri/program ----------------------------------------------- */}
        {media.length > 0 && (
          <section>
            <h2 className={`text-xl font-bold ${tema.aksen}`}>Galeri dan Program</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Foto kegiatan, fasilitas, prestasi, dan program unggulan yang dipilih pengurus.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {media.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="h-44 overflow-hidden bg-emerald-50 dark:bg-slate-950">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.alt_text ?? item.judul} className="h-full w-full object-cover" />
                    ) : (
                      <VisualPendidikan className="h-full w-full text-emerald-700/70 dark:text-emerald-300/70" />
                    )}
                  </div>
                  <div className="p-4">
                    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${tema.badge}`}>
                      {item.kategori}
                    </span>
                    <h3 className="mt-3 font-semibold text-slate-900 dark:text-white">{item.judul}</h3>
                    {item.deskripsi && (
                      <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600 dark:text-slate-400">
                        {item.deskripsi}
                      </p>
                    )}
                    {item.attribution && <p className="mt-3 text-xs text-slate-400">{item.attribution}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {/* --- Kajian dan dakwah ------------------------------------------- */}
        {kajian.length > 0 && (
          <section>
            <h2 className={`flex items-center gap-2 text-xl font-bold ${tema.aksen}`}>
              <CalendarDays className="h-5 w-5" aria-hidden />
              Kajian dan Dakwah
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Jadwal kajian, materi, dan arsip dakwah yang diterbitkan pengurus pondok.
            </p>
            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              {kajian.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <div className="h-40 bg-emerald-50 dark:bg-slate-950">
                    {item.gambar_url ? (
                      <img src={item.gambar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <VisualPendidikan className="h-full w-full text-emerald-700/70 dark:text-emerald-300/70" />
                    )}
                  </div>
                  <div className="p-4">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${tema.aksen}`}>
                      {new Date(item.tanggal_mulai).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                    <h3 className="mt-2 font-semibold text-slate-900 dark:text-white">{item.judul}</h3>
                    <div className="mt-2 space-y-1 text-sm text-slate-600 dark:text-slate-400">
                      {item.pemateri && <p>{item.pemateri}</p>}
                      {item.lokasi && <p>{item.lokasi}</p>}
                      {item.ringkasan && <p className="line-clamp-3 leading-6">{item.ringkasan}</p>}
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                      {item.materi_url && (
                        <a href={item.materi_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tema.aksen}`}>
                          <BookOpen className="h-4 w-4" aria-hidden />
                          Materi
                        </a>
                      )}
                      {item.rekaman_url && (
                        <a href={item.rekaman_url} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-xs font-semibold ${tema.aksen}`}>
                          <PlayCircle className="h-4 w-4" aria-hidden />
                          Rekaman
                        </a>
                      )}
                    </div>
                  </div>
                </article>
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
                  <div className="h-40 overflow-hidden bg-emerald-50 dark:bg-slate-900">
                    {b.gambar_url ? (
                      <img src={b.gambar_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <VisualPendidikan className="h-full w-full text-emerald-700/70 dark:text-emerald-300/70" />
                    )}
                  </div>
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
                    <Link
                      to={`/santri/pondok/berita/${b.id}`}
                      className="mt-1 block font-semibold text-slate-900 hover:text-emerald-700 dark:text-white dark:hover:text-emerald-400"
                    >
                      {b.judul}
                    </Link>
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
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {(profil.hero_image_url || beritaUtama.length > 0) && (
            <div className="grid gap-1 bg-slate-100 p-1 sm:grid-cols-3 dark:bg-slate-950">
              {[profil.hero_image_url, ...beritaUtama.map((b) => b.gambar_url)].filter(Boolean).slice(0, 3).map((url, index) => (
                <img key={`${url}-${index}`} src={url as string} alt="" className="h-32 w-full object-cover" />
              ))}
            </div>
          )}
          <div className="p-8">
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
          </div>
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

/**
 * Ilustrasi hero: halaqah santri-santriwati mengaji kitab kuning bersama
 * ustaz, dengan masjid di latar belakang.
 *
 * Sengaja SVG garis sederhana (siluet), BUKAN foto -- foto orang sungguhan
 * di beranda pelanggan (santri, ustaz) menuntut izin/consent dari orang yang
 * difoto, dan kita tidak punya itu untuk siapa pun. Ilustrasi asli menghindari
 * persoalan itu sama sekali sekaligus tetap terasa islami dan hangat.
 *
 * Opasitasnya rendah (~14%) supaya judul dan tombol di atasnya tetap terbaca
 * jelas -- ilustrasi ini tekstur latar, bukan gambar utama.
 */
function IlustrasiHeroSantri() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.14]"
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMax slice"
      fill="currentColor"
      aria-hidden="true"
    >
      {/* Masjid di latar belakang kanan */}
      <g>
        <rect x="860" y="230" width="220" height="140" rx="4" />
        <path d="M860 230 Q970 120 1080 230 Z" />
        <circle cx="970" cy="150" r="8" />
        <rect x="1000" y="140" width="14" height="90" rx="3" />
        <path d="M1000 140 Q1007 110 1014 140 Z" />
        <path d="M1007 92 a10 10 0 1 0 0.1 0 a7 7 0 1 1 -0.1 0" />
        <rect x="900" y="140" width="12" height="90" rx="3" />
        <path d="M900 140 Q906 112 912 140 Z" />
        <rect x="915" y="280" width="40" height="90" rx="18" />
        <rect x="985" y="280" width="40" height="90" rx="18" />
      </g>

      {/* Tanah/lantai halaqah */}
      <path d="M0 400 Q600 360 1200 400 L1200 420 L0 420 Z" />

      {/* Halaqah: santri dan santriwati duduk melingkar mengaji kitab kuning */}
      {[
        { x: 90, y: 330, jilbab: true },
        { x: 210, y: 360, jilbab: false },
        { x: 330, y: 320, jilbab: true },
        { x: 620, y: 350, jilbab: true },
        { x: 730, y: 320, jilbab: false },
        { x: 800, y: 365, jilbab: true },
      ].map((s, i) => (
        <g key={i} transform={`translate(${s.x} ${s.y})`}>
          {/* badan duduk bersila */}
          <path d="M-32 40 Q-34 4 0 -4 Q34 4 32 40 Q0 54 -32 40 Z" />
          {/* kepala */}
          <circle cx="0" cy="-22" r="15" />
          {s.jilbab ? (
            // jilbab santriwati
            <path d="M-17 -22 Q-20 4 -14 20 L14 20 Q20 4 17 -22 Q0 -38 -17 -22 Z" />
          ) : (
            // peci santri
            <rect x="-13" y="-38" width="26" height="12" rx="3" />
          )}
          {/* kitab kuning terbuka di pangkuan */}
          <rect x="-16" y="20" width="32" height="10" rx="1.5" />
          <line x1="0" y1="20" x2="0" y2="30" stroke="currentColor" strokeWidth="1.5" />
        </g>
      ))}

      {/* Ustaz di depan halaqah, memegang kitab besar */}
      <g transform="translate(475 300)">
        <path d="M-42 56 Q-46 0 0 -8 Q46 0 42 56 Q0 74 -42 56 Z" />
        <circle cx="0" cy="-32" r="19" />
        {/* sorban sederhana */}
        <path d="M-19 -32 Q-22 -50 0 -54 Q22 -50 19 -32 Q0 -44 -19 -32 Z" />
        {/* jenggot */}
        <path d="M-9 -20 Q0 -6 9 -20 Q0 -14 -9 -20 Z" />
        {/* kitab besar terbuka */}
        <rect x="-24" y="24" width="48" height="14" rx="2" />
        <line x1="0" y1="24" x2="0" y2="38" stroke="currentColor" strokeWidth="1.8" />
      </g>
    </svg>
  );
}

function HeroMini({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
      <span className="mx-auto grid h-9 w-9 place-items-center rounded-lg bg-white text-emerald-700 shadow-sm">{icon}</span>
      <p className="mt-2 text-xs font-semibold text-slate-700">{label}</p>
    </div>
  );
}

function HighlightCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <span className="grid h-10 w-10 place-items-center rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
        {icon}
      </span>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function VisualPendidikan({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      <rect width="640" height="360" fill="currentColor" opacity="0.08" />
      <circle cx="500" cy="86" r="84" fill="currentColor" opacity="0.12" />
      <path d="M48 272c74-58 142-80 204-64 88 23 132 102 240 58 52-21 86-59 100-82v176H48v-88Z" fill="currentColor" opacity="0.18" />
      <rect x="96" y="116" width="164" height="122" rx="14" fill="white" opacity="0.9" />
      <path d="M116 142h124M116 170h96M116 198h112" stroke="currentColor" strokeWidth="10" strokeLinecap="round" opacity="0.35" />
      <path d="M336 132 456 84l120 48-120 48-120-48Z" fill="white" opacity="0.94" />
      <path d="M384 166v54c0 20 32 36 72 36s72-16 72-36v-54" stroke="white" strokeWidth="18" strokeLinecap="round" opacity="0.94" />
      <path d="M456 180v70" stroke="currentColor" strokeWidth="10" strokeLinecap="round" opacity="0.45" />
      <circle cx="456" cy="266" r="12" fill="white" opacity="0.94" />
    </svg>
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
