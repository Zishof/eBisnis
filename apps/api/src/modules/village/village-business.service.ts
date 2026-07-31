/**
 * BUMDes, UMKM, wisata, dan keberadaan koperasi.
 *
 * ## Yang tidak dilakukan berkas ini
 *
 * Ia tidak menyimpan satu pun data koperasi, tidak membaca satu pun data
 * kesehatan, dan tidak membuat satu pun listing marketplace. Yang dilakukannya
 * hanyalah **menautkan** dan **membaca ringkasan** lewat port pada
 * `ports/external.ports.ts`. Larangan-larangan itu ditegakkan dengan tidak
 * menyediakan metodenya, bukan dengan pemeriksaan izin.
 *
 * ## "Kosong" dan "belum tersambung" tidak pernah disamakan
 *
 * Setiap hasil dari port membawa `tersedia`. Layanan meneruskannya apa adanya
 * ke pemanggil. Halaman yang menampilkan "penjualan Rp 0" padahal POS belum
 * tersambung menyampaikan kebohongan yang akan diulang pemerintah desa kepada
 * warganya.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import {
  COOPERATIVE_PORT,
  MARKETPLACE_PORT,
  POS_PORT,
  type CooperativeIntegrationPort,
  type MarketplaceLinkPort,
  type PosIntegrationPort,
} from './ports/external.ports';
import {
  bagiHasil,
  bolehDirikanBumdes,
  bolehPindahBumdes,
  bolehSertakanModal,
  bolehTautkanListing,
  bolehTayangkanWisata,
  bolehTetapkanHasil,
  skalaUsaha,
  type StatusBumdes,
} from './village-business';

@Injectable()
export class VillageBusinessService {
  private readonly logger = new Logger(VillageBusinessService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
    @Inject(POS_PORT) private readonly pos: PosIntegrationPort,
    @Inject(MARKETPLACE_PORT) private readonly marketplace: MarketplaceLinkPort,
    @Inject(COOPERATIVE_PORT) private readonly koperasi: CooperativeIntegrationPort,
  ) {}

  // --- BUMDes ---------------------------------------------------------------

  async dirikanBumdes(
    schemaName: string,
    input: {
      name: string;
      regulationNumber: string;
      villageSharePct: number;
      adArtEstablished: boolean;
      establishedAt?: string;
      legalEntityNumber?: string;
      directorName?: string;
      directorResidentId?: string;
      address?: string;
      phone?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');

    const v = bolehDirikanBumdes({
      profil: u.profileType,
      nomorPerdes: input.regulationNumber,
      adArtDitetapkan: input.adArtEstablished,
      bagianDesaPersen: input.villageSharePct,
    });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_bumdes
           (village_unit_id, name, legal_entity_number, regulation_number, established_at,
            address, phone, village_share_pct, ad_art_established, director_name,
            director_resident_id, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'BERDIRI',$12) RETURNING id`,
        [
          u.id,
          input.name,
          input.legalEntityNumber ?? null,
          input.regulationNumber,
          input.establishedAt ?? null,
          input.address ?? null,
          input.phone ?? null,
          input.villageSharePct,
          input.adArtEstablished,
          input.directorName ?? null,
          input.directorResidentId ?? null,
          user.userId,
        ],
      )
      .catch(
        terjemahkanBentrok(
          'Desa ini sudah memiliki BUMDes yang belum bubar. Satu desa satu BUMDes.',
        ),
      );

    return { id: rows[0].id, status: 'BERDIRI' };
  }

  async ubahStatusBumdes(
    schemaName: string,
    bumdesId: string,
    input: { status: StatusBumdes; reason?: string },
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const b = await client.query<{ status: string }>(
        `SELECT status FROM "${schemaName}".village_bumdes
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [bumdesId, u.id],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'BUMDes tidak ditemukan.');

      const v = bolehPindahBumdes(b.rows[0].status as StatusBumdes, input.status);
      if (!v.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, v.alasan!);

      if (input.status === 'BUBAR' && (input.reason ?? '').trim().length < 10) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Alasan pembubaran wajib diuraikan. BUMDes yang bubar tanpa keterangan meninggalkan ' +
            'pertanyaan tentang modal yang pernah disertakan desa.',
        );
      }

      await client.query(
        `UPDATE "${schemaName}".village_bumdes
            SET status = $2,
                dissolution_reason = CASE WHEN $2 = 'BUBAR' THEN $3 ELSE dissolution_reason END,
                dissolved_at = CASE WHEN $2 = 'BUBAR' THEN CURRENT_DATE ELSE dissolved_at END,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [bumdesId, input.status, input.reason ?? null],
      );
      return { id: bumdesId, status: input.status };
    });
  }

  /**
   * Menyertakan modal desa pada BUMDes.
   *
   * Wajib menunjuk transaksi APBDes-nya. Modal yang tercatat pada BUMDes tanpa
   * padanan pada APBDes berarti uangnya belum keluar, atau keluar tanpa
   * dicatat — dan keduanya perlu ketahuan sekarang, bukan saat pemeriksaan.
   */
  async sertakanModal(
    schemaName: string,
    bumdesId: string,
    input: {
      fiscalYear: number;
      amount: number;
      regulationNumber: string;
      budgetTransactionId: string;
      transferredAt: string;
      note?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const b = await client.query<{ status: string }>(
        `SELECT status FROM "${schemaName}".village_bumdes
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [bumdesId, u.id],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'BUMDes tidak ditemukan.');

      const v = bolehSertakanModal({
        jumlah: input.amount,
        nomorPerdes: input.regulationNumber,
        budgetTransactionId: input.budgetTransactionId,
        statusBumdes: b.rows[0].status as StatusBumdes,
      });
      if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

      // Transaksi yang ditunjuk harus benar-benar pengeluaran pembiayaan yang
      // sudah direalisasi. Penyertaan modal yang menunjuk ikatan yang belum
      // dibayar mencatat modal yang belum diterima BUMDes.
      const t = await client.query<{ transaction_type: string; amount: string }>(
        `SELECT transaction_type, amount::text FROM "${schemaName}".village_budget_transaction
          WHERE id = $1 AND village_unit_id = $2 AND is_reversed = FALSE`,
        [input.budgetTransactionId, u.id],
      );
      if (!t.rows.length) {
        throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Transaksi APBDes tidak ditemukan.');
      }
      if (t.rows[0].transaction_type !== 'REALISASI') {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          'Transaksi yang ditunjuk baru berupa ikatan, belum realisasi. Penyertaan modal yang ' +
            'menunjuk ikatan mencatat modal yang belum diterima BUMDes.',
        );
      }
      if (Number(t.rows[0].amount) !== input.amount) {
        throw AppError.badRequest(
          ErrorCodes.VALIDATION_FAILED,
          `Jumlah penyertaan (${input.amount}) berbeda dari nilai transaksi APBDes-nya ` +
            `(${t.rows[0].amount}). Keduanya harus sama agar dapat ditelusuri.`,
        );
      }

      const rows = await client
        .query<{ id: string }>(
          `INSERT INTO "${schemaName}".village_bumdes_capital
             (village_unit_id, village_bumdes_id, fiscal_year, amount, regulation_number,
              budget_transaction_id, transferred_at, note, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            u.id,
            bumdesId,
            input.fiscalYear,
            input.amount,
            input.regulationNumber,
            input.budgetTransactionId,
            input.transferredAt,
            input.note ?? null,
            user.userId,
          ],
        )
        .catch(
          terjemahkanBentrok(
            'Transaksi APBDes ini sudah dicatat sebagai penyertaan modal. Uang yang keluar ' +
              'sekali tidak dapat dicatat dua kali sebagai modal.',
          ),
        );

      return { id: rows.rows[0].id };
    });
  }

  /** Modal yang pernah disertakan desa — yaitu seluruh paparan desa atas BUMDes ini. */
  async paparanModal(schemaName: string, bumdesId: string) {
    await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT coalesce(sum(amount), 0)::text AS total, count(*)::int AS entries,
              min(fiscal_year) AS first_year, max(fiscal_year) AS last_year
         FROM "${schemaName}".village_bumdes_capital WHERE village_bumdes_id = $1`,
      [bumdesId],
    );
    return {
      totalCapital: rows[0].total,
      entries: rows[0].entries,
      firstYear: rows[0].first_year,
      lastYear: rows[0].last_year,
      // Disebutkan eksplisit supaya tidak perlu disimpulkan: inilah batas
      // kerugian yang dapat menimpa desa.
      note:
        'Jumlah ini adalah seluruh paparan desa atas BUMDes. Kerugian BUMDes terbatas pada ' +
        'modal yang disertakan dan tidak menjadi utang desa.',
    };
  }

  /**
   * Menetapkan laporan hasil usaha tahunan.
   *
   * Persentase bagian desa **dicuplik** dari BUMDes saat laporan ditetapkan.
   * Laporan yang hanya merujuk anggaran dasar akan berubah artinya ketika
   * anggaran dasarnya diubah.
   */
  async tetapkanHasilUsaha(
    schemaName: string,
    bumdesId: string,
    input: { fiscalYear: number; revenueAmount: number; expenseAmount: number; reportDocument?: string },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const b = await client.query<{ village_share_pct: string; status: string }>(
        `SELECT village_share_pct::text, status FROM "${schemaName}".village_bumdes
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [bumdesId, u.id],
      );
      if (!b.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'BUMDes tidak ditemukan.');

      const persen = Number(b.rows[0].village_share_pct);
      const tahunSekarang = new Date().getFullYear();
      const v = bolehTetapkanHasil({
        bagianDesaPersenTercuplik: persen,
        periodeSelesai: input.fiscalYear < tahunSekarang,
      });
      if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

      const bagi = bagiHasil({
        pendapatan: input.revenueAmount,
        beban: input.expenseAmount,
        bagianDesaPersen: persen,
      });

      const rows = await client
        .query<{ id: string }>(
          `INSERT INTO "${schemaName}".village_bumdes_result
             (village_unit_id, village_bumdes_id, fiscal_year, revenue_amount, expense_amount,
              net_result, village_share_pct, village_share_amount, retained_amount,
              status, approved_by, approved_at, report_document, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'DITETAPKAN',$10, now(),$11,$10) RETURNING id`,
          [
            u.id,
            bumdesId,
            input.fiscalYear,
            input.revenueAmount,
            input.expenseAmount,
            bagi.labaBersih,
            persen,
            bagi.bagianDesa,
            bagi.bagianBumdes,
            user.userId,
            input.reportDocument ?? null,
          ],
        )
        .catch(terjemahkanBentrok('Laporan hasil usaha tahun ini sudah ditetapkan.'));

      this.logger.log(
        `Hasil usaha BUMDes ${bumdesId} tahun ${input.fiscalYear}: ${bagi.keterangan}`,
      );
      return { id: rows.rows[0].id, ...bagi };
    });
  }

  // --- Unit usaha -----------------------------------------------------------

  async buatUnitUsaha(
    schemaName: string,
    bumdesId: string,
    input: {
      code: string;
      name: string;
      businessType?: string;
      description?: string;
      managerName?: string;
      startedAt?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_bumdes_unit
           (village_unit_id, village_bumdes_id, code, name, business_type, description,
            manager_name, started_at, status, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $8::date IS NULL THEN 'DIRENCANAKAN' ELSE 'BERJALAN' END, $9)
         RETURNING id`,
        [
          u.id,
          bumdesId,
          input.code,
          input.name,
          input.businessType ?? 'PERDAGANGAN',
          input.description ?? null,
          input.managerName ?? null,
          input.startedAt ?? null,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Kode unit usaha sudah dipakai.'));

    return { id: rows[0].id };
  }

  /**
   * Menautkan unit usaha ke outlet POS.
   *
   * Village tidak membuat outlet, tidak membuka shift, dan tidak menyentuh
   * stok. Yang ditautkan adalah outlet yang sudah ada, dan yang dibaca
   * kemudian hanyalah ringkasannya.
   */
  async tautkanOutlet(schemaName: string, unitId: string, outletId: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');

    const hasil = await this.pos.tautkanUnitUsaha({ bumdesUnitId: unitId, outletId });
    if (!hasil.tersedia) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        `${hasil.keterangan} Penautan ditunda sampai POS tersambung.`,
      );
    }
    if (!hasil.data.linked) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'POS menolak penautan outlet ini.');
    }

    await this.tenantDb
      .query(
        schemaName,
        `UPDATE "${schemaName}".village_bumdes_unit
            SET pos_outlet_id = $3, pos_linked_at = now(), updated_at = now(), version = version + 1
          WHERE id = $1 AND village_unit_id = $2`,
        [unitId, u.id, outletId],
      )
      .catch(
        terjemahkanBentrok(
          'Outlet ini sudah ditautkan ke unit usaha lain. Dua unit yang menunjuk outlet yang ' +
            'sama akan melaporkan penjualan yang sama dua kali.',
        ),
      );

    return { unitId, outletId, linked: true };
  }

  /** Ringkasan penjualan satu unit usaha. Meneruskan ketersediaan apa adanya. */
  async penjualanUnit(schemaName: string, unitId: string, from: string, to: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.BUMDES');

    const rows = await this.tenantDb.query<{ pos_outlet_id: string | null; name: string }>(
      schemaName,
      `SELECT pos_outlet_id, name FROM "${schemaName}".village_bumdes_unit
        WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL`,
      [unitId, u.id],
    );
    if (!rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Unit usaha tidak ditemukan.');

    if (!rows[0].pos_outlet_id) {
      return {
        available: false,
        note: `${rows[0].name} belum ditautkan ke outlet POS mana pun.`,
        data: null,
      };
    }

    const hasil = await this.pos.ringkasanPenjualan({
      outletId: rows[0].pos_outlet_id,
      from,
      to,
    });
    return { available: hasil.tersedia, note: hasil.keterangan ?? null, data: hasil.data };
  }

  // --- UMKM -----------------------------------------------------------------

  async daftarkanUmkm(
    schemaName: string,
    input: {
      code: string;
      businessName: string;
      ownerName: string;
      ownerResidentId?: string;
      ownerUserId?: string;
      businessSector?: string;
      description?: string;
      address?: string;
      villageRtId?: string;
      phone?: string;
      nib?: string;
      annualTurnover?: number;
      employeeCount?: number;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.UMKM');

    // Skala dihitung, bukan diketik. Skala yang diisi sendiri oleh pelaku usaha
    // akan mengikuti syarat bantuan yang sedang dibuka, bukan mengikuti
    // usahanya.
    const skala = input.annualTurnover === undefined ? null : skalaUsaha(input.annualTurnover);

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_umkm
           (village_unit_id, code, business_name, owner_resident_id, owner_name, owner_user_id,
            business_sector, description, address, village_rt_id, phone, nib,
            annual_turnover, scale, employee_count, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [
          u.id,
          input.code,
          input.businessName,
          input.ownerResidentId ?? null,
          input.ownerName,
          input.ownerUserId ?? null,
          input.businessSector ?? null,
          input.description ?? null,
          input.address ?? null,
          input.villageRtId ?? null,
          input.phone ?? null,
          input.nib ?? null,
          input.annualTurnover ?? null,
          skala,
          input.employeeCount ?? 0,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Kode UMKM sudah dipakai.'));

    return { id: rows[0].id, scale: skala };
  }

  /**
   * Menautkan listing marketplace ke produk UMKM.
   *
   * Desa **menautkan**, tidak membuat. Produk yang didaftarkan pemerintah desa
   * atas nama warga menimbulkan pertanyaan siapa yang bertanggung jawab bila
   * produknya bermasalah — dan pertanyaan itu muncul justru ketika keadaannya
   * sedang buruk.
   */
  async tautkanListing(
    schemaName: string,
    productId: string,
    listingId: string,
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.UMKM');

    const p = await this.tenantDb.query<{ owner_user_id: string | null }>(
      schemaName,
      `SELECT m.owner_user_id
         FROM "${schemaName}".village_umkm_product p
         JOIN "${schemaName}".village_umkm m ON m.id = p.village_umkm_id
        WHERE p.id = $1 AND p.village_unit_id = $2 AND p.deleted_at IS NULL`,
      [productId, u.id],
    );
    if (!p.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Produk UMKM tidak ditemukan.');

    // Port mengembalikan listingnya HANYA bila memang milik pemilik yang
    // ditanyakan. Karena itu `data` yang tidak kosong sudah berarti
    // kepemilikannya cocok; yang kosong berarti tidak ada, atau bukan miliknya.
    const cek = await this.marketplace.periksaListing({
      listingId,
      ownerUserId: p[0].owner_user_id ?? '',
    });
    const pemilikMenurutMarketplace = cek.data ? (p[0].owner_user_id ?? null) : null;

    const v = bolehTautkanListing({
      listingId,
      ownerUserId: pemilikMenurutMarketplace,
      umkmOwnerUserId: p[0].owner_user_id ?? null,
      tersedia: cek.tersedia,
    });
    if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

    await this.tenantDb
      .query(
        schemaName,
        `UPDATE "${schemaName}".village_umkm_product
            SET marketplace_listing_id = $2, linked_at = now(), linked_by = $3,
                updated_at = now(), version = version + 1
          WHERE id = $1`,
        [productId, listingId, user.userId],
      )
      .catch(terjemahkanBentrok('Listing ini sudah ditautkan ke produk lain.'));

    return { productId, listingId, linked: true };
  }

  // --- Wisata ---------------------------------------------------------------

  async catatWisata(
    schemaName: string,
    input: {
      code: string;
      name: string;
      category?: string;
      description?: string;
      address?: string;
      subAreaId?: string;
      managerName?: string;
      managerContact?: string;
      managerBumdesUnitId?: string;
      isFree?: boolean;
      entryFee?: number;
      openHours?: string;
      facilities?: string;
      photoCount?: number;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.WISATA');

    const rows = await this.tenantDb
      .query<{ id: string }>(
        schemaName,
        `INSERT INTO "${schemaName}".village_tourism_site
           (village_unit_id, code, name, category, description, address, sub_area_id,
            manager_name, manager_contact, manager_bumdes_unit_id, is_free, entry_fee,
            open_hours, facilities, photo_count, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING id`,
        [
          u.id,
          input.code,
          input.name,
          input.category ?? 'ALAM',
          input.description ?? null,
          input.address ?? null,
          input.subAreaId ?? null,
          input.managerName ?? null,
          input.managerContact ?? null,
          input.managerBumdesUnitId ?? null,
          input.isFree ?? false,
          input.entryFee ?? null,
          input.openHours ?? null,
          input.facilities ?? null,
          input.photoCount ?? 0,
          user.userId,
        ],
      )
      .catch(terjemahkanBentrok('Kode destinasi wisata sudah dipakai.'));

    return { id: rows[0].id };
  }

  /**
   * Menayangkan destinasi pada situs desa.
   *
   * Penayangan adalah janji kepada orang yang belum pernah datang. Kelengkapan
   * diperiksa di sini supaya pesannya dapat dibaca, dan diperiksa lagi oleh
   * constraint supaya jalan tulis lain tidak dapat melewatinya.
   */
  async tayangkanWisata(schemaName: string, siteId: string) {
    const u = await this.unit.pastikanLayak(schemaName, 'USAHA.WISATA');

    return this.tenantDb.transaction(schemaName, async (client) => {
      const s = await client.query<Record<string, string | boolean | number | null>>(
        `SELECT manager_name, manager_contact, entry_fee::text, is_free, photo_count
           FROM "${schemaName}".village_tourism_site
          WHERE id = $1 AND village_unit_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [siteId, u.id],
      );
      if (!s.rows.length) throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Destinasi tidak ditemukan.');

      const r = s.rows[0];
      const v = bolehTayangkanWisata({
        namaPengelola: r.manager_name as string | null,
        kontakPengelola: r.manager_contact as string | null,
        tarifMasuk: r.entry_fee === null ? null : Number(r.entry_fee),
        gratis: Boolean(r.is_free),
        adaFoto: Number(r.photo_count) >= 1,
      });
      if (!v.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, v.alasan!);

      await client.query(
        `UPDATE "${schemaName}".village_tourism_site
            SET is_published = TRUE, updated_at = now(), version = version + 1
          WHERE id = $1`,
        [siteId],
      );
      return { id: siteId, published: true };
    });
  }

  // --- Koperasi -------------------------------------------------------------

  /**
   * Koperasi yang beroperasi di desa.
   *
   * Menggabungkan catatan desa dengan apa yang dilaporkan eKoperasi, dan
   * menyatakan ketersediaan yang kedua secara terpisah. "0 koperasi" dan
   * "eKoperasi belum tersambung" tidak boleh terlihat sama.
   */
  async koperasiDiDesa(schemaName: string) {
    const u = await this.unit.unit(schemaName);

    const catatan = await this.tenantDb.query(
      schemaName,
      `SELECT id, name, cooperative_type, legal_number, contact_person, phone,
              external_cooperative_id, status
         FROM "${schemaName}".village_cooperative_presence
        WHERE village_unit_id = $1 AND deleted_at IS NULL
        ORDER BY name`,
      [u.id],
    );

    const luar = await this.koperasi.koperasiDiDesa(u.id);
    return {
      recorded: catatan,
      external: {
        available: luar.tersedia,
        note: luar.keterangan ?? null,
        data: luar.data,
      },
    };
  }

  async catatKoperasi(
    schemaName: string,
    input: {
      name: string;
      cooperativeType?: string;
      legalNumber?: string;
      address?: string;
      contactPerson?: string;
      phone?: string;
    },
    user: AuthenticatedUser,
  ) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<{ id: string }>(
      schemaName,
      `INSERT INTO "${schemaName}".village_cooperative_presence
         (village_unit_id, name, cooperative_type, legal_number, address, contact_person,
          phone, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
      [
        u.id,
        input.name,
        input.cooperativeType ?? null,
        input.legalNumber ?? null,
        input.address ?? null,
        input.contactPerson ?? null,
        input.phone ?? null,
        user.userId,
      ],
    );
    return { id: rows[0].id };
  }

  // --- Ringkasan ------------------------------------------------------------

  async ringkasanUsaha(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<Record<string, string>>(
      schemaName,
      `SELECT
         (SELECT count(*)::int FROM "${schemaName}".village_bumdes
           WHERE village_unit_id = $1 AND status <> 'BUBAR' AND deleted_at IS NULL) AS bumdes_count,
         (SELECT count(*)::int FROM "${schemaName}".village_bumdes_unit
           WHERE village_unit_id = $1 AND status = 'BERJALAN' AND deleted_at IS NULL) AS unit_count,
         (SELECT coalesce(sum(amount), 0)::text FROM "${schemaName}".village_bumdes_capital
           WHERE village_unit_id = $1) AS capital_total,
         (SELECT count(*)::int FROM "${schemaName}".village_umkm
           WHERE village_unit_id = $1 AND status = 'AKTIF' AND deleted_at IS NULL) AS umkm_count,
         (SELECT count(*)::int FROM "${schemaName}".village_tourism_site
           WHERE village_unit_id = $1 AND is_published = TRUE AND deleted_at IS NULL) AS tourism_published`,
      [u.id],
    );
    return rows[0];
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
