/**
 * Daftar keperluan AI beserta kebijakannya.
 *
 * ## AI tidak pernah bertindak, ia hanya mengusulkan
 *
 * Larangan yang paling penting pada seluruh Versi 11: AI **tidak boleh**
 * melakukan pembayaran, posting jurnal, persetujuan, penghapusan, maupun
 * perubahan hak akses.
 *
 * Larangan itu tidak ditegakkan dengan mengingatkan penulis kode. Ia ditegakkan
 * dengan bentuk: setiap keperluan AI menyatakan `outputKind`, dan satu-satunya
 * nilai yang ada adalah `DRAFT`, `ANALYSIS`, dan `RECOMMENDATION`. Tidak ada
 * nilai yang berarti "kerjakan". Sebuah keperluan yang hendak membuat AI
 * bertindak tidak dapat dinyatakan sama sekali dalam daftar ini.
 *
 * Konsekuensinya: seluruh keluaran AI harus melewati manusia sebelum menjadi
 * perbuatan. Itulah yang membuat jawaban yang salah menjadi ketidaknyamanan,
 * bukan bencana.
 *
 * ## Setiap keperluan menyatakan data apa yang boleh dilihatnya
 *
 * Prompt yang disusun bebas akan memuat apa saja yang kebetulan ada di layar.
 * Di sini setiap keperluan menyebutkan sumber datanya, dan yang tidak disebut
 * tidak akan pernah ikut terkirim.
 */

/** Bentuk keluaran. Sengaja tidak ada nilai yang berarti "kerjakan". */
export type OutputKind = 'DRAFT' | 'ANALYSIS' | 'RECOMMENDATION';

/**
 * Kelas risiko.
 *
 * Menentukan seberapa keras pemeriksaannya, bukan sekadar label. Kelas yang
 * lebih tinggi menuntut bukti, menyimpan lebih banyak jejak, dan berkuota lebih
 * ketat.
 */
export type RiskClass = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AiUseCase {
  code: string;
  name: string;
  description: string;

  /** Menu yang izinnya menentukan siapa boleh memakainya. */
  menuCode: string;
  /** Aksi pada menu itu; hampir selalu READ, karena AI hanya membaca. */
  action: string;

  outputKind: OutputKind;
  riskClass: RiskClass;

  /**
   * Wajib menyertakan bukti dari data nyata.
   *
   * Keperluan yang menyimpulkan angka WAJIB berbukti. Kesimpulan tentang uang
   * tanpa angka yang dapat ditelusuri adalah tebakan yang terdengar
   * meyakinkan — dan itu lebih berbahaya daripada tidak ada jawaban sama
   * sekali.
   */
  requiresEvidence: boolean;

  /** Skema JSON keluarannya. Ollama menerimanya apa adanya sebagai `format`. */
  outputSchema: Record<string, unknown>;

  /** Kuota per pengguna per jam. */
  hourlyQuotaPerUser: number;

  /**
   * Menyimpan isi prompt dan keluarannya pada jejak audit.
   *
   * Bawaannya TIDAK. Prompt sebuah ERP memuat angka penjualan, nama pelanggan,
   * dan gaji; menyimpannya utuh berarti membuat salinan kedua dari seluruh data
   * sensitif pada tabel yang aturan aksesnya berbeda dari tabel aslinya.
   *
   * Dinyalakan hanya untuk keperluan berisiko tinggi, dan bahkan saat itu
   * isinya melewati penyamar yang sama dengan telemetri.
   */
  storeContent: boolean;
}

/** Skema yang sering dipakai ulang. */
const SKEMA_RINGKASAN = {
  type: 'object',
  properties: {
    kesimpulan: { type: 'string', description: 'Satu paragraf, bahasa Indonesia.' },
    poinPenting: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    keyakinan: { type: 'string', enum: ['TINGGI', 'SEDANG', 'RENDAH'] },
  },
  required: ['kesimpulan', 'poinPenting', 'keyakinan'],
} as const;

const SKEMA_ANOMALI = {
  type: 'object',
  properties: {
    temuan: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        properties: {
          judul: { type: 'string' },
          keterangan: { type: 'string' },
          tingkat: { type: 'string', enum: ['RENDAH', 'SEDANG', 'TINGGI'] },
          buktiRujukan: { type: 'string', description: 'Baris atau angka yang mendasarinya.' },
        },
        required: ['judul', 'keterangan', 'tingkat', 'buktiRujukan'],
      },
    },
    tidakAdaTemuan: { type: 'boolean' },
  },
  required: ['temuan', 'tidakAdaTemuan'],
} as const;

const SKEMA_REKOMENDASI = {
  type: 'object',
  properties: {
    rekomendasi: {
      type: 'array',
      maxItems: 5,
      items: {
        type: 'object',
        properties: {
          tindakan: { type: 'string' },
          alasan: { type: 'string' },
          prioritas: { type: 'string', enum: ['RENDAH', 'SEDANG', 'TINGGI'] },
        },
        required: ['tindakan', 'alasan', 'prioritas'],
      },
    },
  },
  required: ['rekomendasi'],
} as const;

const SKEMA_DRAFT_SURAT = {
  type: 'object',
  properties: {
    perihal: { type: 'string' },
    isi: { type: 'string', description: 'Badan surat, bahasa Indonesia formal.' },
    catatanPenyusun: {
      type: 'string',
      description: 'Hal yang perlu diperiksa manusia sebelum surat diajukan.',
    },
  },
  required: ['perihal', 'isi', 'catatanPenyusun'],
} as const;

/**
 * Seluruh keperluan yang dikenal.
 *
 * Keperluan yang tidak ada di sini **tidak dapat dipanggil**. Daftar tertutup
 * mencegah prompt bebas: tanpa itu, seseorang dapat mengirim pertanyaan apa pun
 * beserta data apa pun ke penyedia luar, dan tidak ada yang dapat memeriksanya
 * belakangan.
 */
export const AI_USE_CASES: AiUseCase[] = [
  // ------------------------------------------------------------ Copilot umum
  {
    code: 'BUAT_KESIMPULAN',
    name: 'Buat Kesimpulan',
    description: 'Meringkas data yang sedang dilihat pengguna menjadi satu kesimpulan.',
    menuCode: 'HOME_DASHBOARD',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'LOW',
    requiresEvidence: true,
    outputSchema: SKEMA_RINGKASAN,
    hourlyQuotaPerUser: 30,
    storeContent: false,
  },
  {
    code: 'JELASKAN_ANGKA',
    name: 'Jelaskan Angka',
    description: 'Menjelaskan arti sebuah angka beserta cara menghitungnya.',
    menuCode: 'HOME_DASHBOARD',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'MEDIUM',
    requiresEvidence: true,
    outputSchema: SKEMA_RINGKASAN,
    hourlyQuotaPerUser: 30,
    storeContent: false,
  },
  {
    code: 'TEMUKAN_ANOMALI',
    name: 'Temukan Anomali',
    description: 'Menandai baris yang menyimpang dari pola, beserta buktinya.',
    menuCode: 'REPORTING',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'MEDIUM',
    requiresEvidence: true,
    outputSchema: SKEMA_ANOMALI,
    hourlyQuotaPerUser: 20,
    storeContent: false,
  },
  {
    code: 'BERIKAN_REKOMENDASI',
    name: 'Berikan Rekomendasi',
    description: 'Mengusulkan tindakan berdasarkan data yang disertakan.',
    menuCode: 'REPORTING',
    action: 'READ',
    outputKind: 'RECOMMENDATION',
    riskClass: 'MEDIUM',
    requiresEvidence: true,
    outputSchema: SKEMA_REKOMENDASI,
    hourlyQuotaPerUser: 20,
    storeContent: false,
  },

  // ------------------------------------------------------------------- Surat
  {
    code: 'DRAFT_SURAT_KELUAR',
    name: 'Draft Surat Keluar',
    description:
      'Menyusun konsep surat keluar. Hasilnya SELALU konsep yang wajib diperiksa, ' +
      'diajukan, dan disetujui manusia lewat alur yang sama seperti surat lain.',
    menuCode: 'SURAT_KELUAR',
    action: 'CREATE',
    outputKind: 'DRAFT',
    riskClass: 'HIGH',
    requiresEvidence: false,
    outputSchema: SKEMA_DRAFT_SURAT,
    hourlyQuotaPerUser: 10,
    // Berisiko tinggi: isinya disimpan supaya dapat ditelusuri bila kelak ada
    // surat yang isinya dipersoalkan.
    storeContent: true,
  },
  {
    code: 'RINGKAS_SURAT_MASUK',
    name: 'Ringkas Surat Masuk',
    description: 'Meringkas surat masuk yang panjang menjadi beberapa poin.',
    menuCode: 'SURAT_MASUK',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'MEDIUM',
    requiresEvidence: true,
    outputSchema: SKEMA_RINGKASAN,
    hourlyQuotaPerUser: 30,
    storeContent: false,
  },

  // ---------------------------------------------------------- Observability
  {
    code: 'JELASKAN_GALAT',
    name: 'Jelaskan Galat',
    description: 'Menjelaskan sebuah kelompok galat dan mengusulkan langkah pemeriksaan.',
    menuCode: 'ADMIN_AUDIT',
    action: 'READ',
    outputKind: 'ANALYSIS',
    riskClass: 'LOW',
    requiresEvidence: true,
    outputSchema: SKEMA_RINGKASAN,
    hourlyQuotaPerUser: 30,
    storeContent: false,
  },
];

const PETA = new Map(AI_USE_CASES.map((u) => [u.code, u]));

/**
 * Mencari keperluan menurut kodenya.
 *
 * Mengembalikan `undefined` untuk kode yang tidak dikenal — pemanggilnya wajib
 * menolak, bukan melanjutkan dengan kebijakan bawaan. Kebijakan bawaan pada
 * keperluan yang tidak dikenal berarti keperluan apa pun dapat diselundupkan
 * dengan mengarang kodenya.
 */
export function findUseCase(code: string): AiUseCase | undefined {
  return PETA.get(code);
}

export function listUseCases(): AiUseCase[] {
  return [...AI_USE_CASES];
}
