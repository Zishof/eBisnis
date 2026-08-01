/**
 * Pabrik data contoh info-desa.
 *
 * Menyiapkan satu desa atau kelurahan yang tampak sungguhan supaya penyewa baru
 * dapat membuka tiap menu dan melihat bentuk isinya, bukan layar kosong yang
 * tidak memberi tahu apa pun.
 *
 * ## Aturan yang tidak boleh dilanggar
 *
 * 1. **Seluruhnya bertanda `is_sample` dan `sample_batch_id`.** Tanpa itu,
 *    pembersihan akan melewatkannya, dan penyewa yang mengira sudah
 *    membersihkan ruang kerjanya akan menemukan penduduk karangan pada laporan
 *    kependudukannya berbulan-bulan kemudian.
 *
 * 2. **Peran dan hak akses TIDAK disemai ulang maupun ditandai contoh.** Ia
 *    data acuan. Menandainya berarti pembersihan menghapus seluruh hak akses
 *    penyewa, dan penyewa itu terkunci dari sistemnya sendiri karena menekan
 *    tombol yang menjanjikan kebalikannya.
 *
 * 3. **Kelayakan profil dihormati.** Kelurahan tidak memperoleh APBDes, BPD,
 *    maupun BUMDes contoh — bukan karena belum dibuat, melainkan karena data
 *    contoh yang melanggar kelayakan mengajarkan hal yang salah.
 *
 * 4. **Pembersihan hanya menyentuh baris bertanda contoh dari batch yang
 *    disebut**, dan cakupannya diperiksa sebelum dijalankan.
 */

import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { AuthenticatedUser } from '../../common/decorators';
import { VillageUnitService } from './village-unit.service';
import { bolehBersihkan, bolehSemai, periksaCakupanBersih, rencanakan } from './village-sample';

/**
 * Tabel yang ikut dibersihkan, berurutan dari anak ke induk.
 *
 * Urutannya penting: menghapus induk lebih dahulu akan ditolak foreign key, dan
 * penghapusan yang gagal di tengah meninggalkan data contoh separuh — keadaan
 * yang lebih membingungkan daripada tidak membersihkan sama sekali.
 */
const URUTAN_BERSIH = [
  'village_news',
  'village_agenda',
  'village_page',
  'village_asset_borrowing',
  'village_asset',
  'village_asset_category',
  'village_bumdes_result',
  'village_bumdes_capital',
  'village_bumdes_unit',
  'village_bumdes',
  'village_budget_transaction',
  'village_budget_line',
  'village_budget',
  'village_rkp',
  'village_rpjm',
  'village_service_request',
  'village_service_catalog',
  'village_resident',
  'village_family',
  'village_rt',
  'village_rw',
  'village_sub_area',
] as const;

const NAMA_DEPAN = [
  'Sumiati', 'Karto', 'Suparjo', 'Wagiyem', 'Slamet', 'Painem', 'Tukiman', 'Sri Rahayu',
  'Bambang', 'Siti Aminah', 'Joko', 'Endang', 'Marsudi', 'Yuliana', 'Hartono', 'Ngatinem',
];

@Injectable()
export class VillageSampleService {
  private readonly logger = new Logger(VillageSampleService.name);

  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly unit: VillageUnitService,
  ) {}

  /** Rencana semai untuk profil penyewa ini, sebelum apa pun ditulis. */
  async rencana(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const r = rencanakan(u.profileType, { aktif: new Set(u.enabledFeatures) });
    return {
      profileType: u.profileType,
      sections: r.bagian.map((b) => ({
        code: b.kode,
        label: b.label,
        willSeed: b.disemai,
        skipReason: b.alasanDilewati ?? null,
        estimatedRows: b.perkiraanBaris,
      })),
      estimatedTotal: r.totalPerkiraan,
      note:
        'Peran dan hak akses tidak termasuk data contoh. Ia data acuan yang tetap ada setelah ' +
        'pembersihan.',
    };
  }

  async batchAktif(schemaName: string) {
    const u = await this.unit.unit(schemaName);
    const rows = await this.tenantDb.query<{ sample_batch_id: string; n: string; at: string }>(
      schemaName,
      `SELECT sample_batch_id, count(*)::text AS n, min(created_at)::text AS at
         FROM "${schemaName}".village_resident
        WHERE village_unit_id = $1 AND is_sample = TRUE AND sample_batch_id IS NOT NULL
        GROUP BY sample_batch_id ORDER BY 3 DESC`,
      [u.id],
    );
    return rows.map((r) => ({ batchId: r.sample_batch_id, residents: Number(r.n), createdAt: r.at }));
  }

  /**
   * Menyemai data contoh.
   *
   * Seluruhnya di dalam satu transaksi. Penyemaian yang gagal di tengah
   * meninggalkan desa separuh jadi, dan penyewa yang melihatnya tidak dapat
   * membedakannya dari cacat sistem.
   */
  async semai(schemaName: string, user: AuthenticatedUser) {
    const u = await this.unit.unit(schemaName);
    const aktif = await this.batchAktif(schemaName);

    const izin = bolehSemai(aktif.length);
    if (!izin.boleh) throw AppError.conflict(ErrorCodes.CONFLICT, izin.alasan!);

    const rencanaSemai = rencanakan(u.profileType, { aktif: new Set(u.enabledFeatures) });
    const batchId = randomUUID();
    const disemai = new Set(rencanaSemai.bagian.filter((b) => b.disemai).map((b) => b.kode));

    return this.tenantDb.transaction(schemaName, async (client) => {
      const hasil: Record<string, number> = {};

      if (disemai.has('WILAYAH')) {
        hasil.WILAYAH = await this.semaiWilayah(client, schemaName, u, batchId, user.userId);
      }
      if (disemai.has('PENDUDUK')) {
        hasil.PENDUDUK = await this.semaiPenduduk(client, schemaName, u, batchId, user.userId);
      }
      if (disemai.has('LAYANAN')) {
        hasil.LAYANAN = await this.semaiLayanan(client, schemaName, u, batchId, user.userId);
      }
      if (disemai.has('ASET')) {
        hasil.ASET = await this.semaiAset(client, schemaName, u, batchId, user.userId);
      }
      if (disemai.has('SITUS')) {
        hasil.SITUS = await this.semaiSitus(client, schemaName, u, batchId, user.userId);
      }
      // Hanya desa. Kelurahan menerima pagu dari daerah dan tidak menyusun
      // APBDes sendiri; memberinya APBDes contoh mengajarkan hal yang salah.
      if (disemai.has('APBDES')) {
        hasil.APBDES = await this.semaiApbdes(client, schemaName, u, batchId, user.userId);
      }
      if (disemai.has('BUMDES')) {
        hasil.BUMDES = await this.semaiBumdes(client, schemaName, u, batchId, user.userId);
      }

      const total = Object.values(hasil).reduce((n, v) => n + v, 0);
      this.logger.log(
        `Data contoh ${u.profileType} disemai pada ${schemaName}: ${total} baris, batch ${batchId}`,
      );
      return {
        batchId,
        profileType: u.profileType,
        seeded: hasil,
        total,
        skipped: rencanaSemai.bagian
          .filter((b) => !b.disemai)
          .map((b) => ({ code: b.kode, reason: b.alasanDilewati })),
      };
    });
  }

  /**
   * Membersihkan satu batch data contoh.
   *
   * Cakupannya dihitung lebih dahulu dan dibandingkan dengan jumlah baris
   * bertanda contoh. Bila penghapusan akan menyentuh lebih banyak daripada itu,
   * ia dihentikan — yang salah pada kondisi penghapusan tidak boleh dijalankan
   * lalu diperbaiki.
   */
  async bersihkan(schemaName: string, batchId: string) {
    const u = await this.unit.unit(schemaName);

    const izin = bolehBersihkan(batchId);
    if (!izin.boleh) throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, izin.alasan!);

    return this.tenantDb.transaction(schemaName, async (client) => {
      let contoh = 0;
      let sungguhan = 0;
      for (const tabel of URUTAN_BERSIH) {
        const c = await client.query<{ n: string; m: string }>(
          `SELECT count(*) FILTER (WHERE is_sample = TRUE AND sample_batch_id = $2)::text AS n,
                  count(*) FILTER (WHERE is_sample = FALSE)::text AS m
             FROM "${schemaName}".${tabel} WHERE village_unit_id = $1`,
          [u.id, batchId],
        );
        contoh += Number(c.rows[0].n);
        sungguhan += Number(c.rows[0].m);
      }

      let terhapus = 0;
      for (const tabel of URUTAN_BERSIH) {
        const d = await client.query(
          // Tiga syarat sekaligus, dan ketiganya perlu: unit yang benar, benar
          // bertanda contoh, dan batch yang disebut. Melepas salah satunya
          // membuat penghapusan menyentuh data yang bukan sasarannya.
          `DELETE FROM "${schemaName}".${tabel}
            WHERE village_unit_id = $1 AND is_sample = TRUE AND sample_batch_id = $2`,
          [u.id, batchId],
        );
        terhapus += d.rowCount ?? 0;
      }

      const aman = periksaCakupanBersih({ batchId, barisContoh: contoh, barisSungguhan: sungguhan }, terhapus);
      if (!aman.boleh) {
        // Transaksi dibatalkan seluruhnya. Lebih baik tidak membersihkan apa
        // pun daripada membersihkan sesuatu yang bukan data contoh.
        throw AppError.internal(ErrorCodes.INTERNAL_ERROR, aman.alasan!);
      }

      this.logger.log(`Batch ${batchId} dibersihkan pada ${schemaName}: ${terhapus} baris`);
      return { batchId, deleted: terhapus, realRowsUntouched: sungguhan };
    });
  }

  // --- Bagian penyemaian ----------------------------------------------------

  private async semaiWilayah(
    client: PoolClient,
    s: string,
    u: { id: string; profileType: string },
    batchId: string,
    userId: string,
  ): Promise<number> {
    let n = 0;
    const kind = u.profileType === 'DESA' ? 'DUSUN' : 'LINGKUNGAN';
    const namaSub = u.profileType === 'DESA' ? ['Krajan', 'Sidomulyo'] : ['Melati', 'Kenanga'];

    for (const [i, nama] of namaSub.entries()) {
      const sub = await client.query<{ id: string }>(
        `INSERT INTO "${s}".village_sub_area
           (village_unit_id, kind, code, name, head_name, is_sample, sample_batch_id, created_by)
         VALUES ($1,$2,$3,$4,$5,TRUE,$6,$7) RETURNING id`,
        [u.id, kind, `${kind.slice(0, 3)}-0${i + 1}`, nama, NAMA_DEPAN[i], batchId, userId],
      );
      n += 1;

      for (let rw = 1; rw <= 2; rw += 1) {
        const nomorRw = String(i * 2 + rw).padStart(3, '0');
        const barisRw = await client.query<{ id: string }>(
          `INSERT INTO "${s}".village_rw
             (village_unit_id, sub_area_id, number, head_name, is_sample, sample_batch_id, created_by)
           VALUES ($1,$2,$3,$4,TRUE,$5,$6) RETURNING id`,
          [u.id, sub.rows[0].id, nomorRw, NAMA_DEPAN[(i + rw) % NAMA_DEPAN.length], batchId, userId],
        );
        n += 1;

        for (let rt = 1; rt <= 3; rt += 1) {
          await client.query(
            `INSERT INTO "${s}".village_rt
               (village_rw_id, number, head_name, is_sample, sample_batch_id, created_by)
             VALUES ($1,$2,$3,TRUE,$4,$5)`,
            [
              barisRw.rows[0].id,
              String(rt).padStart(3, '0'),
              NAMA_DEPAN[(i + rw + rt) % NAMA_DEPAN.length],
              batchId,
              userId,
            ],
          );
          n += 1;
        }
      }
    }
    return n;
  }

  private async semaiPenduduk(
    client: PoolClient,
    s: string,
    u: { id: string },
    batchId: string,
    userId: string,
  ): Promise<number> {
    const rt = await client.query<{ id: string }>(
      `SELECT t.id FROM "${s}".village_rt t
         JOIN "${s}".village_rw w ON w.id = t.village_rw_id
        WHERE w.village_unit_id = $1 AND t.is_sample = TRUE AND t.sample_batch_id = $2
        ORDER BY t.number`,
      [u.id, batchId],
    );
    if (!rt.rows.length) return 0;

    let n = 0;
    for (let k = 0; k < 20; k += 1) {
      const rtId = rt.rows[k % rt.rows.length].id;
      const keluarga = await client.query<{ id: string }>(
        `INSERT INTO "${s}".village_family
           (village_unit_id, family_card_no, village_rt_id, address, is_sample, sample_batch_id,
            created_by)
         VALUES ($1,$2,$3,$4,TRUE,$5,$6) RETURNING id`,
        [
          u.id,
          `3301${String(10_000_000_000 + k).slice(0, 12)}`,
          rtId,
          `Jalan Contoh Nomor ${k + 1}`,
          batchId,
          userId,
        ],
      );
      n += 1;

      // Kepala keluarga, lalu satu sampai tiga anggota.
      const anggota = 2 + (k % 3);
      for (let a = 0; a < anggota; a += 1) {
        const nama = `${NAMA_DEPAN[(k + a) % NAMA_DEPAN.length]} ${a === 0 ? '' : 'Putra'}`.trim();
        await client.query(
          `INSERT INTO "${s}".village_resident
             (village_unit_id, village_family_id, family_relation, national_id, full_name,
              birth_date, gender, marital_status, village_rt_id, resident_status,
              is_sample, sample_batch_id, created_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'TETAP',TRUE,$10,$11)`,
          [
            u.id,
            keluarga.rows[0].id,
            a === 0 ? 'KEPALA_KELUARGA' : 'ANAK',
            // NIK contoh: enam belas angka, berawalan 33 agar mudah dikenali
            // sebagai data contoh oleh siapa pun yang membacanya.
            `33${String(1_000_000_000_000 + k * 10 + a).slice(0, 14)}`,
            nama,
            a === 0 ? '1985-05-14' : '2012-08-02',
            a % 2 === 0 ? 'L' : 'P',
            a === 0 ? 'KAWIN' : 'BELUM_KAWIN',
            rtId,
            batchId,
            userId,
          ],
        );
        n += 1;
      }
    }
    return n;
  }

  private async semaiLayanan(
    client: PoolClient,
    s: string,
    u: { id: string },
    batchId: string,
    userId: string,
  ): Promise<number> {
    const layanan = [
      ['SKD', 'Surat Keterangan Domisili'],
      ['SKTM', 'Surat Keterangan Tidak Mampu'],
      ['SKU', 'Surat Keterangan Usaha'],
      ['SPN', 'Surat Pengantar Nikah'],
    ];
    let n = 0;
    for (const [kode, nama] of layanan) {
      await client.query(
        `INSERT INTO "${s}".village_service_catalog
           (village_unit_id, code, name, is_active, is_sample, sample_batch_id, created_by)
         VALUES ($1,$2,$3,TRUE,TRUE,$4,$5)
         ON CONFLICT DO NOTHING`,
        [u.id, kode, nama, batchId, userId],
      );
      n += 1;
    }
    return n;
  }

  private async semaiAset(
    client: PoolClient,
    s: string,
    u: { id: string; profileType: string },
    batchId: string,
    userId: string,
  ): Promise<number> {
    const kepemilikan = u.profileType === 'DESA' ? 'DESA' : 'DAERAH';
    const aset: Array<[string, string, string, boolean]> = [
      ['AST-B-0001', 'Proyektor', 'B', true],
      ['AST-B-0002', 'Tenda Serbaguna', 'B', true],
      ['AST-C-0001', 'Balai Pertemuan', 'C', false],
      ['AST-B-0003', 'Komputer Pelayanan', 'B', false],
    ];
    let n = 0;
    for (const [nomor, nama, kib, dapatDipinjam] of aset) {
      await client.query(
        `INSERT INTO "${s}".village_asset
           (village_unit_id, register_number, name, kib_group, ownership, condition,
            is_lendable, acquisition_source, is_sample, sample_batch_id, created_by)
         VALUES ($1,$2,$3,$4,$5,'BAIK',$6,'PEMBELIAN',TRUE,$7,$8)`,
        [u.id, nomor, nama, kib, kepemilikan, dapatDipinjam, batchId, userId],
      );
      n += 1;
    }
    return n;
  }

  private async semaiSitus(
    client: PoolClient,
    s: string,
    u: { id: string; name: string; profileType: string },
    batchId: string,
    userId: string,
  ): Promise<number> {
    const sebutan = u.profileType === 'DESA' ? 'Desa' : 'Kelurahan';
    let n = 0;

    await client.query(
      `INSERT INTO "${s}".village_page
         (village_unit_id, slug, title, body, status, published_at, is_sample, sample_batch_id,
          created_by)
       VALUES ($1,'profil',$2,$3,'TAYANG', now(), TRUE,$4,$5)`,
      [
        u.id,
        `Profil ${sebutan} ${u.name}`,
        `Halaman contoh. ${sebutan} ${u.name} berada di wilayah kecamatan setempat dan ` +
          'melayani warganya melalui kantor pemerintahan setiap hari kerja.',
        batchId,
        userId,
      ],
    );
    n += 1;

    const berita = [
      ['kerja-bakti-minggu-ini', 'Kerja Bakti Minggu Ini'],
      ['musyawarah-perencanaan', 'Musyawarah Perencanaan Pembangunan'],
      ['pelayanan-administrasi', 'Jadwal Pelayanan Administrasi'],
    ];
    for (const [slug, judul] of berita) {
      await client.query(
        `INSERT INTO "${s}".village_news
           (village_unit_id, slug, title, summary, body, status, published_at, author_name,
            is_sample, sample_batch_id, created_by)
         VALUES ($1,$2,$3,$4,$5,'TAYANG', now(), $6, TRUE,$7,$8)`,
        [
          u.id,
          slug,
          judul,
          'Ringkasan berita contoh.',
          `Ini berita contoh untuk ${judul.toLowerCase()}. Isinya cukup panjang agar memenuhi ` +
            'syarat penayangan dan memperlihatkan bentuk halaman berita yang sebenarnya.',
          `Sekretaris ${sebutan}`,
          batchId,
          userId,
        ],
      );
      n += 1;
    }

    await client.query(
      `INSERT INTO "${s}".village_agenda
         (village_unit_id, title, start_at, location, is_public, is_sample, sample_batch_id,
          created_by)
       VALUES ($1,'Musyawarah Desa', now() + interval '7 days', 'Balai Pertemuan', TRUE, TRUE,$2,$3)`,
      [u.id, batchId, userId],
    );
    n += 1;
    return n;
  }

  private async semaiApbdes(
    client: PoolClient,
    s: string,
    u: { id: string },
    batchId: string,
    userId: string,
  ): Promise<number> {
    const tahun = new Date().getFullYear();
    let n = 0;

    const rpjm = await client.query<{ id: string }>(
      `INSERT INTO "${s}".village_rpjm
         (village_unit_id, start_year, end_year, title, status, is_sample, sample_batch_id, created_by)
       VALUES ($1,$2,$3,$4,'DITETAPKAN',TRUE,$5,$6) RETURNING id`,
      [u.id, tahun - 1, tahun + 4, `RPJM Desa ${tahun - 1}–${tahun + 4}`, batchId, userId],
    );
    n += 1;

    await client.query(
      `INSERT INTO "${s}".village_rkp
         (village_unit_id, village_rpjm_id, fiscal_year, title, status, is_sample, sample_batch_id,
          created_by)
       VALUES ($1,$2,$3,$4,'DITETAPKAN',TRUE,$5,$6)`,
      [u.id, rpjm.rows[0].id, tahun, `RKP Desa ${tahun}`, batchId, userId],
    );
    n += 1;

    const anggaran = await client.query<{ id: string }>(
      `INSERT INTO "${s}".village_budget
         (village_unit_id, fiscal_year, status, regulation_number, established_at,
          is_sample, sample_batch_id, created_by)
       VALUES ($1,$2,'DITETAPKAN',$3, CURRENT_DATE, TRUE,$4,$5) RETURNING id`,
      [u.id, tahun, `Perdes Nomor 3 Tahun ${tahun}`, batchId, userId],
    );
    n += 1;

    const baris: Array<[string, string, string, number]> = [
      ['PENDAPATAN', '4.1.01', 'Dana Desa', 800_000_000],
      ['PENDAPATAN', '4.2.01', 'Alokasi Dana Desa', 400_000_000],
      ['BELANJA', '5.1.01', 'Penyelenggaraan Pemerintahan', 500_000_000],
      ['BELANJA', '5.2.01', 'Pembangunan Desa', 700_000_000],
    ];
    for (const [jenis, kode, nama, nilai] of baris) {
      await client.query(
        `INSERT INTO "${s}".village_budget_line
           (village_budget_id, budget_type, account_code, account_name, ceiling_amount, created_by)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [anggaran.rows[0].id, jenis, kode, nama, nilai, userId],
      );
      n += 1;
    }

    await client.query(
      `UPDATE "${s}".village_budget
          SET total_revenue = 1200000000, total_expenditure = 1200000000
        WHERE id = $1`,
      [anggaran.rows[0].id],
    );
    return n;
  }

  private async semaiBumdes(
    client: PoolClient,
    s: string,
    u: { id: string; name: string },
    batchId: string,
    userId: string,
  ): Promise<number> {
    const tahun = new Date().getFullYear();
    const bumdes = await client.query<{ id: string }>(
      `INSERT INTO "${s}".village_bumdes
         (village_unit_id, name, regulation_number, established_at, status, village_share_pct,
          ad_art_established, is_sample, sample_batch_id, created_by)
       VALUES ($1,$2,$3, CURRENT_DATE, 'AKTIF', 30, TRUE, TRUE,$4,$5) RETURNING id`,
      [u.id, `BUMDes ${u.name} Sejahtera`, `Perdes Nomor 5 Tahun ${tahun}`, batchId, userId],
    );

    await client.query(
      `INSERT INTO "${s}".village_bumdes_unit
         (village_unit_id, village_bumdes_id, code, name, business_type, status,
          is_sample, sample_batch_id, created_by)
       VALUES ($1,$2,'UNIT-01','Toko Sembako Desa','PERDAGANGAN','BERJALAN',TRUE,$3,$4)`,
      [u.id, bumdes.rows[0].id, batchId, userId],
    );
    return 2;
  }
}
