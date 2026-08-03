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
import { isCooperativeHost } from '../verticals/cooperative/cooperative-host';
import { isSantriPortalHost, slugPondokDariHost } from '../verticals/pesantren/santri-host';
import { PondokChrome } from '../verticals/pesantren/PondokChrome';
import { LoginPage } from '../pages/auth/LoginPage';
import { RegisterPage } from '../pages/auth/RegisterPage';
import { RegisterSuccessPage } from '../pages/auth/RegisterSuccessPage';
import { ChangePasswordPage } from '../pages/auth/ChangePasswordPage';
import { DemoEntryPage } from '../pages/auth/DemoEntryPage';
import { AppLayout } from '../pages/app/AppLayout';
import { AppHomePage } from '../pages/app/AppHomePage';
import { PesantrenSantriPage } from '../pages/app/pesantren/PesantrenSantriPage';
import { PesantrenUnitPendidikanPage } from '../pages/app/pesantren/PesantrenUnitPendidikanPage';
import { PesantrenAsramaPage } from '../pages/app/pesantren/PesantrenAsramaPage';
import { PesantrenTagihanPage } from '../pages/app/pesantren/PesantrenTagihanPage';
import { PesantrenProfilPage } from '../pages/app/pesantren/PesantrenProfilPage';
import { PesantrenBeritaPage } from '../pages/app/pesantren/PesantrenBeritaPage';
import { PesantrenPsbPage } from '../pages/app/pesantren/PesantrenPsbPage';
import { PesantrenDaftarModulPage } from '../pages/app/pesantren/PesantrenDaftarModulPage';
import { PesantrenKioskPage } from '../pages/app/pesantren/PesantrenKioskPage';
import { MasterListPage } from '../pages/app/MasterListPage';
import { StockTreePage } from '../pages/app/StockTreePage';
import { RequestOrderPage } from '../pages/app/RequestOrderPage';
import { PurchaseOrderPage } from '../pages/app/PurchaseOrderPage';
import { GoodsReceiptPage } from '../pages/app/GoodsReceiptPage';
import { BackorderPage } from '../pages/app/BackorderPage';
import { InternalTransferPage } from '../pages/app/InternalTransferPage';
import { SampleDataPage } from '../pages/app/SampleDataPage';
import { SubscriptionPage } from '../pages/app/SubscriptionPage';
import { NotificationsPage } from '../pages/app/NotificationsPage';
import { SupportPage } from '../pages/app/SupportPage';
import { ComingSoonPage } from '../pages/app/ComingSoonPage';
import { RequireAuth } from './RequireAuth';
import { LoadingState } from '../components/ui';

const MarketplaceActivationPage = lazy(() =>
  import('../pages/app/MarketplaceActivationPage').then((m) => ({ default: m.default })),
);
const AdminUsersPage = lazy(() =>
  import('../pages/app/admin/AdminPages').then((m) => ({ default: m.AdminUsersPage })),
);
const RolePermissionsPage = lazy(() =>
  import('../pages/app/admin/AdminPages').then((m) => ({ default: m.RolePermissionsPage })),
);
const TenantAuditPage = lazy(() =>
  import('../pages/app/admin/AdminPages').then((m) => ({ default: m.TenantAuditPage })),
);
const TenantSettingsPage = lazy(() =>
  import('../pages/app/admin/AdminPages').then((m) => ({ default: m.TenantSettingsPage })),
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

// Portal ePesantren (santri.info) — kerangkanya sendiri, sebab `PublicLayout`
// memakai merek eBisnis dan keterangan footer tentang retail dan F&B.
const SantriLayout = lazy(() =>
  import('../verticals/pesantren/SantriLayout').then((m) => ({ default: m.SantriLayout })),
);
const SantriInfoHomePage = lazy(() =>
  import('../verticals/pesantren/SantriInfoHomePage').then((m) => ({
    default: m.SantriInfoHomePage,
  })),
);
const SitusPondokPage = lazy(() =>
  import('../verticals/pesantren/SitusPondokPage').then((m) => ({ default: m.SitusPondokPage })),
);
const SitusUnitPage = lazy(() =>
  import('../verticals/pesantren/SitusUnitPage').then((m) => ({ default: m.SitusUnitPage })),
);
const PsbGelombangPage = lazy(() =>
  import('../verticals/pesantren/PsbGelombangPage').then((m) => ({ default: m.PsbGelombangPage })),
);
const BeritaDetailPage = lazy(() =>
  import('../verticals/pesantren/BeritaDetailPage').then((m) => ({ default: m.BeritaDetailPage })),
);
const PsbPendaftaranPage = lazy(() =>
  import('../verticals/pesantren/PsbPendaftaranPage').then((m) => ({ default: m.PsbPendaftaranPage })),
);
const PsbLoginPage = lazy(() =>
  import('../verticals/pesantren/PsbLoginPage').then((m) => ({ default: m.PsbLoginPage })),
);
const PsbDashboardPage = lazy(() =>
  import('../verticals/pesantren/PsbDashboardPage').then((m) => ({ default: m.PsbDashboardPage })),
);
const DaftarPesantrenPage = lazy(() =>
  import('../verticals/pesantren/DaftarPesantrenPage').then((m) => ({
    default: m.DaftarPesantrenPage,
  })),
);
const DaftarPesantrenBerhasilPage = lazy(() =>
  import('../verticals/pesantren/DaftarPesantrenBerhasilPage').then((m) => ({
    default: m.DaftarPesantrenBerhasilPage,
  })),
);
const BerandaPondokPage = lazy(() =>
  import('../verticals/pesantren/BerandaPondokPage').then((m) => ({
    default: m.BerandaPondokPage,
  })),
);
// Dokumen komersial khusus pesantren. Terpisah dari milik eBisnis karena isinya
// berbeda — delapan pilar pesantren, harga per santri, dan kemitraan BMT.
const PresentasiPesantrenPage = lazy(() =>
  import('../verticals/pesantren/PresentasiPesantrenPage').then((m) => ({
    default: m.PresentasiPesantrenPage,
  })),
);
const ProposalPesantrenPage = lazy(() =>
  import('../verticals/pesantren/ProposalPesantrenPage').then((m) => ({
    default: m.ProposalPesantrenPage,
  })),
);
const PksPesantrenPage = lazy(() =>
  import('../verticals/pesantren/PksPesantrenPage').then((m) => ({
    default: m.PksPesantrenPage,
  })),
);
const PenawaranPesantrenPage = lazy(() =>
  import('../verticals/pesantren/PenawaranPesantrenPage').then((m) => ({
    default: m.PenawaranPesantrenPage,
  })),
);

/**
 * Apa yang dilihat pengunjung di akar situs, menurut alamat yang ia ketik.
 *
 * Subdomain menyajikan aplikasi yang sama; yang berbeda hanya titik masuknya.
 * Keputusannya dikumpulkan di sini supaya `/` punya satu tempat yang
 * menjelaskan seluruh kemungkinannya, alih-alih rantai syarat yang memanjang
 * setiap kali ada vertikal baru.
 *
 * Ini hanya menentukan tampilan. Data mana yang boleh dibaca tetap diputuskan
 * API dari host permintaan, bukan dari peramban.
 */
function AkarMenurutHost() {
  if (isMarketplaceHost()) return <Navigate to="/belanja" replace />;
  if (isCooperativeHost()) return <Navigate to="/ekoperasi/situs" replace />;
  /*
   * Dua cabang untuk santri.info, dan urutannya penting: apex adalah PORTAL,
   * subdomain adalah PONDOK. Menyamakannya membuat setiap pondok yang mendaftar
   * kehilangan situsnya dan hanya melihat halaman jualan platform.
   */
  if (isSantriPortalHost()) return <Navigate to="/santri" replace />;
  if (slugPondokDariHost()) return <Navigate to="/santri/pondok" replace />;
  return <HomePage />;
}

export function App() {
  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        {/* Website publik — route `/` menampilkan website, bukan redirect login. */}
        <Route element={<PublicLayout />}>
          {/* Pengunjung yang datang lewat belanja.ebisnis.id langsung melihat
              katalog, lewat koperasi.ebisnis.id langsung melihat situs
              koperasinya; pengunjung ebisnis.id melihat website perusahaan. */}
          <Route path="/" element={<AkarMenurutHost />} />
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

        <Route path="/ekoperasi/*" element={<CooperativeRoutes />} />

        {/* Portal ePesantren (santri.info) */}
        <Route path="/santri" element={<SantriLayout />}>
          <Route index element={<SantriInfoHomePage />} />
          {/*
            Masuk BERBEDA dari `/masuk` global: `LoginPage` yang sama, dibungkus
            `SantriLayout` alih-alih `PublicLayout` supaya pengunjung santri.info
            tidak berpindah merek saat menekan "Masuk" (§ tidak mencampur eBisnis
            dan ePesantren pada satu alur masuk).
          */}
          <Route path="masuk" element={<LoginPage />} />
        </Route>
        {/* Di luar kerangka portal: subdomain pondok bukan halaman platform. */}
        <Route path="/santri/pondok" element={<SitusPondokPage />} />
        {/*
          Formulir PSB dibungkus PondokChrome (nama/logo pondok di header,
          bukan bingkai kosong) -- rute ini hanya pernah dicapai lewat
          subdomain pondok (lihat AkarMenurutHost), jadi tidak perlu
          pemeriksaan host lagi seperti pada PublicLayout/SantriLayout.
        */}
        <Route element={<PondokChrome />}>
          <Route path="/santri/pondok/unit/:slug" element={<SitusUnitPage />} />
          <Route path="/santri/pondok/psb" element={<PsbGelombangPage />} />
          <Route path="/santri/pondok/psb/daftar/:gelombangId" element={<PsbPendaftaranPage />} />
          <Route path="/santri/pondok/psb/masuk" element={<PsbLoginPage />} />
          <Route path="/santri/pondok/psb/status" element={<PsbDashboardPage />} />
          <Route path="/santri/pondok/berita/:id" element={<BeritaDetailPage />} />
        </Route>

        {/*
          Pendaftaran pesantren TERPISAH dari `/daftar`.

          Yang ditanyakan berbeda dan yang dihasilkan berbeda: pendaftaran ini
          membuat situs pondok, bukan hanya ruang kerja. Formulir gabungan yang
          menukar setengah pertanyaannya menurut satu pilihan di awal akan
          menampilkan pertanyaan retail kepada pengurus pondok setiap kali
          pilihan itu tergeser.
        */}
        <Route path="/daftar-pesantren" element={<SantriLayout />}>
          <Route index element={<DaftarPesantrenPage />} />
          <Route path="berhasil" element={<DaftarPesantrenBerhasilPage />} />
        </Route>

        {/*
          Dokumen komersial pesantren.

          Di luar `SantriLayout`: presentasi memakai layar penuh sendiri, dan
          ketiga dokumen lain memakai kerangka cetak yang menghilangkan navigasi
          saat dicetak. Menaruhnya di dalam kerangka portal membuat kop dan
          footer portal ikut tercetak di atas kertas.
        */}
        <Route path="/santri/presentasi" element={<PresentasiPesantrenPage />} />
        <Route path="/santri/proposal" element={<ProposalPesantrenPage />} />
        <Route path="/santri/pks" element={<PksPesantrenPage />} />
        <Route path="/santri/penawaran" element={<PenawaranPesantrenPage />} />

        {/* Beranda penyewa pondok — terpisah dari ruang kerja eBisnis di `/app`. */}
        <Route
          path="/pesantren"
          element={
            <RequireAuth>
              <BerandaPondokPage />
            </RequireAuth>
          }
        />

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
          <Route index element={<AppHomePage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="approvals" element={<NotificationsPage />} />
          <Route path="support" element={<SupportPage />} />
          <Route path="tiket" element={<SupportPage />} />
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
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="role-permissions" element={<RolePermissionsPage />} />
          <Route path="audit" element={<TenantAuditPage />} />
          <Route path="settings" element={<TenantSettingsPage />} />
          <Route path="pengaturan" element={<TenantSettingsPage />} />

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
          <Route path="pesantren/unit-pendidikan" element={<PesantrenUnitPendidikanPage />} />
          <Route path="pesantren/santri" element={<PesantrenSantriPage />} />
          <Route path="pesantren/asrama" element={<PesantrenAsramaPage />} />
          <Route path="pesantren/tagihan" element={<PesantrenTagihanPage />} />
          <Route path="pesantren/profil" element={<PesantrenProfilPage />} />
          <Route path="pesantren/berita" element={<PesantrenBeritaPage />} />
          <Route path="pesantren/psb" element={<PesantrenPsbPage />} />
          <Route path="pesantren/rombongan" element={<PesantrenDaftarModulPage module="rombongan" />} />
          <Route path="pesantren/kurikulum" element={<PesantrenDaftarModulPage module="kurikulum" />} />
          <Route path="pesantren/diniyah" element={<PesantrenDaftarModulPage module="diniyah" />} />
          <Route path="pesantren/guru" element={<PesantrenDaftarModulPage module="guru" />} />
          <Route path="pesantren/kartu" element={<PesantrenDaftarModulPage module="kartu" />} />
          <Route path="pesantren/presensi" element={<PesantrenDaftarModulPage module="presensi" />} />
          <Route path="pesantren/tahfiz" element={<PesantrenDaftarModulPage module="tahfiz" />} />
          <Route path="pesantren/nilai" element={<PesantrenDaftarModulPage module="nilai" />} />
          <Route path="pesantren/absensi-guru" element={<PesantrenDaftarModulPage module="absensi-guru" />} />
          <Route path="pesantren/ekstrakurikuler" element={<PesantrenDaftarModulPage module="ekstrakurikuler" />} />
          <Route path="pesantren/prestasi" element={<PesantrenDaftarModulPage module="prestasi" />} />
          <Route path="pesantren/perizinan" element={<PesantrenDaftarModulPage module="perizinan" />} />
          <Route path="pesantren/pelanggaran" element={<PesantrenDaftarModulPage module="pelanggaran" />} />
          <Route path="pesantren/dompet" element={<PesantrenDaftarModulPage module="dompet" />} />
          <Route path="pesantren/katering" element={<PesantrenDaftarModulPage module="katering" />} />
          <Route path="pesantren/laporan" element={<PesantrenDaftarModulPage module="laporan" />} />
          <Route path="pesantren/gerbang" element={<PesantrenDaftarModulPage module="gerbang" />} />
          <Route path="pesantren/portal-wali" element={<PesantrenDaftarModulPage module="portal-wali" />} />
          <Route path="pesantren/kiosk" element={<PesantrenKioskPage />} />
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
