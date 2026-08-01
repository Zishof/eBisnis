/**
 * Pengujian berkas unggahan.
 *
 * Satu aturan dijaga paling ketat: **metadata foto benar-benar hilang.**
 *
 * Pengujian tidak berhenti pada "fungsinya dipanggil". Ia membuat JPEG dan PNG
 * yang memang memuat EXIF beserta koordinat GPS, menjalankan pembuangannya,
 * lalu **mencari kembali koordinat itu di dalam hasilnya**. Aturan sepenting ini
 * tidak boleh hanya dipercaya.
 */

import {
  BERKAS_MAKSIMAL_PER_PENGADUAN,
  JENIS_DIIZINKAN,
  UKURAN_MAKSIMAL_BYTE,
  amankanNama,
  bolehLihatBukti,
  bolehTambahBerkas,
  buangMetadata,
  buangMetadataJpeg,
  buangMetadataPng,
  jenisSebenarnya,
  masihAdaMetadata,
  periksaBerkas,
} from './village-file';
import { Readable } from 'node:stream';
import type { IncomingMessage } from 'node:http';
import { VillageFileService } from './village-file.service';

// --- Berkas contoh yang benar-benar memuat metadata --------------------------

/** Segmen APP1 berisi penanda Exif dan sebuah koordinat yang dapat dicari. */
function segmenExif(rahasia: string): number[] {
  const isi = [0x45, 0x78, 0x69, 0x66, 0x00, 0x00, ...Buffer.from(rahasia, 'latin1')];
  const panjang = isi.length + 2;
  return [0xff, 0xe1, (panjang >> 8) & 0xff, panjang & 0xff, ...isi];
}

function jpegDenganExif(rahasia = 'GPS:-7.797068,110.370529'): Uint8Array {
  return Uint8Array.from([
    0xff, 0xd8, // SOI
    ...segmenExif(rahasia),
    // Komentar bebas — sering memuat nama perangkat lunak dan pemiliknya.
    0xff, 0xfe, 0x00, 0x0a, ...Buffer.from('RahasiaX', 'latin1'),
    0xff, 0xdb, 0x00, 0x05, 0x00, 0x01, 0x02, // DQT (disisakan)
    0xff, 0xda, 0x00, 0x04, 0x01, 0x02, // SOS
    0x11, 0x22, 0x33, // data pindai
    0xff, 0xd9, // EOI
  ]);
}

function potonganPng(nama: string, isi: number[]): number[] {
  const panjang = isi.length;
  return [
    (panjang >> 24) & 0xff, (panjang >> 16) & 0xff, (panjang >> 8) & 0xff, panjang & 0xff,
    ...Buffer.from(nama, 'latin1'),
    ...isi,
    0, 0, 0, 0, // CRC; tidak diperiksa oleh pembuang metadata
  ];
}

function pngDenganMetadata(rahasia = 'GPS:-7.797068,110.370529'): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    ...potonganPng('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...potonganPng('eXIf', [...Buffer.from(rahasia, 'latin1')]),
    ...potonganPng('tEXt', [...Buffer.from('Author\0Sumiati', 'latin1')]),
    ...potonganPng('IDAT', [0x78, 0x9c, 0x62, 0x00, 0x00]),
    ...potonganPng('IEND', []),
  ]);
}

const berisi = (data: Uint8Array, teks: string) =>
  Buffer.from(data).toString('latin1').includes(teks);

// --- Pembuangan metadata -----------------------------------------------------

describe('metadata foto benar-benar hilang', () => {
  it('JPEG: koordinat GPS TIDAK ADA LAGI di dalam hasilnya', () => {
    // Inilah pengujian yang sesungguhnya: bukan "fungsinya dipanggil",
    // melainkan "rahasianya sudah tidak ada".
    const asli = jpegDenganExif();
    expect(berisi(asli, '110.370529')).toBe(true);

    const bersih = buangMetadataJpeg(asli)!;
    expect(bersih).not.toBeNull();
    expect(berisi(bersih, '110.370529')).toBe(false);
    expect(berisi(bersih, 'Exif')).toBe(false);
  });

  it('JPEG: komentar bebas ikut hilang, bukan hanya EXIF', () => {
    // Menghapus GPS saja menyisakan nomor seri kamera — yang menghubungkan
    // seluruh foto dari ponsel yang sama, termasuk yang dikirim "tanpa nama".
    const bersih = buangMetadataJpeg(jpegDenganExif())!;
    expect(berisi(bersih, 'RahasiaX')).toBe(false);
  });

  it('JPEG: segmen yang diperlukan untuk menggambar TETAP ada', () => {
    const bersih = buangMetadataJpeg(jpegDenganExif())!;
    // SOI, DQT, SOS, dan data pindainya.
    expect(bersih[0]).toBe(0xff);
    expect(bersih[1]).toBe(0xd8);
    let adaDqt = false;
    let adaSos = false;
    for (let i = 0; i + 1 < bersih.length; i += 1) {
      if (bersih[i] === 0xff && bersih[i + 1] === 0xdb) adaDqt = true;
      if (bersih[i] === 0xff && bersih[i + 1] === 0xda) adaSos = true;
    }
    expect(adaDqt).toBe(true);
    expect(adaSos).toBe(true);
  });

  it('PNG: koordinat GPS dan nama penulis TIDAK ADA LAGI', () => {
    const asli = pngDenganMetadata();
    expect(berisi(asli, '110.370529')).toBe(true);
    expect(berisi(asli, 'Sumiati')).toBe(true);

    const bersih = buangMetadataPng(asli)!;
    expect(berisi(bersih, '110.370529')).toBe(false);
    expect(berisi(bersih, 'Sumiati')).toBe(false);
    expect(berisi(bersih, 'eXIf')).toBe(false);
    expect(berisi(bersih, 'tEXt')).toBe(false);
  });

  it('PNG: potongan yang diperlukan untuk menggambar TETAP ada', () => {
    const bersih = buangMetadataPng(pngDenganMetadata())!;
    expect(berisi(bersih, 'IHDR')).toBe(true);
    expect(berisi(bersih, 'IDAT')).toBe(true);
    expect(berisi(bersih, 'IEND')).toBe(true);
  });

  it('PNG memakai daftar IZIN: potongan asing ikut dibuang', () => {
    // Potongan baru yang kelak ditambahkan standar tidak diam-diam lolos.
    const data = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...potonganPng('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
      ...potonganPng('zZzZ', [...Buffer.from('PotonganMasaDepan', 'latin1')]),
      ...potonganPng('IDAT', [0x78, 0x9c, 0x62, 0x00, 0x00]),
      ...potonganPng('IEND', []),
    ]);
    const bersih = buangMetadataPng(data)!;
    expect(berisi(bersih, 'PotonganMasaDepan')).toBe(false);
  });

  it('pemeriksa ulang menyatakan hasilnya bersih', () => {
    expect(masihAdaMetadata('image/jpeg', jpegDenganExif())).toBe(true);
    expect(masihAdaMetadata('image/jpeg', buangMetadataJpeg(jpegDenganExif())!)).toBe(false);
    expect(masihAdaMetadata('image/png', pngDenganMetadata())).toBe(true);
    expect(masihAdaMetadata('image/png', buangMetadataPng(pngDenganMetadata())!)).toBe(false);
  });

  it('berkas rusak menghasilkan null, bukan berkas separuh', () => {
    // Pemanggil wajib menolaknya. Berkas yang tidak dapat dibersihkan adalah
    // berkas yang metadatanya tidak diketahui isinya.
    expect(buangMetadataJpeg(Uint8Array.from([0x00, 0x01, 0x02]))).toBeNull();
    expect(buangMetadataJpeg(Uint8Array.from([0xff, 0xd8, 0x00, 0x01]))).toBeNull();
    expect(buangMetadataPng(Uint8Array.from([0x89, 0x50]))).toBeNull();
    // PNG tanpa IDAT bukan gambar.
    const tanpaIdat = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      ...potonganPng('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
      ...potonganPng('IEND', []),
    ]);
    expect(buangMetadataPng(tanpaIdat)).toBeNull();
  });

  it('buangMetadata memilih pembersih sesuai jenisnya', () => {
    expect(buangMetadata('image/jpeg', jpegDenganExif())).not.toBeNull();
    expect(buangMetadata('image/png', pngDenganMetadata())).not.toBeNull();
    // Jenis yang tidak cocok dengan isinya menghasilkan null, bukan berkas asal.
    expect(buangMetadata('image/png', jpegDenganExif())).toBeNull();
  });
});

// --- Jenis berkas ------------------------------------------------------------

describe('jenis berkas ditentukan dari isinya', () => {
  it('mengenali JPEG dan PNG dari awalannya', () => {
    expect(jenisSebenarnya(jpegDenganExif())).toBe('image/jpeg');
    expect(jenisSebenarnya(pngDenganMetadata())).toBe('image/png');
  });

  it('MENOLAK berkas yang menyamar sebagai foto', () => {
    // Berkas bernama foto.jpg bertipe image/jpeg yang isinya HTML akan
    // dijalankan peramban sebagai HTML bila kelak disajikan tanpa header yang
    // benar — dan "kelak" itu selalu tiba.
    const html = Buffer.from('<html><script>alert(1)</script>', 'latin1');
    const h = periksaBerkas({
      namaAsli: 'foto.jpg',
      mimeDilaporkan: 'image/jpeg',
      ukuranByte: html.length,
      awalan: Uint8Array.from(html.subarray(0, 8)),
    });
    expect(h.boleh).toBe(false);
    expect(jenisSebenarnya(Uint8Array.from(html.subarray(0, 8)))).toBeNull();
  });

  it('daftar izin hanya JPEG dan PNG', () => {
    expect([...JENIS_DIIZINKAN].sort()).toEqual(['image/jpeg', 'image/png']);
  });

  it('HEIC ditolak meskipun bawaan iPhone, dengan saran yang dapat diikuti', () => {
    // Metadatanya tidak dapat dibuang oleh kode di modul ini, dan menerima
    // berkas yang tidak dapat dibersihkan lebih buruk daripada menyuruh warga
    // mengubah setelan kameranya.
    const heic = Buffer.from([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70]); // ftyp
    const h = periksaBerkas({
      namaAsli: 'IMG_0001.HEIC',
      mimeDilaporkan: 'image/heic',
      ukuranByte: 2_000_000,
      awalan: Uint8Array.from(heic),
    });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('iPhone');
    expect(h.alasan).toContain('Paling Cocok');
  });

  it('menerima foto yang wajar', () => {
    const j = jpegDenganExif();
    expect(
      periksaBerkas({
        namaAsli: 'IMG_2031.jpg',
        mimeDilaporkan: 'image/jpeg',
        ukuranByte: 2_400_000,
        awalan: j,
      }).boleh,
    ).toBe(true);
  });

  it('menolak berkas kosong dan yang terlalu besar', () => {
    const j = jpegDenganExif();
    expect(periksaBerkas({ namaAsli: 'a.jpg', mimeDilaporkan: 'image/jpeg', ukuranByte: 0, awalan: j }).boleh).toBe(false);
    const besar = periksaBerkas({
      namaAsli: 'a.jpg',
      mimeDilaporkan: 'image/jpeg',
      ukuranByte: UKURAN_MAKSIMAL_BYTE + 1,
      awalan: j,
    });
    expect(besar.boleh).toBe(false);
    expect(besar.alasan).toContain('Kecilkan');
  });
});

describe('jumlah berkas per pengaduan', () => {
  it('membatasi pada tiga, sama dengan aplikasi warga', () => {
    expect(BERKAS_MAKSIMAL_PER_PENGADUAN).toBe(3);
    expect(bolehTambahBerkas(2).boleh).toBe(true);
    const h = bolehTambahBerkas(3);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak ditindaklanjuti');
  });
});

// --- Siapa yang boleh melihat ------------------------------------------------

describe('foto bukti tidak pernah publik', () => {
  it('pelapor dan petugas boleh; warga lain tidak', () => {
    expect(bolehLihatBukti('PELAPOR').boleh).toBe(true);
    expect(bolehLihatBukti('PETUGAS').boleh).toBe(true);
    const h = bolehLihatBukti('ORANG_LAIN');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('rumah dan halaman orang');
  });
});

describe('nama berkas', () => {
  it('membuang jalur dan penanjakan direktori', () => {
    expect(amankanNama('../../etc/passwd')).not.toContain('/');
    expect(amankanNama('..\\..\\windows\\win.ini')).not.toContain('\\');
    expect(amankanNama('../../etc/passwd')).not.toContain('..');
  });

  it('menyisakan nama yang wajar', () => {
    expect(amankanNama('IMG_2031.jpg')).toBe('IMG_2031.jpg');
  });

  it('nama kosong tetap menghasilkan nama', () => {
    expect(amankanNama('').length).toBeGreaterThan(0);
    expect(amankanNama('/')).toBe('foto');
  });
});

// --- Membaca badan permintaan ------------------------------------------------

describe('bacaBadan', () => {
  /**
   * Layanannya dibuat tanpa ketergantungan.
   *
   * `bacaBadan` tidak menyentuh basis data, unit, maupun penyimpanan — ia hanya
   * membaca aliran. Menyuntikkan tiruan bertingkat untuk menguji sesuatu yang
   * tidak memakainya hanya menambah kode yang harus ikut diperbaiki setiap kali
   * konstruktornya berubah.
   */
  const layanan = new VillageFileService(
    null as never,
    null as never,
    null as never,
  );

  /** Aliran yang meniru permintaan HTTP masuk. */
  function aliran(isi: Buffer): IncomingMessage {
    const r = Readable.from([isi]) as unknown as IncomingMessage;
    return r;
  }

  it('membaca isi permintaan apa adanya', async () => {
    const isi = Buffer.from([0xff, 0xd8, 0xff, 0x01, 0x02, 0x03]);
    const hasil = await layanan.bacaBadan(aliran(isi));
    expect(Buffer.from(hasil)).toEqual(isi);
  });

  it('MENOLAK aliran yang isinya sudah terbaca, bukan menggantung selamanya', async () => {
    // Inilah yang terjadi ketika permintaan menyebut dirinya `application/json`:
    // body-parser bawaan menghabiskan alirannya sebelum sampai ke sini.
    //
    // Sebelum penjaga ini ada, `'end'` pada aliran yang sudah berakhir tidak
    // pernah menyala lagi, dan Promise-nya TIDAK PERNAH SELESAI — permintaannya
    // menggantung menahan satu koneksi sampai batas waktu soket, tanpa galat,
    // tanpa log, tanpa apa pun yang menunjukkan sebabnya.
    const habis = aliran(Buffer.from([1, 2, 3]));
    for await (const _ of habis as unknown as AsyncIterable<Buffer>) {
      // sengaja dihabiskan, meniru body-parser
    }

    await expect(layanan.bacaBadan(habis)).rejects.toThrow(/sudah terbaca/i);
  });

  it('penolakannya menyebutkan Content-Type yang benar', async () => {
    const habis = aliran(Buffer.from([1]));
    for await (const _ of habis as unknown as AsyncIterable<Buffer>) {
      // dihabiskan
    }

    // Pesan yang hanya menyatakan "permintaan tidak sah" membuat pengembang
    // aplikasi menebak-nebak. Yang menyebut jalan keluarnya dapat diikuti.
    await expect(layanan.bacaBadan(habis)).rejects.toThrow(/image\/jpeg/);
  });

  it('memutus aliran yang melewati batas ukuran', async () => {
    const kelewat = Buffer.alloc(UKURAN_MAKSIMAL_BYTE + 1024);
    await expect(layanan.bacaBadan(aliran(kelewat))).rejects.toThrow(/melebihi/i);
  });

  it('meneruskan galat aliran, tidak menelannya', async () => {
    const rusak = new Readable({
      read() {
        this.destroy(new Error('sambungan terputus'));
      },
    }) as unknown as IncomingMessage;

    await expect(layanan.bacaBadan(rusak)).rejects.toThrow(/sambungan terputus/);
  });
});
