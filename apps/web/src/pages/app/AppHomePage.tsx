import { useAuth } from '../../app/auth-context';
import { VERTIKAL_PESANTREN } from '../../app/beranda-sesudah-masuk';
import { CmnInventoryOwnerDashboardPage } from './CmnInventoryOwnerDashboardPage';
import { DashboardPage } from './DashboardPage';
import { PesantrenDashboardPage } from './pesantren/PesantrenDashboardPage';

/**
 * Dasbor `/app` (indeks ruang kerja) menurut vertikal penyewa.
 *
 * `berandaSesudahMasuk()` mengantar penyewa PESANTREN ke `/pesantren` saat
 * masuk pertama kali -- tetapi halaman itu sendiri menawarkan tautan "Ruang
 * kerja lengkap" menuju `/app` (mis. untuk keuangan/pengguna/laporan inti
 * yang belum punya layar khusus pesantren). Tanpa pencabangan ini, siapa pun
 * yang tiba di `/app` lewat tautan itu -- atau lewat "Beranda" pada sisi
 * navigasi, atau lewat sesi demo santri.info -- akan melihat dasbor ERP/POS
 * generik (Stock Monitoring, Request Order) yang tidak menyebut satu pun
 * santri, asrama, atau tagihan pondok.
 */
export function AppHomePage() {
  const { user, hasPermission } = useAuth();
  if (
    user?.tenant?.schemaName.endsWith('_inventory') &&
    hasPermission('SALES_REPORT.VIEW_PROFIT')
  ) {
    return <CmnInventoryOwnerDashboardPage />;
  }
  if (user?.tenant?.verticalCode === VERTIKAL_PESANTREN) {
    return <PesantrenDashboardPage />;
  }
  return <DashboardPage />;
}
