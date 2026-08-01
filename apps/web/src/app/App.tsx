import { Navigate, Route, Routes } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import { PublicLayout } from '../pages/public/PublicLayout';
import { HomePage } from '../pages/public/HomePage';
import { CmsPage } from '../pages/public/CmsPage';
import { PricingPage } from '../pages/public/PricingPage';
import { NewsListPage } from '../pages/public/NewsListPage';
import { NewsDetailPage } from '../pages/public/NewsDetailPage';
import { ContactPage } from '../pages/public/ContactPage';
import { BelanjaLayout } from '../pages/belanja/BelanjaLayout';
import { isMarketplaceHost } from '../pages/belanja/marketplace-host';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { RegisterSuccessPage } from '../pages/auth/RegisterSuccessPage';
import { ChangePasswordPage } from '../pages/auth/ChangePasswordPage';
import { DemoEntryPage } from '../pages/auth/DemoEntryPage';
import { AppLayout } from '../pages/app/AppLayout';
import { DashboardPage } from '../pages/app/DashboardPage';
import { MasterListPage } from '../pages/app/MasterListPage';
import { StockTreePage } from '../pages/app/StockTreePage';
import { RequestOrderPage } from '../pages/app/RequestOrderPage';
import { PurchaseOrderPage } from '../pages/app/PurchaseOrderPage';
import { GoodsReceiptPage } from '../pages/app/GoodsReceiptPage';
import { BackorderPage } from '../pages/app/BackorderPage';
import { InternalTransferPage } from '../pages/app/InternalTransferPage';
import { SampleDataPage } from '../pages/app/SampleDataPage';
import { SubscriptionPage } from '../pages/app/SubscriptionPage';
import { ComingSoonPage } from '../pages/app/ComingSoonPage';
import { RequireAuth } from './RequireAuth';
import { LoadingState } from '../components/ui';

const MarketplaceActivationPage = lazy(() =>
  import('../pages/app/MarketplaceActivationPage').then((m) => ({ default: m.default })),
);

const PlatformLayout = lazy(() =>
  import('../pages/platform/PlatformLayout').then((m) => ({ default: m.PlatformLayout })),
);
const PlatformDashboardPage = lazy(() =>
  import('../pages/platform/PlatformDashboardPage').then((m) => ({ default: m.PlatformDashboardPage })),
);
const PlatformTenantsPage = lazy(() =>
  import('../pages/platform/PlatformTenantsPage').then((m) => ({ default: m.PlatformTenantsPage })),
);
const PlatformPackagesPage = lazy(() =>
  import('../pages/platform/PlatformPackagesPage').then((m) => ({ default: m.PlatformPackagesPage })),
);
const PlatformCmsPage = lazy(() =>
  import('../pages/platform/PlatformCmsPage').then((m) => ({ default: m.PlatformCmsPage })),
);
const PlatformAuditPage = lazy(() =>
  import('../pages/platform/PlatformAuditPage').then((m) => ({ default: m.PlatformAuditPage })),
);
const PlatformSamplePage = lazy(() =>
  import('../pages/platform/PlatformSamplePage').then((m) => ({ default: m.PlatformSamplePage })),
);

// Empat dokumen penawaran dimuat terpisah: isinya panjang, dan sebagian besar
// pengunjung beranda tidak membukanya.
const PresentasiPage = lazy(() =>
  import('../pages/public/PresentasiPage').then((m) => ({ default: m.PresentasiPage })),
);
const ProposalPage = lazy(() =>
  import('../pages/public/ProposalPage').then((m) => ({ default: m.ProposalPage })),
);
const PksPage = lazy(() => import('../pages/public/PksPage').then((m) => ({ default: m.PksPage })));
const PenawaranPage = lazy(() =>
  import('../pages/public/PenawaranPage').then((m) => ({ default: m.PenawaranPage })),
);

// --- Situs desa (info-desa) ---
// Hanya membaca. Tidak ada satu pun jalur tulis dari halaman tanpa autentikasi.
const VillageSitePage = lazy(() =>
  import('../verticals/village/public/VillageSitePage').then((m) => ({ default: m.VillageSitePage })),
);
// Anjungan Mandiri Desa. Layar penuh tanpa kerangka aplikasi: kios di kantor
// desa tidak punya bilah navigasi, tidak punya tombol keluar, dan tidak boleh
// menampilkan apa pun selain layanannya sendiri.
const KioskPage = lazy(() =>
  import('../verticals/village/kiosk/KioskPage').then((m) => ({ default: m.KioskPage })),
);
const VillageNewsPage = lazy(() =>
  import('../verticals/village/public/VillageNewsPage').then((m) => ({ default: m.VillageNewsPage })),
);

// Layar petugas info-desa (D-1 sampai D-9).
//
// Vite menggabungkan seluruh halaman dari satu berkas menjadi satu bundel,
// sehingga tiga puluh baris di bawah menghasilkan tiga potongan, bukan tiga
// puluh. Yang dimuat hanya potongan yang berisi halaman yang benar-benar
// dibuka — penyewa yang tidak memakai vertikal desa tidak pernah mengunduhnya.
const DesaProfilWilayahPage = lazy(() =>
  import('../verticals/village/admin/halaman-wilayah').then((m) => ({ default: m.ProfilWilayahPage })),
);
const DesaWilayahPage = lazy(() =>
  import('../verticals/village/admin/halaman-wilayah').then((m) => ({ default: m.WilayahPage })),
);
const DesaDomainPage = lazy(() =>
  import('../verticals/village/admin/halaman-wilayah').then((m) => ({ default: m.DomainPage })),
);
const DesaPotensiPage = lazy(() =>
  import('../verticals/village/admin/halaman-wilayah').then((m) => ({ default: m.PotensiPage })),
);
const DesaPendudukPage = lazy(() =>
  import('../verticals/village/admin/halaman-penduduk').then((m) => ({ default: m.PendudukPage })),
);
const DesaKeluargaPage = lazy(() =>
  import('../verticals/village/admin/halaman-penduduk').then((m) => ({ default: m.KeluargaPage })),
);
const DesaPeristiwaPage = lazy(() =>
  import('../verticals/village/admin/halaman-penduduk').then((m) => ({ default: m.PeristiwaPage })),
);
const DesaRentanPage = lazy(() =>
  import('../verticals/village/admin/halaman-penduduk').then((m) => ({ default: m.RentanPage })),
);
const DesaAparaturPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.AparaturPage })),
);
const DesaBpdPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.BpdPage })),
);
const DesaRegisterPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.RegisterPage })),
);
const DesaJenisLayananPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.JenisLayananPage })),
);
const DesaPermohonanPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.PermohonanPage })),
);
const DesaPermohonanDetailPage = lazy(() =>
  import('../verticals/village/admin/PermohonanDetailPage').then((m) => ({
    default: m.PermohonanDetailPage,
  })),
);
const DesaAntreanPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.AntreanPage })),
);
const DesaPengaduanPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.PengaduanPage })),
);
const DesaAspirasiPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.AspirasiPage })),
);
const DesaMusrenbangPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.MusrenbangPage })),
);
const DesaRpjmdesPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.RpjmdesPage })),
);
const DesaRkpdesPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.RkpdesPage })),
);
const DesaApbdesPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.ApbdesPage })),
);
const DesaRealisasiPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.RealisasiPage })),
);
const DesaBukuKasPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.BukuKasPage })),
);
const DesaProgramBantuanPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.ProgramBantuanPage })),
);
const DesaBumdesPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.BumdesPage })),
);
const DesaUmkmPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.UmkmPage })),
);
const DesaWisataPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.WisataPage })),
);
const DesaInsidenPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.InsidenPage })),
);
const DesaBencanaPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.BencanaPage })),
);
const DesaTanahPage = lazy(() =>
  import('../verticals/village/admin/halaman-daftar').then((m) => ({ default: m.TanahPage })),
);
const DesaAsetPage = lazy(() =>
  import('../verticals/village/admin/halaman-lain').then((m) => ({ default: m.AsetPage })),
);
const DesaPenerimaPage = lazy(() =>
  import('../verticals/village/admin/halaman-lain').then((m) => ({ default: m.PenerimaPage })),
);
const DesaLingkunganPage = lazy(() =>
  import('../verticals/village/admin/halaman-lain').then((m) => ({ default: m.LingkunganPage })),
);

// Layar kasir dimuat terpisah: berkasnya besar dan hanya dipakai peran kasir,
// sementara pengguna lain tidak perlu ikut menunggunya diunduh.
const PosPage = lazy(() => import('../pages/pos/PosPage').then((m) => ({ default: m.PosPage })));
const PosReportPage = lazy(() =>
  import('../pages/pos/PosReportPage').then((m) => ({ default: m.PosReportPage })),
);

const BelanjaHomePage = lazy(() =>
  import('../pages/belanja/BelanjaHomePage').then((m) => ({ default: m.BelanjaHomePage })),
);
const BelanjaSearchPage = lazy(() =>
  import('../pages/belanja/BelanjaSearchPage').then((m) => ({ default: m.BelanjaSearchPage })),
);
const BelanjaProductPage = lazy(() =>
  import('../pages/belanja/BelanjaProductPage').then((m) => ({ default: m.BelanjaProductPage })),
);

// Vertikal koperasi — seluruh rutenya terkumpul di satu berkas di dalam
// namespace-nya sendiri, supaya jejaknya di berkas bersama ini tinggal satu
// impor dan satu baris rute (panduan koordinasi §3).
const CooperativeRoutes = lazy(() =>
  import('../verticals/cooperative/routes').then((m) => ({ default: m.CooperativeRoutes })),
);

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        {/* Website publik — route `/` menampilkan website, bukan redirect login. */}
        <Route element={<PublicLayout />}>
          {/* Pengunjung yang datang lewat belanja.ebisnis.id langsung melihat
              katalog; pengunjung ebisnis.id melihat website perusahaan. */}
          <Route
            path="/"
            element={isMarketplaceHost() ? <Navigate to="/belanja" replace /> : <HomePage />}
          />
          <Route path="/harga" element={<PricingPage />} />
          <Route path="/presentasi" element={<PresentasiPage />} />
          <Route path="/proposal" element={<ProposalPage />} />
          <Route path="/pks" element={<PksPage />} />
          <Route path="/penawaran" element={<PenawaranPage />} />
          <Route path="/berita" element={<NewsListPage />} />
          <Route path="/berita/:slug" element={<NewsDetailPage />} />
          <Route path="/kontak" element={<ContactPage />} />
          <Route path="/tentang" element={<CmsPage slug="tentang" fallbackTitle="Tentang Kami" />} />
          <Route path="/syarat" element={<CmsPage slug="syarat" fallbackTitle="Syarat dan Ketentuan" />} />
          <Route path="/privasi" element={<CmsPage slug="privasi" fallbackTitle="Kebijakan Privasi" />} />
          <Route path="/masuk" element={<LoginPage />} />
          <Route path="/daftar" element={<RegisterPage />} />
          <Route path="/daftar/berhasil" element={<RegisterSuccessPage />} />
          <Route path="/demo" element={<DemoEntryPage />} />
          <Route path="/ganti-kata-sandi" element={<ChangePasswordPage />} />
        </Route>

        {/* Anjungan Mandiri Desa — layar penuh, di luar kerangka aplikasi.
            Perangkatnya masuk sebagai akun anjungan; warga memakainya tanpa
            masuk sendiri. */}
        <Route
          path="/anjungan"
          element={
            <RequireAuth>
              <KioskPage />
            </RequireAuth>
          }
        />

        {/* Situs desa — halaman publik satu desa, hanya membaca. */}
        <Route element={<PublicLayout />}>
          <Route path="/desa/:slug" element={<VillageSitePage />} />
          <Route path="/desa/:slug/berita/:beritaSlug" element={<VillageNewsPage />} />
        </Route>

        <Route path="/ekoperasi/*" element={<CooperativeRoutes />} />

        {/* Marketplace publik (belanja.ebisnis.id) */}
        <Route path="/belanja" element={<BelanjaLayout />}>
          <Route index element={<BelanjaHomePage />} />
          <Route path="cari" element={<BelanjaSearchPage />} />
          <Route path=":storeSlug/:productSlug" element={<BelanjaProductPage />} />
        </Route>

        {/* Aplikasi tenant */}
        <Route
          path="/app"
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="products" element={<MasterListPage resource="products" />} />
          <Route path="product-categories" element={<MasterListPage resource="product-categories" />} />
          <Route path="uoms" element={<MasterListPage resource="uoms" />} />
          <Route path="suppliers" element={<MasterListPage resource="suppliers" />} />
          <Route path="product-suppliers" element={<MasterListPage resource="product-suppliers" />} />
          <Route path="customers" element={<MasterListPage resource="customers" />} />
          <Route path="customer-groups" element={<MasterListPage resource="customer-groups" />} />
          <Route path="supplier-groups" element={<MasterListPage resource="supplier-groups" />} />
          <Route path="warehouses" element={<MasterListPage resource="warehouses" />} />
          <Route path="warehouse-types" element={<MasterListPage resource="warehouse-types" />} />
          <Route path="outlets" element={<MasterListPage resource="outlets" />} />
          <Route path="outlet-types" element={<MasterListPage resource="outlet-types" />} />
          <Route path="regions" element={<MasterListPage resource="regions" />} />
          <Route path="stock-policies" element={<MasterListPage resource="stock-policies" />} />
          <Route path="payment-methods" element={<MasterListPage resource="payment-methods" />} />
          <Route path="payment-terms" element={<MasterListPage resource="payment-terms" />} />
          <Route path="tax-categories" element={<MasterListPage resource="tax-categories" />} />
          <Route path="departments" element={<MasterListPage resource="departments" />} />
          <Route path="job-positions" element={<MasterListPage resource="job-positions" />} />
          <Route path="leave-types" element={<MasterListPage resource="leave-types" />} />
          <Route path="vehicle-types" element={<MasterListPage resource="vehicle-types" />} />
          <Route path="chart-of-accounts" element={<MasterListPage resource="chart-of-accounts" />} />
          <Route path="roles" element={<MasterListPage resource="roles" />} />

          <Route path="request-orders" element={<RequestOrderPage />} />
          <Route path="purchase-orders" element={<PurchaseOrderPage />} />
          <Route path="goods-receipts" element={<GoodsReceiptPage />} />
          <Route path="backorders" element={<BackorderPage />} />
          <Route path="internal-transfers" element={<InternalTransferPage />} />
          <Route path="stock-tree" element={<StockTreePage />} />
          <Route path="pos" element={<PosPage />} />
          <Route path="pos/laporan" element={<PosReportPage />} />
          <Route path="sample-data" element={<SampleDataPage />} />
          <Route path="devices" element={<SubscriptionPage tab="devices" />} />
          <Route path="subscription/checkout" element={<SubscriptionPage tab="checkout" />} />
          <Route path="subscription/invoices" element={<SubscriptionPage tab="invoices" />} />
          <Route path="marketplace/aktivasi" element={<MarketplaceActivationPage />} />
          {/*
            Info-desa (D-1 sampai D-9).

            Berada di bawah `/app` karena di situlah seluruh aplikasi penyewa
            hidup, dan katalog menu menyebut `/app/info-desa/...` persis sama.
            Sidebar memakai `menu.route` apa adanya; rute yang tidak cocok
            memantulkan petugas ke halaman depan tanpa galat apa pun.
          */}
          <Route path="info-desa/profil" element={<DesaProfilWilayahPage />} />
          <Route path="info-desa/wilayah" element={<DesaWilayahPage />} />
          <Route path="info-desa/domain" element={<DesaDomainPage />} />
          <Route path="info-desa/potensi" element={<DesaPotensiPage />} />

          <Route path="info-desa/penduduk" element={<DesaPendudukPage />} />
          <Route path="info-desa/keluarga" element={<DesaKeluargaPage />} />
          <Route path="info-desa/peristiwa" element={<DesaPeristiwaPage />} />
          <Route path="info-desa/rentan" element={<DesaRentanPage />} />

          <Route path="info-desa/aparatur" element={<DesaAparaturPage />} />
          <Route path="info-desa/bpd" element={<DesaBpdPage />} />
          <Route path="info-desa/register" element={<DesaRegisterPage />} />

          <Route path="info-desa/layanan/jenis" element={<DesaJenisLayananPage />} />
          <Route path="info-desa/layanan/permohonan" element={<DesaPermohonanPage />} />
          {/*
            Rincian permohonan tidak punya menunya sendiri — ia dibuka dari
            daftar. Karena itu pengujian keselarasan rute mengabaikan rute
            berparameter: menu untuk satu berkas tertentu tidak masuk akal.
          */}
          <Route path="info-desa/layanan/permohonan/:id" element={<DesaPermohonanDetailPage />} />
          <Route path="info-desa/layanan/antrean" element={<DesaAntreanPage />} />

          <Route path="info-desa/pengaduan" element={<DesaPengaduanPage />} />
          <Route path="info-desa/aspirasi" element={<DesaAspirasiPage />} />
          <Route path="info-desa/musrenbang" element={<DesaMusrenbangPage />} />
          <Route path="info-desa/musrenbang-kelurahan" element={<DesaMusrenbangPage />} />

          <Route path="info-desa/rpjmdes" element={<DesaRpjmdesPage />} />
          <Route path="info-desa/rkpdes" element={<DesaRkpdesPage />} />
          <Route path="info-desa/apbdes" element={<DesaApbdesPage />} />
          <Route path="info-desa/realisasi" element={<DesaRealisasiPage />} />
          <Route path="info-desa/buku-kas" element={<DesaBukuKasPage />} />

          <Route path="info-desa/aset" element={<DesaAsetPage />} />
          <Route path="info-desa/bantuan" element={<DesaProgramBantuanPage />} />
          <Route path="info-desa/penerima" element={<DesaPenerimaPage />} />

          <Route path="info-desa/bumdes" element={<DesaBumdesPage />} />
          <Route path="info-desa/umkm" element={<DesaUmkmPage />} />
          <Route path="info-desa/wisata" element={<DesaWisataPage />} />

          <Route path="info-desa/keamanan" element={<DesaInsidenPage />} />
          <Route path="info-desa/bencana" element={<DesaBencanaPage />} />
          <Route path="info-desa/lingkungan" element={<DesaLingkunganPage />} />
          <Route path="info-desa/tanah" element={<DesaTanahPage />} />

          <Route path="*" element={<ComingSoonPage />} />
        </Route>

        {/* Portal Platform Super Admin */}
        <Route
          path="/platform"
          element={
            <RequireAuth requirePlatformStaff>
              <PlatformLayout />
            </RequireAuth>
          }
        >
          <Route index element={<PlatformDashboardPage />} />
          <Route path="tenants" element={<PlatformTenantsPage />} />
          <Route path="registrations" element={<PlatformTenantsPage tab="registrations" />} />
          <Route path="packages" element={<PlatformPackagesPage />} />
          <Route path="cms" element={<PlatformCmsPage />} />
          <Route path="contoh" element={<PlatformSamplePage />} />
          <Route path="audit" element={<PlatformAuditPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
