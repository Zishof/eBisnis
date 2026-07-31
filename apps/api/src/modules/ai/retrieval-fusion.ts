/**
 * Penggabungan hasil pencarian leksikal dan semantik.
 *
 * ## Mengapa keduanya, bukan salah satu
 *
 * Pencarian leksikal unggul pada yang persis: nomor surat, kode barang, nama
 * orang. Pencarian semantik unggul pada yang searti: "surat izin tidak masuk"
 * menemukan dokumen yang menulis "permohonan cuti".
 *
 * Memilih salah satu berarti kehilangan yang lain. Seseorang yang mencari
 * "SK-042/VII/2026" dengan pencarian semantik saja mungkin tidak menemukannya —
 * nomor surat tidak punya makna yang dapat didekati.
 */

export interface Scored {
  id: string;
  score: number;
}

/**
 * Reciprocal Rank Fusion.
 *
 * ## Mengapa peringkat, bukan skor
 *
 * Skor leksikal (`ts_rank`) dan skor semantik (kosinus) berada pada skala yang
 * sama sekali berbeda: `ts_rank` biasanya 0–1 tetapi tidak terbatas dan
 * bergantung panjang dokumen, sedangkan kosinus selalu −1 sampai 1. Menjumlahkan
 * atau merata-ratakannya berarti membandingkan hal yang tidak sebanding, dan
 * hasilnya didominasi skala yang kebetulan lebih besar.
 *
 * RRF hanya memakai **urutan**, bukan nilainya. Ia tidak peduli seberapa besar
 * skornya — hanya siapa yang lebih dulu. Karena itu ia bekerja tanpa perlu
 * menormalkan apa pun, dan tetap benar bila kelak model embeddingnya diganti.
 *
 * `k` meredam pengaruh peringkat teratas. Nilai 60 adalah yang lazim dipakai
 * pada literatur RRF; ia membuat selisih antara peringkat 1 dan 2 tidak jauh
 * lebih besar daripada selisih antara 10 dan 11, sehingga satu daftar tidak
 * mendominasi hanya karena kebetulan yakin.
 */
export const RRF_K = 60;

export function reciprocalRankFusion(
  lists: Array<{ weight: number; items: Scored[] }>,
  k = RRF_K,
): Scored[] {
  const gabungan = new Map<string, number>();

  for (const { weight, items } of lists) {
    items.forEach((item, index) => {
      const peringkat = index + 1;
      const tambahan = weight / (k + peringkat);
      gabungan.set(item.id, (gabungan.get(item.id) ?? 0) + tambahan);
    });
  }

  return [...gabungan.entries()]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Kesamaan kosinus, dihitung di sisi aplikasi.
 *
 * Dipakai untuk pengujian dan untuk korpus kecil; pencarian sesungguhnya
 * memakai fungsi SQL supaya tidak menarik seluruh vektor ke memori.
 *
 * Mengembalikan `null` — bukan nol — ketika vektornya tidak sebanding, dengan
 * alasan yang sama seperti pada fungsi SQL-nya: nol berarti "tidak mirip", dan
 * itu pernyataan berbeda dari "tidak dapat dibandingkan".
 */
export function cosineSimilarity(a: number[], b: number[]): number | null {
  if (!Array.isArray(a) || !Array.isArray(b)) return null;
  if (a.length === 0 || a.length !== b.length) return null;

  let hasilKali = 0;
  let normaA = 0;
  let normaB = 0;

  for (let i = 0; i < a.length; i += 1) {
    hasilKali += a[i] * b[i];
    normaA += a[i] * a[i];
    normaB += b[i] * b[i];
  }

  if (normaA === 0 || normaB === 0) return null;
  return hasilKali / (Math.sqrt(normaA) * Math.sqrt(normaB));
}

/**
 * Jenis pencari yang sedang dipakai.
 *
 * Dilaporkan pada setiap jawaban. Pengguna yang tidak menemukan sesuatu berhak
 * tahu apakah pencariannya berbasis kata atau berbasis makna — keduanya gagal
 * dengan cara yang berbeda, dan cara memperbaiki pertanyaannya juga berbeda.
 */
export type RetrieverKind = 'LEXICAL' | 'SEMANTIC' | 'HYBRID';

export function describeRetriever(kind: RetrieverKind): string {
  switch (kind) {
    case 'HYBRID':
      return (
        'Pencarian menggabungkan kata kunci dan makna. Yang persis (nomor surat, kode) ' +
        'ditemukan lewat kata kunci; yang searti ditemukan lewat makna.'
      );
    case 'SEMANTIC':
      return (
        'Pencarian berbasis MAKNA. Kata yang berbeda tetapi searti tetap ditemukan, ' +
        'tetapi kode dan nomor persis mungkin terlewat.'
      );
    case 'LEXICAL':
    default:
      return (
        'Pencarian berbasis KATA KUNCI, bukan makna. Pertanyaan yang memakai kata berbeda ' +
        'dari dokumennya mungkin tidak menemukan bukti yang sebenarnya ada.'
      );
  }
}
