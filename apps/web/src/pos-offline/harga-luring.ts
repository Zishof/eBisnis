/**
 * Aritmetika transaksi luring — perkalian dan penjumlahan, bukan kebijakan harga.
 *
 * ## Keputusan yang menentukan seluruh berkas ini
 *
 * Layar kasir **tidak menghitung harga**. Ia mengalikan harga yang sudah
 * ditetapkan peladen dan dibekukan ke dalam salinan katalog.
 *
 * Godaannya besar untuk memindahkan mesin harga ke peramban supaya luring
 * "lengkap". Itu berarti kebijakan harga — buku harga, promosi, pohon diskon,
 * pembulatan mata uang — punya dua implementasi. Dua implementasi aturan uang
 * tidak pernah tetap sama; keduanya menyimpang perlahan, dan yang pertama
 * menyadarinya adalah pembeli yang ditagih berbeda dari struk sebelumnya.
 *
 * Peramban yang tidak dapat menghitung promosi juga tidak dapat menghitungnya
 * keliru. Yang dikerjakan di sini hanya:
 *
 *     baris = jumlah × harga beku
 *     pajak = menurut tarif yang tersalin, inklusif atau eksklusif
 *     total = penjumlahan
 *
 * Semua yang lebih rumit daripada itu menunggu peladen.
 *
 * ## Akibat yang harus dikatakan, bukan disembunyikan
 *
 * Promosi dan buku harga yang seharusnya berlaku **tidak dievaluasi** saat
 * luring. Harga yang tertagih adalah harga pada salinan. Batas umur salinan 12
 * jam (lihat `katalog.ts`) membatasi seberapa jauh ia dapat meleset, dan
 * penerimaan di peladen membandingkannya lagi — tetapi kasir tetap harus tahu
 * bahwa diskon tertentu tidak akan muncul selama luring.
 *
 * ## Mengapa bilangan bulat, bukan pecahan
 *
 * Seluruh perhitungan memakai satuan terkecil mata uang sebagai bilangan bulat.
 * `0.1 + 0.2` pada bilangan pecahan biner bernilai `0.30000000000000004`; pada
 * mesin kasir, selisih sepersekian sen yang menumpuk sepanjang hari menjadi
 * selisih laci kas yang tidak dapat dijelaskan siapa pun.
 */

/** Berapa satuan terkecil dalam satu satuan mata uang. */
const PECAHAN: Record<string, number> = {
  IDR: 1, // rupiah tidak memakai sen dalam praktik kasir
  USD: 100,
  EUR: 100,
  SGD: 100,
  MYR: 100,
};

export function pecahanMataUang(currencyCode: string): number {
  return PECAHAN[currencyCode.toUpperCase()] ?? 100;
}

export interface TarifLuring {
  taxRateId: string;
  code: string;
  /** Persen, misalnya 11 untuk 11%. */
  rate: number;
  isInclusive: boolean;
}

export interface BarisLuring {
  productId: string;
  name: string;
  uomId: string | null;
  quantity: number;
  /** Harga satuan beku dari salinan, sebagai string desimal. */
  unitPrice: string;
  taxRateId: string | null;
}

export interface HasilBaris {
  productId: string;
  name: string;
  uomId: string | null;
  quantity: number;
  unitPrice: string;
  /** Nilai baris sebelum pajak eksklusif ditambahkan. */
  lineSubtotal: string;
  taxAmount: string;
  lineTotal: string;
  taxRateId: string | null;
}

export interface HasilKeranjang {
  lines: HasilBaris[];
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  itemCount: number;
}

/**
 * Mengubah string desimal menjadi bilangan bulat satuan terkecil.
 *
 * Dilakukan lewat teks, bukan `Math.round(Number(x) * pecahan)`: mengalikan
 * pecahan biner lebih dahulu sudah memasukkan galat sebelum pembulatan, dan
 * pada nilai seperti `1.005` hasilnya membulat ke arah yang salah.
 */
export function keSatuanTerkecil(desimal: string, pecahan: number): number {
  const bersih = (desimal ?? '0').trim();
  if (!bersih || !/^-?\d*(\.\d*)?$/.test(bersih)) return 0;

  const negatif = bersih.startsWith('-');
  const [utuh, pecahanTeks = ''] = bersih.replace('-', '').split('.');
  const digitDiperlukan = String(pecahan).length - 1;

  const dipangkas = pecahanTeks.slice(0, digitDiperlukan).padEnd(digitDiperlukan, '0');
  const berikutnya = pecahanTeks.charCodeAt(digitDiperlukan) - 48;

  let nilai = Number(`${utuh || '0'}${dipangkas || ''}`);
  // Pembulatan setengah ke atas, sama dengan yang dipakai peladen.
  if (berikutnya >= 5) nilai += 1;
  return negatif ? -nilai : nilai;
}

/** Kebalikannya: bilangan bulat satuan terkecil menjadi string desimal. */
export function keDesimal(satuan: number, pecahan: number): string {
  if (pecahan === 1) return String(satuan);
  const negatif = satuan < 0;
  const abs = Math.abs(satuan);
  const digit = String(pecahan).length - 1;
  const utuh = Math.floor(abs / pecahan);
  const sisa = String(abs % pecahan).padStart(digit, '0');
  return `${negatif ? '-' : ''}${utuh}.${sisa}`;
}

/**
 * Menghitung satu baris.
 *
 * Pajak inklusif **dikeluarkan** dari harga, bukan ditambahkan di atasnya:
 * harga yang tertera sudah termasuk pajak, dan menambahkannya lagi akan menagih
 * pembeli dua kali untuk pajak yang sama.
 */
export function hitungBarisLuring(
  baris: BarisLuring,
  tarif: TarifLuring[],
  currencyCode: string,
): HasilBaris {
  const pecahan = pecahanMataUang(currencyCode);
  const harga = keSatuanTerkecil(baris.unitPrice, pecahan);
  const kotor = harga * baris.quantity;

  const t = baris.taxRateId ? tarif.find((x) => x.taxRateId === baris.taxRateId) : undefined;

  let subtotal = kotor;
  let pajak = 0;

  if (t && t.rate !== 0) {
    if (t.isInclusive) {
      // Harga sudah mengandung pajak; yang dicari adalah bagian pajaknya.
      const dasar = Math.round((kotor * 100) / (100 + t.rate));
      pajak = kotor - dasar;
      subtotal = dasar;
    } else {
      pajak = Math.round((kotor * t.rate) / 100);
      subtotal = kotor;
    }
  }

  return {
    productId: baris.productId,
    name: baris.name,
    uomId: baris.uomId,
    quantity: baris.quantity,
    unitPrice: baris.unitPrice,
    lineSubtotal: keDesimal(subtotal, pecahan),
    taxAmount: keDesimal(pajak, pecahan),
    lineTotal: keDesimal(subtotal + pajak, pecahan),
    taxRateId: baris.taxRateId,
  };
}

/**
 * Menjumlahkan seluruh keranjang.
 *
 * Dijumlahkan dari nilai baris yang **sudah dibulatkan**, bukan dari nilai
 * mentah lalu dibulatkan sekali di akhir. Struk mencantumkan angka per baris,
 * dan pembeli yang menjumlahkan sendiri baris-baris pada struknya harus
 * mendapat angka yang sama dengan totalnya.
 */
export function hitungKeranjangLuring(
  baris: BarisLuring[],
  tarif: TarifLuring[],
  currencyCode: string,
): HasilKeranjang {
  const pecahan = pecahanMataUang(currencyCode);
  const hasil = baris.map((b) => hitungBarisLuring(b, tarif, currencyCode));

  let subtotal = 0;
  let pajak = 0;
  let jumlahBarang = 0;
  for (const h of hasil) {
    subtotal += keSatuanTerkecil(h.lineSubtotal, pecahan);
    pajak += keSatuanTerkecil(h.taxAmount, pecahan);
    jumlahBarang += h.quantity;
  }

  return {
    lines: hasil,
    subtotal: keDesimal(subtotal, pecahan),
    taxTotal: keDesimal(pajak, pecahan),
    grandTotal: keDesimal(subtotal + pajak, pecahan),
    itemCount: jumlahBarang,
  };
}

/**
 * Kembalian, dan penolakan bila uang yang diserahkan kurang.
 *
 * Dipisah menjadi fungsi tersendiri karena inilah satu-satunya tempat layar
 * kasir memutuskan sesuatu tentang uang tanpa peladen. Kesalahan di sini
 * berakhir sebagai selisih laci kas yang baru ketahuan saat tutup shift.
 */
export function hitungKembalian(
  grandTotal: string,
  diserahkan: string,
  currencyCode: string,
): { cukup: boolean; change: string; kurang: string } {
  const pecahan = pecahanMataUang(currencyCode);
  const tagihan = keSatuanTerkecil(grandTotal, pecahan);
  const uang = keSatuanTerkecil(diserahkan, pecahan);
  if (uang < tagihan) {
    return { cukup: false, change: keDesimal(0, pecahan), kurang: keDesimal(tagihan - uang, pecahan) };
  }
  return { cukup: true, change: keDesimal(uang - tagihan, pecahan), kurang: keDesimal(0, pecahan) };
}
