import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Penyimpanan rahasia terenkripsi untuk credential provider pembayaran.
 *
 * Sampai Versi 8, satu-satunya rahasia yang dipakai sistem adalah milik platform
 * dan disimpan sebagai nama env var (`PaymentProvider.secretReference`). Pola itu
 * baik dan tetap dipakai untuk akun platform, tetapi tidak dapat menampung
 * marketplace: satu credential per seller berarti menambah env var setiap kali
 * tenant mendaftar, dan itu menuntut akses ke sistem operasi server pada setiap
 * pendaftaran.
 *
 * Maka credential tenant disimpan terenkripsi di basis data. Yang tetap dipegang:
 *
 *   kunci berasal dari environment, tidak pernah dari basis data
 *   satu kunci per environment, dengan id agar dapat dirotasi
 *   nilai tidak pernah dikembalikan utuh setelah disimpan
 *   setiap pembacaan tercatat pada audit
 *
 * Algoritma: AES-256-GCM. GCM dipilih karena ia sekaligus membuktikan ciphertext
 * tidak diubah — tanpa itu, penyerang dengan akses tulis ke basis data dapat
 * mengganti credential seller lain tanpa terdeteksi sampai pembayaran gagal.
 */

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const VERSION = 'v1';

/** Panjang minimum kunci mentah sebelum diturunkan. */
const MIN_KEY_MATERIAL = 32;

export interface SealedSecret {
  /** Ciphertext yang aman disimpan; memuat versi, id kunci, IV, dan tag. */
  ciphertext: string;
  /** Id kunci yang dipakai, agar rotasi dapat mengenali data lama. */
  keyId: string;
  /** Empat karakter terakhir nilai asli, untuk ditampilkan tanpa membuka. */
  hint: string;
}

@Injectable()
export class SecretBoxService implements OnModuleInit {
  private readonly logger = new Logger(SecretBoxService.name);
  private keys = new Map<string, Buffer>();
  private activeKeyId: string | null = null;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    this.loadKeys();
  }

  /** Benar bila enkripsi credential dapat dipakai. */
  get isConfigured(): boolean {
    return this.activeKeyId !== null;
  }

  get keyIds(): string[] {
    return [...this.keys.keys()];
  }

  /**
   * Menyandikan satu nilai rahasia.
   *
   * Menolak nilai kosong: menyimpan rahasia kosong berarti akun tampak
   * terkonfigurasi padahal tidak, dan kegagalannya baru terlihat saat pembayaran
   * pertama.
   */
  seal(plaintext: string): SealedSecret {
    this.assertConfigured();
    const value = plaintext ?? '';
    if (value.length === 0) {
      throw new Error('Nilai rahasia tidak boleh kosong.');
    }

    const keyId = this.activeKeyId!;
    const key = this.keys.get(keyId)!;
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      ciphertext: [
        VERSION,
        keyId,
        iv.toString('base64'),
        tag.toString('base64'),
        encrypted.toString('base64'),
      ].join('.'),
      keyId,
      hint: hintOf(value),
    };
  }

  /**
   * Membuka nilai rahasia.
   *
   * Dipakai hanya oleh resolver credential saat memanggil provider. Tidak
   * dipakai UI, tidak dipakai API, dan tidak pernah masuk log — pemanggilnya
   * bertanggung jawab mencatat pembukaan pada audit.
   */
  open(ciphertext: string): string {
    this.assertConfigured();
    const parts = ciphertext.split('.');
    if (parts.length !== 5) {
      throw new Error('Format rahasia tidak dikenal.');
    }
    const [version, keyId, ivB64, tagB64, dataB64] = parts;
    if (version !== VERSION) {
      throw new Error(`Versi rahasia tidak didukung: ${version}.`);
    }

    const key = this.keys.get(keyId);
    if (!key) {
      // Kunci yang hilang berarti data tidak dapat dibuka lagi. Pesannya menyebut
      // id kunci supaya operator dapat mengembalikannya, bukan sekadar "gagal".
      throw new Error(
        `Kunci "${keyId}" tidak tersedia pada environment ini. ` +
          'Kembalikan kunci tersebut atau rotasi ulang credential yang memakainya.',
      );
    }

    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    try {
      return Buffer.concat([
        decipher.update(Buffer.from(dataB64, 'base64')),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Kegagalan tag berarti ciphertext atau kunci berubah. Tidak dibedakan,
      // karena membedakannya memberi tahu penyerang mana yang ia tebak benar.
      throw new Error('Rahasia tidak dapat dibuka: data berubah atau kunci salah.');
    }
  }

  /** Benar bila `ciphertext` memakai kunci yang bukan kunci aktif. */
  needsRotation(ciphertext: string): boolean {
    const keyId = ciphertext.split('.')[1];
    return Boolean(this.activeKeyId) && keyId !== this.activeKeyId;
  }

  /**
   * Membandingkan dua nilai tanpa membocorkan panjang kecocokan lewat waktu.
   * Dipakai saat memverifikasi credential yang dimasukkan ulang.
   */
  static equals(a: string, b: string): boolean {
    const bufA = Buffer.from(a, 'utf8');
    const bufB = Buffer.from(b, 'utf8');
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  }

  private assertConfigured(): void {
    if (!this.activeKeyId) {
      throw new Error(
        'Enkripsi credential belum dikonfigurasi. Setel CREDENTIAL_ENCRYPTION_KEYS ' +
          'dan CREDENTIAL_ENCRYPTION_ACTIVE_KEY pada environment.',
      );
    }
  }

  /**
   * Memuat kunci dari environment.
   *
   * Format `CREDENTIAL_ENCRYPTION_KEYS`: `id1:bahan1,id2:bahan2`.
   * Bahan kunci diturunkan lewat HKDF, sehingga bahan yang panjangnya berbeda
   * tetap menghasilkan kunci 32 byte dan bahan yang sama tidak dipakai langsung
   * sebagai kunci.
   */
  private loadKeys(): void {
    const raw = this.config.get<string>('credential.encryptionKeys', '');
    const activeId = this.config.get<string>('credential.activeKeyId', '');

    if (!raw) {
      // Bukan error saat menyala: sebagian besar environment pengembangan tidak
      // memakai credential tenant. Yang error adalah memakainya tanpa kunci.
      this.logger.warn(
        'CREDENTIAL_ENCRYPTION_KEYS belum diset. Fitur credential provider tenant tidak aktif.',
      );
      return;
    }

    for (const entry of raw.split(',')) {
      const separator = entry.indexOf(':');
      if (separator <= 0) {
        throw new Error(`Entri kunci tidak valid: harapkan "id:bahan", diterima "${entry}".`);
      }
      const id = entry.slice(0, separator).trim();
      const material = entry.slice(separator + 1).trim();
      if (!/^[a-z0-9_-]{1,32}$/i.test(id)) {
        throw new Error(`Id kunci tidak valid: "${id}".`);
      }
      if (material.length < MIN_KEY_MATERIAL) {
        throw new Error(
          `Bahan kunci "${id}" terlalu pendek: ${material.length} karakter, minimum ${MIN_KEY_MATERIAL}.`,
        );
      }
      if (this.keys.has(id)) {
        throw new Error(`Id kunci ganda: "${id}".`);
      }
      this.keys.set(id, deriveKey(material, id));
    }

    if (!activeId) {
      throw new Error('CREDENTIAL_ENCRYPTION_ACTIVE_KEY belum diset.');
    }
    if (!this.keys.has(activeId)) {
      throw new Error(`Kunci aktif "${activeId}" tidak ada pada CREDENTIAL_ENCRYPTION_KEYS.`);
    }

    this.activeKeyId = activeId;
    this.logger.log(
      `Enkripsi credential siap. Kunci: ${this.keyIds.join(', ')}; aktif: ${activeId}.`,
    );
  }
}

/**
 * Menurunkan kunci 32 byte dari bahan mentah.
 *
 * Id kunci ikut menjadi salt, sehingga dua kunci dengan bahan yang tidak sengaja
 * sama tetap menghasilkan kunci berbeda.
 */
function deriveKey(material: string, keyId: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', Buffer.from(material, 'utf8'), Buffer.from(`ebisnis:${keyId}`), Buffer.from('credential-encryption'), KEY_LENGTH),
  );
}

/**
 * Petunjuk yang aman ditampilkan: empat karakter terakhir.
 *
 * Nilai yang terlalu pendek tidak diberi petunjuk sama sekali — menampilkan tiga
 * dari empat karakter rahasia bukan penyamaran, melainkan kebocoran.
 */
function hintOf(value: string): string {
  return value.length >= 8 ? `••••${value.slice(-4)}` : '••••';
}

export { TAG_LENGTH, IV_LENGTH };
