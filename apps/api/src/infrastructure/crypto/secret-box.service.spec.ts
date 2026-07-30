import { ConfigService } from '@nestjs/config';
import { SecretBoxService } from './secret-box.service';

const KEY_A = 'a'.repeat(48);
const KEY_B = 'b'.repeat(48);

function build(keys: string, activeKeyId: string): SecretBoxService {
  const config = {
    get: (path: string, fallback?: unknown) =>
      path === 'credential.encryptionKeys'
        ? keys
        : path === 'credential.activeKeyId'
          ? activeKeyId
          : fallback,
  } as unknown as ConfigService;
  const service = new SecretBoxService(config);
  service.onModuleInit();
  return service;
}

describe('SecretBoxService', () => {
  describe('konfigurasi', () => {
    it('tidak aktif bila kunci belum diset', () => {
      const service = build('', '');
      expect(service.isConfigured).toBe(false);
      expect(() => service.seal('rahasia')).toThrow(/belum dikonfigurasi/);
    });

    it('menolak bahan kunci yang terlalu pendek', () => {
      expect(() => build('k1:pendek', 'k1')).toThrow(/terlalu pendek/);
    });

    it('menolak entri tanpa pemisah id', () => {
      expect(() => build(KEY_A, 'k1')).toThrow(/tidak valid/);
    });

    it('menolak id kunci ganda', () => {
      expect(() => build(`k1:${KEY_A},k1:${KEY_B}`, 'k1')).toThrow(/ganda/);
    });

    it('menolak kunci aktif yang tidak ada', () => {
      expect(() => build(`k1:${KEY_A}`, 'k9')).toThrow(/tidak ada/);
    });

    it('menolak bila kunci aktif tidak disebut', () => {
      expect(() => build(`k1:${KEY_A}`, '')).toThrow(/ACTIVE_KEY/);
    });
  });

  describe('menyandi dan membuka', () => {
    const service = build(`k1:${KEY_A}`, 'k1');

    it('mengembalikan nilai asli', () => {
      // Nilai uji sengaja TIDAK meniru format vendor mana pun. Fixture yang
      // menyerupai kunci asli membuat pemindai rahasia menandai berkas test,
      // dan menonaktifkan aturannya akan melemahkan pemeriksaan yang berguna.
      const secret = 'nilai-uji-abcdef123456';
      expect(service.open(service.seal(secret).ciphertext)).toBe(secret);
    });

    it('menghasilkan ciphertext berbeda untuk nilai yang sama', () => {
      // IV acak per operasi. Tanpa ini, dua seller dengan credential yang sama
      // akan terlihat sama pada basis data.
      const a = service.seal('rahasia-sama').ciphertext;
      const b = service.seal('rahasia-sama').ciphertext;
      expect(a).not.toBe(b);
      expect(service.open(a)).toBe(service.open(b));
    });

    it('tidak memuat nilai asli pada ciphertext', () => {
      const secret = 'nilai-yang-sangat-rahasia';
      expect(service.seal(secret).ciphertext).not.toContain(secret);
    });

    it('menangani unicode dan nilai panjang', () => {
      const secret = 'ünïcödé-🔐-' + 'x'.repeat(2000);
      expect(service.open(service.seal(secret).ciphertext)).toBe(secret);
    });

    it('menolak nilai kosong', () => {
      // Rahasia kosong membuat akun tampak terkonfigurasi padahal tidak.
      expect(() => service.seal('')).toThrow(/tidak boleh kosong/);
    });

    it('mencantumkan id kunci pada hasil', () => {
      expect(service.seal('abc12345').keyId).toBe('k1');
    });
  });

  describe('petunjuk yang ditampilkan', () => {
    const service = build(`k1:${KEY_A}`, 'k1');

    it('hanya menampilkan empat karakter terakhir', () => {
      expect(service.seal('nilai-uji-abcd7c41').hint).toBe('••••7c41');
    });

    it('tidak memberi petunjuk pada nilai pendek', () => {
      // Menampilkan tiga dari empat karakter bukan penyamaran, melainkan kebocoran.
      expect(service.seal('abc123').hint).toBe('••••');
    });
  });

  describe('deteksi perubahan', () => {
    const service = build(`k1:${KEY_A}`, 'k1');

    it('menolak ciphertext yang diubah', () => {
      const sealed = service.seal('rahasia').ciphertext;
      const parts = sealed.split('.');
      const data = Buffer.from(parts[4], 'base64');
      data[0] ^= 0xff;
      parts[4] = data.toString('base64');
      expect(() => service.open(parts.join('.'))).toThrow(/data berubah atau kunci salah/);
    });

    it('menolak tag autentikasi yang diubah', () => {
      const parts = service.seal('rahasia').ciphertext.split('.');
      const tag = Buffer.from(parts[3], 'base64');
      tag[0] ^= 0xff;
      parts[3] = tag.toString('base64');
      expect(() => service.open(parts.join('.'))).toThrow(/data berubah atau kunci salah/);
    });

    it('menolak format yang tidak dikenal', () => {
      expect(() => service.open('bukan-ciphertext')).toThrow(/Format rahasia tidak dikenal/);
    });

    it('menolak versi yang tidak didukung', () => {
      const parts = service.seal('rahasia').ciphertext.split('.');
      parts[0] = 'v99';
      expect(() => service.open(parts.join('.'))).toThrow(/Versi rahasia tidak didukung/);
    });
  });

  describe('rotasi kunci', () => {
    it('membuka data lama setelah kunci aktif berganti', () => {
      const before = build(`k1:${KEY_A}`, 'k1');
      const sealed = before.seal('rahasia-lama').ciphertext;

      // Kunci lama tetap dipasang; hanya kunci aktifnya yang berganti.
      const after = build(`k1:${KEY_A},k2:${KEY_B}`, 'k2');
      expect(after.open(sealed)).toBe('rahasia-lama');
      expect(after.seal('rahasia-baru').keyId).toBe('k2');
    });

    it('menandai data yang masih memakai kunci lama', () => {
      const before = build(`k1:${KEY_A}`, 'k1');
      const sealed = before.seal('rahasia-lama').ciphertext;
      const after = build(`k1:${KEY_A},k2:${KEY_B}`, 'k2');
      expect(after.needsRotation(sealed)).toBe(true);
      expect(after.needsRotation(after.seal('baru').ciphertext)).toBe(false);
    });

    it('menyebut id kunci yang hilang agar dapat dikembalikan', () => {
      const before = build(`k1:${KEY_A}`, 'k1');
      const sealed = before.seal('rahasia').ciphertext;
      const after = build(`k2:${KEY_B}`, 'k2');
      expect(() => after.open(sealed)).toThrow(/Kunci "k1" tidak tersedia/);
    });

    it('tidak dapat dibuka kunci lain walau panjangnya sama', () => {
      const a = build(`k1:${KEY_A}`, 'k1');
      const sealed = a.seal('rahasia').ciphertext;
      // Kunci berbeda dipasang dengan id yang sama: pembukaan harus gagal,
      // bukan menghasilkan sampah.
      const b = build(`k1:${KEY_B}`, 'k1');
      expect(() => b.open(sealed)).toThrow(/data berubah atau kunci salah/);
    });
  });

  describe('turunan kunci', () => {
    it('memakai id sebagai salt sehingga bahan sama menghasilkan kunci berbeda', () => {
      const a = build(`k1:${KEY_A}`, 'k1');
      const sealed = a.seal('rahasia').ciphertext.replace(/^v1\.k1\./, 'v1.k2.');
      const b = build(`k2:${KEY_A}`, 'k2');
      expect(() => b.open(sealed)).toThrow(/data berubah atau kunci salah/);
    });
  });

  describe('perbandingan aman', () => {
    it('benar untuk nilai identik', () => {
      expect(SecretBoxService.equals('rahasia', 'rahasia')).toBe(true);
    });

    it('salah untuk nilai berbeda', () => {
      expect(SecretBoxService.equals('rahasia', 'rahasib')).toBe(false);
    });

    it('salah untuk panjang berbeda tanpa melempar', () => {
      expect(SecretBoxService.equals('a', 'panjang-sekali')).toBe(false);
    });
  });
});
