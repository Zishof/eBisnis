/**
 * Layar daftar D-3 sampai D-9.
 *
 * Setiap layar di bawah hanya menyatakan **kolom apa yang ditampilkan** dan
 * **saringan apa yang tersedia**. Tabel, urutan, batas halaman, dan hak
 * aksesnya ditentukan peladen (`village-listing.ts`).
 *
 * Beberapa layar membawa `catatan` yang selalu tampil di bawah tabel. Itu bukan
 * hiasan: pada layar tertentu, apa yang **tidak** ada di tabel perlu dijelaskan
 * kepada petugas, supaya ia tidak menghabiskan waktu mencarinya atau
 * menyimpulkan datanya rusak.
 */

import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { VillageListPage } from './VillageListPage';
import {
  angkaKolom,
  cacahKolom,
  kodeKolom,
  namaPelaporKolom,
  statusKolom,
  tanggalKolom,
  teksKolom,
  tautanKolom,
  uangKolom,
  waktuKolom,
  yaTidakKolom,
} from './kolom';

const STATUS_PERMOHONAN = [
  'DRAF', 'DIAJUKAN', 'BERKAS_KURANG', 'DIVERIFIKASI', 'MENUNGGU_PERSETUJUAN',
  'DISETUJUI', 'DITOLAK', 'DITERBITKAN', 'DISERAHKAN', 'DIBATALKAN',
].map((s) => ({ nilai: s, label: s.replace(/_/g, ' ') }));

// --- D-3 Pemerintahan --------------------------------------------------------

export function AparaturPage() {
  return (
    <VillageListPage
      kode="aparatur"
      judul="Aparatur Desa"
      uraian="Perangkat desa beserta jabatan dan masa kerjanya."
      kolom={[
        teksKolom('display_name', 'Nama'),
        teksKolom('position_name', 'Jabatan'),
        kodeKolom('position_code', 'Kode'),
        teksKolom('employment_type', 'Status Kepegawaian'),
        teksKolom('phone', 'Telepon'),
        yaTidakKolom('is_active', 'Aktif', 'Aktif', 'Tidak aktif'),
      ]}
      saringan={[
        { kunci: 'q', label: 'Cari nama', lebar: 'lebar' },
        {
          kunci: 'aktif',
          label: 'Keadaan',
          pilihan: [
            { nilai: 'true', label: 'Masih menjabat' },
            { nilai: 'false', label: 'Sudah tidak' },
          ],
        },
      ]}
      catatan="Nomor identitas aparatur tidak ditampilkan di daftar ini. Ia dibutuhkan pada berkas kepegawaian, bukan pada layar yang dibuka setiap hari."
      kosong="Belum ada aparatur yang tercatat"
    />
  );
}

export function BpdPage() {
  return (
    <VillageListPage
      kode="bpd"
      judul="Badan Permusyawaratan Desa"
      uraian="Anggota BPD beserta wilayah yang diwakilinya."
      kolom={[
        teksKolom('member_name', 'Nama'),
        teksKolom('bpd_position', 'Jabatan'),
        teksKolom('representing_area', 'Mewakili'),
        tanggalKolom('start_date', 'Mulai'),
        tanggalKolom('end_date', 'Berakhir'),
        kodeKolom('decree_number', 'Nomor SK'),
        statusKolom('status'),
      ]}
      saringan={[{ kunci: 'q', label: 'Cari nama', lebar: 'lebar' }]}
      catatan="BPD mengawasi jalannya pemerintahan desa. Kewenangannya tidak mencakup pembacaan data penduduk perorangan — yang dilihat BPD pada sistem ini adalah angka dan ringkasan."
      kosong="Belum ada anggota BPD yang tercatat"
    />
  );
}

export function RegisterPage() {
  return (
    <VillageListPage
      kode="register"
      judul="Buku Register"
      uraian="Pencatatan administrasi umum desa."
      kolom={[
        kodeKolom('entry_number', 'Nomor'),
        tanggalKolom('entry_date', 'Tanggal'),
        teksKolom('register_type', 'Jenis Buku'),
        teksKolom('subject', 'Perihal'),
        uangKolom('amount', 'Nilai'),
        teksKolom('note', 'Catatan'),
      ]}
      saringan={[
        { kunci: 'jenis', label: 'Jenis buku' },
        { kunci: 'q', label: 'Cari perihal', lebar: 'lebar' },
      ]}
      kosong="Belum ada catatan register"
    />
  );
}

// --- D-4 Pelayanan -----------------------------------------------------------

export function JenisLayananPage() {
  return (
    <VillageListPage
      kode="jenis-layanan"
      judul="Jenis Layanan"
      uraian="Surat dan layanan yang dapat diajukan warga."
      kolom={[
        kodeKolom('code', 'Kode'),
        teksKolom('name', 'Nama Layanan'),
        teksKolom('category', 'Kategori'),
        kodeKolom('letter_code', 'Kode Surat'),
        cacahKolom('sla_working_days', 'Janji Selesai', 'hari kerja'),
        uangKolom('fee_amount', 'Biaya'),
        yaTidakKolom('is_online', 'Daring', 'Bisa daring', 'Loket saja'),
        yaTidakKolom('is_active', 'Keadaan', 'Aktif', 'Tidak aktif'),
      ]}
      saringan={[
        { kunci: 'q', label: 'Cari layanan', lebar: 'lebar' },
        {
          kunci: 'aktif',
          label: 'Keadaan',
          pilihan: [
            { nilai: 'true', label: 'Aktif' },
            { nilai: 'false', label: 'Tidak aktif' },
          ],
        },
      ]}
      catatan="Mengubah jenis layanan tidak mengubah permohonan yang sedang berjalan. Setiap permohonan menyimpan salinan ketentuan yang berlaku saat ia diajukan, sehingga syarat tidak berubah di tengah jalan bagi warga yang sudah menyerahkan berkasnya."
      kosong="Belum ada jenis layanan"
    />
  );
}

export function PermohonanPage() {
  return (
    <VillageListPage
      kode="permohonan"
      judul="Permohonan Surat"
      uraian="Berkas yang masuk dari loket, anjungan, dan aplikasi warga."
      kolom={[
        tautanKolom('request_number', 'Nomor', (id) => `/app/info-desa/layanan/permohonan/${id}`),
        teksKolom('applicant_name', 'Pemohon'),
        teksKolom('service_name', 'Layanan'),
        teksKolom('purpose', 'Keperluan'),
        waktuKolom('submitted_at', 'Diajukan'),
        tanggalKolom('due_date', 'Janji Selesai'),
        statusKolom('status'),
      ]}
      saringan={[
        { kunci: 'status', label: 'Status', pilihan: STATUS_PERMOHONAN },
        { kunci: 'q', label: 'Cari nomor / pemohon', lebar: 'lebar' },
        {
          kunci: 'terlambat',
          label: 'Ketepatan',
          pilihan: [
            { nilai: 'true', label: 'Lewat janji' },
            { nilai: 'false', label: 'Masih dalam janji' },
          ],
        },
      ]}
      aksi={
        <Link to="/app/info-desa/layanan/permohonan/baru" className="btn-primary px-3 py-1.5 text-sm">
          <Plus size={15} aria-hidden className="me-1.5 inline" />
          Buat permohonan
        </Link>
      }
      catatan="NIK dan nomor telepon pemohon tidak ditampilkan di daftar ini. Layar loket terbaca dari antrean yang berdiri di belakangnya; keduanya tersedia pada rincian permohonan, yang dibuka satu per satu."
      kosong="Belum ada permohonan"
    />
  );
}

export function AntreanPage() {
  return (
    <VillageListPage
      kode="antrean"
      judul="Antrean Loket"
      uraian="Nomor antrean hari ini dan hari-hari sebelumnya."
      kolom={[
        kodeKolom('ticket_number', 'Nomor'),
        tanggalKolom('queue_date', 'Tanggal'),
        teksKolom('counter_name', 'Loket'),
        waktuKolom('called_at', 'Dipanggil'),
        waktuKolom('served_at', 'Dilayani'),
        waktuKolom('finished_at', 'Selesai'),
        statusKolom('status'),
      ]}
      saringan={[
        { kunci: 'tanggal', label: 'Tanggal', bentuk: 'tanggal' },
        { kunci: 'status', label: 'Status' },
      ]}
      kosong="Belum ada antrean"
    />
  );
}

// --- D-5 Partisipasi ---------------------------------------------------------

export function PengaduanPage() {
  return (
    <VillageListPage
      kode="pengaduan"
      judul="Pengaduan Warga"
      uraian="Laporan yang masuk dari aplikasi warga, anjungan, dan loket."
      kolom={[
        kodeKolom('ticket_number', 'Nomor'),
        teksKolom('title', 'Perihal'),
        teksKolom('category_name', 'Kategori'),
        namaPelaporKolom(),
        teksKolom('location_note', 'Tempat Kejadian'),
        cacahKolom('evidence_count', 'Foto'),
        waktuKolom('created_at', 'Masuk'),
        statusKolom('status'),
      ]}
      saringan={[
        { kunci: 'status', label: 'Status' },
        { kunci: 'q', label: 'Cari nomor / perihal', lebar: 'lebar' },
      ]}
      catatan="Kolom pelapor yang kosong berarti warga memilih namanya tidak ditampilkan — bukan bahwa datanya hilang. Tempat kejadian adalah keterangan yang ditulis pelapor, bukan posisi ponselnya; koordinat pada foto sudah dihapus sebelum foto disimpan."
      kosong="Belum ada pengaduan"
    />
  );
}

export function AspirasiPage() {
  return (
    <VillageListPage
      kode="aspirasi"
      judul="Aspirasi Warga"
      uraian="Usulan warga, diurutkan dari yang paling banyak didukung."
      kolom={[
        teksKolom('title', 'Usulan'),
        teksKolom('category', 'Kategori'),
        namaPelaporKolom('Pengusul'),
        cacahKolom('support_count', 'Dukungan'),
        yaTidakKolom('is_public', 'Tampil Publik', 'Ya', 'Tidak'),
        waktuKolom('created_at', 'Masuk'),
        statusKolom('status'),
      ]}
      saringan={[
        { kunci: 'status', label: 'Status' },
        { kunci: 'q', label: 'Cari usulan', lebar: 'lebar' },
      ]}
      catatan="Banyaknya dukungan bukan keputusan. Usulan yang didukung paling banyak belum tentu yang paling dibutuhkan, dan yang mengusulkan bukan selalu yang paling terdampak."
      kosong="Belum ada aspirasi"
    />
  );
}

export function MusrenbangPage() {
  return (
    <VillageListPage
      kode="musrenbang"
      judul="Musyawarah Perencanaan"
      uraian="Forum musrenbang beserta usulan yang dibahas."
      kolom={[
        teksKolom('title', 'Forum'),
        teksKolom('forum_type', 'Jenis'),
        angkaKolom('fiscal_year', 'Tahun'),
        waktuKolom('held_at', 'Dilaksanakan'),
        teksKolom('venue', 'Tempat'),
        cacahKolom('attendee_count', 'Hadir'),
        cacahKolom('quorum_minimum', 'Kuorum'),
        cacahKolom('proposal_count', 'Usulan'),
        uangKolom('budget_ceiling', 'Pagu'),
        statusKolom('status'),
      ]}
      saringan={[
        { kunci: 'tahun', label: 'Tahun', bentuk: 'tahun' },
        { kunci: 'forum', label: 'Jenis forum' },
      ]}
      catatan="Forum yang jumlah hadirnya di bawah kuorum tidak dapat menetapkan hasil. Batas itu ditegakkan basis data, bukan hanya diperiksa layar."
      kosong="Belum ada musrenbang"
    />
  );
}

// --- D-6 Perencanaan dan keuangan -------------------------------------------

export function RpjmdesPage() {
  return (
    <VillageListPage
      kode="rpjmdes"
      judul="RPJM Desa"
      uraian="Rencana pembangunan jangka menengah desa."
      kolom={[
        teksKolom('title', 'Judul'),
        angkaKolom('start_year', 'Mulai'),
        angkaKolom('end_year', 'Sampai'),
        teksKolom('vision', 'Visi'),
        kodeKolom('regulation_number', 'Nomor Perdes'),
        statusKolom('status'),
      ]}
      kosong="Belum ada RPJM Desa"
    />
  );
}

export function RkpdesPage() {
  return (
    <VillageListPage
      kode="rkpdes"
      judul="RKP Desa"
      uraian="Rencana kerja pemerintah desa per tahun anggaran."
      kolom={[
        angkaKolom('fiscal_year', 'Tahun'),
        teksKolom('title', 'Judul'),
        kodeKolom('regulation_number', 'Nomor Perdes'),
        cacahKolom('activity_count', 'Kegiatan'),
        statusKolom('status'),
      ]}
      saringan={[{ kunci: 'tahun', label: 'Tahun', bentuk: 'tahun' }]}
      kosong="Belum ada RKP Desa"
    />
  );
}

export function ApbdesPage() {
  return (
    <VillageListPage
      kode="apbdes"
      judul="APBDes"
      uraian="Anggaran pendapatan dan belanja desa beserta perubahannya."
      kolom={[
        angkaKolom('fiscal_year', 'Tahun'),
        teksKolom('budget_type', 'Jenis'),
        cacahKolom('revision_number', 'Perubahan ke-'),
        cacahKolom('line_count', 'Baris'),
        uangKolom('ceiling_total', 'Pagu'),
        uangKolom('committed_total', 'Terikat'),
        uangKolom('realized_total', 'Terealisasi'),
        statusKolom('status'),
      ]}
      saringan={[{ kunci: 'tahun', label: 'Tahun', bentuk: 'tahun' }]}
      catatan="Pagu, terikat, dan terealisasi ditampilkan bertiga dengan sengaja. Yang menentukan apakah sebuah belanja masih dapat dilakukan adalah pagu dikurangi terikat — bukan pagu dikurangi terealisasi, sebab yang sudah diikat pasti akan dibayar."
      kosong="Belum ada APBDes"
    />
  );
}

export function RealisasiPage() {
  return (
    <VillageListPage
      kode="realisasi"
      judul="Realisasi Anggaran"
      uraian="Penerimaan dan pengeluaran yang sudah dibukukan."
      kolom={[
        kodeKolom('transaction_number', 'Nomor'),
        tanggalKolom('transaction_date', 'Tanggal'),
        teksKolom('transaction_type', 'Jenis'),
        kodeKolom('account_code', 'Kode Rekening'),
        teksKolom('account_name', 'Uraian Rekening'),
        teksKolom('description', 'Keterangan'),
        teksKolom('counterparty', 'Pihak'),
        uangKolom('amount', 'Jumlah'),
        yaTidakKolom('is_reversed', 'Dibalik', 'Sudah dibalik', '—'),
      ]}
      saringan={[
        { kunci: 'jenis', label: 'Jenis' },
        { kunci: 'dari', label: 'Dari tanggal', bentuk: 'tanggal' },
        { kunci: 'sampai', label: 'Sampai tanggal', bentuk: 'tanggal' },
      ]}
      catatan="Transaksi yang keliru dibalik dengan transaksi lawan, tidak dihapus. Buku yang barisnya dapat hilang bukan buku yang dapat dipertanggungjawabkan."
      kosong="Belum ada realisasi"
    />
  );
}

export function BukuKasPage() {
  return (
    <VillageListPage
      kode="buku-kas"
      judul="Buku Kas"
      uraian="Buku kas umum dan pembantu."
      kolom={[
        tanggalKolom('entry_date', 'Tanggal'),
        cacahKolom('sequence_no', 'No. Urut'),
        teksKolom('book_type', 'Buku'),
        teksKolom('description', 'Uraian'),
        uangKolom('debit_amount', 'Penerimaan'),
        uangKolom('credit_amount', 'Pengeluaran'),
        uangKolom('running_balance', 'Saldo'),
      ]}
      saringan={[
        { kunci: 'tahun', label: 'Tahun', bentuk: 'tahun' },
        { kunci: 'buku', label: 'Jenis buku' },
      ]}
      catatan="Saldo dihitung berurutan dari baris pertama. Menyaring tanggal mengubah baris yang tampil, tidak mengubah saldonya — angka saldo tetap menunjuk keadaan kas pada baris tersebut."
      kosong="Belum ada catatan kas"
    />
  );
}

// --- D-7 Bantuan -------------------------------------------------------------

export function ProgramBantuanPage() {
  return (
    <VillageListPage
      kode="program-bantuan"
      judul="Program Bantuan"
      uraian="Program bantuan yang dijalankan desa beserta kuotanya."
      kolom={[
        kodeKolom('code', 'Kode'),
        teksKolom('name', 'Program'),
        teksKolom('aid_category', 'Kategori'),
        teksKolom('aid_form', 'Bentuk'),
        teksKolom('funding_source', 'Sumber Dana'),
        angkaKolom('fiscal_year', 'Tahun'),
        cacahKolom('quota', 'Kuota'),
        cacahKolom('beneficiary_count', 'Penerima'),
        uangKolom('amount_per_beneficiary', 'Per Penerima'),
        yaTidakKolom('allow_stacking', 'Boleh Rangkap', 'Ya', 'Tidak'),
        statusKolom('status'),
      ]}
      saringan={[
        { kunci: 'tahun', label: 'Tahun', bentuk: 'tahun' },
        { kunci: 'status', label: 'Status' },
      ]}
      catatan="Yang ditampilkan adalah JUMLAH penerima, bukan namanya. Daftar penerima bantuan yang terbuka di layar kantor desa adalah pengumuman siapa yang miskin di desa ini; ia dibuka lewat layar penerima, per program, oleh petugas yang memang mengurusnya."
      kosong="Belum ada program bantuan"
    />
  );
}

// --- D-8 Usaha ---------------------------------------------------------------

export function BumdesPage() {
  return (
    <VillageListPage
      kode="bumdes"
      judul="BUMDes"
      uraian="Badan usaha milik desa beserta unit usahanya."
      kolom={[
        teksKolom('name', 'Nama'),
        kodeKolom('legal_entity_number', 'Nomor Badan Hukum'),
        kodeKolom('regulation_number', 'Nomor Perdes'),
        tanggalKolom('established_at', 'Berdiri'),
        teksKolom('director_name', 'Direktur'),
        angkaKolom('village_share_pct', 'Penyertaan Desa (%)'),
        cacahKolom('unit_count', 'Unit Usaha'),
        statusKolom('status'),
      ]}
      catatan="Kerugian unit usaha tidak dapat mengalir kembali ke APBDes. Batas itu ditegakkan basis data: bagian desa dari hasil usaha tidak pernah bernilai negatif."
      kosong="Belum ada BUMDes"
    />
  );
}

export function UmkmPage() {
  return (
    <VillageListPage
      kode="umkm"
      judul="UMKM"
      uraian="Usaha mikro, kecil, dan menengah di wilayah desa."
      kolom={[
        kodeKolom('code', 'Kode'),
        teksKolom('business_name', 'Nama Usaha'),
        teksKolom('owner_name', 'Pemilik'),
        teksKolom('business_sector', 'Bidang'),
        teksKolom('scale', 'Skala'),
        cacahKolom('employee_count', 'Pekerja'),
        teksKolom('address', 'Alamat'),
        cacahKolom('product_count', 'Produk'),
        statusKolom('status'),
      ]}
      saringan={[{ kunci: 'q', label: 'Cari nama usaha', lebar: 'lebar' }]}
      kosong="Belum ada UMKM yang terdata"
    />
  );
}

export function WisataPage() {
  return (
    <VillageListPage
      kode="wisata"
      judul="Wisata Desa"
      uraian="Objek wisata yang dikelola desa."
      kolom={[
        kodeKolom('code', 'Kode'),
        teksKolom('name', 'Nama'),
        teksKolom('category', 'Kategori'),
        teksKolom('address', 'Alamat'),
        teksKolom('open_hours', 'Jam Buka'),
        yaTidakKolom('is_free', 'Tiket', 'Gratis', 'Berbayar'),
        uangKolom('entry_fee', 'Harga Tiket'),
        angkaKolom('annual_visitors', 'Pengunjung / Tahun'),
        yaTidakKolom('is_published', 'Situs Desa', 'Tayang', 'Tidak tayang'),
      ]}
      saringan={[
        {
          kunci: 'tayang',
          label: 'Tayang di situs',
          pilihan: [
            { nilai: 'true', label: 'Tayang' },
            { nilai: 'false', label: 'Belum tayang' },
          ],
        },
      ]}
      catatan="Koordinat lokasi tidak ditampilkan di daftar ini dan tidak ikut ke situs publik apa adanya. Titik peta objek wisata yang tayang menunjuk tempat umum, bukan rumah pengelolanya."
      kosong="Belum ada objek wisata"
    />
  );
}

// --- D-9 Keamanan dan lingkungan --------------------------------------------

export function InsidenPage() {
  return (
    <VillageListPage
      kode="insiden"
      judul="Buku Kejadian"
      uraian="Catatan kejadian keamanan dan ketertiban di wilayah desa."
      kolom={[
        kodeKolom('incident_number', 'Nomor'),
        waktuKolom('occurred_at', 'Waktu Kejadian'),
        teksKolom('incident_type', 'Jenis'),
        teksKolom('location_note', 'Tempat'),
        teksKolom('description', 'Uraian'),
        cacahKolom('casualty_count', 'Korban'),
        uangKolom('estimated_loss', 'Taksiran Kerugian'),
        teksKolom('referred_to', 'Diteruskan ke'),
        statusKolom('status'),
      ]}
      saringan={[
        { kunci: 'jenis', label: 'Jenis kejadian' },
        { kunci: 'status', label: 'Status' },
      ]}
      catatan="Buku ini mencatat APA yang terjadi, bukan siapa yang diduga melakukannya — tidak ada kolomnya sama sekali. Menetapkan seseorang sebagai terduga adalah kewenangan penegak hukum; catatan desa yang menyebut nama terduga akan beredar sebagai tuduhan yang tidak pernah diadili."
      kosong="Belum ada kejadian yang tercatat"
    />
  );
}

export function LinmasPage() {
  return (
    <VillageListPage
      kode="linmas"
      judul="Anggota Linmas"
      uraian="Perlindungan masyarakat beserta pos jaganya."
      kolom={[
        kodeKolom('member_number', 'Nomor Anggota'),
        teksKolom('full_name', 'Nama'),
        teksKolom('position', 'Jabatan'),
        teksKolom('post_name', 'Pos Jaga'),
        teksKolom('phone', 'Telepon'),
        tanggalKolom('joined_at', 'Bergabung'),
        tanggalKolom('ended_at', 'Berhenti'),
        yaTidakKolom('is_active', 'Keadaan', 'Aktif', 'Tidak aktif'),
      ]}
      catatan="Linmas menjaga ketertiban, tidak mendata penduduk. Peran ini tidak memperoleh baris data penduduk perorangan sama sekali — pembatasannya ada pada cakupan wilayah, bukan pada tampilan menu."
      kosong="Belum ada anggota Linmas"
    />
  );
}

export function BencanaPage() {
  return (
    <VillageListPage
      kode="bencana"
      judul="Kebencanaan"
      uraian="Kejadian bencana, dampak, dan penanganannya."
      kolom={[
        kodeKolom('event_number', 'Nomor'),
        waktuKolom('occurred_at', 'Mulai'),
        waktuKolom('ended_at', 'Berakhir'),
        teksKolom('disaster_type', 'Jenis'),
        teksKolom('location_note', 'Lokasi'),
        cacahKolom('affected_family_count', 'KK Terdampak'),
        cacahKolom('displaced_count', 'Mengungsi'),
        cacahKolom('casualty_count', 'Meninggal'),
        cacahKolom('injured_count', 'Luka'),
        uangKolom('estimated_loss', 'Taksiran Kerugian'),
        cacahKolom('damage_count', 'Objek Rusak'),
        statusKolom('status'),
      ]}
      saringan={[{ kunci: 'jenis', label: 'Jenis bencana' }]}
      catatan="Angka pada jam-jam pertama selalu berubah, dan itu wajar. Perbaikannya dicatat sebagai koreksi beserta alasannya, bukan dengan menimpa angka lama — laporan yang angkanya berubah diam-diam tidak dapat dipakai mempertanggungjawabkan bantuan yang sudah disalurkan."
      kosong="Belum ada kejadian bencana"
    />
  );
}

export function TanahPage() {
  return (
    <VillageListPage
      kode="tanah"
      judul="Pertanahan Administratif"
      uraian="Bidang tanah menurut administrasi desa."
      kolom={[
        kodeKolom('parcel_code', 'Kode Bidang'),
        kodeKolom('letter_c_number', 'Letter C'),
        kodeKolom('persil_number', 'Persil'),
        teksKolom('possessor_name', 'Penguasa'),
        teksKolom('possession_type', 'Dasar Penguasaan'),
        angkaKolom('area_m2', 'Luas (m²)'),
        teksKolom('land_use', 'Penggunaan'),
        teksKolom('address', 'Letak'),
        teksKolom('certificate_status', 'Sertifikat'),
        cacahKolom('statement_count', 'SKT Berlaku'),
      ]}
      saringan={[{ kunci: 'q', label: 'Cari kode / penguasa', lebar: 'lebar' }]}
      catatan="Kolomnya bernama PENGUASA, bukan pemilik, dan itu bukan pilihan kata. Pemerintah desa mencatat siapa yang menguasai bidang menurut administrasinya; kepemilikan ditetapkan BPN. Surat keterangan yang terbit dari sini wajib memuat kalimat bahwa ia bukan bukti kepemilikan — ditegakkan basis data pada teks suratnya, bukan hanya diingatkan kepada petugas."
      kosong="Belum ada bidang tanah yang tercatat"
    />
  );
}
