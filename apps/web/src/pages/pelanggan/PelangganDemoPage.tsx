import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bell, Download, MapPin, PackageSearch, Phone, Sparkles, Store } from 'lucide-react';
import {
  bacaKontenPortalPelanggan,
  type KontenPortalPelanggan,
  type PengumumanToko,
  type ProdukTokoDemo,
} from './konten-portal-pelanggan';

export function PelangganDemoPage() {
  const { slug } = useParams();
  const [konten, setKonten] = useState<KontenPortalPelanggan>(() => bacaKontenPortalPelanggan());

  useEffect(() => {
    const segarkan = () => setKonten(bacaKontenPortalPelanggan());
    window.addEventListener('storage', segarkan);
    window.addEventListener('portal-pelanggan-berubah', segarkan);
    return () => {
      window.removeEventListener('storage', segarkan);
      window.removeEventListener('portal-pelanggan-berubah', segarkan);
    };
  }, []);

  const produkUnggulan = useMemo(
    () => konten.produk.filter((produk) => produk.unggulan).slice(0, 4),
    [konten.produk],
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="container-page flex min-h-16 flex-wrap items-center justify-between gap-3 py-3">
          <Link to={`/pelanggan/${slug ?? konten.slug}`} className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-700 text-white">
              <Store className="h-5 w-5" aria-hidden />
            </span>
            <span>
              <span className="block text-sm font-bold">{konten.namaToko}</span>
              <span className="block text-xs text-slate-500">pelanggan-{slug ?? konten.slug}.ebisnis.id</span>
            </span>
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <a className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100" href="#pengumuman">
              Pengumuman
            </a>
            <a className="rounded-lg px-3 py-2 font-medium text-slate-700 hover:bg-slate-100" href="#produk">
              Produk
            </a>
            <a className="btn-primary py-2" href={konten.apkAndroidUrl}>
              <Download className="h-4 w-4" aria-hidden />
              APK Android
            </a>
          </nav>
        </div>
      </header>

      <section className="border-b border-slate-200 bg-white">
        <div className="container-page grid gap-8 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <span className="section-eyebrow">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Halaman pelanggan toko demo
            </span>
            <h1 className="max-w-4xl text-3xl font-bold tracking-tight text-slate-950 sm:text-5xl">
              {konten.namaToko}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">{konten.tagline}</p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{konten.deskripsi}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a className="btn-primary" href={konten.apkAndroidUrl}>
                <Download className="h-4 w-4" aria-hidden />
                Download APK Pelanggan
              </a>
              <a className="btn-outline" href={`https://wa.me/${konten.whatsapp.replace(/\D/g, '')}`}>
                <Phone className="h-4 w-4" aria-hidden />
                Hubungi Toko
              </a>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-950 p-5 text-white shadow-sm">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-lg bg-white/10">
                <Bell className="h-6 w-6" aria-hidden />
              </span>
              <div>
                <p className="text-sm text-slate-300">Info terbaru</p>
                <p className="text-lg font-semibold">{konten.pengumuman[0]?.judul ?? 'Belum ada pengumuman'}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-300">
              {konten.pengumuman[0]?.isi ?? 'Admin toko dapat menulis pengumuman dari halaman admin.'}
            </p>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <InfoPill icon={<MapPin className="h-4 w-4" aria-hidden />} label={konten.alamat} />
              <InfoPill icon={<Store className="h-4 w-4" aria-hidden />} label={konten.jamBuka} />
            </div>
          </div>
        </div>
      </section>

      <section id="pengumuman" className="container-page py-10">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Pengumuman Toko</h2>
            <p className="mt-1 text-sm text-slate-600">
              Tempat admin menyampaikan diskon, promo, perubahan jam buka, atau info penting.
            </p>
          </div>
          <span className="badge bg-brand-100 text-brand-800">{konten.pengumuman.length} info aktif</span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {konten.pengumuman.map((item) => (
            <PengumumanCard key={item.id} item={item} />
          ))}
        </div>
      </section>

      <section id="produk" className="border-y border-slate-200 bg-white py-10">
        <div className="container-page">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Produk Pilihan</h2>
              <p className="mt-1 text-sm text-slate-600">
                Pelanggan bisa melihat produk yang dijual toko demo sebelum datang atau memesan.
              </p>
            </div>
            <span className="badge bg-emerald-100 text-emerald-800">{konten.produk.length} produk tampil</span>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(produkUnggulan.length > 0 ? produkUnggulan : konten.produk.slice(0, 4)).map((produk) => (
              <ProdukCard key={produk.id} produk={produk} />
            ))}
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {konten.produk.slice(4).map((produk) => (
              <div key={produk.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
                <div>
                  <p className="font-semibold">{produk.nama}</p>
                  <p className="text-xs text-slate-500">{produk.kategori}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-brand-700">{produk.harga}</p>
                  <p className="text-xs text-slate-500">{produk.stok}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page py-10">
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-6">
          <h2 className="text-xl font-bold tracking-tight text-brand-950">Aplikasi pelanggan Android</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-brand-900">
            Untuk tahap demo, tombol unduh mengarah ke paket Android pelanggan. Nantinya aplikasi ini
            menyimpan struk digital, status member, voucher, dan pemberitahuan dari toko.
          </p>
          <a className="btn-primary mt-4" href={konten.apkAndroidUrl}>
            <Download className="h-4 w-4" aria-hidden />
            Download APK Android
          </a>
        </div>
      </section>
    </main>
  );
}

function InfoPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-slate-200">
      {icon}
      <span>{label}</span>
    </div>
  );
}

function PengumumanCard({ item }: { item: PengumumanToko }) {
  return (
    <article className="card p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="badge bg-sky-100 text-sky-800">{item.label}</span>
        <time className="text-xs text-slate-500">{item.tanggal}</time>
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">{item.judul}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-600">{item.isi}</p>
    </article>
  );
}

function ProdukCard({ produk }: { produk: ProdukTokoDemo }) {
  return (
    <article className="card overflow-hidden">
      <div className="grid aspect-[4/3] place-items-center bg-slate-100">
        <PackageSearch className="h-10 w-10 text-slate-400" aria-hidden />
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-slate-500">{produk.kategori}</span>
          {produk.unggulan && <span className="badge bg-amber-100 text-amber-800">Unggulan</span>}
        </div>
        <h3 className="mt-2 font-bold text-slate-950">{produk.nama}</h3>
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="font-semibold text-brand-700">{produk.harga}</span>
          <span className="text-xs text-slate-500">{produk.stok}</span>
        </div>
      </div>
    </article>
  );
}
