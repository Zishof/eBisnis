import { Navigate, Route, Routes, Outlet} from 'react-router-dom';
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
import { PurposeProvider } from '../verticals/health/PurposeGate';
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

// Vertical kesehatan. Dimuat terpisah: sebagian besar penyewa bukan fasilitas
// kesehatan, dan tidak ada alasan mereka mengunduh layar rekam medis.
const HealthFacilityPage = lazy(() =>
  import('../verticals/health/FacilityPage').then((m) => ({ default: m.FacilityPage })),
);
const HealthPatientPage = lazy(() =>
  import('../verticals/health/PatientPage').then((m) => ({ default: m.PatientPage })),
);
const HealthQueuePage = lazy(() =>
  import('../verticals/health/QueuePage').then((m) => ({ default: m.QueuePage })),
);
const HealthEncounterPage = lazy(() =>
  import('../verticals/health/EncounterPage').then((m) => ({ default: m.EncounterPage })),
);
const HealthPharmacyPage = lazy(() =>
  import('../verticals/health/PharmacyPage').then((m) => ({ default: m.PharmacyPage })),
);
const HealthLabPage = lazy(() =>
  import('../verticals/health/LabPage').then((m) => ({ default: m.LabPage })),
);
const HealthWardPage = lazy(() =>
  import('../verticals/health/WardPage').then((m) => ({ default: m.WardPage })),
);
const HealthEmergencyPage = lazy(() =>
  import('../verticals/health/EmergencyPage').then((m) => ({ default: m.EmergencyPage })),
);
const HealthFamilyPage = lazy(() =>
  import('../verticals/health/FamilyPage').then((m) => ({ default: m.FamilyPage })),
);
const HealthGrowthPage = lazy(() =>
  import('../verticals/health/GrowthPage').then((m) => ({ default: m.GrowthPage })),
);
const HealthImmunizationPage = lazy(() =>
  import('../verticals/health/ImmunizationPage').then((m) => ({ default: m.ImmunizationPage })),
);
const HealthHomeVisitPage = lazy(() =>
  import('../verticals/health/HomeVisitPage').then((m) => ({ default: m.HomeVisitPage })),
);
const HealthCoveragePage = lazy(() =>
  import('../verticals/health/CoveragePage').then((m) => ({ default: m.CoveragePage })),
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
          <Route path="/tentang" element={<CmsPage slug="tentang" />} />
          <Route path="/syarat" element={<CmsPage slug="syarat" />} />
          <Route path="/privasi" element={<CmsPage slug="privasi" />} />
          <Route path="/masuk" element={<LoginPage />} />
          <Route path="/daftar" element={<RegisterPage />} />
          <Route path="/daftar/berhasil" element={<RegisterSuccessPage />} />
          <Route path="/demo" element={<DemoEntryPage />} />
          <Route path="/ganti-kata-sandi" element={<ChangePasswordPage />} />
        </Route>

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
          <Route path="sample-data" element={<SampleDataPage />} />
          <Route path="devices" element={<SubscriptionPage tab="devices" />} />
          <Route path="subscription/checkout" element={<SubscriptionPage tab="checkout" />} />
          <Route path="subscription/invoices" element={<SubscriptionPage tab="invoices" />} />
          <Route path="marketplace/aktivasi" element={<MarketplaceActivationPage />} />

          {/*
            eMedik. Seluruh layar yang menyentuh rekam medis berada di bawah
            PurposeProvider, sehingga tujuan penggunaan selalu terbawa pada
            setiap pembacaan — tajuk yang harus diingat di dua puluh tempat
            adalah tajuk yang akan terlupa di salah satunya.
          */}
          <Route path="emedik" element={<PurposeProvider><Outlet /></PurposeProvider>}>
            <Route path="fasilitas" element={<HealthFacilityPage />} />
            <Route path="pasien" element={<HealthPatientPage />} />
            <Route path="pendaftaran" element={<HealthQueuePage />} />
            <Route path="kunjungan/:id" element={<HealthEncounterPage />} />
            <Route path="resep" element={<HealthPharmacyPage />} />
            <Route path="penyerahan" element={<HealthPharmacyPage />} />
            <Route path="lab/pesanan" element={<HealthLabPage />} />
            <Route path="lab/spesimen" element={<HealthLabPage />} />
            <Route path="lab/hasil" element={<HealthLabPage />} />
            <Route path="lab/kritis" element={<HealthLabPage />} />
            <Route path="rawat-inap" element={<HealthWardPage />} />
            <Route path="keperawatan" element={<HealthWardPage />} />
            <Route path="tempat-tidur" element={<HealthWardPage />} />
            <Route path="igd" element={<HealthEmergencyPage />} />

            {/*
              Puskesmas dan Posyandu.

              `kunjungan-rumah` SENGAJA bukan `kunjungan`. Menu HEALTH_HOME_VISIT
              semula berutas `/app/emedik/kunjungan`, dan NavLink mencocokkan
              awalan — sehingga membuka kunjungan klinis mana pun
              (`kunjungan/:id`) menyorot menu "Kunjungan Rumah" di bilah samping.
              Dokter yang sedang membaca rekam medis melihat menu Posyandu
              tersorot. Diperbaiki migrasi H059.
            */}
            <Route path="keluarga" element={<HealthFamilyPage />} />
            <Route path="pertumbuhan" element={<HealthGrowthPage />} />
            <Route path="imunisasi" element={<HealthImmunizationPage />} />
            <Route path="kunjungan-rumah" element={<HealthHomeVisitPage />} />
            <Route path="cakupan" element={<HealthCoveragePage />} />
          </Route>
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
