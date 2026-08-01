/**
 * Daftar untuk layar petugas — konfigurasi, bukan pembangun kueri.
 *
 * ## Mengapa ini satu berkas konfigurasi, bukan dua puluh metode layanan
 *
 * Dua puluh layar petugas membutuhkan dua puluh daftar yang bentuknya sama:
 * ambil baris milik unit ini, saring, urutkan, potong halaman. Menulisnya dua
 * puluh kali berarti dua puluh tempat yang harus diperiksa ketika satu
 * kekeliruan ditemukan — dan dua puluh kesempatan melupakan `village_unit_id`.
 *
 * ## Yang membuatnya aman: tidak ada pengenal SQL yang datang dari permintaan
 *
 * Nama tabel, nama kolom, klausa gabung, dan urutan seluruhnya **literal pada
 * berkas ini**. Yang datang dari permintaan hanya nilai saringan, dan nilai
 * selalu terikat sebagai parameter.
 *
 * Pembangun kueri yang menerima `?sort=nama_kolom` tampak praktis sampai
 * seseorang mengirim `?sort=(SELECT national_id FROM ...)`. Di sini tidak ada
 * jalannya: kunci saringan pun dicocokkan ke daftar yang tertulis di bawah,
 * dan yang tidak cocok diabaikan, bukan diteruskan.
 *
 * ## Yang TIDAK boleh ada di sini
 *
 * Tabel berisi orang per orang **tidak dilayani berkas ini**. Penduduk,
 * keluarga, peristiwa penting, dan penerima bantuan dibaca lewat layanannya
 * masing-masing, sebab pembacaannya wajib menghormati cakupan wilayah petugas
 * (D-3) dan wajib tercatat pada log akses. Daftar umum tidak mengetahui
 * keduanya, dan menambahkannya ke sini berarti membuat pintu samping yang
 * melewati keduanya sekaligus.
 *
 * Larangan itu ditegakkan `TABEL_TERLARANG` beserta pengujiannya, bukan oleh
 * ingatan orang yang menambahkan daftar berikutnya.
 */

import type { KodeFitur } from './village-profile';

/** Bentuk nilai saringan yang diterima. */
export type BentukSaringan = 'TEKS' | 'UUID' | 'PILIHAN' | 'TAHUN' | 'TANGGAL' | 'BENAR_SALAH';

export interface Saringan {
  /** Kunci pada kueri URL. */
  kunci: string;
  /** Klausa SQL literal; `$n` disisipkan pemanggil. */
  klausa: string;
  bentuk: BentukSaringan;
  /** Untuk `PILIHAN`: nilai yang diterima. Selain ini ditolak. */
  pilihan?: readonly string[];
}

export interface Daftar {
  /** Dipakai pada rute `/village/lists/:kode`. */
  kode: string;
  /** Judul untuk layar petugas. */
  judul: string;
  /** Tabel utama. Literal. */
  tabel: string;
  /** Alias tabel utama pada SQL. */
  alias: string;
  /** Gabungan literal, bila ada. */
  gabung?: string;
  /** Proyeksi. Daftar izin — kolom di luar ini tidak pernah terbaca. */
  pilih: readonly string[];
  /** ORDER BY literal. */
  urut: string;
  fitur: KodeFitur;
  /** Hak akses yang dibutuhkan, berbentuk `MENU.ACTION`. */
  hakAkses: string;
  saring?: readonly Saringan[];
  /**
   * Benar bila tabelnya punya `deleted_at`. Dinyatakan di sini, lalu
   * DICOCOKKAN pengujian terhadap berkas migrasi yang sebenarnya.
   *
   * Menyatakannya salah pada tabel yang punya `deleted_at` membuat baris
   * terhapus muncul kembali di layar petugas — tanpa galat, tanpa tanda, dan
   * baru ketahuan ketika seseorang bertanya mengapa aparatur yang sudah
   * berhenti masih terdaftar.
   */
  hapusLunak?: boolean;
}

/**
 * Tabel yang tidak boleh dilayani daftar umum.
 *
 * Bukan karena isinya rahasia, melainkan karena pembacaannya punya kewajiban
 * yang tidak dapat dipenuhi berkas ini: penyaringan cakupan wilayah, pencatatan
 * akses, dan penekanan angka kecil. Semuanya ada pada layanan masing-masing.
 */
export const TABEL_TERLARANG: readonly string[] = [
  'village_resident',
  'village_resident_history',
  'village_resident_document',
  'village_resident_duplicate',
  'village_resident_access_log',
  'village_family',
  'village_vital_event',
  'village_household_survey',
  'village_aid_candidate',
  'village_aid_beneficiary',
  'village_portal_link',
  // Berisi jejak layar yang justru wajib dihapus (D-10).
  'village_kiosk_session',
  // Kode ambil di dalamnya adalah kunci untuk mencetak surat orang lain (D-13).
  'village_kiosk_claim',
  'village_file_object',
  'village_survey_response',
];

/**
 * Kolom yang tidak boleh muncul pada daftar mana pun.
 *
 * Pemeriksaan **kedua**, berdiri sendiri dari daftar izin `pilih`. Yang pertama
 * menyatakan apa yang boleh; yang kedua menangkap apa yang lolos ketika
 * seseorang menambahkan satu kolom pada `pilih` tanpa memikirkannya.
 *
 * Dua pemeriksaan yang saling bebas menangkap kekeliruan yang tidak dapat
 * ditangkap satu pemeriksaan, betapa pun telitinya.
 */
export const RUAS_TERLARANG: readonly string[] = [
  'national_id',
  'nik',
  'applicant_nik',
  'external_id_number',
  'mother_name',
  'father_name',
  // Token penelusuran adalah kunci untuk membuka aduan orang lain tanpa akun.
  'tracking_token',
  'verification_token',
  'claim_code',
  // Alamat isi berkas pada penyimpanan.
  'storage_key',
  // Koordinat tepat rumah pelapor.
  'latitude',
  'longitude',
  'geojson',
  'password_hash',
  'reporter_phone',
  'applicant_phone',
  'answers',
];

// --- Daftar D-1 sampai D-9 ---------------------------------------------------

const STATUS_PERMOHONAN = [
  'DRAF', 'DIAJUKAN', 'BERKAS_KURANG', 'DIVERIFIKASI', 'MENUNGGU_PERSETUJUAN',
  'DISETUJUI', 'DITOLAK', 'DITERBITKAN', 'DISERAHKAN', 'DIBATALKAN',
] as const;

export const DAFTAR: readonly Daftar[] = [
  // --- D-3 Aparatur --------------------------------------------------------
  {
    kode: 'aparatur',
    judul: 'Aparatur',
    tabel: 'village_officer',
    alias: 'o',
    // `external_id_number` sengaja TIDAK diambil meskipun ada pada tabelnya:
    // nomor identitas aparatur bukan bagian dari daftar jabatan.
    pilih: [
      'o.id', 'o.position_code', 'o.position_name', 'o.employment_type',
      'o.echelon', 'o.is_active', 'o.phone',
      'COALESCE(o.external_name, r.full_name) AS display_name',
    ],
    gabung: 'LEFT JOIN {S}.village_resident r ON r.id = o.village_resident_id',
    urut: 'o.is_active DESC, o.position_name',
    fitur: 'APARATUR.STRUKTUR',
    hakAkses: 'VILLAGE_OFFICER.READ',
    hapusLunak: true,
    saring: [
      { kunci: 'q', klausa: 'COALESCE(o.external_name, r.full_name) ILIKE $n', bentuk: 'TEKS' },
      { kunci: 'aktif', klausa: 'o.is_active = $n', bentuk: 'BENAR_SALAH' },
    ],
  },
  {
    kode: 'bpd',
    judul: 'Anggota BPD',
    tabel: 'village_bpd_member',
    alias: 'b',
    pilih: [
      'b.id', 'b.member_name', 'b.bpd_position', 'b.representing_area',
      'b.start_date::text', 'b.end_date::text', 'b.decree_number', 'b.status',
    ],
    urut: 'b.status, b.member_name',
    fitur: 'APARATUR.BPD',
    hakAkses: 'VILLAGE_BPD.READ',
    hapusLunak: true,
    saring: [{ kunci: 'q', klausa: 'b.member_name ILIKE $n', bentuk: 'TEKS' }],
  },
  {
    kode: 'register',
    judul: 'Buku Register',
    tabel: 'village_register_entry',
    alias: 'g',
    pilih: [
      'g.id', 'g.register_type', 'g.entry_number', 'g.entry_date::text',
      'g.subject', 'g.description', 'g.amount', 'g.note',
    ],
    urut: 'g.entry_date DESC, g.entry_number DESC',
    fitur: 'REGISTER.UMUM',
    hakAkses: 'VILLAGE_REGISTER.READ',
    hapusLunak: true,
    saring: [
      { kunci: 'jenis', klausa: 'g.register_type = $n', bentuk: 'TEKS' },
      { kunci: 'q', klausa: 'g.subject ILIKE $n', bentuk: 'TEKS' },
    ],
  },

  // --- D-4 Layanan ---------------------------------------------------------
  {
    kode: 'jenis-layanan',
    judul: 'Jenis Layanan',
    tabel: 'village_service_catalog',
    alias: 'k',
    pilih: [
      'k.id', 'k.code', 'k.name', 'k.category', 'k.letter_code',
      'k.sla_working_days', 'k.fee_amount', 'k.is_online', 'k.is_active',
      'k.definition_version', 'k.sort_order',
    ],
    urut: 'k.sort_order, k.name',
    fitur: 'LAYANAN.KATALOG',
    hakAkses: 'VILLAGE_SERVICE_CATALOG.READ',
    hapusLunak: true,
    saring: [
      { kunci: 'q', klausa: 'k.name ILIKE $n', bentuk: 'TEKS' },
      { kunci: 'aktif', klausa: 'k.is_active = $n', bentuk: 'BENAR_SALAH' },
    ],
  },
  {
    kode: 'permohonan',
    judul: 'Permohonan Surat',
    tabel: 'village_service_request',
    alias: 'p',
    // `applicant_nik` dan `applicant_phone` tidak diambil. Daftar permohonan
    // dibaca sambil berdiri di loket, dan layar loket terlihat dari antrean.
    pilih: [
      'p.id', 'p.request_number', 'p.applicant_name', 'p.purpose', 'p.status',
      'p.submitted_at', 'p.due_date::text', 'p.finished_at',
      'k.name AS service_name', 'k.letter_code',
    ],
    gabung: 'JOIN {S}.village_service_catalog k ON k.id = p.service_catalog_id',
    urut: 'p.submitted_at DESC NULLS LAST, p.created_at DESC',
    fitur: 'LAYANAN.PERMOHONAN',
    hakAkses: 'VILLAGE_SERVICE_REQUEST.READ',
    saring: [
      { kunci: 'status', klausa: 'p.status = $n', bentuk: 'PILIHAN', pilihan: STATUS_PERMOHONAN },
      { kunci: 'jenis', klausa: 'p.service_catalog_id = $n', bentuk: 'UUID' },
      { kunci: 'q', klausa: '(p.request_number ILIKE $n OR p.applicant_name ILIKE $n)', bentuk: 'TEKS' },
      { kunci: 'terlambat', klausa: '(p.due_date < CURRENT_DATE AND p.finished_at IS NULL) = $n', bentuk: 'BENAR_SALAH' },
    ],
  },
  {
    kode: 'antrean',
    judul: 'Antrean Loket',
    tabel: 'village_queue_ticket',
    alias: 'a',
    pilih: [
      'a.id', 'a.ticket_number', 'a.sequence_no', 'a.status',
      'a.queue_date::text', 'a.called_at', 'a.served_at', 'a.finished_at',
      'c.name AS counter_name',
    ],
    gabung: 'LEFT JOIN {S}.village_counter c ON c.id = a.counter_id',
    urut: 'a.queue_date DESC, a.sequence_no',
    fitur: 'LAYANAN.ANTREAN',
    hakAkses: 'VILLAGE_QUEUE.READ',
    saring: [
      { kunci: 'tanggal', klausa: 'a.queue_date = $n', bentuk: 'TANGGAL' },
      { kunci: 'status', klausa: 'a.status = $n', bentuk: 'TEKS' },
    ],
  },

  // --- D-5 Partisipasi -----------------------------------------------------
  {
    kode: 'pengaduan',
    judul: 'Pengaduan Warga',
    tabel: 'village_complaint',
    alias: 'p',
    // Nama pelapor HANYA ditampilkan bila ia memilih terbuka. Kolomnya sudah
    // NULL untuk mode ANONIM sejak D-5, tetapi `CASE` di sini membuatnya tidak
    // bergantung pada itu: dua penjaga, bukan satu.
    pilih: [
      'p.id', 'p.ticket_number', 'p.title', 'p.status', 'p.reporter_mode',
      'p.location_note', 'p.created_at', 'p.last_action_at', 'p.resolved_at',
      'p.is_public',
      "CASE WHEN p.reporter_mode = 'TERBUKA' THEN p.reporter_name ELSE NULL END AS reporter_name",
      'k.name AS category_name',
      '(SELECT COUNT(*) FROM {S}.village_complaint_evidence e WHERE e.complaint_id = p.id) AS evidence_count',
    ],
    gabung: 'LEFT JOIN {S}.village_complaint_category k ON k.id = p.category_id',
    urut: 'p.created_at DESC',
    fitur: 'PARTISIPASI.PENGADUAN',
    hakAkses: 'VILLAGE_COMPLAINT.READ',
    saring: [
      { kunci: 'status', klausa: 'p.status = $n', bentuk: 'TEKS' },
      { kunci: 'q', klausa: '(p.ticket_number ILIKE $n OR p.title ILIKE $n)', bentuk: 'TEKS' },
      { kunci: 'petugas', klausa: 'p.assigned_officer_id = $n', bentuk: 'UUID' },
    ],
  },
  {
    kode: 'aspirasi',
    judul: 'Aspirasi Warga',
    tabel: 'village_aspiration',
    alias: 's',
    pilih: [
      's.id', 's.title', 's.description', 's.category', 's.status',
      's.support_count', 's.reporter_mode', 's.is_public', 's.created_at',
      "CASE WHEN s.reporter_mode = 'TERBUKA' THEN s.reporter_name ELSE NULL END AS reporter_name",
    ],
    urut: 's.support_count DESC, s.created_at DESC',
    fitur: 'PARTISIPASI.ASPIRASI',
    hakAkses: 'VILLAGE_ASPIRATION.READ',
    saring: [
      { kunci: 'status', klausa: 's.status = $n', bentuk: 'TEKS' },
      { kunci: 'q', klausa: 's.title ILIKE $n', bentuk: 'TEKS' },
    ],
  },
  {
    kode: 'musrenbang',
    judul: 'Musyawarah Perencanaan',
    tabel: 'village_musrenbang',
    alias: 'm',
    pilih: [
      'm.id', 'm.forum_type', 'm.fiscal_year', 'm.title', 'm.held_at',
      'm.venue', 'm.quorum_minimum', 'm.attendee_count', 'm.budget_ceiling',
      'm.status', 'm.finalized_at',
      '(SELECT COUNT(*) FROM {S}.village_proposal u WHERE u.musrenbang_id = m.id) AS proposal_count',
    ],
    urut: 'm.held_at DESC',
    fitur: 'PARTISIPASI.MUSRENBANG_DESA',
    hakAkses: 'VILLAGE_MUSRENBANG.READ',
    saring: [
      { kunci: 'tahun', klausa: 'm.fiscal_year = $n', bentuk: 'TAHUN' },
      { kunci: 'forum', klausa: 'm.forum_type = $n', bentuk: 'TEKS' },
    ],
  },

  // --- D-6 Perencanaan dan keuangan ---------------------------------------
  {
    kode: 'rpjmdes',
    judul: 'RPJM Desa',
    tabel: 'village_rpjm',
    alias: 'j',
    pilih: [
      'j.id', 'j.start_year', 'j.end_year', 'j.title', 'j.vision',
      'j.regulation_number', 'j.status',
    ],
    urut: 'j.start_year DESC',
    fitur: 'PERENCANAAN.RPJMDES',
    hakAkses: 'VILLAGE_RPJMDES.READ',
  },
  {
    kode: 'rkpdes',
    judul: 'RKP Desa',
    tabel: 'village_rkp',
    alias: 'r',
    pilih: [
      'r.id', 'r.fiscal_year', 'r.title', 'r.regulation_number', 'r.status',
      '(SELECT COUNT(*) FROM {S}.village_activity_plan p WHERE p.fiscal_year = r.fiscal_year) AS activity_count',
    ],
    urut: 'r.fiscal_year DESC',
    fitur: 'PERENCANAAN.RKPDES',
    hakAkses: 'VILLAGE_RKPDES.READ',
    saring: [{ kunci: 'tahun', klausa: 'r.fiscal_year = $n', bentuk: 'TAHUN' }],
  },
  {
    kode: 'apbdes',
    judul: 'APBDes',
    tabel: 'village_budget',
    alias: 'b',
    pilih: [
      'b.id', 'b.fiscal_year', 'b.budget_type', 'b.revision_number', 'b.status',
      '(SELECT COUNT(*) FROM {S}.village_budget_line l WHERE l.village_budget_id = b.id) AS line_count',
      '(SELECT COALESCE(SUM(l.ceiling_amount), 0) FROM {S}.village_budget_line l WHERE l.village_budget_id = b.id) AS ceiling_total',
      '(SELECT COALESCE(SUM(l.committed_amount), 0) FROM {S}.village_budget_line l WHERE l.village_budget_id = b.id) AS committed_total',
      '(SELECT COALESCE(SUM(l.realized_amount), 0) FROM {S}.village_budget_line l WHERE l.village_budget_id = b.id) AS realized_total',
    ],
    urut: 'b.fiscal_year DESC, b.revision_number DESC',
    fitur: 'KEUANGAN.APBDES',
    hakAkses: 'VILLAGE_APBDES.READ',
    saring: [{ kunci: 'tahun', klausa: 'b.fiscal_year = $n', bentuk: 'TAHUN' }],
  },
  {
    kode: 'realisasi',
    judul: 'Realisasi Anggaran',
    tabel: 'village_budget_transaction',
    alias: 't',
    pilih: [
      't.id', 't.transaction_type', 't.transaction_number',
      't.transaction_date::text', 't.amount', 't.description',
      't.counterparty', 't.document_reference', 't.is_reversed', 't.reversed_at',
      'l.account_code', 'l.account_name',
    ],
    gabung: 'JOIN {S}.village_budget_line l ON l.id = t.budget_line_id',
    urut: 't.transaction_date DESC',
    fitur: 'KEUANGAN.REALISASI',
    hakAkses: 'VILLAGE_REALIZATION.READ',
    saring: [
      { kunci: 'jenis', klausa: 't.transaction_type = $n', bentuk: 'TEKS' },
      { kunci: 'dari', klausa: 't.transaction_date >= $n', bentuk: 'TANGGAL' },
      { kunci: 'sampai', klausa: 't.transaction_date <= $n', bentuk: 'TANGGAL' },
    ],
  },
  {
    kode: 'buku-kas',
    judul: 'Buku Kas',
    tabel: 'village_cash_book',
    alias: 'c',
    pilih: [
      'c.id', 'c.fiscal_year', 'c.book_type', 'c.entry_date::text',
      'c.sequence_no', 'c.description', 'c.debit_amount', 'c.credit_amount',
      'c.running_balance',
    ],
    urut: 'c.entry_date DESC, c.sequence_no DESC',
    fitur: 'KEUANGAN.BUKU_KAS',
    hakAkses: 'VILLAGE_CASHBOOK.READ',
    saring: [
      { kunci: 'tahun', klausa: 'c.fiscal_year = $n', bentuk: 'TAHUN' },
      { kunci: 'buku', klausa: 'c.book_type = $n', bentuk: 'TEKS' },
    ],
  },

  // --- D-7 Bantuan ---------------------------------------------------------
  {
    kode: 'program-bantuan',
    judul: 'Program Bantuan',
    tabel: 'village_aid_program',
    alias: 'g',
    // Jumlah penerima ditampilkan sebagai ANGKA, bukan daftar nama. Daftar
    // penerima adalah pengumuman siapa yang miskin di desa ini.
    pilih: [
      'g.id', 'g.code', 'g.name', 'g.aid_category', 'g.aid_form',
      'g.fiscal_year', 'g.quota', 'g.period_start::text', 'g.period_end::text',
      'g.status', 'g.allow_stacking', 'g.funding_source',
      'g.amount_per_beneficiary',
      '(SELECT COUNT(*) FROM {S}.village_aid_beneficiary p WHERE p.aid_program_id = g.id) AS beneficiary_count',
    ],
    urut: 'g.fiscal_year DESC, g.name',
    fitur: 'BANTUAN.PROGRAM',
    hakAkses: 'VILLAGE_AID_PROGRAM.READ',
    hapusLunak: true,
    saring: [
      { kunci: 'tahun', klausa: 'g.fiscal_year = $n', bentuk: 'TAHUN' },
      { kunci: 'status', klausa: 'g.status = $n', bentuk: 'TEKS' },
    ],
  },

  // --- D-8 Usaha -----------------------------------------------------------
  {
    kode: 'bumdes',
    judul: 'BUMDes',
    tabel: 'village_bumdes',
    alias: 'd',
    pilih: [
      'd.id', 'd.name', 'd.legal_entity_number', 'd.regulation_number',
      'd.established_at::text', 'd.status', 'd.director_name',
      'd.village_share_pct', 'd.is_published',
      '(SELECT COUNT(*) FROM {S}.village_bumdes_unit u WHERE u.village_bumdes_id = d.id) AS unit_count',
    ],
    urut: 'd.name',
    fitur: 'USAHA.BUMDES',
    hakAkses: 'VILLAGE_BUMDES.READ',
    hapusLunak: true,
  },
  {
    kode: 'umkm',
    judul: 'UMKM',
    tabel: 'village_umkm',
    alias: 'u',
    pilih: [
      'u.id', 'u.code', 'u.business_name', 'u.owner_name', 'u.business_sector',
      'u.scale', 'u.employee_count', 'u.address', 'u.status', 'u.is_published',
      '(SELECT COUNT(*) FROM {S}.village_umkm_product p WHERE p.village_umkm_id = u.id) AS product_count',
    ],
    urut: 'u.business_name',
    fitur: 'USAHA.UMKM',
    hakAkses: 'VILLAGE_UMKM.READ',
    hapusLunak: true,
    saring: [{ kunci: 'q', klausa: 'u.business_name ILIKE $n', bentuk: 'TEKS' }],
  },
  {
    kode: 'wisata',
    judul: 'Wisata Desa',
    tabel: 'village_tourism_site',
    alias: 'w',
    pilih: [
      'w.id', 'w.code', 'w.name', 'w.category', 'w.address',
      'w.is_free', 'w.entry_fee', 'w.open_hours', 'w.status', 'w.is_published',
      'w.annual_visitors', 'w.description',
    ],
    urut: 'w.name',
    fitur: 'USAHA.WISATA',
    hakAkses: 'VILLAGE_TOURISM.READ',
    hapusLunak: true,
    saring: [{ kunci: 'tayang', klausa: 'w.is_published = $n', bentuk: 'BENAR_SALAH' }],
  },

  // --- D-9 Keamanan dan lingkungan ----------------------------------------
  {
    kode: 'insiden',
    judul: 'Insiden Keamanan',
    tabel: 'village_incident',
    alias: 'i',
    // TIDAK ADA kolom terlapor maupun terduga — tabelnya memang tidak
    // memilikinya (D-9). Buku kejadian desa mencatat APA yang terjadi; menuduh
    // adalah kewenangan yang tidak dimiliki pemerintah desa.
    pilih: [
      'i.id', 'i.incident_number', 'i.incident_type', 'i.occurred_at',
      'i.location_note', 'i.description', 'i.status', 'i.casualty_count',
      'i.estimated_loss', 'i.handling_note', 'i.referred_to', 'i.referral_number',
      "CASE WHEN i.is_anonymous THEN NULL ELSE i.reporter_name END AS reporter_name",
    ],
    urut: 'i.occurred_at DESC',
    fitur: 'KEAMANAN.INSIDEN',
    hakAkses: 'VILLAGE_LINMAS.READ',
    saring: [
      { kunci: 'jenis', klausa: 'i.incident_type = $n', bentuk: 'TEKS' },
      { kunci: 'status', klausa: 'i.status = $n', bentuk: 'TEKS' },
    ],
  },
  {
    kode: 'linmas',
    judul: 'Anggota Linmas',
    tabel: 'village_linmas_member',
    alias: 'l',
    pilih: [
      'l.id', 'l.full_name', 'l.member_number', 'l.position', 'l.phone',
      'l.is_active', 'l.joined_at::text', 'l.ended_at::text',
      'q.name AS post_name',
    ],
    gabung: 'LEFT JOIN {S}.village_security_post q ON q.id = l.security_post_id',
    urut: 'l.is_active DESC, l.full_name',
    fitur: 'KEAMANAN.LINMAS',
    hakAkses: 'VILLAGE_LINMAS.READ',
    hapusLunak: true,
  },
  {
    kode: 'bencana',
    judul: 'Kejadian Bencana',
    tabel: 'village_disaster_event',
    alias: 'b',
    pilih: [
      'b.id', 'b.event_number', 'b.disaster_type', 'b.occurred_at',
      'b.ended_at', 'b.location_note', 'b.description', 'b.status',
      'b.affected_family_count', 'b.displaced_count', 'b.casualty_count',
      'b.injured_count', 'b.estimated_loss', 'b.emergency_status',
      'b.correction_note', 'b.corrected_at',
      '(SELECT COUNT(*) FROM {S}.village_disaster_damage d WHERE d.disaster_event_id = b.id) AS damage_count',
    ],
    urut: 'b.occurred_at DESC',
    fitur: 'BENCANA.KEJADIAN',
    hakAkses: 'VILLAGE_DISASTER.READ',
    saring: [{ kunci: 'jenis', klausa: 'b.disaster_type = $n', bentuk: 'TEKS' }],
  },
  {
    kode: 'tanah',
    judul: 'Bidang Tanah (Administratif)',
    tabel: 'village_land_parcel',
    alias: 'n',
    // `possessor_name` — PENGUASA, bukan pemilik. Pemerintah desa mencatat
    // siapa yang menguasai bidang menurut administrasinya; kepemilikan
    // ditetapkan BPN (D-9).
    pilih: [
      'n.id', 'n.parcel_code', 'n.letter_c_number', 'n.persil_number',
      'n.possessor_name', 'n.possession_type', 'n.area_m2', 'n.land_use',
      'n.address', 'n.certificate_status',
      '(SELECT COUNT(*) FROM {S}.village_land_statement s WHERE s.land_parcel_id = n.id AND s.revoked_at IS NULL) AS statement_count',
    ],
    urut: 'n.parcel_code',
    fitur: 'TANAH.ADMINISTRATIF',
    hakAkses: 'VILLAGE_LAND.READ',
    hapusLunak: true,
    saring: [
      { kunci: 'q', klausa: '(n.parcel_code ILIKE $n OR n.possessor_name ILIKE $n)', bentuk: 'TEKS' },
    ],
  },
];

// --- Pemeriksaan konfigurasi -------------------------------------------------

export function cariDaftar(kode: string): Daftar | undefined {
  return DAFTAR.find((d) => d.kode === kode);
}

/**
 * Memeriksa satu nilai saringan menurut bentuknya.
 *
 * Mengembalikan `null` bila nilainya tidak sah — dan pemanggil **mengabaikan**
 * saringannya, tidak meneruskannya. Saringan yang tidak dikenali bukan alasan
 * menolak seluruh permintaan; ia hanya bukan saringan.
 */
export function bacaNilaiSaringan(s: Saringan, mentah: string): unknown | null {
  const v = (mentah ?? '').trim();
  if (!v) return null;

  switch (s.bentuk) {
    case 'TEKS':
      return v.length > 100 ? null : `%${v}%`;
    case 'UUID':
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v) ? v : null;
    case 'PILIHAN':
      return s.pilihan?.includes(v) ? v : null;
    case 'TAHUN': {
      const n = Number(v);
      return Number.isInteger(n) && n >= 2000 && n <= 2100 ? n : null;
    }
    case 'TANGGAL':
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null;
    case 'BENAR_SALAH':
      return v === 'true' ? true : v === 'false' ? false : null;
    default:
      return null;
  }
}

/** Batas halaman. Diperiksa di sini, bukan dipercayakan kepada pemanggil. */
export const HALAMAN_MAKSIMAL = 200;
export function bacaBatas(mentah?: string): number {
  const n = Number(mentah ?? '');
  if (!Number.isInteger(n) || n <= 0) return 50;
  return Math.min(n, HALAMAN_MAKSIMAL);
}
