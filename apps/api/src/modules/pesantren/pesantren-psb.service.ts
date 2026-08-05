/**
 * PSB/PPDB (EP-O2) — sisi basis datanya. Pola sama dengan
 * `pesantren-perizinan.service.ts` dan `pesantren-nilai.service.ts`.
 *
 * Alur pendaftar: TERDAFTAR -> VERIFIKASI -> DIJADWALKAN ->
 * (LULUS_SELEKSI | TIDAK_LULUS) -> DITERIMA -> DAFTAR_ULANG, dengan
 * DIBATALKAN dapat dicapai dari status non-final mana pun. Daftar ulang
 * TIDAK menulis pesantren_santri sendiri -- ia memanggil
 * `PesantrenSantriService.catat()` supaya validasi dan penanganan NIS
 * duplikat hanya ada di satu tempat (compute/tulis sekali, dipakai bersama).
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { PesantrenSantriService, BarisSantri, kolomOrangTua } from './pesantren-santri.service';
import {
  MasukanBiodataSendiri,
  MasukanGelombang,
  MasukanJadwal,
  MasukanPendaftar,
  HasilJadwal,
  bentukNomorPendaftaran,
  validasiBiodataSendiri,
  validasiGelombang,
  validasiHasilJadwal,
  validasiJadwal,
  validasiPendaftar,
} from './pesantren-psb';

export interface BarisGelombang {
  id: string;
  tahun_ajaran_id: string;
  unit_pendidikan_id: string | null;
  kode: string;
  nama: string;
  tanggal_buka: string;
  tanggal_tutup: string;
  kuota: number | null;
  biaya_pendaftaran: string;
  status: string;
  form_schema: unknown[];
  created_at: string;
}

const KOLOM_GELOMBANG = `id::text, tahun_ajaran_id::text, unit_pendidikan_id::text, kode, nama, tanggal_buka::text,
  tanggal_tutup::text, kuota, biaya_pendaftaran::text, status, form_schema, created_at::text`;

export interface BarisPendaftar {
  id: string;
  gelombang_id: string;
  nomor_pendaftaran: string;
  nama_lengkap: string;
  jenis_kelamin: string;
  tempat_lahir: string | null;
  tanggal_lahir: string | null;
  nama_orang_tua: string | null;
  no_hp_orang_tua: string | null;
  alamat: string | null;
  asal_sekolah: string | null;
  jalur_masuk: string | null;
  unit_pendidikan_tujuan_id: string | null;
  status: string;
  catatan_verifikasi: string | null;
  catatan_keputusan: string | null;
  santri_id: string | null;
  jawaban_tambahan: Record<string, unknown>;
  created_at: string;

  // -- Kelengkapan setara Dapodik (lihat migrasi 20260802T340000) ----------
  nik: string | null;
  nisn: string | null;
  nipd: string | null;
  agama: string | null;
  kewarganegaraan: string;
  kebutuhan_khusus: string;
  anak_ke: number | null;
  jumlah_saudara: number | null;
  alat_transportasi: string | null;
  jarak_tempat_tinggal_km: string | null;
  telepon: string | null;
  hp: string | null;
  email: string | null;
  penerima_kip: boolean;
  nomor_kip: string | null;
  penerima_kks: boolean;
  nomor_kks: string | null;
  nomor_kk: string | null;
  nama_ayah: string | null;
  nik_ayah: string | null;
  tahun_lahir_ayah: number | null;
  pendidikan_ayah: string | null;
  pekerjaan_ayah: string | null;
  penghasilan_ayah: string | null;
  nama_ibu: string | null;
  nik_ibu: string | null;
  tahun_lahir_ibu: number | null;
  pendidikan_ibu: string | null;
  pekerjaan_ibu: string | null;
  penghasilan_ibu: string | null;
  nama_wali: string | null;
  nik_wali: string | null;
  tahun_lahir_wali: number | null;
  pendidikan_wali: string | null;
  pekerjaan_wali: string | null;
  penghasilan_wali: string | null;
}

const KOLOM_PENDAFTAR = `id::text, gelombang_id::text, nomor_pendaftaran, nama_lengkap, jenis_kelamin,
  tempat_lahir, tanggal_lahir::text, nama_orang_tua, no_hp_orang_tua, alamat, asal_sekolah,
  jalur_masuk, unit_pendidikan_tujuan_id::text, status, catatan_verifikasi, catatan_keputusan, santri_id::text,
  jawaban_tambahan, created_at::text,
  nik, nisn, nipd, agama, kewarganegaraan, kebutuhan_khusus, anak_ke,
  jumlah_saudara, alat_transportasi, jarak_tempat_tinggal_km::text,
  telepon, hp, email, penerima_kip, nomor_kip, penerima_kks, nomor_kks,
  nomor_kk, nama_ayah, nik_ayah, tahun_lahir_ayah, pendidikan_ayah,
  pekerjaan_ayah, penghasilan_ayah, nama_ibu, nik_ibu, tahun_lahir_ibu,
  pendidikan_ibu, pekerjaan_ibu, penghasilan_ibu, nama_wali, nik_wali,
  tahun_lahir_wali, pendidikan_wali, pekerjaan_wali, penghasilan_wali`;

export interface BarisJadwal {
  id: string;
  pendaftar_id: string;
  jenis: string;
  tanggal: string;
  waktu_mulai: string | null;
  waktu_selesai: string | null;
  lokasi: string | null;
  penguji: string | null;
  status: string;
  nilai: string | null;
  catatan_hasil: string | null;
  created_at: string;
}

const KOLOM_JADWAL = `id::text, pendaftar_id::text, jenis, tanggal::text, waktu_mulai::text,
  waktu_selesai::text, lokasi, penguji, status, nilai::text, catatan_hasil, created_at::text`;

export interface BarisAgendaJadwal extends BarisJadwal {
  nomor_pendaftaran: string;
  nama_lengkap: string;
  status_pendaftar: string;
  gelombang_nama: string;
  unit_pendidikan_nama: string | null;
}

const KOLOM_AGENDA_JADWAL = `j.id::text, j.pendaftar_id::text, j.jenis, j.tanggal::text, j.waktu_mulai::text,
  j.waktu_selesai::text, j.lokasi, j.penguji, j.status, j.nilai::text, j.catatan_hasil, j.created_at::text,
  p.nomor_pendaftaran, p.nama_lengkap, p.status AS status_pendaftar, g.nama AS gelombang_nama,
  u.name AS unit_pendidikan_nama`;

@Injectable()
export class PesantrenPsbService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly santriService: PesantrenSantriService,
  ) {}

  // --- Gelombang -----------------------------------------------------------

  async daftarGelombang(
    schemaName: string,
    opsi: { status?: string; unitPendidikanId?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisGelombang[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }
    if (opsi.unitPendidikanId) {
      params.push(opsi.unitPendidikanId);
      kondisi.push(`unit_pendidikan_id = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_psb_gelombang WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisGelombang>(
      schemaName,
      `SELECT ${KOLOM_GELOMBANG} FROM ${S}.pesantren_psb_gelombang
        WHERE ${where}
        ORDER BY tanggal_buka DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satuGelombang(schemaName: string, id: string): Promise<BarisGelombang | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisGelombang>(
      schemaName,
      `SELECT ${KOLOM_GELOMBANG} FROM ${S}.pesantren_psb_gelombang WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  async catatGelombang(schemaName: string, masukan: MasukanGelombang, createdBy: string): Promise<BarisGelombang> {
    const galat = validasiGelombang(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const tahunAjaran = await this.tenantDb.queryOne<{ id: string }>(
      schemaName,
      `SELECT id FROM ${S}.pesantren_tahun_ajaran WHERE id = $1 AND deleted_at IS NULL`,
      [masukan.tahunAjaranId],
    );
    if (!tahunAjaran) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tahun ajaran tidak ditemukan.');
    }

    if (masukan.unitPendidikanId) {
      const unit = await this.tenantDb.queryOne<{ id: string }>(
        schemaName,
        `SELECT id FROM ${S}.pesantren_unit_pendidikan WHERE id = $1 AND deleted_at IS NULL`,
        [masukan.unitPendidikanId],
      );
      if (!unit) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tidak ditemukan.');
      }
    }

    try {
      const rows = await this.tenantDb.query<BarisGelombang>(
        schemaName,
        `INSERT INTO ${S}.pesantren_psb_gelombang
           (tahun_ajaran_id, unit_pendidikan_id, kode, nama, tanggal_buka, tanggal_tutup, kuota, biaya_pendaftaran, form_schema, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 0), COALESCE($9::jsonb, '[]'::jsonb), $10, $10)
         RETURNING ${KOLOM_GELOMBANG}`,
        [
          masukan.tahunAjaranId,
          masukan.unitPendidikanId || null,
          masukan.kode!.trim(),
          masukan.nama!.trim(),
          masukan.tanggalBuka,
          masukan.tanggalTutup,
          masukan.kuota ?? null,
          masukan.biayaPendaftaran ?? null,
          masukan.formSchema ? JSON.stringify(masukan.formSchema) : null,
          createdBy,
        ],
      );
      return rows[0];
    } catch (error) {
      if (isUniqueViolation(error, 'ux_pesantren_psb_gelombang_kode')) {
        throw AppError.conflict(
          ErrorCodes.CONFLICT,
          `Kode gelombang "${masukan.kode}" sudah dipakai pada tahun ajaran ini.`,
        );
      }
      throw error;
    }
  }

  private async ubahStatusGelombang(
    schemaName: string,
    id: string,
    dari: string[],
    ke: string,
    actorUserId: string,
  ): Promise<BarisGelombang> {
    const S = `"${schemaName}"`;
    const gelombang = await this.satuGelombang(schemaName, id);
    if (!gelombang) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gelombang tidak ditemukan.');
    }
    if (!dari.includes(gelombang.status)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Gelombang berstatus "${gelombang.status}" tidak dapat diubah ke "${ke}". Status saat ini harus salah satu dari: ${dari.join(', ')}.`,
      );
    }
    const rows = await this.tenantDb.query<BarisGelombang>(
      schemaName,
      `UPDATE ${S}.pesantren_psb_gelombang
          SET status = $2, updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_GELOMBANG}`,
      [id, ke, actorUserId],
    );
    return rows[0];
  }

  async bukaGelombang(schemaName: string, id: string, actorUserId: string): Promise<BarisGelombang> {
    return this.ubahStatusGelombang(schemaName, id, ['DRAFT'], 'DIBUKA', actorUserId);
  }

  async tutupGelombang(schemaName: string, id: string, actorUserId: string): Promise<BarisGelombang> {
    return this.ubahStatusGelombang(schemaName, id, ['DIBUKA'], 'DITUTUP', actorUserId);
  }

  async selesaikanGelombang(schemaName: string, id: string, actorUserId: string): Promise<BarisGelombang> {
    return this.ubahStatusGelombang(schemaName, id, ['DITUTUP'], 'SELESAI', actorUserId);
  }

  // --- Pendaftar -------------------------------------------------------------

  async daftarPendaftar(
    schemaName: string,
    opsi: { gelombangId?: string; status?: string; cari?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisPendaftar[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.gelombangId) {
      params.push(opsi.gelombangId);
      kondisi.push(`gelombang_id = $${params.length}`);
    }
    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`status = $${params.length}`);
    }
    if (opsi.cari) {
      params.push(`%${opsi.cari}%`);
      kondisi.push(`(nama_lengkap ILIKE $${params.length} OR nomor_pendaftaran ILIKE $${params.length})`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total FROM ${S}.pesantren_psb_pendaftar WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisPendaftar>(
      schemaName,
      `SELECT ${KOLOM_PENDAFTAR} FROM ${S}.pesantren_psb_pendaftar
        WHERE ${where}
        ORDER BY created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async satuPendaftar(schemaName: string, id: string): Promise<BarisPendaftar | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisPendaftar>(
      schemaName,
      `SELECT ${KOLOM_PENDAFTAR} FROM ${S}.pesantren_psb_pendaftar WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
  }

  /**
   * Lookup untuk portal pendaftar (`nomor_pendaftaran` sebagai "nama
   * pengguna") -- lihat `PesantrenPublicService.psbMasuk`. Berbeda dari
   * `satuPendaftar()` yang dicari lewat id internal.
   */
  async satuPendaftarByNomor(schemaName: string, nomorPendaftaran: string): Promise<BarisPendaftar | null> {
    const S = `"${schemaName}"`;
    return this.tenantDb.queryOne<BarisPendaftar>(
      schemaName,
      `SELECT ${KOLOM_PENDAFTAR} FROM ${S}.pesantren_psb_pendaftar WHERE nomor_pendaftaran = $1 AND deleted_at IS NULL`,
      [nomorPendaftaran],
    );
  }

  /**
   * Pendaftar mengubah biodatanya SENDIRI lewat portal PSB -- lihat
   * `MasukanBiodataSendiri` untuk kolom mana saja yang boleh disentuh jalur
   * ini. Tidak menerima `actorUserId` sama sekali (pendaftar bukan
   * `platform_user`, lihat `PsbApplicantAuthGuard`) -- `updated_by` sengaja
   * dibiarkan apa adanya, bukan diisi id pendaftar yang bukan UUID staf.
   */
  async perbaruiBiodataSendiri(
    schemaName: string,
    pendaftarId: string,
    masukan: MasukanBiodataSendiri,
  ): Promise<BarisPendaftar> {
    const galat = validasiBiodataSendiri(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    const pendaftar = await this.satuPendaftar(schemaName, pendaftarId);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    if (pendaftar.status === 'DIBATALKAN') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Pendaftaran ini sudah dibatalkan. Biodata tidak dapat diubah lagi -- hubungi pengurus pondok.',
      );
    }

    const S = `"${schemaName}"`;
    const ayah = masukan.ayah ?? {};
    const ibu = masukan.ibu ?? {};
    const wali = masukan.wali ?? {};
    const rows = await this.tenantDb.query<BarisPendaftar>(
      schemaName,
      `UPDATE ${S}.pesantren_psb_pendaftar
          SET alamat = $2, telepon = $3, hp = $4, email = $5,
              nama_orang_tua = $6, no_hp_orang_tua = $7,
              nama_ayah = $8, nik_ayah = $9, tahun_lahir_ayah = $10, pendidikan_ayah = $11, pekerjaan_ayah = $12, penghasilan_ayah = $13,
              nama_ibu = $14, nik_ibu = $15, tahun_lahir_ibu = $16, pendidikan_ibu = $17, pekerjaan_ibu = $18, penghasilan_ibu = $19,
              nama_wali = $20, nik_wali = $21, tahun_lahir_wali = $22, pendidikan_wali = $23, pekerjaan_wali = $24, penghasilan_wali = $25,
              updated_at = now(), version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_PENDAFTAR}`,
      [
        pendaftarId,
        bersihkan(masukan.alamat),
        bersihkan(masukan.telepon),
        bersihkan(masukan.hp),
        bersihkan(masukan.email),
        bersihkan(masukan.namaOrangTua),
        bersihkan(masukan.noHpOrangTua),
        ...kolomOrangTua(ayah),
        ...kolomOrangTua(ibu),
        ...kolomOrangTua(wali),
      ],
    );
    return rows[0];
  }

  /**
   * Mendaftarkan calon santri pada gelombang yang berstatus DIBUKA. Nomor
   * pendaftaran dibentuk atomik di dalam transaksi: `nomor_urut_terakhir`
   * milik gelombang dikunci dan dinaikkan lewat `UPDATE ... RETURNING`
   * sebelum baris pendaftar ditulis, supaya dua pendaftaran bersamaan tidak
   * pernah menerima nomor yang sama.
   */
  /**
   * `createdBy` boleh `null` -- pendaftaran lewat situs publik (calon
   * santri mendaftar sendiri, lihat `PesantrenPublicController.psbDaftar`)
   * tidak punya aktor staf sama sekali, berbeda dari pendaftaran yang
   * dicatat pengurus lewat panel admin.
   */
  async daftarkan(schemaName: string, masukan: MasukanPendaftar, createdBy: string | null): Promise<BarisPendaftar> {
    const galat = validasiPendaftar(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;
      const gelombangRows = await client.query<{
        id: string;
        status: string;
        kode: string;
        tahun_ajaran_code: string;
        unit_pendidikan_id: string | null;
      }>(
        `SELECT g.id::text, g.status, g.kode, t.code AS tahun_ajaran_code, g.unit_pendidikan_id::text
           FROM ${S}.pesantren_psb_gelombang g
           JOIN ${S}.pesantren_tahun_ajaran t ON t.id = g.tahun_ajaran_id
          WHERE g.id = $1 AND g.deleted_at IS NULL
          FOR UPDATE OF g`,
        [masukan.gelombangId],
      );
      const gelombang = gelombangRows.rows[0];
      if (!gelombang) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Gelombang tidak ditemukan.');
      }
      if (gelombang.status !== 'DIBUKA') {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Gelombang berstatus "${gelombang.status}" tidak menerima pendaftaran. Hanya gelombang DIBUKA yang menerima pendaftar baru.`,
        );
      }

      /*
       * Gelombang khusus satu unit MENIMPA pilihan pengunjung, bukan
       * sekadar menyarankan -- pendaftar yang mendaftar lewat gelombang
       * MI tidak boleh tercatat bertujuan BLK hanya karena formulirnya
       * (atau permintaan API yang dibuat manual) mengisi field itu berbeda.
       * Gelombang lintas-unit (unit_pendidikan_id NULL) tetap memakai
       * pilihan pengunjung apa adanya, seperti sebelumnya.
       */
      const unitPendidikanTujuanId = gelombang.unit_pendidikan_id ?? masukan.unitPendidikanTujuanId;

      if (unitPendidikanTujuanId) {
        const unit = await client.query(
          `SELECT id FROM ${S}.pesantren_unit_pendidikan WHERE id = $1 AND deleted_at IS NULL`,
          [unitPendidikanTujuanId],
        );
        if (!unit.rows[0]) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit pendidikan tujuan tidak ditemukan.');
        }
      }

      const urutRows = await client.query<{ nomor_urut_terakhir: number }>(
        `UPDATE ${S}.pesantren_psb_gelombang
            SET nomor_urut_terakhir = nomor_urut_terakhir + 1
          WHERE id = $1
          RETURNING nomor_urut_terakhir`,
        [gelombang.id],
      );
      const urutan = urutRows.rows[0].nomor_urut_terakhir;
      const nomorPendaftaran = bentukNomorPendaftaran(gelombang.tahun_ajaran_code, gelombang.kode, urutan);

      const ayah = masukan.ayah ?? {};
      const ibu = masukan.ibu ?? {};
      const wali = masukan.wali ?? {};
      const rows = await client.query<BarisPendaftar>(
        `INSERT INTO ${S}.pesantren_psb_pendaftar
           (gelombang_id, nomor_pendaftaran, nama_lengkap, jenis_kelamin, tempat_lahir, tanggal_lahir,
            nama_orang_tua, no_hp_orang_tua, alamat, asal_sekolah, jalur_masuk, unit_pendidikan_tujuan_id,
            nik, nisn, nipd, agama, kewarganegaraan, kebutuhan_khusus,
            anak_ke, jumlah_saudara, alat_transportasi, jarak_tempat_tinggal_km,
            telepon, hp, email, penerima_kip, nomor_kip, penerima_kks, nomor_kks,
            nomor_kk,
            nama_ayah, nik_ayah, tahun_lahir_ayah, pendidikan_ayah, pekerjaan_ayah, penghasilan_ayah,
            nama_ibu, nik_ibu, tahun_lahir_ibu, pendidikan_ibu, pekerjaan_ibu, penghasilan_ibu,
            nama_wali, nik_wali, tahun_lahir_wali, pendidikan_wali, pekerjaan_wali, penghasilan_wali,
            jawaban_tambahan, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
                 $13, $14, $15, $16, COALESCE($17, 'WNI'), COALESCE($18, 'TIDAK_ADA'),
                 $19, $20, $21, $22,
                 $23, $24, $25, COALESCE($26, FALSE), $27, COALESCE($28, FALSE), $29,
                 $30,
                 $31, $32, $33, $34, $35, $36,
                 $37, $38, $39, $40, $41, $42,
                 $43, $44, $45, $46, $47, $48,
                 COALESCE($49::jsonb, '{}'::jsonb), $50, $50)
         RETURNING ${KOLOM_PENDAFTAR}`,
        [
          gelombang.id,
          nomorPendaftaran,
          masukan.namaLengkap!.trim(),
          masukan.jenisKelamin,
          bersihkan(masukan.tempatLahir),
          masukan.tanggalLahir ? new Date(masukan.tanggalLahir) : null,
          bersihkan(masukan.namaOrangTua),
          bersihkan(masukan.noHpOrangTua),
          bersihkan(masukan.alamat),
          bersihkan(masukan.asalSekolah),
          bersihkan(masukan.jalurMasuk)?.toUpperCase() ?? null,
          unitPendidikanTujuanId || null,
          bersihkan(masukan.nik),
          bersihkan(masukan.nisn),
          bersihkan(masukan.nipd),
          bersihkan(masukan.agama),
          bersihkan(masukan.kewarganegaraan),
          bersihkan(masukan.kebutuhanKhusus)?.toUpperCase() ?? null,
          masukan.anakKe ?? null,
          masukan.jumlahSaudara ?? null,
          bersihkan(masukan.alatTransportasi),
          masukan.jarakTempatTinggalKm ?? null,
          bersihkan(masukan.telepon),
          bersihkan(masukan.hp),
          bersihkan(masukan.email),
          masukan.penerimaKip ?? false,
          bersihkan(masukan.nomorKip),
          masukan.penerimaKks ?? false,
          bersihkan(masukan.nomorKks),
          bersihkan(masukan.nomorKk),
          ...kolomOrangTua(ayah),
          ...kolomOrangTua(ibu),
          ...kolomOrangTua(wali),
          masukan.jawabanTambahan ? JSON.stringify(masukan.jawabanTambahan) : null,
          createdBy,
        ],
      );
      return rows.rows[0];
    });
  }

  async verifikasi(schemaName: string, id: string, catatan: string | undefined, actorUserId: string): Promise<BarisPendaftar> {
    return this.ubahStatusPendaftar(schemaName, id, ['TERDAFTAR'], 'VERIFIKASI', {
      catatan_verifikasi: bersihkan(catatan),
      diverifikasi_oleh: actorUserId,
      diverifikasi_pada: 'now()',
    });
  }

  async luluskan(schemaName: string, id: string, catatan: string | undefined, actorUserId: string): Promise<BarisPendaftar> {
    const pendaftar = await this.satuPendaftar(schemaName, id);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    if (pendaftar.status !== 'DIJADWALKAN') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Pendaftar berstatus "${pendaftar.status}" tidak dapat diluluskan. Status saat ini harus DIJADWALKAN.`,
      );
    }
    const S = `"${schemaName}"`;
    const selesai = await this.tenantDb.queryOne<{ jumlah: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS jumlah FROM ${S}.pesantren_psb_jadwal
        WHERE pendaftar_id = $1 AND status = 'SELESAI' AND deleted_at IS NULL`,
      [id],
    );
    if (Number(selesai?.jumlah ?? 0) < 1) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Pendaftar belum memiliki satu pun jadwal berstatus SELESAI. Catat hasil ujian/wawancara terlebih dahulu sebelum meluluskan.',
      );
    }
    return this.ubahStatusPendaftar(schemaName, id, ['DIJADWALKAN'], 'LULUS_SELEKSI', {
      catatan_keputusan: bersihkan(catatan),
      diputuskan_oleh: actorUserId,
      diputuskan_pada: 'now()',
    });
  }

  async tidakLuluskan(schemaName: string, id: string, catatan: string | undefined, actorUserId: string): Promise<BarisPendaftar> {
    return this.ubahStatusPendaftar(schemaName, id, ['DIJADWALKAN'], 'TIDAK_LULUS', {
      catatan_keputusan: bersihkan(catatan),
      diputuskan_oleh: actorUserId,
      diputuskan_pada: 'now()',
    });
  }

  /**
   * Menerima pendaftar yang sudah lulus seleksi. Menolak bila kuota
   * gelombang (jika diisi) sudah tercapai -- dihitung dari pendaftar
   * berstatus DITERIMA atau DAFTAR_ULANG pada gelombang yang sama, sebab
   * keduanya sama-sama "sudah mengisi kuota".
   */
  async terima(schemaName: string, id: string, catatan: string | undefined, actorUserId: string): Promise<BarisPendaftar> {
    const pendaftar = await this.satuPendaftar(schemaName, id);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    if (pendaftar.status !== 'LULUS_SELEKSI') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Pendaftar berstatus "${pendaftar.status}" tidak dapat diterima. Hanya pendaftar LULUS_SELEKSI yang dapat diterima.`,
      );
    }
    const gelombang = await this.satuGelombang(schemaName, pendaftar.gelombang_id);
    if (gelombang?.kuota != null) {
      const S = `"${schemaName}"`;
      const terisi = await this.tenantDb.queryOne<{ jumlah: string }>(
        schemaName,
        `SELECT COUNT(*)::text AS jumlah FROM ${S}.pesantren_psb_pendaftar
          WHERE gelombang_id = $1 AND status IN ('DITERIMA', 'DAFTAR_ULANG') AND deleted_at IS NULL`,
        [pendaftar.gelombang_id],
      );
      if (Number(terisi?.jumlah ?? 0) >= gelombang.kuota) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Kuota gelombang "${gelombang.nama}" (${gelombang.kuota}) sudah tercapai. Tidak dapat menerima pendaftar baru pada gelombang ini.`,
        );
      }
    }
    return this.ubahStatusPendaftar(schemaName, id, ['LULUS_SELEKSI'], 'DITERIMA', {
      catatan_keputusan: bersihkan(catatan),
      diputuskan_oleh: actorUserId,
      diputuskan_pada: 'now()',
    });
  }

  async batalkan(schemaName: string, id: string, catatan: string | undefined, actorUserId: string): Promise<BarisPendaftar> {
    const pendaftar = await this.satuPendaftar(schemaName, id);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    if (['DAFTAR_ULANG', 'DIBATALKAN'].includes(pendaftar.status)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Pendaftar berstatus "${pendaftar.status}" tidak dapat dibatalkan.`,
      );
    }
    return this.ubahStatusPendaftar(
      schemaName,
      id,
      STATUS_NON_FINAL_UNTUK_BATAL,
      'DIBATALKAN',
      { catatan_keputusan: bersihkan(catatan), diputuskan_oleh: actorUserId, diputuskan_pada: 'now()' },
    );
  }

  /**
   * Daftar ulang: membuat baris `pesantren_santri` lewat
   * `PesantrenSantriService.catat()` (bukan menulis tabel itu di sini
   * sendiri), menautkan `santri_id`, dan memindahkan status ke
   * DAFTAR_ULANG. NIS tetap dimasukkan manual oleh panitia -- pola yang
   * sama dengan `PesantrenSantriService`, yang juga tidak memiliki
   * penomoran NIS otomatis.
   */
  async daftarUlang(
    schemaName: string,
    id: string,
    masukan: { nis: string; statusTinggal: string; tanggalMasuk?: string | null },
    createdBy: string,
  ): Promise<{ pendaftar: BarisPendaftar; santri: BarisSantri }> {
    const pendaftar = await this.satuPendaftar(schemaName, id);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    if (pendaftar.status !== 'DITERIMA') {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Pendaftar berstatus "${pendaftar.status}" tidak dapat daftar ulang. Hanya pendaftar DITERIMA yang dapat daftar ulang.`,
      );
    }

    const santri = await this.santriService.catat(
      schemaName,
      {
        nis: masukan.nis,
        namaLengkap: pendaftar.nama_lengkap,
        jenisKelamin: pendaftar.jenis_kelamin,
        tempatLahir: pendaftar.tempat_lahir,
        tanggalLahir: pendaftar.tanggal_lahir,
        unitPendidikanId: pendaftar.unit_pendidikan_tujuan_id,
        statusTinggal: masukan.statusTinggal,
        tanggalMasuk: masukan.tanggalMasuk,
        alamatAsal: pendaftar.alamat,

        // -- Kelengkapan setara Dapodik, dibawa dari pendaftar apa adanya --
        // (sudah tervalidasi saat pendaftaran; `catat()` memvalidasi ulang).
        nik: pendaftar.nik,
        nisn: pendaftar.nisn,
        nipd: pendaftar.nipd,
        agama: pendaftar.agama,
        kewarganegaraan: pendaftar.kewarganegaraan,
        kebutuhanKhusus: pendaftar.kebutuhan_khusus,
        anakKe: pendaftar.anak_ke,
        jumlahSaudara: pendaftar.jumlah_saudara,
        alatTransportasi: pendaftar.alat_transportasi,
        jarakTempatTinggalKm: pendaftar.jarak_tempat_tinggal_km != null ? Number(pendaftar.jarak_tempat_tinggal_km) : null,
        telepon: pendaftar.telepon,
        hp: pendaftar.hp,
        email: pendaftar.email,
        penerimaKip: pendaftar.penerima_kip,
        nomorKip: pendaftar.nomor_kip,
        penerimaKks: pendaftar.penerima_kks,
        nomorKks: pendaftar.nomor_kks,
        nomorKk: pendaftar.nomor_kk,
        ayah: {
          nama: pendaftar.nama_ayah,
          nik: pendaftar.nik_ayah,
          tahunLahir: pendaftar.tahun_lahir_ayah,
          pendidikan: pendaftar.pendidikan_ayah,
          pekerjaan: pendaftar.pekerjaan_ayah,
          penghasilan: pendaftar.penghasilan_ayah,
        },
        ibu: {
          nama: pendaftar.nama_ibu,
          nik: pendaftar.nik_ibu,
          tahunLahir: pendaftar.tahun_lahir_ibu,
          pendidikan: pendaftar.pendidikan_ibu,
          pekerjaan: pendaftar.pekerjaan_ibu,
          penghasilan: pendaftar.penghasilan_ibu,
        },
        wali: {
          nama: pendaftar.nama_wali,
          nik: pendaftar.nik_wali,
          tahunLahir: pendaftar.tahun_lahir_wali,
          pendidikan: pendaftar.pendidikan_wali,
          pekerjaan: pendaftar.pekerjaan_wali,
          penghasilan: pendaftar.penghasilan_wali,
        },
      },
      createdBy,
    );

    const S = `"${schemaName}"`;
    const rows = await this.tenantDb.query<BarisPendaftar>(
      schemaName,
      `UPDATE ${S}.pesantren_psb_pendaftar
          SET status = 'DAFTAR_ULANG', santri_id = $2, updated_at = now(), updated_by = $3, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_PENDAFTAR}`,
      [id, santri.id, createdBy],
    );
    return { pendaftar: rows[0], santri };
  }

  private async ubahStatusPendaftar(
    schemaName: string,
    id: string,
    dari: string[],
    ke: string,
    kolomTambahan: Record<string, string | null>,
  ): Promise<BarisPendaftar> {
    const S = `"${schemaName}"`;
    const pendaftar = await this.satuPendaftar(schemaName, id);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    if (!dari.includes(pendaftar.status)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Pendaftar berstatus "${pendaftar.status}" tidak dapat diubah ke "${ke}". Status saat ini harus salah satu dari: ${dari.join(', ')}.`,
      );
    }

    const kolom = Object.keys(kolomTambahan);
    const set = kolom.map((k, i) => `${k} = ${kolomTambahan[k] === 'now()' ? 'now()' : `$${i + 3}`}`);
    const nilai = kolom.filter((k) => kolomTambahan[k] !== 'now()').map((k) => kolomTambahan[k]);

    const rows = await this.tenantDb.query<BarisPendaftar>(
      schemaName,
      `UPDATE ${S}.pesantren_psb_pendaftar
          SET status = $2, ${set.join(', ')}, updated_at = now(), version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_PENDAFTAR}`,
      [id, ke, ...nilai],
    );
    return rows[0];
  }

  // --- Jadwal ------------------------------------------------------------

  async daftarAgendaJadwal(
    schemaName: string,
    opsi: { tanggal?: string; jenis?: string; status?: string; halaman: number; ukuranHalaman: number },
  ): Promise<{ items: BarisAgendaJadwal[]; total: number }> {
    const S = `"${schemaName}"`;
    const kondisi: string[] = ['j.deleted_at IS NULL', 'p.deleted_at IS NULL'];
    const params: unknown[] = [];

    if (opsi.tanggal) {
      params.push(opsi.tanggal);
      kondisi.push(`j.tanggal = $${params.length}`);
    }
    if (opsi.jenis) {
      params.push(opsi.jenis);
      kondisi.push(`j.jenis = $${params.length}`);
    }
    if (opsi.status) {
      params.push(opsi.status);
      kondisi.push(`j.status = $${params.length}`);
    }

    const where = kondisi.join(' AND ');
    const totalRows = await this.tenantDb.query<{ total: string }>(
      schemaName,
      `SELECT COUNT(*)::text AS total
         FROM ${S}.pesantren_psb_jadwal j
         JOIN ${S}.pesantren_psb_pendaftar p ON p.id = j.pendaftar_id
        WHERE ${where}`,
      params,
    );

    const offset = (opsi.halaman - 1) * opsi.ukuranHalaman;
    params.push(opsi.ukuranHalaman, offset);
    const items = await this.tenantDb.query<BarisAgendaJadwal>(
      schemaName,
      `SELECT ${KOLOM_AGENDA_JADWAL}
         FROM ${S}.pesantren_psb_jadwal j
         JOIN ${S}.pesantren_psb_pendaftar p ON p.id = j.pendaftar_id
         JOIN ${S}.pesantren_psb_gelombang g ON g.id = p.gelombang_id
         LEFT JOIN ${S}.pesantren_unit_pendidikan u ON u.id = p.unit_pendidikan_tujuan_id
        WHERE ${where}
        ORDER BY j.tanggal ASC, j.waktu_mulai ASC NULLS LAST, p.nama_lengkap ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    return { items, total: Number(totalRows[0]?.total ?? 0) };
  }

  async daftarJadwal(schemaName: string, pendaftarId: string): Promise<BarisJadwal[]> {
    const S = `"${schemaName}"`;
    return this.tenantDb.query<BarisJadwal>(
      schemaName,
      `SELECT ${KOLOM_JADWAL} FROM ${S}.pesantren_psb_jadwal
        WHERE pendaftar_id = $1 AND deleted_at IS NULL
        ORDER BY tanggal ASC, waktu_mulai ASC NULLS LAST`,
      [pendaftarId],
    );
  }

  /**
   * Menjadwalkan ujian/wawancara. Menaikkan status pendaftar ke DIJADWALKAN
   * bila sebelumnya masih VERIFIKASI -- boleh dipanggil berulang (banyak
   * jadwal per pendaftar) tanpa menolak jadwal kedua dan seterusnya.
   */
  async jadwalkan(schemaName: string, masukan: MasukanJadwal, createdBy: string): Promise<BarisJadwal> {
    const galat = validasiJadwal(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const pendaftar = await this.satuPendaftar(schemaName, masukan.pendaftarId!);
    if (!pendaftar) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pendaftar tidak ditemukan.');
    }
    if (!['VERIFIKASI', 'DIJADWALKAN'].includes(pendaftar.status)) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `Pendaftar berstatus "${pendaftar.status}" tidak dapat dijadwalkan. Verifikasi pendaftar terlebih dahulu.`,
      );
    }

    return this.tenantDb.transaction(schemaName, async (client) => {
      const S = `"${schemaName}"`;
      const rows = await client.query<BarisJadwal>(
        `INSERT INTO ${S}.pesantren_psb_jadwal
           (pendaftar_id, jenis, tanggal, waktu_mulai, waktu_selesai, lokasi, penguji, created_by, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
         RETURNING ${KOLOM_JADWAL}`,
        [
          masukan.pendaftarId,
          masukan.jenis,
          masukan.tanggal,
          masukan.waktuMulai || null,
          masukan.waktuSelesai || null,
          bersihkan(masukan.lokasi),
          bersihkan(masukan.penguji),
          createdBy,
        ],
      );

      if (pendaftar.status === 'VERIFIKASI') {
        await client.query(
          `UPDATE ${S}.pesantren_psb_pendaftar
              SET status = 'DIJADWALKAN', updated_at = now(), updated_by = $2, version = version + 1
            WHERE id = $1`,
          [masukan.pendaftarId, createdBy],
        );
      }

      return rows.rows[0];
    });
  }

  async catatHasilJadwal(schemaName: string, jadwalId: string, masukan: HasilJadwal, actorUserId: string): Promise<BarisJadwal> {
    const galat = validasiHasilJadwal(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const jadwal = await this.tenantDb.queryOne<BarisJadwal>(
      schemaName,
      `SELECT ${KOLOM_JADWAL} FROM ${S}.pesantren_psb_jadwal WHERE id = $1 AND deleted_at IS NULL`,
      [jadwalId],
    );
    if (!jadwal) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Jadwal tidak ditemukan.');
    }
    const rows = await this.tenantDb.query<BarisJadwal>(
      schemaName,
      `UPDATE ${S}.pesantren_psb_jadwal
          SET status = $2, nilai = $3, catatan_hasil = $4, updated_at = now(), updated_by = $5, version = version + 1
        WHERE id = $1
        RETURNING ${KOLOM_JADWAL}`,
      [jadwalId, masukan.status, masukan.nilai ?? null, bersihkan(masukan.catatanHasil), actorUserId],
    );
    return rows[0];
  }
}

const STATUS_NON_FINAL_UNTUK_BATAL = ['TERDAFTAR', 'VERIFIKASI', 'DIJADWALKAN', 'LULUS_SELEKSI', 'DITERIMA'];

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}

/** Kode error PostgreSQL 23505 = unique_violation. */
function isUniqueViolation(error: unknown, constraintName: string): boolean {
  const e = error as { code?: string; constraint?: string } | null;
  return e?.code === '23505' && e?.constraint === constraintName;
}
