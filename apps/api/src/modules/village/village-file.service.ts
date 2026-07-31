/**
 * Foto bukti pengaduan.
 *
 * ## Urutan kerjanya ditetapkan dengan sengaja
 *
 * 1. Baca isi berkas dengan **batas byte yang tegas** — pemutusan terjadi saat
 *    batas terlampaui, bukan sesudah seluruhnya terbaca.
 * 2. Tentukan jenisnya dari **isi berkas**, bukan dari `Content-Type`.
 * 3. Buang metadata.
 * 4. **Periksa kembali** bahwa metadatanya benar-benar hilang.
 * 5. Baru simpan.
 *
 * Langkah keempat tampak berlebihan — kita sendiri yang menulis pembuangnya
 * pada langkah tiga. Ia tetap ada karena pembuang metadata bekerja terhadap
 * berkas yang bentuknya diperkirakan, dan berkas dari dunia nyata tidak selalu
 * berbentuk seperti yang diperkirakan. Bila kelak ada bentuk yang lolos,
 * unggahannya ditolak — bukan tersimpan diam-diam beserta koordinat rumah
 * pengunggahnya.
 *
 * ## Mengapa isi berkas dikirim sebagai badan permintaan mentah
 *
 * Unggahan multipart membutuhkan `multer`, yang tidak terjangkau dari
 * `apps/api`, dan menambahkannya menyentuh berkas kunci bersama yang sedang
 * dipakai sesi vertikal lain. Base64 di dalam JSON menaikkan ukuran kiriman
 * sepertiga dan memaksa seluruh isinya masuk ke memori sebelum dapat dinilai.
 *
 * Badan mentah tidak butuh keduanya: `Content-Type: image/jpeg`, isinya byte
 * apa adanya, dan alirannya dapat diputus tepat pada byte melewati batas.
 * Rinciannya pada `docs/integration-requests/village/006-file-storage.md`.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IncomingMessage } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { VillageUnitService } from './village-unit.service';
import { FILE_STORAGE_PORT, type FileStoragePort } from './ports/file-storage.port';
import {
  BERKAS_MAKSIMAL_PER_PENGADUAN,
  UKURAN_MAKSIMAL_BYTE,
  amankanNama,
  bolehLihatBukti,
  bolehTambahBerkas,
  buangMetadata,
  jenisSebenarnya,
  masihAdaMetadata,
  periksaBerkas,
  type JenisGambar,
  type PerannyaTerhadapBerkas,
} from './village-file';

interface BarisBerkas {
  id: string;
  storage_key: string;
  mime_type: string;
  original_name: string;
  size_bytes: number;
  uploaded_at: Date;
  uploaded_by: string | null;
  complaint_id: string;
  reporter_user_id: string | null;
  caption: string | null;
}

@Injectable()
export class VillageFileService {
  private readonly logger = new Logger(VillageFileService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
    @Inject(FILE_STORAGE_PORT) private readonly penyimpanan: FileStoragePort,
  ) {}

  // --- Membaca badan permintaan ---------------------------------------------

  /**
   * Membaca isi permintaan dengan batas byte yang ditegakkan **selama** aliran
   * berjalan.
   *
   * Yang membedakannya dari `body-parser` berbatas: di sini pemutusan terjadi
   * pada potongan yang melewati batas. Permintaan lima ratus megabita tidak
   * pernah sempat menempati memori peladen — ia ditolak pada megabita kesembilan.
   */
  async bacaBadan(req: IncomingMessage): Promise<Uint8Array> {
    const potongan: Buffer[] = [];
    let jumlah = 0;

    return new Promise<Uint8Array>((selesai, gagal) => {
      req.on('data', (c: Buffer) => {
        jumlah += c.length;
        if (jumlah > UKURAN_MAKSIMAL_BYTE) {
          // Aliran dihentikan sekarang juga; sisanya tidak dibaca.
          req.destroy();
          gagal(
            AppError.badRequest(
              ErrorCodes.VALIDATION_FAILED,
              `Ukuran foto melebihi ${Math.floor(UKURAN_MAKSIMAL_BYTE / 1024 / 1024)} MB. ` +
                'Kirim ulang dengan ukuran lebih kecil.',
            ),
          );
          return;
        }
        potongan.push(c);
      });
      req.on('end', () => selesai(Buffer.concat(potongan)));
      req.on('error', (e) => gagal(e));
    });
  }

  // --- Mengunggah ------------------------------------------------------------

  async unggahBuktiPengaduan(
    schemaName: string,
    complaintId: string,
    isi: Uint8Array,
    opsi: { namaAsli?: string; keterangan?: string; olehPetugas?: boolean },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');

    // 1. Pengaduannya ada, dan pemanggil memang berhak melekatinya.
    const peran = await this.peranTerhadapPengaduan(schemaName, complaintId, user, opsi.olehPetugas);
    const bolehLihat = bolehLihatBukti(peran);
    if (!bolehLihat.boleh) {
      throw AppError.forbidden(
        ErrorCodes.FORBIDDEN,
        'Foto hanya dapat dilampirkan pelapor sendiri atau petugas yang menangani.',
      );
    }

    // 2. Jenisnya ditentukan dari isi berkas. `Content-Type` yang dikirim
    //    peramban maupun ponsel tidak dipercaya sama sekali: ia disetel
    //    pengirim, dan pengirim adalah pihak yang sedang kita nilai.
    const jenis = jenisSebenarnya(isi);
    if (!jenis) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Berkas ini bukan foto JPG atau PNG. Kirim foto langsung dari galeri atau kamera.',
      );
    }

    const putusan = periksaBerkas({
      namaAsli: opsi.namaAsli ?? 'foto.jpg',
      mimeDilaporkan: jenis,
      ukuranByte: isi.length,
      awalan: isi.subarray(0, 8),
    });
    if (!putusan.boleh) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, putusan.alasan!);
    }

    // 3. Batas jumlah, dihitung dari basis data dan bukan dari yang dikirim klien.
    const cacah = await this.tenantDb.query<{ n: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS n FROM "${schemaName}".village_complaint_evidence
        WHERE complaint_id = $1 AND file_object_id IS NOT NULL`,
      [complaintId],
    );
    const tambah = bolehTambahBerkas(Number(cacah[0]?.n ?? 0));
    if (!tambah.boleh) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, tambah.alasan!);
    }

    // 4. Buang metadata, lalu periksa hasilnya.
    const ukuranAwal = isi.length;
    const bersih = buangMetadata(jenis, isi);
    if (!bersih) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Foto ini tidak dapat diproses. Coba kirim ulang, atau potret ulang dengan aplikasi kamera bawaan.',
      );
    }
    if (masihAdaMetadata(jenis, bersih)) {
      // Ditolak, bukan disimpan. Foto yang metadatanya bertahan membawa
      // koordinat tempat ia dipotret, dan tidak seorang pun akan menyadarinya
      // sebab ia tidak tampak di layar mana pun.
      this.logger.warn(
        `Metadata bertahan setelah pembersihan pada unggahan pengaduan ${complaintId}; unggahan ditolak.`,
      );
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Foto ini memuat data tambahan yang tidak dapat dibersihkan sistem, sehingga tidak disimpan. ' +
          'Silakan potret ulang lalu kirim kembali.',
      );
    }

    const namaAman = amankanNama(opsi.namaAsli ?? 'foto');
    const checksum = createHash('sha256').update(bersih).digest('hex');

    // 5. Baris dulu, isi kemudian, keduanya dalam satu transaksi. Bila
    //    penyimpanan gagal, transaksinya berguling balik dan tidak ada baris
    //    yang menunjuk berkas yang tidak pernah tertulis.
    // Pengenal dibuat di sini, bukan oleh basis data. Kunci penyimpanan
    // mengandung pengenal ini, dan `storage_key` bersifat unik — menyisipkan
    // nilai sementara lalu memperbaruinya akan bertabrakan begitu dua warga
    // mengunggah pada saat yang sama.
    const fileId = randomUUID();
    // Skema penyewa di depan membuat berkas dua desa tidak pernah berbagi
    // direktori; pengenal acak membuat kunci tidak dapat ditebak dari nomor tiket.
    const kunci = `${schemaName}/pengaduan/${complaintId}/${fileId}.${
      jenis === 'image/png' ? 'png' : 'jpg'
    }`;

    let kunciTersimpan: string | null = null;
    try {
      return await this.tenantDb.transaction(
        schemaName,
        async (client) => {
          await client.query(
            `INSERT INTO "${schemaName}".village_file_object
               (id, village_unit_id, storage_key, original_name, mime_type, size_bytes,
                checksum, metadata_stripped, original_size_bytes, subject_type, uploaded_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, 'PENGADUAN', $9)`,
            [
              fileId,
              u.id,
              kunci,
              namaAman,
              jenis,
              bersih.length,
              checksum,
              ukuranAwal,
              user.userId,
            ],
          );

          await client.query(
            `INSERT INTO "${schemaName}".village_complaint_evidence
               (complaint_id, file_object_id, caption, uploaded_by_officer)
             VALUES ($1, $2, $3, $4)`,
            [complaintId, fileId, opsi.keterangan?.trim() || null, peran === 'PETUGAS'],
          );

          await this.penyimpanan.simpan({ storageKey: kunci, data: bersih, mimeType: jenis });
          kunciTersimpan = kunci;

          return {
            id: fileId,
            mimeType: jenis,
            sizeBytes: bersih.length,
            originalSizeBytes: ukuranAwal,
            metadataStripped: true,
            note:
              ukuranAwal > bersih.length
                ? 'Foto tersimpan. Data lokasi dan informasi kamera pada foto sudah dihapus sebelum disimpan.'
                : 'Foto tersimpan.',
          };
        },
        { userId: user.userId, moduleCode: 'VILLAGE_COMPLAINT', actionCode: 'EVIDENCE' },
      );
    } catch (e) {
      // Transaksi berguling balik, tetapi berkasnya mungkin sudah tertulis bila
      // kegagalannya terjadi pada COMMIT. Bersihkan agar tidak ada isi tanpa
      // keterangan yang tertinggal di cakram.
      if (kunciTersimpan) {
        await this.penyimpanan.hapus(kunciTersimpan).catch(() => undefined);
      }
      throw e;
    }
  }

  // --- Membaca ---------------------------------------------------------------

  /** Daftar foto sebuah pengaduan — keterangannya saja, bukan isinya. */
  async daftarBukti(schemaName: string, complaintId: string, user: AuthenticatedUser) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');
    const peran = await this.peranTerhadapPengaduan(schemaName, complaintId, user);
    const v = bolehLihatBukti(peran);
    if (!v.boleh) throw AppError.forbidden(ErrorCodes.FORBIDDEN, v.alasan!);

    const rows = await this.tenantDb.query<{
      id: string;
      mime_type: string;
      size_bytes: number;
      uploaded_at: Date;
      caption: string | null;
      uploaded_by_officer: boolean;
    }>(
      schemaName,
      `SELECT f.id, f.mime_type, f.size_bytes, f.uploaded_at,
              e.caption, e.uploaded_by_officer
         FROM "${schemaName}".village_complaint_evidence e
         JOIN "${schemaName}".village_file_object f ON f.id = e.file_object_id
        WHERE e.complaint_id = $1
        ORDER BY f.uploaded_at ASC`,
      [complaintId],
    );

    // Tidak ada `storage_key` pada keluaran, dan tidak ada `original_name`.
    // Kunci penyimpanan adalah alamat isinya; nama asli berkas dari ponsel
    // kerap memuat tanggal dan nama pemiliknya. Keduanya tidak diperlukan
    // untuk menampilkan foto.
    return rows.map((r) => ({
      id: r.id,
      mimeType: r.mime_type,
      sizeBytes: r.size_bytes,
      caption: r.caption,
      uploadedAt: r.uploaded_at,
      uploadedByOfficer: r.uploaded_by_officer,
    }));
  }

  /** Isi berkas. Dipanggil hanya setelah hak aksesnya dinilai di sini. */
  async ambilIsi(schemaName: string, fileId: string, user: AuthenticatedUser) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');

    const rows = await this.tenantDb.query<BarisBerkas>(
      schemaName,
      `SELECT f.id, f.storage_key, f.mime_type, f.original_name, f.size_bytes,
              e.complaint_id, c.reporter_user_id
         FROM "${schemaName}".village_file_object f
         JOIN "${schemaName}".village_complaint_evidence e ON e.file_object_id = f.id
         JOIN "${schemaName}".village_complaint c ON c.id = e.complaint_id
        WHERE f.id = $1`,
      [fileId],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Foto tidak ditemukan.');
    }

    const b = rows[0];
    const peran = await this.peranTerhadapPengaduan(schemaName, b.complaint_id, user);
    const v = bolehLihatBukti(peran);
    if (!v.boleh) throw AppError.forbidden(ErrorCodes.FORBIDDEN, v.alasan!);

    const isi = await this.penyimpanan.ambil(b.storage_key);
    if (!isi) {
      // Baris ada, isinya tidak. Dinyatakan apa adanya: menyamarkannya sebagai
      // "tidak ditemukan" menyembunyikan kerusakan penyimpanan yang perlu
      // diketahui pengurus peladen.
      this.logger.error(`Isi berkas hilang dari penyimpanan: ${b.storage_key}`);
      throw AppError.notFound(
        ErrorCodes.NOT_FOUND,
        'Isi foto tidak dapat dibaca dari penyimpanan. Laporkan kepada pengelola sistem.',
      );
    }

    return {
      data: isi,
      mimeType: b.mime_type as JenisGambar,
      originalName: b.original_name,
      sizeBytes: b.size_bytes,
    };
  }

  // --- Menghapus -------------------------------------------------------------

  async hapusBukti(schemaName: string, fileId: string, user: AuthenticatedUser) {
    await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');

    const rows = await this.tenantDb.query<BarisBerkas>(
      schemaName,
      `SELECT f.id, f.storage_key, e.complaint_id
         FROM "${schemaName}".village_file_object f
         JOIN "${schemaName}".village_complaint_evidence e ON e.file_object_id = f.id
        WHERE f.id = $1`,
      [fileId],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Foto tidak ditemukan.');

    const b = rows[0];
    const peran = await this.peranTerhadapPengaduan(schemaName, b.complaint_id, user);
    if (peran === 'ORANG_LAIN') {
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Foto ini bukan milik Anda.');
    }

    await this.tenantDb.transaction(
      schemaName,
      async (client) => {
        // Bukti ikut terhapus lewat ON DELETE CASCADE pada tautan berkas.
        await client.query(`DELETE FROM "${schemaName}".village_file_object WHERE id = $1`, [
          fileId,
        ]);
      },
      { userId: user.userId, moduleCode: 'VILLAGE_COMPLAINT', actionCode: 'EVIDENCE' },
    );

    // Isi dihapus setelah barisnya hilang. Urutan sebaliknya menyisakan baris
    // yang menunjuk isi yang sudah tiada bila penghapusan barisnya gagal.
    await this.penyimpanan.hapus(b.storage_key).catch((e) => {
      this.logger.error(`Baris berkas ${fileId} terhapus, isinya gagal dihapus: ${e}`);
    });

    return { deleted: true };
  }

  // --- Siapa pemanggilnya terhadap pengaduan ini -----------------------------

  /**
   * Menentukan peran pemanggil: pelapornya sendiri, petugas, atau orang lain.
   *
   * Petugas dikenali dari hak akses rutenya (`olehPetugas`), yang sudah dinilai
   * penjaga rute sebelum sampai ke sini. Pelapor dikenali dari `reporter_user_id`
   * pada pengaduannya — bukan dari apa pun yang dikirim klien.
   */
  private async peranTerhadapPengaduan(
    schemaName: string,
    complaintId: string,
    user: AuthenticatedUser,
    olehPetugas = false,
  ): Promise<PerannyaTerhadapBerkas> {
    const rows = await this.tenantDb.query<{ reporter_user_id: string | null; status: string }>(
      schemaName,
      `SELECT reporter_user_id, status FROM "${schemaName}".village_complaint WHERE id = $1`,
      [complaintId],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pengaduan tidak ditemukan.');
    }
    if (olehPetugas) return 'PETUGAS';
    return rows[0].reporter_user_id === user.userId ? 'PELAPOR' : 'ORANG_LAIN';
  }

  /** Untuk pemeriksaan kesehatan. */
  async kesiapanPenyimpanan() {
    const s = await this.penyimpanan.siap();
    return {
      ...s,
      maxBytes: UKURAN_MAKSIMAL_BYTE,
      maxPerComplaint: BERKAS_MAKSIMAL_PER_PENGADUAN,
    };
  }
}
