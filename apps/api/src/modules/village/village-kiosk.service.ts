/**
 * Anjungan Mandiri Desa.
 *
 * Delapan fungsi, seluruhnya dari presentasi: cetak surat mandiri, cek status,
 * ambil antrean, ajukan surat, pengumuman dan info bantuan, lapor, buku tamu,
 * dan absensi ronda.
 *
 * ## Tidak satu pun metode di berkas ini menerima nama atau NIK untuk dicari
 *
 * Yang membuka berkas hanyalah **kode ambil**. Anjungan adalah layar sentuh di
 * ruang tunggu kantor desa; yang dapat mencari berdasarkan nama bukan anjungan
 * layanan melainkan terminal kependudukan yang diletakkan di ruang publik.
 *
 * Nama pemohon pun tidak ditampilkan kembali di layar. Warga yang memasukkan
 * kode ambil sudah tahu namanya sendiri; yang mengantre di belakangnya tidak
 * perlu ikut tahu.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import { layak, type KodeFitur } from './village-profile';
import {
  HURUF_KODE,
  KUNCI_MENIT,
  MENU_ANJUNGAN,
  PANDUAN,
  PANJANG_KODE,
  PERCOBAAN_MAKSIMAL,
  bersihkanKode,
  bolehCetakMandiri,
  bolehIsiBukuTamu,
  bolehMencoba,
  formatKode,
  panduan,
  periksaBentukKode,
  pesanGagal,
  proyeksikanAnjungan,
  type KeperluanTamu,
} from './village-kiosk';

/** Label status yang dapat dibaca warga, bukan kode dalam huruf besar. */
const LABEL_STATUS: Record<string, string> = {
  DRAF: 'Belum diajukan',
  DIAJUKAN: 'Sudah diajukan, menunggu diperiksa',
  BERKAS_KURANG: 'Berkas belum lengkap — silakan ke loket',
  DIVERIFIKASI: 'Berkas sudah diperiksa',
  MENUNGGU_PERSETUJUAN: 'Menunggu tanda tangan pejabat',
  DISETUJUI: 'Sudah disetujui, surat sedang disiapkan',
  DITOLAK: 'Tidak dapat diproses — silakan ke loket',
  DITERBITKAN: 'Sudah terbit — dapat dicetak di sini',
  DISERAHKAN: 'Sudah diserahkan',
  DIBATALKAN: 'Dibatalkan',
};

@Injectable()
export class VillageKioskService {
  private readonly logger = new Logger(VillageKioskService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  // --- Layar utama ----------------------------------------------------------

  /** Menu yang tampil pada anjungan, sudah disaring kelayakan profil. */
  async menu(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const sakelar = { aktif: new Set(u.enabledFeatures) };

    return {
      unitName: u.name,
      profileType: u.profileType,
      greeting: `Selamat datang di ${u.profileType === 'DESA' ? 'Desa' : 'Kelurahan'} ${u.name}`,
      menu: MENU_ANJUNGAN.filter((m) => {
        if (!m.fitur) return true;
        return layak(m.fitur as KodeFitur, u.profileType, sakelar).layak;
      }).map((m) => ({
        code: m.kode,
        label: m.label,
        description: m.keterangan,
        icon: m.ikon,
        needsClaimCode: m.perluKode,
      })),
    };
  }

  /** Panduan langkah demi langkah. */
  panduan(kode?: string) {
    if (!kode) return PANDUAN;
    const p = panduan(kode);
    if (!p) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Panduan tidak ditemukan.');
    return p;
  }

  // --- Kode ambil -----------------------------------------------------------

  /**
   * Menerbitkan kode ambil untuk sebuah permohonan.
   *
   * Dipanggil saat permohonan diajukan — dari loket, dari mobile, atau dari
   * anjungan itu sendiri. Kode dibuat dengan `randomInt` dari `node:crypto`,
   * bukan `Math.random`: kode yang dapat ditebak dari waktu penerbitannya bukan
   * kode.
   */
  async terbitkanKode(
    schemaName: string,
    input: { serviceRequestId?: string; complaintId?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.unit(schemaName);
    const jenis = input.serviceRequestId ? 'PERMOHONAN' : 'PENGADUAN';
    if (!input.serviceRequestId && !input.complaintId) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Kode ambil harus menunjuk satu permohonan atau satu pengaduan.',
      );
    }

    // Sampai sepuluh kali; tabrakan pada ruang 31^8 sangat jarang, tetapi
    // "sangat jarang" pada sepuluh ribu desa berarti tetap terjadi.
    for (let percobaan = 0; percobaan < 10; percobaan += 1) {
      const kode = this.buatKode();
      try {
        const rows = await this.tenantDb.query<{ id: string }>(
          schemaName,
          `INSERT INTO "${schemaName}".village_kiosk_claim
             (village_unit_id, claim_code, subject_type, service_request_id, complaint_id,
              expires_at, created_by)
           VALUES ($1,$2,$3,$4,$5, now() + interval '180 days', $6) RETURNING id`,
          [
            u.id,
            kode,
            jenis,
            input.serviceRequestId ?? null,
            input.complaintId ?? null,
            user.userId,
          ],
        );
        return { id: rows[0].id, claimCode: kode, display: formatKode(kode) };
      } catch (e) {
        if ((e as { code?: string })?.code !== '23505') throw e;
        // Bentrok kode: coba lagi. Bentrok berkas: hentikan, sebab berkas ini
        // sudah punya kode yang berlaku.
        const pesan = String((e as { detail?: string })?.detail ?? '');
        if (pesan.includes('service_request_id') || pesan.includes('complaint_id')) {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            'Berkas ini sudah memiliki kode ambil yang berlaku. Cabut yang lama bila hilang.',
          );
        }
      }
    }
    throw AppError.internal(ErrorCodes.INTERNAL_ERROR, 'Gagal membuat kode ambil yang unik.');
  }

  private buatKode(): string {
    let k = '';
    for (let i = 0; i < PANJANG_KODE; i += 1) k += HURUF_KODE[randomInt(HURUF_KODE.length)];
    return k;
  }

  /**
   * Membuka berkas dari kode ambil.
   *
   * Seluruh pembatasan percobaan terjadi di sini, di dalam satu transaksi
   * dengan penguncian baris. Dua anjungan yang mencoba kode yang sama
   * bersamaan tidak boleh sama-sama memperoleh percobaan penuh.
   */
  private async bukaKode(
    client: PoolClient,
    schemaName: string,
    unitId: string,
    masukan: string,
  ) {
    const bentuk = periksaBentukKode(masukan);
    if (!bentuk.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, bentuk.alasan!);
    const kode = bersihkanKode(masukan);

    const rows = await client.query<Record<string, string | number | null>>(
      `SELECT id, subject_type, service_request_id, complaint_id, failed_attempts,
              locked_until, expires_at, revoked_at, kiosk_print_count
         FROM "${schemaName}".village_kiosk_claim
        WHERE village_unit_id = $1 AND claim_code = $2
        FOR UPDATE`,
      [unitId, kode],
    );

    if (!rows.rows.length) {
      // Kode yang tidak ada tetap memakan waktu yang sama dan menghasilkan
      // pesan yang sama seperti kode yang ada tetapi salah. Membedakannya
      // memberi tahu penebak bahwa tebakannya sudah mendekati.
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, pesanGagal(PERCOBAAN_MAKSIMAL - 1));
    }

    const c = rows.rows[0];
    const sekarang = new Date().toISOString();

    if (c.revoked_at) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Kode ini sudah tidak berlaku. Mintakan kode baru kepada petugas loket.',
      );
    }
    if (c.expires_at && String(c.expires_at) < sekarang) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Kode ini sudah kedaluwarsa. Mintakan kode baru kepada petugas loket.',
      );
    }

    const izin = bolehMencoba(
      {
        percobaanGagal: Number(c.failed_attempts),
        terkunciSampai: c.locked_until ? String(c.locked_until) : null,
      },
      sekarang,
    );
    if (!izin.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, izin.alasan!);

    await client.query(
      `UPDATE "${schemaName}".village_kiosk_claim
          SET failed_attempts = 0, locked_until = NULL, last_used_at = now(),
              version = version + 1
        WHERE id = $1`,
      [c.id],
    );

    return {
      id: String(c.id),
      subjectType: String(c.subject_type),
      serviceRequestId: c.service_request_id ? String(c.service_request_id) : null,
      complaintId: c.complaint_id ? String(c.complaint_id) : null,
      printCount: Number(c.kiosk_print_count),
    };
  }

  /** Mencatat percobaan yang gagal, dan mengunci bila sudah habis. */
  private async catatGagal(schemaName: string, unitId: string, masukan: string) {
    const kode = bersihkanKode(masukan);
    if (kode.length !== PANJANG_KODE) return;
    await this.tenantDb.query(
      schemaName,
      `UPDATE "${schemaName}".village_kiosk_claim
          SET failed_attempts = failed_attempts + 1,
              locked_until = CASE
                WHEN failed_attempts + 1 >= $3 THEN now() + ($4 || ' minutes')::interval
                ELSE locked_until END,
              version = version + 1
        WHERE village_unit_id = $1 AND claim_code = $2 AND revoked_at IS NULL`,
      [unitId, kode, PERCOBAAN_MAKSIMAL, String(KUNCI_MENIT)],
    );
  }

  // --- 1. Cek status pengajuan ----------------------------------------------

  /**
   * Memeriksa status pengajuan dari kode ambil.
   *
   * Yang dikembalikan sudah melewati proyeksi anjungan: nomor permohonan, jenis
   * layanan, status, dan perkiraan selesainya. **Bukan** nama, bukan NIK, bukan
   * alamat.
   */
  async cekStatus(schemaName: string, claimCode: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'LAYANAN.PERMOHONAN');

    return this.tenantDb
      .transaction(schemaName, async (client) => {
        const c = await this.bukaKode(client, schemaName, u.id, claimCode);
        if (c.subjectType !== 'PERMOHONAN') {
          throw AppError.badRequest(
            ErrorCodes.VALIDATION_FAILED,
            'Kode ini untuk pengaduan, bukan permohonan surat. Pilih menu Lapor untuk memeriksanya.',
          );
        }

        const r = await client.query<Record<string, string | null>>(
          `SELECT r.request_number AS "requestNumber", k.name AS "serviceName", r.status,
                  r.submitted_at AS "submittedAt", r.due_date AS "dueDate"
             FROM "${schemaName}".village_service_request r
             JOIN "${schemaName}".village_service_catalog k ON k.id = r.service_catalog_id
            WHERE r.id = $1`,
          [c.serviceRequestId],
        );
        if (!r.rows.length) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas permohonan tidak ditemukan.');
        }

        const status = String(r.rows[0].status);
        const baris = {
          ...r.rows[0],
          statusLabel: LABEL_STATUS[status] ?? status,
        };
        return {
          ...proyeksikanAnjungan('PERMOHONAN', baris),
          canPrintHere:
            status === 'DITERBITKAN' || status === 'DISERAHKAN' ? c.printCount < 3 : false,
        };
      })
      .catch(async (e) => {
        if (e instanceof AppError && e.errorCode === ErrorCodes.VALIDATION_FAILED) {
          await this.catatGagal(schemaName, u.id, claimCode);
        }
        throw e;
      });
  }

  // --- 2. Cetak surat mandiri -----------------------------------------------

  /**
   * Menyiapkan surat untuk dicetak di anjungan.
   *
   * Menaikkan penghitung cetak **sebelum** mengembalikan isinya, di dalam
   * transaksi yang sama. Menaikkannya sesudah berarti anjungan yang mati listrik
   * di tengah pencetakan tidak menghitungnya — dan orang yang tahu itu dapat
   * mencetak berapa pun yang ia mau.
   */
  async cetakSurat(schemaName: string, claimCode: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'LAYANAN.PERMOHONAN');

    return this.tenantDb
      .transaction(schemaName, async (client) => {
        const c = await this.bukaKode(client, schemaName, u.id, claimCode);
        if (c.subjectType !== 'PERMOHONAN') {
          throw AppError.badRequest(
            ErrorCodes.VALIDATION_FAILED,
            'Kode ini bukan untuk permohonan surat.',
          );
        }

        const r = await client.query<Record<string, string | boolean | null>>(
          `SELECT r.status, r.request_number,
                  l.id AS letter_id, l.letter_number, l.letter_date, l.subject, l.body,
                  l.signed_position, l.verification_token, l.is_revoked
             FROM "${schemaName}".village_service_request r
        LEFT JOIN "${schemaName}".village_letter l ON l.service_request_id = r.id
            WHERE r.id = $1`,
          [c.serviceRequestId],
        );
        if (!r.rows.length) {
          throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Berkas permohonan tidak ditemukan.');
        }
        const row = r.rows[0];

        const v = bolehCetakMandiri({
          status: String(row.status),
          adaSurat: Boolean(row.letter_id),
          suratDicabut: Boolean(row.is_revoked),
          sudahDicetak: c.printCount,
        });
        if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

        await client.query(
          `UPDATE "${schemaName}".village_kiosk_claim
              SET kiosk_print_count = kiosk_print_count + 1, last_used_at = now(),
                  version = version + 1
            WHERE id = $1`,
          [c.id],
        );
        await client.query(
          `UPDATE "${schemaName}".village_letter
              SET print_count = print_count + 1, last_printed_at = now()
            WHERE id = $1`,
          [row.letter_id],
        );

        this.logger.log(`Surat ${row.letter_number} dicetak dari anjungan pada ${schemaName}`);
        return {
          letterNumber: row.letter_number,
          letterDate: row.letter_date,
          subject: row.subject,
          body: row.body,
          signedPosition: row.signed_position,
          verificationToken: row.verification_token,
          printsRemaining: 3 - (c.printCount + 1),
        };
      })
      .catch(async (e) => {
        if (e instanceof AppError && e.errorCode === ErrorCodes.VALIDATION_FAILED) {
          await this.catatGagal(schemaName, u.id, claimCode);
        }
        throw e;
      });
  }

  // --- 3. Antrean -----------------------------------------------------------

  /** Daftar layanan yang dapat diambil antreannya. */
  async layananTersedia(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'LAYANAN.KATALOG');
    return this.tenantDb.query(
      schemaName,
      `SELECT id, code, name FROM "${schemaName}".village_service_catalog
        WHERE village_unit_id = $1 AND is_active = TRUE AND deleted_at IS NULL
        ORDER BY name`,
      [u.id],
    );
  }

  async ambilAntrean(schemaName: string, serviceCatalogId?: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'LAYANAN.ANTREAN');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const urut = await client.query<{ n: string }>(
        `SELECT COALESCE(MAX(sequence_no), 0)::text AS n
           FROM "${schemaName}".village_queue_ticket
          WHERE village_unit_id = $1 AND queue_date = CURRENT_DATE
          FOR UPDATE`,
        [u.id],
      );
      const nomor = Number(urut.rows[0].n) + 1;
      const nomorTiket = `A${String(nomor).padStart(3, '0')}`;

      const t = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_queue_ticket
           (village_unit_id, ticket_number, sequence_no) VALUES ($1,$2,$3) RETURNING id`,
        [u.id, nomorTiket, nomor],
      );

      const menunggu = await client.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM "${schemaName}".village_queue_ticket
          WHERE village_unit_id = $1 AND queue_date = CURRENT_DATE
            AND status = 'MENUNGGU' AND sequence_no < $2`,
        [u.id, nomor],
      );

      const antre = Number(menunggu.rows[0].n);
      return proyeksikanAnjungan('ANTREAN', {
        ticketNumber: nomorTiket,
        status: 'MENUNGGU',
        aheadCount: antre,
        // Perkiraan kasar, dan disebut perkiraan. Angka yang tampak pasti lalu
        // meleset membuat orang berhenti mempercayai layarnya.
        estimatedWaitMinutes: antre * 5,
        counterName: null,
        serviceCatalogId,
        id: t.rows[0].id,
      });
    });
  }

  // --- 4. Ajukan surat ------------------------------------------------------

  /**
   * Memulai pengajuan surat dari anjungan.
   *
   * Anjungan hanya membuat permohonan **draf** beserta kode ambilnya. Berkas
   * persyaratan dan verifikasi identitas tetap di loket: layar sentuh di ruang
   * tunggu bukan tempat memastikan siapa yang berdiri di depannya.
   */
  async ajukanSurat(
    schemaName: string,
    input: { serviceCatalogId: string; applicantName: string; applicantPhone?: string; purpose?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'LAYANAN.PERMOHONAN');

    if (!input.applicantName?.trim() || input.applicantName.trim().length < 2) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nama pemohon wajib diisi.');
    }

    const r = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_service_request
         (village_unit_id, service_catalog_id, applicant_name, applicant_phone, purpose,
          status, created_by)
       VALUES ($1,$2,$3,$4,$5,'DRAF',$6) RETURNING id`,
      [
        u.id,
        input.serviceCatalogId,
        input.applicantName.trim(),
        input.applicantPhone ?? null,
        input.purpose ?? null,
        user.userId,
      ],
    );

    const kode = await this.terbitkanKode(schemaName, { serviceRequestId: r[0].id }, user);
    return {
      requestId: r[0].id,
      claimCode: kode.claimCode,
      display: kode.display,
      note:
        'Simpan kode ini. Bawa fotokopi KTP dan KK ke loket untuk melengkapi berkas; ' +
        'setelah surat terbit, Anda dapat mencetaknya sendiri di anjungan dengan kode ini.',
    };
  }

  // --- 5. Pengumuman dan info bantuan ---------------------------------------

  async pengumuman(schemaName: string) {
    const u = await this.unit.unit(schemaName);

    const [berita, agenda, bantuan] = await Promise.all([
      this.tenantDb.query<Record<string, unknown>>(
        schemaName,
        `SELECT title, summary, published_at AS "publishedAt"
           FROM "${schemaName}".village_news
          WHERE village_unit_id = $1 AND status = 'TAYANG' AND deleted_at IS NULL
            AND published_at <= now()
          ORDER BY published_at DESC LIMIT 8`,
        [u.id],
      ),
      this.tenantDb.query(
        schemaName,
        `SELECT title, start_at AS "startAt", location
           FROM "${schemaName}".village_agenda
          WHERE village_unit_id = $1 AND is_public = TRUE AND deleted_at IS NULL
            AND start_at >= now() - interval '1 day'
          ORDER BY start_at LIMIT 8`,
        [u.id],
      ),
      this.tenantDb.query<Record<string, unknown>>(
        schemaName,
        `SELECT name AS "programName", aid_category AS "aidCategory",
                period_start AS "periodStart", period_end AS "periodEnd", quota
           FROM "${schemaName}".village_aid_program
          WHERE village_unit_id = $1 AND is_published = TRUE AND deleted_at IS NULL
            AND status IN ('DIBUKA','DISALURKAN')
          ORDER BY period_start DESC LIMIT 8`,
        [u.id],
      ),
    ]);

    return {
      news: berita.map((b) => proyeksikanAnjungan('PENGUMUMAN', b)),
      agenda,
      // Program bantuan: yang ditampilkan hanya programnya, bukan penerimanya.
      // Daftar penerima di layar ruang tunggu adalah pengumuman siapa yang
      // miskin di desa ini.
      aidPrograms: bantuan.map((b) => proyeksikanAnjungan('BANTUAN', b)),
    };
  }

  // --- 6. Lapor -------------------------------------------------------------

  /**
   * Menyampaikan pengaduan dari anjungan.
   *
   * Anonim tetap mungkin, dan bila anonim, identitas pelapor benar-benar tidak
   * disimpan — sama seperti pengaduan pada D-5. Yang anonim tetap memperoleh
   * kode ambil supaya ia dapat memeriksa tindak lanjutnya tanpa menyebut nama.
   */
  async lapor(
    schemaName: string,
    input: {
      categoryId?: string;
      title: string;
      description: string;
      locationNote?: string;
      reporterName?: string;
      reporterPhone?: string;
      isAnonymous?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');
    const anonim = input.isAnonymous ?? false;

    if (!input.description?.trim() || input.description.trim().length < 10) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Ceritakan laporan Anda sedikit lebih panjang agar dapat ditindaklanjuti.',
      );
    }

    const nomor = `ADU/${new Date().getFullYear()}/${randomInt(100000, 999999)}`;
    const c = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_complaint
         (village_unit_id, ticket_number, category_id, title, description, location_note,
          reporter_mode, reporter_name, reporter_phone, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DITERIMA',$10) RETURNING id`,
      [
        u.id,
        nomor,
        input.categoryId ?? null,
        input.title?.trim() || input.description.trim().slice(0, 80),
        input.description.trim(),
        input.locationNote ?? null,
        // Anonim BENAR-BENAR tidak menyimpan identitas: constraint D-5 menolak
        // baris anonim yang masih membawa nama atau nomor telepon.
        anonim ? 'ANONIM' : 'TERBUKA',
        anonim ? null : (input.reporterName ?? null),
        anonim ? null : (input.reporterPhone ?? null),
        user.userId,
      ],
    );

    const kode = await this.terbitkanKode(schemaName, { complaintId: c[0].id }, user);
    return {
      complaintNumber: nomor,
      claimCode: kode.claimCode,
      display: kode.display,
      anonymous: anonim,
      note: anonim
        ? 'Laporan Anda tersimpan tanpa nama. Simpan kode ini untuk memeriksa tindak lanjutnya.'
        : 'Simpan kode ini untuk memeriksa tindak lanjut laporan Anda.',
    };
  }

  /** Memeriksa tindak lanjut pengaduan dari kode ambil. */
  async cekLaporan(schemaName: string, claimCode: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'PARTISIPASI.PENGADUAN');

    return this.tenantDb
      .transaction(schemaName, async (client) => {
        const c = await this.bukaKode(client, schemaName, u.id, claimCode);
        if (c.subjectType !== 'PENGADUAN') {
          throw AppError.badRequest(
            ErrorCodes.VALIDATION_FAILED,
            'Kode ini untuk permohonan surat, bukan pengaduan.',
          );
        }

        const r = await client.query<Record<string, string | null>>(
          `SELECT ticket_number AS "requestNumber", title AS "serviceName", status,
                  created_at AS "submittedAt"
             FROM "${schemaName}".village_complaint WHERE id = $1`,
          [c.complaintId],
        );
        if (!r.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Laporan tidak ditemukan.');

        const tindak = await client.query(
          `SELECT note, occurred_at AS "at"
             FROM "${schemaName}".village_complaint_followup
            WHERE complaint_id = $1 ORDER BY occurred_at DESC LIMIT 5`,
          [c.complaintId],
        );

        return { ...proyeksikanAnjungan('PERMOHONAN', r.rows[0]), followUps: tindak };
      })
      .catch(async (e) => {
        if (e instanceof AppError && e.errorCode === ErrorCodes.VALIDATION_FAILED) {
          await this.catatGagal(schemaName, u.id, claimCode);
        }
        throw e;
      });
  }

  // --- 7. Buku tamu ---------------------------------------------------------

  async isiBukuTamu(
    schemaName: string,
    input: {
      guestName: string;
      purpose: KeperluanTamu;
      phone?: string;
      institution?: string;
      note?: string;
      kioskCode?: string;
    },
  ) {
    const u = await this.unit.unit(schemaName);

    const v = bolehIsiBukuTamu({
      nama: input.guestName,
      keperluan: input.purpose,
      telepon: input.phone,
      instansi: input.institution,
      keterangan: input.note,
    });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_guest_book
         (village_unit_id, guest_name, purpose, phone, institution, note, kiosk_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        u.id,
        input.guestName.trim(),
        input.purpose,
        input.phone ?? null,
        input.institution ?? null,
        input.note ?? null,
        input.kioskCode ?? null,
      ],
    );
    return { id: rows[0].id, note: 'Terima kasih. Silakan menunggu dipanggil petugas.' };
  }

  /** Rekap kunjungan hari ini, untuk petugas. */
  async rekapBukuTamu(schemaName: string, tanggal?: string) {
    const u = await this.unit.unit(schemaName);
    return this.tenantDb.query(
      schemaName,
      `SELECT id, guest_name AS "guestName", purpose, institution, visited_at AS "visitedAt"
         FROM "${schemaName}".village_guest_book
        WHERE village_unit_id = $1 AND visited_at::date = COALESCE($2::date, CURRENT_DATE)
        ORDER BY visited_at DESC`,
      [u.id, tanggal ?? null],
    );
  }

  // --- 8. Absensi ronda -----------------------------------------------------

  async absenRonda(
    schemaName: string,
    input: { memberName: string; patrolScheduleId?: string; kioskCode?: string; note?: string },
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'KEAMANAN.LINMAS');

    if (!input.memberName?.trim() || input.memberName.trim().length < 2) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Nama anggota wajib diisi.');
    }

    const anggota = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `SELECT id FROM "${schemaName}".village_linmas_member
        WHERE village_unit_id = $1 AND lower(full_name) = lower($2)
          AND is_active = TRUE AND deleted_at IS NULL LIMIT 1`,
      [u.id, input.memberName.trim()],
    );

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_patrol_attendance
           (village_unit_id, patrol_schedule_id, linmas_member_id, member_name, channel, kiosk_code,
            note)
         VALUES ($1,$2,$3,$4,'ANJUNGAN',$5,$6) RETURNING id`,
        [
          u.id,
          input.patrolScheduleId ?? null,
          anggota[0]?.id ?? null,
          input.memberName.trim(),
          input.kioskCode ?? null,
          input.note ?? null,
        ],
      )
      .catch((e: unknown) => {
        if ((e as { code?: string })?.code === '23505') {
          throw AppError.conflict(
            ErrorCodes.CONFLICT,
            'Kehadiran Anda pada jadwal ronda ini sudah tercatat.',
          );
        }
        throw e;
      });

    return {
      id: rows[0].id,
      recognised: Boolean(anggota.length),
      note: anggota.length
        ? 'Kehadiran tercatat. Terima kasih atas tugas Anda malam ini.'
        : 'Kehadiran tercatat. Nama Anda belum terdaftar sebagai anggota Linmas; ' +
          'petugas akan mencocokkannya.',
    };
  }
}
