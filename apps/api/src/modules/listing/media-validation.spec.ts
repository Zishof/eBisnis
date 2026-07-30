import {
  MAX_FILE_BYTES,
  MAX_PIXELS,
  probeImage,
  validateImage,
} from './media-validation';

// --- Pembentuk berkas uji --------------------------------------------------

function png(width: number, height: number, extraBytes = 0): Buffer {
  const head = Buffer.alloc(24 + extraBytes);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(head, 0);
  head.writeUInt32BE(13, 8);
  head.write('IHDR', 12, 'ascii');
  head.writeUInt32BE(width, 16);
  head.writeUInt32BE(height, 20);
  return head;
}

function gif(width: number, height: number): Buffer {
  const buf = Buffer.alloc(20);
  buf.write('GIF89a', 0, 'ascii');
  buf.writeUInt16LE(width, 6);
  buf.writeUInt16LE(height, 8);
  return buf;
}

function webpLossy(width: number, height: number): Buffer {
  const buf = Buffer.alloc(40);
  buf.write('RIFF', 0, 'ascii');
  buf.write('WEBP', 8, 'ascii');
  buf.write('VP8 ', 12, 'ascii');
  buf.writeUInt16LE(width & 0x3fff, 26);
  buf.writeUInt16LE(height & 0x3fff, 28);
  return buf;
}

function jpeg(width: number, height: number): Buffer {
  const buf = Buffer.alloc(24);
  buf[0] = 0xff;
  buf[1] = 0xd8; // SOI
  buf[2] = 0xff;
  buf[3] = 0xc0; // SOF0
  buf.writeUInt16BE(17, 4); // panjang segmen
  buf[6] = 8; // presisi
  buf.writeUInt16BE(height, 7);
  buf.writeUInt16BE(width, 9);
  return buf;
}

describe('probeImage', () => {
  it('mengenali PNG beserta dimensinya', () => {
    expect(probeImage(png(1200, 900))).toMatchObject({ format: 'PNG', width: 1200, height: 900 });
  });

  it('mengenali GIF beserta dimensinya', () => {
    expect(probeImage(gif(800, 600))).toMatchObject({ format: 'GIF', width: 800, height: 600 });
  });

  it('mengenali WebP lossy beserta dimensinya', () => {
    expect(probeImage(webpLossy(1024, 768))).toMatchObject({
      format: 'WEBP',
      width: 1024,
      height: 768,
    });
  });

  it('mengenali JPEG beserta dimensinya', () => {
    expect(probeImage(jpeg(1600, 1200))).toMatchObject({
      format: 'JPEG',
      width: 1600,
      height: 1200,
    });
  });

  describe('bukan gambar', () => {
    it('menolak skrip PHP', () => {
      expect(probeImage(Buffer.from('<?php system($_GET["c"]); ?>'))).toBeNull();
    });

    it('menolak SVG', () => {
      // SVG sengaja tidak diterima: ia dokumen XML yang dapat memuat skrip, dan
      // menyanitasinya dengan benar jauh lebih sulit daripada menolaknya.
      expect(probeImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>'))).toBeNull();
    });

    it('menolak HTML', () => {
      expect(probeImage(Buffer.from('<!DOCTYPE html><html><body>x</body></html>'))).toBeNull();
    });

    it('menolak berkas kosong', () => {
      expect(probeImage(Buffer.alloc(0))).toBeNull();
    });

    it('menolak header yang terpotong', () => {
      expect(probeImage(png(100, 100).subarray(0, 12))).toBeNull();
    });
  });
});

describe('validateImage', () => {
  describe('yang diterima', () => {
    it('menerima PNG berukuran wajar', () => {
      const result = validateImage(png(1200, 1200), 'produk.png');
      expect(result.ok).toBe(true);
      expect(result.probe).toMatchObject({ format: 'PNG', mimeType: 'image/png' });
    });

    it('menerima .jpg maupun .jpeg untuk JPEG', () => {
      expect(validateImage(jpeg(800, 800), 'a.jpg').ok).toBe(true);
      expect(validateImage(jpeg(800, 800), 'a.jpeg').ok).toBe(true);
    });

    it('tidak peduli huruf besar pada ekstensi', () => {
      expect(validateImage(png(800, 800), 'PRODUK.PNG').ok).toBe(true);
    });
  });

  describe('tipe ditentukan dari isi, bukan ekstensi', () => {
    it('menolak skrip PHP berekstensi .jpg', () => {
      // Ini yang menutup R17: berkas berisi kode yang dieksekusi, disamarkan
      // sebagai gambar lewat ekstensinya.
      const result = validateImage(Buffer.from('<?php system($_GET["c"]); ?>'), 'gambar.jpg');
      expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_FORMAT' });
    });

    it('menolak SVG berekstensi .png', () => {
      const result = validateImage(
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
        'gambar.png',
      );
      expect(result).toMatchObject({ ok: false, code: 'UNKNOWN_FORMAT' });
    });

    it('menolak PNG yang diberi ekstensi .jpg', () => {
      const result = validateImage(png(800, 800), 'gambar.jpg');
      expect(result).toMatchObject({ ok: false, code: 'EXTENSION_MISMATCH' });
      expect(result.message).toMatch(/isinya PNG/);
    });

    it('menolak ekstensi yang tidak diterima sama sekali', () => {
      const diterima = ['a.svg', 'a.php', 'a.html', 'a.exe', 'a'].filter(
        (name) => validateImage(png(800, 800), name).ok,
      );
      expect(diterima).toEqual([]);
    });
  });

  describe('bom dekompresi', () => {
    it('menolak PNG yang menyatakan dimensi raksasa', () => {
      // Ini yang menutup R18. Berkas hanya 24 byte, tetapi menyatakan dimensi
      // yang bila didekode menuntut belasan gigabyte memori. Dimensi dibaca
      // dari header, dan berkasnya ditolak sebelum satu piksel pun dibentuk.
      const bom = png(60000, 60000);
      expect(bom.length).toBeLessThan(100);
      const result = validateImage(bom, 'bom.png');
      expect(result.ok).toBe(false);
      expect(['DIMENSION_TOO_LARGE', 'PIXEL_BUDGET_EXCEEDED']).toContain(result.code);
    });

    it('menolak yang melewati batas total piksel walau tiap sisi masih wajar', () => {
      // 7000 × 7000 = 49 juta piksel: tiap sisi di bawah batas, totalnya tidak.
      const result = validateImage(png(7000, 7000), 'besar.png');
      expect(result).toMatchObject({ ok: false, code: 'PIXEL_BUDGET_EXCEEDED' });
      expect(7000 * 7000).toBeGreaterThan(MAX_PIXELS);
    });

    it('menolak dimensi yang melebihi batas per sisi', () => {
      const result = validateImage(png(9000, 600), 'panjang.png');
      expect(result.ok).toBe(false);
    });
  });

  describe('batas lain', () => {
    it('menolak berkas kosong', () => {
      expect(validateImage(Buffer.alloc(0), 'a.png')).toMatchObject({ ok: false, code: 'EMPTY' });
    });

    it('menolak berkas melebihi batas ukuran', () => {
      const besar = png(1000, 1000, MAX_FILE_BYTES);
      const result = validateImage(besar, 'a.png');
      expect(result).toMatchObject({ ok: false, code: 'TOO_LARGE' });
      expect(result.message).toMatch(/MB/);
    });

    it('menolak gambar terlalu kecil untuk ditampilkan', () => {
      expect(validateImage(png(200, 200), 'kecil.png')).toMatchObject({
        ok: false,
        code: 'DIMENSION_TOO_SMALL',
      });
    });

    it('menolak perbandingan sisi yang ekstrem', () => {
      // 4000 × 500 = 8:1. Gambar produk dengan bentuk seperti ini hampir selalu
      // spanduk, bukan foto barang.
      expect(validateImage(png(4000, 500), 'spanduk.png')).toMatchObject({
        ok: false,
        code: 'ASPECT_RATIO_EXTREME',
      });
    });
  });

  describe('pesan penolakan', () => {
    it('menyebut apa yang harus diperbaiki', () => {
      expect(validateImage(png(200, 200), 'a.png').message).toMatch(/Minimum 500×500/);
      expect(validateImage(png(800, 800), 'a.jpg').message).toMatch(/isinya PNG/);
      expect(validateImage(Buffer.from('bukan gambar'), 'a.png').message).toMatch(/bukan gambar/);
    });
  });
});
