/**
 * Adapter penyimpanan berkas pada cakram peladen.
 *
 * Dipakai pemasangan satu-peladen di kantor desa. Pemasangan terpusat kelak
 * mengganti adapter ini dengan penyimpanan objek tanpa menyentuh layanan.
 *
 * ## Kunci penyimpanan diperiksa dua kali, dengan cara yang berbeda
 *
 * Kunci berasal dari kode kita sendiri, bukan dari permintaan — tetapi
 * pemeriksaannya tetap dilakukan di sini, sebab "berasal dari kode kita" adalah
 * keadaan hari ini, bukan jaminan. Pemeriksaannya:
 *
 * 1. Daftar izin bentuk: hanya huruf, angka, garis bawah, tanda hubung, titik
 *    tunggal, dan garis miring pemisah.
 * 2. Sesudah `resolve`, hasilnya wajib masih berada di dalam direktori dasar.
 *
 * Yang kedua menangkap apa yang lolos dari yang pertama. `a/./b` lolos daftar
 * izin dan tidak berbahaya; simpul yang ditautkan (symlink) tidak terlihat pada
 * teks kunci sama sekali, dan hanya tertangkap setelah jalurnya diselesaikan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { mkdir, readFile, rm, writeFile, access, realpath } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import type { FileStoragePort, SimpanBerkasInput } from './file-storage.port';

/**
 * Bentuk kunci yang diizinkan.
 *
 * Tidak ada `..` sebagai ruas tersendiri, tidak ada garis miring balik, tidak
 * ada titik dua — yang terakhir penting pada Windows, tempat `C:nama` menunjuk
 * direktori kerja pemacu C dan bukan berkas bernama `C:nama`.
 */
const BENTUK_KUNCI = /^[A-Za-z0-9_][A-Za-z0-9_.-]*(\/[A-Za-z0-9_][A-Za-z0-9_.-]*)*$/;

@Injectable()
export class LocalFileStorageAdapter implements FileStoragePort {
  private readonly logger = new Logger(LocalFileStorageAdapter.name);
  private readonly akar: string;

  constructor() {
    // Dibaca langsung, bukan lewat berkas konfigurasi bersama: village memiliki
    // infrastrukturnya sendiri di tempat infrastruktur Core belum ada, sama
    // seperti WorkflowPort pada D-4 dan resolver situs publik pada D-10.
    this.akar = resolve(process.env.VILLAGE_FILE_DIR ?? join(process.cwd(), 'storage', 'village'));
  }

  private jalur(storageKey: string): string {
    if (!BENTUK_KUNCI.test(storageKey)) {
      throw new Error(`Kunci penyimpanan tidak berbentuk sah: ${storageKey}`);
    }
    const penuh = resolve(this.akar, storageKey);
    // Pemeriksaan kedua. `startsWith(akar)` saja tidak cukup: direktori
    // `/data/village-lama` berawalan sama dengan `/data/village`.
    if (penuh !== this.akar && !penuh.startsWith(this.akar + sep)) {
      throw new Error('Kunci penyimpanan keluar dari direktori dasar.');
    }
    return penuh;
  }

  async simpan(input: SimpanBerkasInput): Promise<void> {
    const penuh = this.jalur(input.storageKey);
    await mkdir(dirname(penuh), { recursive: true });

    // `wx` — gagal bila berkasnya sudah ada. Kunci penyimpanan mengandung UUID,
    // sehingga tabrakan berarti ada yang keliru; menimpanya diam-diam akan
    // mengganti foto bukti sebuah pengaduan dengan foto pengaduan lain.
    await writeFile(penuh, input.data, { flag: 'wx', mode: 0o640 });

    // Setelah tertulis, jalur nyatanya diperiksa: berkas yang ditulis melalui
    // direktori yang ditautkan ke luar akan berakhir di luar direktori dasar,
    // dan itu baru terlihat sekarang.
    try {
      const nyata = await realpath(penuh);
      if (nyata !== this.akar && !nyata.startsWith(this.akar + sep)) {
        await rm(penuh, { force: true });
        throw new Error('Jalur nyata berkas berada di luar direktori dasar.');
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Jalur nyata')) throw e;
      // realpath gagal karena sebab lain (misalnya sistem berkas tanpa dukungan
      // symlink) tidak membatalkan penyimpanan; pemeriksaan bentuk sudah lewat.
      this.logger.debug(`realpath tidak dapat diperiksa untuk ${input.storageKey}`);
    }
  }

  async ambil(storageKey: string): Promise<Uint8Array | null> {
    const penuh = this.jalur(storageKey);
    try {
      return await readFile(penuh);
    } catch (e) {
      if ((e as NodeJS.ErrnoException)?.code === 'ENOENT') return null;
      throw e;
    }
  }

  async hapus(storageKey: string): Promise<void> {
    await rm(this.jalur(storageKey), { force: true });
  }

  async siap(): Promise<{ tersedia: boolean; keterangan: string }> {
    try {
      await mkdir(this.akar, { recursive: true });
      await access(this.akar, constants.W_OK);
      return { tersedia: true, keterangan: `Penyimpanan berkas siap pada ${this.akar}.` };
    } catch (e) {
      // Jujur, bukan diam. Penyimpanan yang tidak dapat ditulisi membuat unggah
      // foto gagal satu per satu tanpa ada yang tahu sebabnya.
      return {
        tersedia: false,
        keterangan: `Direktori penyimpanan tidak dapat ditulisi (${this.akar}): ${
          e instanceof Error ? e.message : 'sebab tidak diketahui'
        }. Setel VILLAGE_FILE_DIR.`,
      };
    }
  }
}
