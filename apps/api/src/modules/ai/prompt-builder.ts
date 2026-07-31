/**
 * Penyusunan prompt dan penyamaran data.
 *
 * ## Yang dikirim ke model harus disengaja, bukan kebetulan
 *
 * Prompt yang disusun dengan menempelkan apa saja yang ada di layar akan
 * memuat nomor rekening, gaji, dan nomor telepon pelanggan — bukan karena ada
 * yang bermaksud mengirimkannya, melainkan karena kebetulan ada di sana.
 *
 * Fungsi di berkas ini murni: masukan yang sama menghasilkan prompt yang sama,
 * dan hasilnya dapat diperiksa tanpa memanggil model.
 */

import { createHash } from 'node:crypto';
import { sanitize } from '../../infrastructure/observability/telemetry-sanitizer';

/** Satu potong bukti yang menyertai pertanyaan. */
export interface Evidence {
  /** Dari mana potongan ini berasal — ditampilkan kepada pengguna. */
  source: string;
  /** Rujukan yang dapat ditelusuri, mis. nomor dokumen atau id baris. */
  reference?: string;
  content: string;
}

export interface BuildPromptInput {
  useCaseName: string;
  instruction: string;
  question: string;
  evidence: Evidence[];
  tenantName?: string | null;
  /** Batas jumlah huruf seluruh bukti. */
  evidenceCharBudget?: number;
}

/**
 * Batas bawaan panjang bukti, dalam huruf.
 *
 * Model 3B pada penyedia ini berkonteks beberapa ribu token. Bukti yang
 * melampaui konteks tidak menghasilkan galat — ia diam-diam terpotong oleh
 * penyedianya, dan bagian yang terpotong justru sering bagian akhir yang paling
 * penting. Memotongnya sendiri di sini membuat pemotongan itu terlihat dan
 * dapat dilaporkan.
 */
const BUDGET_BUKTI = 6_000;

/**
 * Pola data yang tidak boleh ikut terkirim.
 *
 * Berlapis dengan penyamar telemetri, bukan menggantikannya: penyamar telemetri
 * bekerja pada objek berkunci (`{password: ...}`), sedangkan bukti AI sering
 * berupa teks bebas yang kuncinya sudah hilang.
 */
/*
 * URUTANNYA PENTING: yang paling khusus diperiksa lebih dulu.
 *
 * Nomor telepon Indonesia panjangnya dua belas angka, sehingga pola "nomor
 * panjang" akan menelannya bila diperiksa duluan. Penyamarannya tetap terjadi —
 * jadi tidak ada kebocoran — tetapi LAPORANNYA salah: pengguna diberi tahu "satu
 * nomor panjang disamarkan" padahal yang disamarkan nomor teleponnya. Laporan
 * itulah yang dilihat pengguna, dan laporan yang salah membuat penyamaran
 * tampak sembarangan.
 *
 * Ditemukan oleh pengujian, bukan oleh pembacaan ulang.
 */
const POLA_SENSITIF: Array<{ pola: RegExp; ganti: string; nama: string }> = [
  // Surel — paling khas, tidak mungkin tertukar.
  { pola: /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, ganti: '[SUREL-DISAMARKAN]', nama: 'surel' },
  // NPWP berformat titik dan strip.
  { pola: /\b\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}\b/g, ganti: '[NPWP-DISAMARKAN]', nama: 'NPWP' },
  // Nomor telepon Indonesia — lebih khusus daripada sekadar deretan angka.
  { pola: /\b(?:\+62|62|0)8[1-9]\d{6,10}\b/g, ganti: '[TELEPON-DISAMARKAN]', nama: 'telepon' },
  // Sisa deretan angka panjang: nomor rekening, NIK, dan sejenisnya.
  { pola: /\b\d{10,16}\b/g, ganti: '[NOMOR-DISAMARKAN]', nama: 'nomor panjang' },
];

export interface RedactionResult {
  text: string;
  /** Apa saja yang disamarkan, untuk dilaporkan kepada penggunanya. */
  redacted: Array<{ kind: string; count: number }>;
}

/**
 * Menyamarkan data sensitif dari teks bebas.
 *
 * Yang disamarkan dilaporkan, tidak dibuang diam-diam. Pengguna yang melihat
 * "tiga nomor disamarkan" tahu mengapa jawabannya tidak menyebut nomor itu;
 * tanpa laporan, ia akan mengira modelnya yang tidak becus.
 */
export function redactText(text: string): RedactionResult {
  const laporan: Array<{ kind: string; count: number }> = [];
  let hasil = text;

  for (const { pola, ganti, nama } of POLA_SENSITIF) {
    const cocok = hasil.match(pola);
    if (cocok?.length) {
      laporan.push({ kind: nama, count: cocok.length });
      hasil = hasil.replace(pola, ganti);
    }
  }

  return { text: hasil, redacted: laporan };
}

/** Menyamarkan objek terstruktur lalu mengubahnya menjadi teks. */
export function redactObject(value: unknown): RedactionResult {
  // Penyamar telemetri lebih dulu: ia mengenali kunci seperti `password` dan
  // `token` yang polanya tidak terlihat dari nilainya saja.
  const bersih = sanitize(value);
  return redactText(typeof bersih === 'string' ? bersih : JSON.stringify(bersih, null, 2));
}

export interface BuiltPrompt {
  system: string;
  user: string;
  /** Bukti yang benar-benar disertakan setelah pemotongan. */
  includedEvidence: number;
  /** Bukti yang dibuang karena melampaui batas. */
  droppedEvidence: number;
  redacted: Array<{ kind: string; count: number }>;
  fingerprint: string;
}

/**
 * Menyusun prompt.
 *
 * ## Aturan yang ditanamkan pada pesan sistem
 *
 * Model diberi tahu bahwa ia **tidak boleh mengarang angka** dan **wajib
 * mengatakan tidak tahu**. Itu bukan jaminan — model dapat mengabaikannya —
 * tetapi bersama kewajiban bukti dan pemeriksaan skema, ia menurunkan
 * peluang jawaban yang terdengar meyakinkan namun tidak berdasar.
 *
 * Yang benar-benar menjamin keamanannya bukan kalimat ini, melainkan kenyataan
 * bahwa keluarannya tidak dapat menjadi perbuatan tanpa melewati manusia.
 */
export function buildPrompt(input: BuildPromptInput): BuiltPrompt {
  const budget = input.evidenceCharBudget ?? BUDGET_BUKTI;

  const laporanGabungan = new Map<string, number>();
  const bagian: string[] = [];
  let terpakai = 0;
  let disertakan = 0;
  let dibuang = 0;

  for (const bukti of input.evidence) {
    const { text, redacted } = redactText(bukti.content);
    for (const r of redacted) {
      laporanGabungan.set(r.kind, (laporanGabungan.get(r.kind) ?? 0) + r.count);
    }

    const blok =
      `--- Sumber: ${bukti.source}` +
      (bukti.reference ? ` (${bukti.reference})` : '') +
      `\n${text}\n`;

    if (terpakai + blok.length > budget) {
      dibuang += 1;
      continue;
    }
    bagian.push(blok);
    terpakai += blok.length;
    disertakan += 1;
  }

  const system = [
    'Anda asisten pada sistem ERP berbahasa Indonesia.',
    '',
    'Aturan yang wajib dipatuhi:',
    '1. Jawab HANYA berdasarkan bukti yang diberikan. Jangan memakai pengetahuan luar.',
    '2. JANGAN mengarang angka. Setiap angka yang Anda sebut harus ada pada bukti.',
    '3. Bila bukti tidak cukup, katakan tidak cukup — jangan menebak.',
    '4. Jawab dalam bahasa Indonesia yang lugas.',
    '5. Anda TIDAK melakukan tindakan apa pun. Keluaran Anda adalah usulan yang akan',
    '   diperiksa manusia sebelum dipakai.',
  ].join('\n');

  const user = [
    input.tenantName ? `Konteks: ${input.tenantName}` : null,
    `Tugas: ${input.useCaseName}`,
    input.instruction,
    '',
    bagian.length ? 'BUKTI:' : 'BUKTI: (tidak ada bukti disertakan)',
    ...bagian,
    '',
    `PERTANYAAN: ${input.question}`,
  ]
    .filter((b) => b !== null)
    .join('\n');

  return {
    system,
    user,
    includedEvidence: disertakan,
    droppedEvidence: dibuang,
    redacted: [...laporanGabungan.entries()].map(([kind, count]) => ({ kind, count })),
    // Sidik dipakai mengenali permintaan yang sama tanpa menyimpan isinya.
    fingerprint: createHash('sha256').update(`${system}\n${user}`).digest('hex').slice(0, 32),
  };
}

/**
 * Memeriksa keluaran terhadap skemanya.
 *
 * Ollama menerima JSON Schema dan biasanya mematuhinya, tetapi "biasanya" bukan
 * jaminan. Diperiksa lagi di sini karena keluaran yang tidak sesuai bentuk akan
 * meledak jauh dari sini — pada komponen antarmuka yang membaca bidang yang
 * ternyata tidak ada.
 *
 * Pemeriksaannya sengaja sederhana: keberadaan bidang wajib dan tipe dasarnya.
 * Pemeriksa JSON Schema yang lengkap adalah pustaka tersendiri, dan yang
 * benar-benar sering salah hanyalah bidang yang hilang.
 */
export function validateAgainstSchema(
  value: unknown,
  schema: Record<string, unknown>,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return { valid: false, errors: ['Keluaran bukan objek.'] };
    }
    const obj = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Record<string, unknown>>;
    const required = (schema.required ?? []) as string[];

    for (const nama of required) {
      if (obj[nama] === undefined || obj[nama] === null) {
        errors.push(`Bidang wajib '${nama}' tidak ada.`);
        continue;
      }
      const harap = properties[nama]?.type;
      const ada = Array.isArray(obj[nama]) ? 'array' : typeof obj[nama];
      if (harap && harap !== ada) {
        errors.push(`Bidang '${nama}' bertipe ${ada}, seharusnya ${harap}.`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Membaca JSON dari keluaran model.
 *
 * Model kadang membungkus JSON dalam pagar kode meski diminta menjawab JSON
 * murni. Membiarkannya berarti seluruh jawaban terbuang hanya karena tiga
 * karakter pembungkus.
 */
export function parseModelJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const bersih = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  try {
    return { ok: true, value: JSON.parse(bersih) };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
