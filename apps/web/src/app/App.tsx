import { Navigate, Outlet, Route, Routes, useParams } from 'react-router-dom';
import { Suspense, lazy, useEffect } from 'react';
import { PublicLayout } from '../pages/public/PublicLayout';
import { HomePage } from '../pages/public/HomePage';
import { EmedikLandingPage } from '../pages/public/EmedikLandingPage';
import { ApotikLandingPage } from '../pages/public/ApotikLandingPage';
import { isApotikHost, rootExperienceFor } from '../pages/public/emedik-host';
import { isEducationPublicHost } from '../verticals/education/education-host';
import { CmsPage } from '../pages/public/CmsPage';
import { PricingPage } from '../pages/public/PricingPage';
import { NewsListPage } from '../pages/public/NewsListPage';
import { NewsDetailPage } from '../pages/public/NewsDetailPage';
import { ContactPage } from '../pages/public/ContactPage';
import { BelanjaLayout } from '../pages/belanja/BelanjaLayout';
import { isMarketplaceHost } from '../pages/belanja/marketplace-host';
import { isSalonDemoHost, salonRootRedirectFor } from '../pages/contoh/salon-host';
import { businessVerticalPublicHostFor, businessVerticalRootRedirectFor } from '../pages/contoh/business-verticals';
import { pelangganRootRedirectFor } from '../pages/pelanggan/pelanggan-host';
import { inventoryRootRedirectFor } from '../pages/inventory/inventory-host';
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
import { PesantrenKioskPage } from '../pages/app/pesantren/PesantrenKioskPage';
import { PesantrenGerbangPage } from '../pages/app/pesantren/PesantrenGerbangPage';
import { PesantrenPresensiPage } from '../pages/app/pesantren/PesantrenPresensiPage';
import { PesantrenPerizinanPage } from '../pages/app/pesantren/PesantrenPerizinanPage';
import { PesantrenJadwalPage } from '../pages/app/pesantren/PesantrenJadwalPage';
import { PesantrenNilaiPage } from '../pages/app/pesantren/PesantrenNilaiPage';
import { PesantrenDakwahPage } from '../pages/app/pesantren/PesantrenDakwahPage';
import { PesantrenGuruPage } from '../pages/app/pesantren/PesantrenGuruPage';
import { PesantrenKartuPage } from '../pages/app/pesantren/PesantrenKartuPage';
import { PesantrenPembinaanPage } from '../pages/app/pesantren/PesantrenPembinaanPage';
import { PesantrenBukuPenghubungPage } from '../pages/app/pesantren/PesantrenBukuPenghubungPage';
import { PesantrenKelasKurikulumPage } from '../pages/app/pesantren/PesantrenKelasKurikulumPage';
import { PesantrenAbsensiGuruPage } from '../pages/app/pesantren/PesantrenAbsensiGuruPage';
import { PesantrenDompetPage } from '../pages/app/pesantren/PesantrenDompetPage';
import { PesantrenKateringPage } from '../pages/app/pesantren/PesantrenKateringPage';
import { PesantrenSkalaHurufPage } from '../pages/app/pesantren/PesantrenSkalaHurufPage';
import { PesantrenLaporanPage } from '../pages/app/pesantren/PesantrenLaporanPage';
import { PesantrenPortalWaliPage } from '../pages/app/pesantren/PesantrenPortalWaliPage';
import { PesantrenDapodikPage } from '../pages/app/pesantren/PesantrenDapodikPage';
import { PesantrenAkademikPage } from '../pages/app/pesantren/PesantrenAkademikPage';
import { EducationGapImplementationPage } from '../pages/app/education/EducationGapImplementationPage';
import { EschoolDashboardPage } from '../pages/app/eschool/EschoolDashboardPage';
import { EschoolOperationalPage } from '../pages/app/eschool/EschoolOperationalPage';
import { MasterListPage } from '../pages/app/MasterListPage';
import { StockTreePage } from '../pages/app/StockTreePage';
import { RequestOrderPage } from '../pages/app/RequestOrderPage';
import { PurchaseOrderPage } from '../pages/app/PurchaseOrderPage';
import { GoodsReceiptPage } from '../pages/app/GoodsReceiptPage';
import { BackorderPage } from '../pages/app/BackorderPage';
import { InternalTransferPage } from '../pages/app/InternalTransferPage';
import { StockAlertsPage, StockMovementsPage } from '../pages/app/InventoryLedgerPage';
import { JournalEntriesPage } from '../pages/app/JournalEntriesPage';
import { InventoryControlPage } from '../pages/app/InventoryControlPage';
import { InventoryTransactionWorkspacePage } from '../pages/app/InventoryTransactionWorkspacePage';
import { InventoryPartyMasterPage } from '../pages/app/InventoryPartyMasterPage';
import { InventorySupplierWorkspacePage } from '../pages/app/InventorySupplierWorkspacePage';
import { SalesOrdersPage, SalesReportsPage } from '../pages/app/SalesPages';
import { SampleDataPage } from '../pages/app/SampleDataPage';
import { SubscriptionPage } from '../pages/app/SubscriptionPage';
import { NotificationsPage } from '../pages/app/NotificationsPage';
import { SupportPage } from '../pages/app/SupportPage';
import { OperationalModulePage } from '../pages/app/OperationalModulePage';
import { PurposeProvider } from '../verticals/health/PurposeGate';
import { RequireAuth } from './RequireAuth';
import { LoadingState } from '../components/ui';
import { useTenantMetadata } from '../lib/tenant-metadata';

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
const EducationLandingPage = lazy(() =>
  import('../verticals/education/EducationLandingPage').then((m) => ({
    default: m.EducationLandingPage,
  })),
);
const EducationProposalPage = lazy(() =>
  import('../verticals/education/EducationDocuments').then((m) => ({
    default: m.EducationProposalPage,
  })),
);
const EducationPenawaranPage = lazy(() =>
  import('../verticals/education/EducationDocuments').then((m) => ({
    default: m.EducationPenawaranPage,
  })),
);
const EducationPksPage = lazy(() =>
  import('../verticals/education/EducationDocuments').then((m) => ({
    default: m.EducationPksPage,
  })),
);
const EducationPresentationPage = lazy(() =>
  import('../verticals/education/EducationDocuments').then((m) => ({
    default: m.EducationPresentationPage,
  })),
);

// Vertical kesehatan. Dimuat terpisah: sebagian besar penyewa bukan fasilitas
// kesehatan, dan tidak ada alasan mereka mengunduh layar rekam medis.
const HealthFacilityPage = lazy(() =>
  import('../verticals/health/FacilityPage').then((m) => ({ default: m.FacilityPage })),
);
const HealthPatientPage = lazy(() =>
  import('../verticals/health/PatientPage').then((m) => ({ default: m.PatientPage })),
);
const HealthDuplicatePatientPage = lazy(() =>
  import('../verticals/health/DuplicatePatientPage').then((m) => ({
    default: m.DuplicatePatientPage,
  })),
);
const HealthQueuePage = lazy(() =>
  import('../verticals/health/QueuePage').then((m) => ({ default: m.QueuePage })),
);
const HealthOutpatientPage = lazy(() =>
  import('../verticals/health/OutpatientPage').then((m) => ({ default: m.OutpatientPage })),
);
const HealthEncounterPage = lazy(() =>
  import('../verticals/health/EncounterPage').then((m) => ({ default: m.EncounterPage })),
);
const HealthPharmacyPage = lazy(() =>
  import('../verticals/health/PharmacyPage').then((m) => ({ default: m.PharmacyPage })),
);
const HealthAdministrationPage = lazy(() =>
  import('../verticals/health/AdministrationPage').then((m) => ({ default: m.AdministrationPage })),
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
const HealthSurgeryPage = lazy(() =>
  import('../verticals/health/SurgeryPage').then((m) => ({ default: m.SurgeryPage })),
);
const HealthIcuPage = lazy(() =>
  import('../verticals/health/IcuPage').then((m) => ({ default: m.IcuPage })),
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
const HealthCodingPage = lazy(() =>
  import('../verticals/health/CodingPage').then((m) => ({ default: m.CodingPage })),
);
const HealthLegalHoldPage = lazy(() =>
  import('../verticals/health/LegalHoldPage').then((m) => ({ default: m.LegalHoldPage })),
);
const HealthInfoReleasePage = lazy(() =>
  import('../verticals/health/InfoReleasePage').then((m) => ({ default: m.InfoReleasePage })),
);
const HealthBreakGlassPage = lazy(() =>
  import('../verticals/health/BreakGlassPage').then((m) => ({ default: m.BreakGlassPage })),
);
const HealthSafetyPage = lazy(() =>
  import('../verticals/health/SafetyPage').then((m) => ({ default: m.SafetyPage })),
);
const HealthQualityPage = lazy(() =>
  import('../verticals/health/QualityPage').then((m) => ({ default: m.QualityPage })),
);
const HealthClaimPage = lazy(() =>
  import('../verticals/health/ClaimPage').then((m) => ({ default: m.ClaimPage })),
);
const HealthBpjsPage = lazy(() =>
  import('../verticals/health/BpjsPage').then((m) => ({ default: m.BpjsPage })),
);
const HealthTariffPage = lazy(() =>
  import('../verticals/health/TariffPage').then((m) => ({ default: m.TariffPage })),
);
const HealthMasterDataPage = lazy(() =>
  import('../verticals/health/MasterDataPage').then((m) => ({ default: m.MasterDataPage })),
);
const HealthOperationalReadinessPage = lazy(() =>
  import('../verticals/health/OperationalReadinessPage').then((m) => ({ default: m.OperationalReadinessPage })),
);
const HealthOperationalModulePage = lazy(() =>
  import('../verticals/health/HealthOperationalModulePage').then((m) => ({ default: m.HealthOperationalModulePage })),
);
const HealthFeePolicyPage = lazy(() =>
  import('../verticals/health/FeePolicyPage').then((m) => ({ default: m.FeePolicyPage })),
);
const HealthSettlementPage = lazy(() =>
  import('../verticals/health/SettlementPage').then((m) => ({ default: m.SettlementPage })),
);
const HealthFeeContractPage = lazy(() =>
  import('../verticals/health/FeeContractPage').then((m) => ({ default: m.FeeContractPage })),
);
const HealthDevicePage = lazy(() =>
  import('../verticals/health/DevicePage').then((m) => ({ default: m.DevicePage })),
);
const HealthDeviceMaintenancePage = lazy(() =>
  import('../verticals/health/DeviceMaintenancePage').then((m) => ({
    default: m.DeviceMaintenancePage,
  })),
);
const HealthDeviceAdapterPage = lazy(() =>
  import('../verticals/health/DeviceAdapterPage').then((m) => ({ default: m.DeviceAdapterPage })),
);

// Layar kasir dimuat terpisah: berkasnya besar dan hanya dipakai peran kasir,
// sementara pengguna lain tidak perlu ikut menunggunya diunduh.
const PosPage = lazy(() => import('../pages/pos/PosPage').then((m) => ({ default: m.PosPage })));
const PharmacyPosPage = lazy(() =>
  import('../pages/pos/PharmacyPosPage').then((m) => ({ default: m.PharmacyPosPage })),
);
const PharmacyTradePage = lazy(() =>
  import('../pages/pos/PharmacyTradePage').then((m) => ({ default: m.PharmacyTradePage })),
);
const PosReportPage = lazy(() =>
  import('../pages/pos/PosReportPage').then((m) => ({ default: m.PosReportPage })),
);
const PosPromotionPage = lazy(() =>
  import('../pages/pos/PosPromotionPage').then((m) => ({ default: m.PosPromotionPage })),
);
const PelangganDemoPage = lazy(() =>
  import('../pages/pelanggan/PelangganDemoPage').then((m) => ({ default: m.PelangganDemoPage })),
);
const SalonDemoPage = lazy(() =>
  import('../pages/contoh/SalonDemoPage').then((m) => ({ default: m.SalonDemoPage })),
);
const BusinessVerticalPage = lazy(() =>
  import('../pages/contoh/BusinessVerticalPage').then((m) => ({ default: m.BusinessVerticalPage })),
);
const PortalPelangganAdminPage = lazy(() =>
  import('../pages/pelanggan/PortalPelangganAdminPage').then((m) => ({
    default: m.PortalPelangganAdminPage,
  })),
);
const InventoryLandingPage = lazy(() =>
  import('../pages/inventory/InventoryLandingPage').then((m) => ({ default: m.InventoryLandingPage })),
);
const InventoryManualPage = lazy(() =>
  import('../pages/inventory/InventoryManualPage').then((m) => ({ default: m.InventoryManualPage })),
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
const RaporVerificationPage = lazy(() =>
  import('../verticals/pesantren/RaporVerificationPage').then((m) => ({ default: m.RaporVerificationPage })),
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
  const businessVerticalRedirect = businessVerticalRootRedirectFor();
  if (businessVerticalRedirect) return <BusinessVerticalPage />;
  const salonRedirect = salonRootRedirectFor();
  if (salonRedirect) return <Navigate to={salonRedirect} replace />;
  const pelangganRedirect = pelangganRootRedirectFor();
  if (pelangganRedirect) return <Navigate to={pelangganRedirect} replace />;
  const inventoryRedirect = inventoryRootRedirectFor();
  if (inventoryRedirect) return <Navigate to={inventoryRedirect} replace />;
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

function isEbisnisApexHost() {
  const host = window.location.hostname.toLowerCase().replace(/\.$/, '');
  return host === 'ebisnis.id' || host === 'www.ebisnis.id';
}

function ExternalRedirect({ host }: { host: string }) {
  useEffect(() => {
    window.location.replace(`https://${host}`);
  }, [host]);
  return <LoadingState label="Membuka website unit usaha" />;
}

function DemoDomainRedirect() {
  if (!isEbisnisApexHost()) return <DemoEntryPage />;
  return <ExternalRedirect host="demo.ebisnis.id" />;
}

function SalonLegacyRedirect() {
  if (!isEbisnisApexHost()) return <SalonDemoPage />;
  return <ExternalRedirect host="salon.ebisnis.id" />;
}

function BusinessVerticalDomainRedirect() {
  const params = useParams();
  const host = businessVerticalPublicHostFor(params.vertical);
  if (!host || !isEbisnisApexHost()) return <BusinessVerticalPage />;
  return <ExternalRedirect host={host} />;
}

function AppTenantGate() {
  if (isSalonDemoHost()) return <Navigate to="/masuk" replace />;
  if (isApotikHost() && window.location.pathname === '/app/pos') {
    return <Navigate to="/app/apotik/pos" replace />;
  }
  return (
    <RequireAuth>
      <AppLayout />
    </RequireAuth>
  );
}

export function App() {
  useTenantMetadata();

  const rootExperience = rootExperienceFor(window.location.hostname, window.location.pathname);
  const educationHost = isEducationPublicHost();
  const rootElement =
    educationHost ? (
      <EducationLandingPage />
    ) : rootExperience === 'emedik' ? (
      <EmedikLandingPage />
    ) : rootExperience === 'apotik' ? (
      <ApotikLandingPage />
    ) : rootExperience === 'demo-apotik' ? (
      <ApotikLandingPage demo />
    ) : null;

  return (
    <Suspense fallback={<LoadingState />}>
      <Routes>
        {rootElement && <Route path="/" element={rootElement} />}
        <Route path="/education" element={<EducationLandingPage />} />

        {/* Website publik — route `/` menampilkan website, bukan redirect login. */}
        <Route element={<PublicLayout />}>
          {/* Pengunjung yang datang lewat belanja.ebisnis.id langsung melihat
              katalog, lewat koperasi.ebisnis.id langsung melihat situs
              koperasinya; pengunjung ebisnis.id melihat website perusahaan. */}
          {!rootElement && <Route path="/" element={<AkarMenurutHost />} />}
          <Route path="/harga" element={<PricingPage />} />
          <Route path="/presentasi" element={educationHost ? <EducationPresentationPage /> : <PresentasiPage />} />
          <Route path="/proposal" element={educationHost ? <EducationProposalPage /> : <ProposalPage />} />
          <Route path="/pks" element={educationHost ? <EducationPksPage /> : <PksPage />} />
          <Route path="/penawaran" element={educationHost ? <EducationPenawaranPage /> : <PenawaranPage />} />
          <Route path="/berita" element={<NewsListPage />} />
          <Route path="/berita/:slug" element={<NewsDetailPage />} />
          <Route path="/kontak" element={<ContactPage />} />
          <Route path="/tentang" element={<CmsPage slug="tentang" fallbackTitle="Tentang Kami" />} />
          <Route path="/syarat" element={<CmsPage slug="syarat" fallbackTitle="Syarat dan Ketentuan" />} />
          <Route path="/privasi" element={<CmsPage slug="privasi" fallbackTitle="Kebijakan Privasi" />} />
          <Route path="/masuk" element={<LoginPage />} />
          <Route path="/daftar" element={<RegisterPage />} />
          <Route path="/daftar/berhasil" element={<RegisterSuccessPage />} />
          <Route path="/demo" element={<DemoDomainRedirect />} />
          <Route path="/inventory" element={<InventoryLandingPage />} />
          <Route path="/panduan/inventory-sales" element={<InventoryManualPage />} />
          <Route path="/contoh-usaha/:vertical" element={<BusinessVerticalDomainRedirect />} />
          <Route path="/a/*" element={<AkarMenurutHost />} />
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
          <Route path="/santri/pondok/rapor/verifikasi/:code" element={<RaporVerificationPage />} />
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

        {/* Halaman pelanggan toko (pelanggan-demo.ebisnis.id) */}
        <Route path="/pelanggan/:slug" element={<PelangganDemoPage />} />

        {/* Contoh jenis usaha untuk calon tenant */}
        <Route path="/contoh/salon" element={<SalonLegacyRedirect />} />

        {/* Aplikasi tenant */}
        <Route
          path="/app"
          element={<AppTenantGate />}
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
          <Route path="journal-entries" element={<JournalEntriesPage />} />
          <Route path="inventory-control" element={<InventoryControlPage />} />
            <Route path="master/suppliers" element={<InventorySupplierWorkspacePage />} />
            <Route path="master/suppliers/manage" element={<InventoryPartyMasterPage kind="suppliers" />} />
            <Route path="master/customers" element={<InventoryPartyMasterPage kind="customers" />} />
            <Route path="master/salespeople" element={<InventoryPartyMasterPage kind="salespeople" />} />
          <Route path="inventory/stock" element={<InventoryControlPage />} />
          <Route path="inventory/stock-opnames" element={<InventoryControlPage />} />
          <Route path="inventory/pricing" element={<InventoryControlPage />} />
          <Route path="purchasing/invoices" element={<InventoryTransactionWorkspacePage mode="purchase" />} />
          <Route path="purchasing/payables" element={<InventoryControlPage />} />
          <Route path="purchasing/reports" element={<InventoryControlPage />} />
          <Route path="sales/invoices" element={<InventoryTransactionWorkspacePage mode="sales" />} />
          <Route path="sales/receivables" element={<InventoryControlPage />} />
          <Route path="sales/note-custody" element={<InventoryControlPage />} />
          <Route path="sales/receivable-reports" element={<InventoryControlPage />} />
          <Route path="finance/journals" element={<InventoryControlPage />} />
          <Route path="finance/profit-loss" element={<InventoryControlPage />} />
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
          <Route path="stock-movements" element={<StockMovementsPage />} />
          <Route path="stock-alerts" element={<StockAlertsPage />} />
          <Route path="sales/orders" element={<SalesOrdersPage />} />
          <Route path="sales/orders/new" element={<InventoryTransactionWorkspacePage mode="sales" />} />
          <Route path="sales/reports" element={<SalesReportsPage />} />
          <Route path="pos" element={<Navigate to="/app/pos/kasir" replace />} />
          <Route path="pos/kasir" element={<PosPage />} />
          <Route path="pos/apotik" element={<PharmacyPosPage />} />
          <Route path="apotik/pos" element={<PharmacyPosPage />} />
          <Route path="apotik/penjualan" element={<PharmacyTradePage area="sales" />} />
          <Route path="apotik/pembelian" element={<PharmacyTradePage area="purchasing" />} />
          <Route path="apotik/racikan" element={<PharmacyTradePage area="compound" />} />
          <Route path="pos/laporan" element={<PosReportPage />} />
          <Route path="pos/aturan-diskon" element={<PosPromotionPage />} />
          <Route path="portal-pelanggan" element={<PortalPelangganAdminPage />} />
          <Route path="sample-data" element={<SampleDataPage />} />
          <Route path="devices" element={<SubscriptionPage tab="devices" />} />
          <Route path="subscription/checkout" element={<SubscriptionPage tab="checkout" />} />
          <Route path="subscription/invoices" element={<SubscriptionPage tab="invoices" />} />
          <Route path="marketplace/aktivasi" element={<MarketplaceActivationPage />} />

          {/*
            eMedik. Seluruh layar yang menyentuh rekam medis berada di bawah
            PurposeProvider, sehingga tujuan penggunaan selalu terbawa pada
            setiap pembacaan.
          */}
          <Route path="emedik" element={<PurposeProvider><Outlet /></PurposeProvider>}>
            <Route index element={<HealthOperationalModulePage />} />
            <Route path="fasilitas" element={<HealthFacilityPage />} />
            <Route path="unit" element={<HealthFacilityPage />} />
            <Route path="pemberi-layanan" element={<HealthFacilityPage />} />
            <Route path="pasien" element={<HealthPatientPage />} />
            <Route path="pasien/ganda" element={<HealthDuplicatePatientPage />} />
            <Route path="pendaftaran" element={<HealthQueuePage />} />
            <Route path="rawat-jalan" element={<HealthOutpatientPage />} />
            <Route path="kunjungan/:id" element={<HealthEncounterPage />} />
            <Route path="resep" element={<HealthPharmacyPage />} />
            <Route path="penyerahan" element={<HealthPharmacyPage />} />
            <Route path="formularium" element={<HealthPharmacyPage />} />
            <Route path="pemberian" element={<HealthAdministrationPage />} />
            <Route path="lab/pesanan" element={<HealthLabPage />} />
            <Route path="lab/spesimen" element={<HealthLabPage />} />
            <Route path="lab/hasil" element={<HealthLabPage />} />
            <Route path="lab/kritis" element={<HealthLabPage />} />
            <Route path="lab/katalog" element={<HealthLabPage />} />
            <Route path="rawat-inap" element={<HealthWardPage />} />
            <Route path="keperawatan" element={<HealthWardPage />} />
            <Route path="tempat-tidur" element={<HealthWardPage />} />
            <Route path="igd" element={<HealthEmergencyPage />} />
            <Route path="operasi" element={<HealthSurgeryPage />} />
            <Route path="intensif" element={<HealthIcuPage />} />

            <Route path="keluarga" element={<HealthFamilyPage />} />
            <Route path="pertumbuhan" element={<HealthGrowthPage />} />
            <Route path="imunisasi" element={<HealthImmunizationPage />} />
            <Route path="kunjungan-rumah" element={<HealthHomeVisitPage />} />
            <Route path="cakupan" element={<HealthCoveragePage />} />

            <Route path="koding" element={<HealthCodingPage />} />
            <Route path="penahanan" element={<HealthLegalHoldPage />} />
            <Route path="jejak-akses" element={<HealthLegalHoldPage />} />
            <Route path="pelepasan" element={<HealthInfoReleasePage />} />
            <Route path="telaah-darurat" element={<HealthBreakGlassPage />} />
            <Route path="keselamatan" element={<HealthSafetyPage />} />
            <Route path="mutu" element={<HealthQualityPage />} />

            <Route path="klaim" element={<HealthClaimPage />} />
            <Route path="telaah-klaim" element={<HealthClaimPage />} />
            <Route path="bpjs" element={<HealthBpjsPage />} />
            <Route path="sep" element={<HealthBpjsPage />} />
            <Route path="kepesertaan" element={<HealthBpjsPage />} />

            <Route path="tarif" element={<HealthTariffPage />} />
            <Route path="penjamin" element={<HealthTariffPage />} />
            <Route path="layanan" element={<HealthMasterDataPage mode="services" />} />
            <Route path="master-data" element={<HealthMasterDataPage mode="services" />} />
            <Route path="pemetaan" element={<HealthMasterDataPage mode="services" />} />
            <Route path="terminologi" element={<HealthMasterDataPage mode="terminology" />} />
            <Route path="kfa" element={<HealthMasterDataPage mode="kfa" />} />
            <Route path="satusehat" element={<HealthOperationalReadinessPage mode="satusehat" />} />
            <Route path="satusehat-kemampuan" element={<HealthOperationalReadinessPage mode="satusehat" />} />
            <Route path="kebijakan-jasa" element={<HealthFeePolicyPage />} />
            <Route path="kontributor" element={<HealthFeePolicyPage />} />
            <Route path="settlement" element={<HealthSettlementPage />} />
            <Route path="distribusi" element={<HealthSettlementPage />} />
            <Route path="pernyataan" element={<HealthSettlementPage />} />
            <Route path="kontrak-fee" element={<HealthFeeContractPage />} />

            <Route path="alat" element={<HealthDevicePage />} />
            <Route path="gateway" element={<HealthDevicePage />} />
            <Route path="pemeliharaan-alat" element={<HealthDeviceMaintenancePage />} />
            <Route path="keamanan-alat" element={<HealthDeviceMaintenancePage />} />
            <Route path="pesan-alat" element={<HealthDeviceAdapterPage />} />
            <Route path="pemetaan-kode" element={<HealthDeviceAdapterPage />} />
            <Route path="hasil-alat" element={<HealthDeviceAdapterPage />} />
            <Route path="akun-portal" element={<HealthOperationalReadinessPage mode="portal" />} />
            <Route path="pelepasan-hasil" element={<HealthOperationalReadinessPage mode="portal" />} />
            <Route path="website" element={<HealthOperationalReadinessPage mode="portal" />} />
            <Route path="data-contoh" element={<HealthOperationalReadinessPage mode="sample" />} />
            <Route path="laporan" element={<HealthOperationalReadinessPage mode="report" />} />
            <Route path="akuntansi" element={<HealthOperationalReadinessPage mode="accounting" />} />
            <Route path="rekonsiliasi" element={<HealthClaimPage />} />
            <Route path="dasbor-investor" element={<HealthOperationalReadinessPage mode="investor" />} />
            <Route path="waterfall" element={<HealthOperationalReadinessPage mode="investor" />} />
            <Route path="zona-data" element={<HealthOperationalReadinessPage mode="security" />} />
            <Route path="penjaga-ai" element={<HealthOperationalReadinessPage mode="ai" />} />
            <Route path="*" element={<HealthOperationalModulePage />} />
          </Route>

          <Route path="pesantren/unit-pendidikan" element={<PesantrenUnitPendidikanPage />} />
          <Route path="pesantren/santri" element={<PesantrenSantriPage />} />
          <Route path="pesantren/asrama" element={<PesantrenAsramaPage />} />
          <Route path="pesantren/tagihan" element={<PesantrenTagihanPage />} />
          <Route path="pesantren/profil" element={<PesantrenProfilPage />} />
          <Route path="pesantren/berita" element={<PesantrenBeritaPage />} />
          <Route path="pesantren/psb" element={<PesantrenPsbPage />} />
          <Route path="pesantren/rombongan" element={<PesantrenKelasKurikulumPage initialTab="rombongan" />} />
          <Route path="pesantren/kurikulum" element={<PesantrenKelasKurikulumPage initialTab="kurikulum" />} />
          <Route path="pesantren/jadwal" element={<PesantrenJadwalPage />} />
          <Route path="pesantren/dakwah" element={<PesantrenDakwahPage initialTab="kajian" />} />
          <Route path="pesantren/diniyah" element={<PesantrenDakwahPage initialTab="halaqah" />} />
          <Route path="pesantren/guru" element={<PesantrenGuruPage />} />
          <Route path="pesantren/kartu" element={<PesantrenKartuPage />} />
          <Route path="pesantren/presensi" element={<PesantrenPresensiPage />} />
          <Route path="pesantren/tahfiz" element={<PesantrenDakwahPage initialTab="tahfiz" />} />
          <Route path="pesantren/nilai" element={<PesantrenNilaiPage />} />
          <Route path="pesantren/akademik" element={<PesantrenAkademikPage />} />
          <Route path="pesantren/nilai/skala-huruf" element={<PesantrenSkalaHurufPage />} />
          <Route path="pesantren/absensi-guru" element={<PesantrenAbsensiGuruPage />} />
          <Route path="pesantren/ekstrakurikuler" element={<PesantrenPembinaanPage initialTab="ekskul" />} />
          <Route path="pesantren/prestasi" element={<PesantrenPembinaanPage initialTab="prestasi" />} />
          <Route path="pesantren/buku-penghubung" element={<PesantrenBukuPenghubungPage />} />
          <Route path="pesantren/perizinan" element={<PesantrenPerizinanPage />} />
          <Route path="pesantren/pelanggaran" element={<PesantrenPembinaanPage initialTab="pelanggaran" />} />
          <Route path="pesantren/dompet" element={<PesantrenDompetPage />} />
          <Route path="pesantren/katering" element={<PesantrenKateringPage />} />
          <Route path="pesantren/laporan" element={<PesantrenLaporanPage />} />
          <Route path="pesantren/dapodik" element={<PesantrenDapodikPage />} />
          <Route path="pesantren/gerbang" element={<PesantrenGerbangPage />} />
          <Route path="pesantren/portal-wali" element={<PesantrenPortalWaliPage />} />
          <Route path="pesantren/kiosk" element={<PesantrenKioskPage />} />
          <Route path="eschool" element={<EschoolDashboardPage />} />
          <Route path="eschool/dapodik" element={<PesantrenDapodikPage mode="eschool" />} />
          <Route path="eschool/:moduleCode" element={<EschoolOperationalPage />} />
          <Route path="ecampus" element={<EducationGapImplementationPage />} />
          <Route path="*" element={<OperationalModulePage />} />
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
