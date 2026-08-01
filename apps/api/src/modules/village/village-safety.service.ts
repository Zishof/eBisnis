/**
 * Keamanan, kebencanaan, infrastruktur, dan pertanahan administratif.
 *
 * ## Yang tidak disediakan berkas ini
 *
 * Tidak ada metode untuk menghapus laporan kejadian bencana, dan tidak ada
 * parameter untuk mencatat nama pelaku insiden. Keduanya bukan kelalaian:
 * larangan yang ditegakkan dengan tidak menyediakan jalannya tidak dapat
 * dilonggarkan oleh orang yang sedang terburu-buru.
 *
 * ## Penyangkalan disisipkan, lalu diperiksa lagi
 *
 * Layanan menyisipkan penyangkalan baku bila belum ada, dan basis data
 * memeriksanya lagi lewat constraint. Penyisipan supaya petugas tidak perlu
 * mengetiknya; constraint supaya jalur penerbitan lain — impor, penyuntingan
 * langsung, kode yang ditulis kemudian — tidak dapat melewatinya.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  bolehCatatPenyaluran,
  bolehPindahInsiden,
  bolehRujukInsiden,
  bolehSalurkanLogistik,
  periksaAngkaBencana,
  periksaPenilaian,
  tilikKondisi,
  type JenisBencana,
  type JenisInsiden,
  type KondisiInfrastruktur,
  type StatusInsiden,
} from './village-safety';
import {
  bolehCatatPeralihan,
  bolehTerbitkanSkt,
  periksaBidang,
  periksaPenyangkalan,
  sisipkanPenyangkalan,
  type CaraPeralihan,
  type JenisPenguasaan,
  type StatusSertifikat,
} from './village-land';

@Injectable()
export class VillageSafetyService {
  private readonly logger = new Logger(VillageSafetyService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  // --- Insiden --------------------------------------------------------------

  /**
   * Mencatat insiden keamanan.
   *
   * Perhatikan apa yang tidak diterima metode ini: tidak ada `namaPelaku`,
   * tidak ada `tersangkaId`. Catatan desa yang menyebut seseorang sebagai
   * pelaku adalah pencemaran nama baik yang menunggu waktu, dan ia tersimpan
   * jauh lebih lama daripada peristiwanya.
   */
  async catatInsiden(
    schemaName: string,
    input: {
      incidentNumber: string;
      incidentType: JenisInsiden;
      occurredAt: string;
      locationNote: string;
      description: string;
      subAreaId?: string;
      villageRtId?: string;
      estimatedLoss?: number;
      casualtyCount?: number;
      reporterName?: string;
      reporterPhone?: string;
      isAnonymous?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'KEAMANAN.INSIDEN');
    const anonim = input.isAnonymous ?? false;

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_incident
           (village_unit_id, incident_number, incident_type, occurred_at, location_note,
            sub_area_id, village_rt_id, description, estimated_loss, casualty_count,
            reporter_name, reporter_phone, is_anonymous, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id`,
        [
          u.id,
          input.incidentNumber,
          input.incidentType,
          input.occurredAt,
          input.locationNote,
          input.subAreaId ?? null,
          input.villageRtId ?? null,
          input.description,
          input.estimatedLoss ?? null,
          input.casualtyCount ?? 0,
          // Laporan anonim benar-benar tidak menyimpan identitas pelapor, sama
          // seperti pengaduan pada D-5. Menyimpannya "untuk berjaga-jaga" berarti
          // anonimitasnya hanya janji.
          anonim ? null : (input.reporterName ?? null),
          anonim ? null : (input.reporterPhone ?? null),
          anonim,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Nomor insiden sudah dipakai.'));

    return { id: rows[0].id, anonymous: anonim };
  }

  async ubahStatusInsiden(
    schemaName: string,
    incidentId: string,
    input: { status: StatusInsiden; handlingNote?: string; referredTo?: string; referralNumber?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'KEAMANAN.INSIDEN');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const i = await client.query<{ status: string }>(
        `SELECT status FROM "${schemaName}".village_incident
          WHERE id = $1 AND village_unit_id = $2 FOR UPDATE`,
        [incidentId, u.id],
      );
      if (!i.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Insiden tidak ditemukan.');

      const v = bolehPindahInsiden(i.rows[0].status as StatusInsiden, input.status);
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      if (input.status === 'DIRUJUK') {
        const r = bolehRujukInsiden({
          dirujukKe: input.referredTo ?? '',
          nomorRujukan: input.referralNumber ?? '',
        });
        if (!r.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, r.alasan!);
      }

      await client.query(
        `UPDATE "${schemaName}".village_incident
            SET status = $2, handling_note = COALESCE($3, handling_note),
                referred_to = COALESCE($4, referred_to),
                referral_number = COALESCE($5, referral_number),
                referred_at = CASE WHEN $2 = 'DIRUJUK' THEN now() ELSE referred_at END,
                handled_by = $6, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [
          incidentId,
          input.status,
          input.handlingNote ?? null,
          input.referredTo ?? null,
          input.referralNumber ?? null,
          user.userId,
        ],
      );
      return { id: incidentId, status: input.status };
    });
  }

  // --- Kebencanaan ----------------------------------------------------------

  async catatKejadianBencana(
    schemaName: string,
    input: {
      eventNumber: string;
      disasterType: JenisBencana;
      occurredAt: string;
      locationNote: string;
      description?: string;
      affectedFamilyCount?: number;
      displacedCount?: number;
      casualtyCount?: number;
      injuredCount?: number;
      estimatedLoss?: number;
      emergencyStatus?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BENCANA.KEJADIAN');

    const v = periksaAngkaBencana({
      jenis: input.disasterType,
      tanggalKejadian: input.occurredAt,
      jumlahTerdampakKk: input.affectedFamilyCount ?? 0,
      jumlahMengungsi: input.displacedCount ?? 0,
      jumlahKorbanJiwa: input.casualtyCount ?? 0,
    });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_disaster_event
           (village_unit_id, event_number, disaster_type, occurred_at, location_note, description,
            affected_family_count, displaced_count, casualty_count, injured_count,
            estimated_loss, emergency_status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
        [
          u.id,
          input.eventNumber,
          input.disasterType,
          input.occurredAt,
          input.locationNote,
          input.description ?? null,
          input.affectedFamilyCount ?? 0,
          input.displacedCount ?? 0,
          input.casualtyCount ?? 0,
          input.injuredCount ?? 0,
          input.estimatedLoss ?? null,
          input.emergencyStatus ?? null,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Nomor kejadian sudah dipakai.'));

    return { id: rows[0].id };
  }

  /**
   * Mengoreksi angka kejadian.
   *
   * Tidak ada metode penghapusan, dan itu disengaja. Laporan kejadian naik ke
   * kecamatan dan BPBD serta menjadi dasar penetapan status tanggap darurat;
   * menghapusnya mengubah catatan sejarah yang sudah dipakai pihak lain. Yang
   * salah dikoreksi beserta alasannya, sehingga koreksinya ikut terbaca.
   */
  async koreksiKejadian(
    schemaName: string,
    eventId: string,
    input: {
      correctionNote: string;
      affectedFamilyCount?: number;
      displacedCount?: number;
      casualtyCount?: number;
      injuredCount?: number;
      estimatedLoss?: number;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BENCANA.KEJADIAN');

    if ((input.correctionNote ?? '').trim().length < 10) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Alasan koreksi wajib diuraikan. Angka yang berubah tanpa keterangan membuat laporan ' +
          'yang sudah naik ke BPBD tidak dapat dijelaskan lagi.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE "${schemaName}".village_disaster_event
          SET affected_family_count = COALESCE($3, affected_family_count),
              displaced_count = COALESCE($4, displaced_count),
              casualty_count = COALESCE($5, casualty_count),
              injured_count = COALESCE($6, injured_count),
              estimated_loss = COALESCE($7, estimated_loss),
              correction_note = $8, corrected_at = now(), corrected_by = $9,
              updated_at = now(), version = version + 1
        WHERE id = $1 AND village_unit_id = $2
        RETURNING id`,
      [
        eventId,
        u.id,
        input.affectedFamilyCount ?? null,
        input.displacedCount ?? null,
        input.casualtyCount ?? null,
        input.injuredCount ?? null,
        input.estimatedLoss ?? null,
        input.correctionNote,
        user.userId,
      ],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Kejadian tidak ditemukan.');
    return { id: rows[0].id, corrected: true };
  }

  // --- Logistik -------------------------------------------------------------

  async terimaLogistik(
    schemaName: string,
    input: { reliefItemId: string; quantity: number; note?: string },
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BENCANA.LOGISTIK');
    if (!(input.quantity > 0)) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Jumlah penerimaan harus lebih besar dari nol.');
    }

    const rows = await this.tenantDb.query<{ stock_quantity: string }>(
      schemaName,
      `UPDATE "${schemaName}".village_relief_item
          SET stock_quantity = stock_quantity + $3, updated_at = now(), version = version + 1
        WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL
        RETURNING stock_quantity::text`,
      [input.reliefItemId, u.id, input.quantity],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Barang bantuan tidak ditemukan.');
    return { stock: rows[0].stock_quantity };
  }

  /**
   * Menyalurkan bantuan bencana.
   *
   * **Tidak ada penyaringan kelayakan di sini**, dan itu kebalikan sengaja dari
   * bantuan sosial pada D-7. Keluarga yang kehilangan rumah pada pukul tiga
   * pagi bukan berkas yang perlu dinilai. Yang membatasi hanyalah stok, dan
   * yang tetap dituntut hanyalah nama penerimanya — pertanggungjawaban
   * sesudahnya, bukan syarat sebelumnya.
   *
   * Stok dikunci sebelum diperiksa. Dua penyaluran bersamaan tanpa kunci akan
   * sama-sama membaca stok yang sama dan keduanya lolos; constraint
   * `stock_quantity >= 0` menangkap yang kedua, tetapi dengan pesan yang tidak
   * berguna bagi petugas posko.
   */
  async salurkanLogistik(
    schemaName: string,
    input: {
      reliefItemId: string;
      quantity: number;
      recipientName: string;
      disasterEventId?: string;
      recipientFamilyId?: string;
      locationNote?: string;
      note?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'BENCANA.LOGISTIK');

    const catat = bolehCatatPenyaluran({
      jumlah: input.quantity,
      namaPenerima: input.recipientName,
      lokasi: input.locationNote,
    });
    if (!catat.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, catat.alasan!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const b = await client.query<{ stock_quantity: string; unit: string; name: string }>(
        `SELECT stock_quantity::text, unit, name FROM "${schemaName}".village_relief_item
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [input.reliefItemId, u.id],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Barang bantuan tidak ditemukan.');

      const v = bolehSalurkanLogistik(
        { tersedia: Number(b.rows[0].stock_quantity), satuan: b.rows[0].unit },
        input.quantity,
      );
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, `${b.rows[0].name}: ${v.alasan}`);

      const d = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_relief_distribution
           (village_unit_id, disaster_event_id, relief_item_id, quantity, recipient_name,
            recipient_family_id, location_note, distributed_by, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8) RETURNING id`,
        [
          u.id,
          input.disasterEventId ?? null,
          input.reliefItemId,
          input.quantity,
          input.recipientName,
          input.recipientFamilyId ?? null,
          input.locationNote ?? null,
          user.userId,
          input.note ?? null,
        ],
      );

      await client.query(
        `UPDATE "${schemaName}".village_relief_item
            SET stock_quantity = stock_quantity - $2, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [input.reliefItemId, input.quantity],
      );

      return { id: d.rows[0].id, remainingStock: Number(b.rows[0].stock_quantity) - input.quantity };
    });
  }

  // --- Infrastruktur --------------------------------------------------------

  async catatPemeriksaanInfrastruktur(
    schemaName: string,
    infrastructureId: string,
    input: {
      inspectedAt: string;
      condition: KondisiInfrastruktur;
      finding: string;
      recommendation?: string;
      estimatedCost?: number;
      inspectorName?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'LINGKUNGAN.INFRASTRUKTUR');

    const v = periksaPenilaian({ kondisi: input.condition, dinilaiPada: input.inspectedAt });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".village_infrastructure
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [infrastructureId, u.id],
      );
      if (!p.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Infrastruktur tidak ditemukan.');

      const rows = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_infrastructure_inspection
           (village_unit_id, infrastructure_id, inspected_at, condition, finding, recommendation,
            estimated_cost, inspector_name, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
        [
          u.id,
          infrastructureId,
          input.inspectedAt,
          input.condition,
          input.finding,
          input.recommendation ?? null,
          input.estimatedCost ?? null,
          input.inspectorName ?? null,
          user.userId,
        ],
      );

      // Kondisi induknya mengikuti pemeriksaan terakhir, beserta tanggalnya.
      // Keduanya diperbarui bersama; kondisi tanpa tanggal ditolak constraint.
      await client.query(
        `UPDATE "${schemaName}".village_infrastructure
            SET condition = $2, condition_assessed_at = $3, updated_at = now(),
                version = version + 1
          WHERE id = $1`,
        [infrastructureId, input.condition, input.inspectedAt],
      );

      return { id: rows.rows[0].id };
    });
  }

  /** Daftar infrastruktur beserta umur penilaian kondisinya. */
  async daftarInfrastruktur(schemaName: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'LINGKUNGAN.INFRASTRUKTUR');
    const hariIni = new Date().toISOString().slice(0, 10);

    const rows = await this.tenantDb.query<Record<string, string | null>>(
      schemaName,
      `SELECT id, code, name, infra_type, location_note, length_m::text, width_m::text,
              built_year, condition, condition_assessed_at::text
         FROM "${schemaName}".village_infrastructure
        WHERE village_unit_id = $1 AND deleted_at IS NULL
        ORDER BY infra_type, code`,
      [u.id],
    );

    return rows.map((r) => ({
      ...r,
      // Umur penilaian disajikan bersama kondisinya, bukan disimpan diam-diam.
      // "Jalan rusak berat" yang dinilai tiga tahun lalu akan tetap masuk RKP
      // setelah jalannya diaspal, dan anggaran mengikuti pernyataan itu.
      assessment: r.condition
        ? tilikKondisi(
            {
              kondisi: r.condition as KondisiInfrastruktur,
              dinilaiPada: String(r.condition_assessed_at),
            },
            hariIni,
          )
        : null,
    }));
  }

  // --- Pertanahan -----------------------------------------------------------

  async catatBidang(
    schemaName: string,
    input: {
      parcelCode: string;
      possessorName: string;
      areaM2: number;
      possessionType?: JenisPenguasaan;
      possessorResidentId?: string;
      letterCNumber?: string;
      persilNumber?: string;
      landUse?: string;
      address?: string;
      subAreaId?: string;
      villageRtId?: string;
      boundaryNorth?: string;
      boundarySouth?: string;
      boundaryEast?: string;
      boundaryWest?: string;
      certificateStatus?: StatusSertifikat;
      certificateNumber?: string;
      note?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TANAH.ADMINISTRATIF');

    const v = periksaBidang({
      statusSertifikat: input.certificateStatus ?? 'BELUM_BERSERTIFIKAT',
      nomorSertifikat: input.certificateNumber,
      luasM2: input.areaM2,
      jenisPenguasaan: input.possessionType ?? 'MILIK_ADAT',
    });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_land_parcel
           (village_unit_id, parcel_code, letter_c_number, persil_number, possessor_name,
            possessor_resident_id, possession_type, area_m2, land_use, address, sub_area_id,
            village_rt_id, boundary_north, boundary_south, boundary_east, boundary_west,
            certificate_status, certificate_number, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
         RETURNING id`,
        [
          u.id,
          input.parcelCode,
          input.letterCNumber ?? null,
          input.persilNumber ?? null,
          input.possessorName,
          input.possessorResidentId ?? null,
          input.possessionType ?? 'MILIK_ADAT',
          input.areaM2,
          input.landUse ?? null,
          input.address ?? null,
          input.subAreaId ?? null,
          input.villageRtId ?? null,
          input.boundaryNorth ?? null,
          input.boundarySouth ?? null,
          input.boundaryEast ?? null,
          input.boundaryWest ?? null,
          input.certificateStatus ?? 'BELUM_BERSERTIFIKAT',
          input.certificateNumber ?? null,
          input.note ?? null,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Kode bidang sudah dipakai.'));

    return {
      id: rows[0].id,
      // Disebutkan pada tiap pencatatan, bukan hanya pada dokumentasi.
      note:
        'Catatan ini bersifat administratif: penguasaan fisik menurut administrasi desa, ' +
        'bukan hak atas tanah.',
    };
  }

  async catatPeralihan(
    schemaName: string,
    parcelId: string,
    input: {
      transferType: CaraPeralihan;
      transferredAt: string;
      fromName: string;
      toName: string;
      legalBasis: string;
      areaM2?: number;
      note?: string;
      updatePossessor?: boolean;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TANAH.ADMINISTRATIF');

    const v = bolehCatatPeralihan({
      cara: input.transferType,
      dariNama: input.fromName,
      kepadaNama: input.toName,
      tanggal: input.transferredAt,
      dasarPeralihan: input.legalBasis,
    });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await client.query<{ id: string }>(
        `SELECT id FROM "${schemaName}".village_land_parcel
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [parcelId, u.id],
      );
      if (!p.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Bidang tidak ditemukan.');

      const rows = await client.query<{ id: string }>(
        `INSERT INTO "${schemaName}".village_land_history
           (village_unit_id, land_parcel_id, transfer_type, transferred_at, from_name, to_name,
            legal_basis, area_m2, note, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
        [
          u.id,
          parcelId,
          input.transferType,
          input.transferredAt,
          input.fromName,
          input.toName,
          input.legalBasis,
          input.areaM2 ?? null,
          input.note ?? null,
          user.userId,
        ],
      );

      if (input.updatePossessor !== false) {
        await client.query(
          `UPDATE "${schemaName}".village_land_parcel
              SET possessor_name = $2, possessor_resident_id = NULL,
                  updated_at = now(), version = version + 1
            WHERE id = $1`,
          [parcelId, input.toName],
        );
      }

      return { id: rows.rows[0].id };
    });
  }

  async catatPersetujuanBatas(
    schemaName: string,
    parcelId: string,
    input: {
      side: 'UTARA' | 'SELATAN' | 'TIMUR' | 'BARAT';
      neighbourName: string;
      consented: boolean;
      neighbourResidentId?: string;
      neighbourParcelId?: string;
      objectionNote?: string;
      witnessName?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TANAH.ADMINISTRATIF');

    if (!input.consented && (input.objectionNote ?? '').trim().length < 5) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Keberatan wajib diuraikan. Tetangga yang menolak tanpa keterangan tidak meninggalkan ' +
          'apa pun yang dapat dimusyawarahkan.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_land_boundary_consent
         (village_unit_id, land_parcel_id, side, neighbour_name, neighbour_resident_id,
          neighbour_parcel_id, consented, consented_at, objection_note, witness_name, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (land_parcel_id, side) DO UPDATE
         SET neighbour_name = EXCLUDED.neighbour_name,
             neighbour_resident_id = EXCLUDED.neighbour_resident_id,
             neighbour_parcel_id = EXCLUDED.neighbour_parcel_id,
             consented = EXCLUDED.consented,
             consented_at = EXCLUDED.consented_at,
             objection_note = EXCLUDED.objection_note,
             witness_name = EXCLUDED.witness_name,
             updated_at = now(),
             version = village_land_boundary_consent.version + 1
       RETURNING id`,
      [
        u.id,
        parcelId,
        input.side,
        input.neighbourName,
        input.neighbourResidentId ?? null,
        input.neighbourParcelId ?? null,
        input.consented,
        input.consented ? new Date().toISOString().slice(0, 10) : null,
        input.objectionNote ?? null,
        input.witnessName ?? null,
        user.userId,
      ],
    );
    return { id: rows[0].id };
  }

  /**
   * Menerbitkan surat keterangan tanah.
   *
   * Penyangkalan disisipkan bila belum ada, lalu diperiksa lagi — dan basis
   * data memeriksanya ketiga kalinya lewat constraint pada `body_text`.
   * Berlapis, karena inilah satu-satunya hal pada D-9 yang, bila terlewat,
   * menghasilkan kertas yang dipegang warga selama puluhan tahun sebagai bukti
   * atas sesuatu yang tidak pernah dibuktikannya.
   */
  async terbitkanSkt(
    schemaName: string,
    parcelId: string,
    input: {
      statementNumber: string;
      issuedAt: string;
      bodyText: string;
      purpose?: string;
      validUntil?: string;
      serviceRequestId?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'TANAH.SURAT_KETERANGAN');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const p = await client.query<Record<string, string | number>>(
        `SELECT p.certificate_status, p.possessor_name,
                (SELECT count(*)::int FROM "${schemaName}".village_land_boundary_consent c
                  WHERE c.land_parcel_id = p.id) AS neighbour_count,
                (SELECT count(*)::int FROM "${schemaName}".village_land_boundary_consent c
                  WHERE c.land_parcel_id = p.id AND c.consented = TRUE) AS consent_count,
                (SELECT count(*)::int FROM "${schemaName}".village_land_statement s
                  WHERE s.land_parcel_id = p.id AND s.is_revoked = FALSE) AS active_statements
           FROM "${schemaName}".village_land_parcel p
          WHERE p.id = $1 AND p.village_unit_id = $2 AND p.deleted_at IS NULL
          FOR UPDATE OF p`,
        [parcelId, u.id],
      );
      if (!p.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Bidang tidak ditemukan.');
      const r = p.rows[0];

      // Disisipkan lebih dahulu supaya petugas tidak perlu mengetiknya, lalu
      // tetap diperiksa: penyisipan yang gagal karena alasan apa pun tidak
      // boleh lolos hanya karena ia dilakukan otomatis.
      const badan = sisipkanPenyangkalan(input.bodyText);

      const v = bolehTerbitkanSkt({
        statusSertifikat: String(r.certificate_status) as StatusSertifikat,
        jumlahTetangga: Number(r.neighbour_count),
        jumlahPersetujuan: Number(r.consent_count),
        namaPenguasa: String(r.possessor_name),
        badanSurat: badan,
        adaSktBerlaku: Number(r.active_statements) > 0,
      });
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      const rows = await client
        .query<{ id: string }>(
          `INSERT INTO "${schemaName}".village_land_statement
             (village_unit_id, land_parcel_id, service_request_id, statement_number, issued_at,
              valid_until, possessor_name, purpose, certificate_status_at_issue,
              neighbour_count, consent_count, body_text, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
          [
            u.id,
            parcelId,
            input.serviceRequestId ?? null,
            input.statementNumber,
            input.issuedAt,
            input.validUntil ?? null,
            r.possessor_name,
            input.purpose ?? null,
            r.certificate_status,
            Number(r.neighbour_count),
            Number(r.consent_count),
            badan,
            user.userId,
          ],
        )
        .catch(
          terjemahkanBentrok(
            'Nomor surat sudah dipakai, atau bidang ini sudah memiliki surat yang berlaku.',
          ),
        );

      this.logger.log(`SKT ${input.statementNumber} terbit untuk bidang ${parcelId}`);
      return {
        id: rows.rows[0].id,
        disclaimerPresent: periksaPenyangkalan(badan).ada,
        bodyText: badan,
      };
    });
  }

  async cabutSkt(schemaName: string, statementId: string, reason: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TANAH.SURAT_KETERANGAN');

    if ((reason ?? '').trim().length < 5) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Alasan pencabutan wajib disebutkan. Surat yang dicabut tanpa keterangan menyisakan ' +
          'pertanyaan pada siapa pun yang pernah memegang salinannya.',
      );
    }

    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `UPDATE "${schemaName}".village_land_statement
          SET is_revoked = TRUE, revoked_at = now(), revoke_reason = $3,
              updated_at = now(), version = version + 1
        WHERE id = $1 AND village_unit_id = $2 AND is_revoked = FALSE
        RETURNING id`,
      [statementId, u.id, reason],
    );
    if (!rows.length) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Surat tidak ditemukan atau sudah dicabut.');
    }
    return { id: rows[0].id, revoked: true };
  }

  /** Riwayat satu bidang: peralihan, persetujuan batas, dan surat yang pernah terbit. */
  async riwayatBidang(schemaName: string, parcelId: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'TANAH.ADMINISTRATIF');

    const [peralihan, persetujuan, surat] = await Promise.all([
      this.tenantDb.query(
        schemaName,
        `SELECT id, transfer_type, transferred_at, from_name, to_name, legal_basis, note
           FROM "${schemaName}".village_land_history
          WHERE land_parcel_id = $1 AND village_unit_id = $2
          ORDER BY transferred_at DESC`,
        [parcelId, u.id],
      ),
      this.tenantDb.query(
        schemaName,
        `SELECT id, side, neighbour_name, consented, consented_at, objection_note
           FROM "${schemaName}".village_land_boundary_consent
          WHERE land_parcel_id = $1 AND village_unit_id = $2
          ORDER BY side`,
        [parcelId, u.id],
      ),
      this.tenantDb.query(
        schemaName,
        `SELECT id, statement_number, issued_at, valid_until, is_revoked, revoke_reason
           FROM "${schemaName}".village_land_statement
          WHERE land_parcel_id = $1 AND village_unit_id = $2
          ORDER BY issued_at DESC`,
        [parcelId, u.id],
      ),
    ]);

    return {
      transfers: peralihan,
      boundaryConsents: persetujuan,
      statements: surat,
      note:
        'Seluruhnya catatan administratif desa. Bukan bukti kepemilikan, dan tidak menggantikan ' +
        'sertifikat yang diterbitkan Badan Pertanahan Nasional.',
    };
  }
}

// --- Bagian dalam ------------------------------------------------------------

function terjemahkanBentrok(pesan: string) {
  return (error: unknown): never => {
    if ((error as { code?: string })?.code === '23505') {
      throw AppError.conflict(ErrorCodes.CONFLICT, pesan);
    }
    throw error;
  };
}
