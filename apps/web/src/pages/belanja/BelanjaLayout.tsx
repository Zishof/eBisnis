/**
 * Kerangka marketplace publik (belanja.ebisnis.id).
 *
 * Terpisah dari `PublicLayout` yang melayani website perusahaan. Keduanya
 * melayani orang yang berbeda: website menjelaskan produk ERP kepada calon
 * pelanggan, sedangkan marketplace melayani pembeli yang mencari barang. Satu
 * kerangka yang mencoba melayani keduanya akan membingungkan keduanya.
 *
 * Tidak ada apa pun di halaman ini yang menuntut masuk. Katalog dibaca dari
 * projection publik, dan tak satu pun permintaannya membawa token.
 */

import { Link, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Search, Store } from 'lucide-react';

export function BelanjaLayout() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get('q') ?? '');

  // Kotak pencarian mengikuti alamat. Tanpa ini, menekan tombol kembali
  // meninggalkan kata kunci lama di kotak sedangkan hasilnya sudah berubah.
  useEffect(() => {
    setTerm(params.get('q') ?? '');
  }, [params]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = term.trim();
    navigate(value ? `/belanja/cari?q=${encodeURIComponent(value)}` : '/belanja');
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link to="/belanja" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
            <Store className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            <span className="hidden sm:inline">Belanja</span>
          </Link>

          <form onSubmit={submit} className="flex flex-1 items-center" role="search">
            <label htmlFor="cari-produk" className="sr-only">
              Cari produk
            </label>
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="cari-produk"
                type="search"
                value={term}
                onChange={(event) => setTerm(event.target.value)}
                placeholder="Cari produk, merek, atau toko"
                className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </div>
            <button
              type="submit"
              className="ml-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              Cari
            </button>
          </form>

          <Link
            to="/"
            className="hidden shrink-0 text-sm text-slate-500 hover:text-slate-900 md:inline"
          >
            Buka toko sendiri
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>

      <footer className="mt-12 border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-slate-500">
          <p>
            Marketplace eBisnis.id. Setiap produk dijual oleh penjual yang tercantum pada halamannya.
          </p>
          <div className="mt-2 flex flex-wrap gap-4">
            <Link to="/syarat" className="hover:text-slate-900">
              Syarat layanan
            </Link>
            <Link to="/privasi" className="hover:text-slate-900">
              Kebijakan privasi
            </Link>
            <Link to="/kontak" className="hover:text-slate-900">
              Kontak
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
