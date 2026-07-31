/**
 * `FileStoragePort` — tempat isi berkas benar-benar disimpan.
 *
 * ## Mengapa foto tidak disimpan di dalam basis data
 *
 * Foto delapan megabita yang duduk sebagai `bytea` ikut tersalin setiap kali
 * basis data dicadangkan, ikut terkirim setiap kali direplikasi, dan ikut
 * terbaca setiap kali seseorang menjalankan `SELECT *` tanpa menyebut kolom.
 * Basis data menyimpan **keterangan** berkasnya; isinya disimpan di luar.
 *
 * ## Mengapa ini port, bukan pemanggilan langsung ke sistem berkas
 *
 * Pemasangan di kantor desa memakai satu peladen dengan cakramnya sendiri.
 * Pemasangan terpusat memakai penyimpanan objek. Keduanya sudah dapat
 * diperkirakan sekarang, dan yang membedakan keduanya hanya adapter.
 *
 * ## Yang sengaja TIDAK ada pada antarmuka ini
 *
 * Tidak ada `urlPublik()`. Foto pengaduan memperlihatkan rumah, wajah, dan
 * pelat nomor orang; tautan yang dapat dibuka siapa saja yang memegangnya
 * membuat seluruh pemeriksaan hak akses menjadi tidak berarti — cukup satu
 * tautan tersalin ke grup percakapan, dan foto itu keluar dari sistem.
 *
 * Isinya dibaca lewat `ambil()`, yang hanya dapat dipanggil kode yang sudah
 * melewati pemeriksaan hak akses. Antarmuka yang tidak punya metodenya tidak
 * dapat dipaksa menyediakannya.
 */

export interface SimpanBerkasInput {
  /**
   * Kunci penyimpanan. Wajib sudah berawalan skema penyewa; adapter
   * memeriksanya kembali, sebab pemanggil yang keliru satu kali saja membuat
   * berkas dua desa duduk pada direktori yang sama.
   */
  storageKey: string;
  data: Uint8Array;
  mimeType: string;
}

export interface FileStoragePort {
  simpan(input: SimpanBerkasInput): Promise<void>;
  ambil(storageKey: string): Promise<Uint8Array | null>;
  hapus(storageKey: string): Promise<void>;
  /** Untuk pemeriksaan kesehatan: apakah tempat simpannya benar-benar dapat ditulisi. */
  siap(): Promise<{ tersedia: boolean; keterangan: string }>;
}

export const FILE_STORAGE_PORT = Symbol('FILE_STORAGE_PORT');
