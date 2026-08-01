/**
 * Memasang dan menghapus data contoh koperasi.
 *
 * Dua tombol, dan keduanya harus dapat ditekan berkali-kali tanpa akibat
 * berbeda. Penyewa yang ragu akan menekannya dua kali; yang kedua tidak boleh
 * menggandakan apa pun maupun menggagalkan yang pertama.
 *
 * ## Larangan yang paling menentukan
 *
 * **Penghapusan tidak boleh menyentuh data sungguhan.** Penyaringnya adalah
 * awalan kode `CONTOH-`, bukan tanggal dan bukan `is_sample` — tanda yang
 * dapat tertulis pada baris sungguhan karena kekeliruan, dan sekali itu
 * terjadi, pembersihan berikutnya menghapus data penyewa tanpa ada yang
 * menyadarinya.
 *
 * **Peran dan hak akses tidak pernah ikut terhapus.** Keduanya bertanda
 * `REFERENCE`; menghapusnya mengunci pengurus keluar dari koperasinya sendiri.
 * Lihat `cooperative-sample.ts`.
 *
 * ## Seluruhnya dalam satu transaksi
 *
 * Pemasangan yang gagal di tengah meninggalkan koperasi separuh jadi — anggota
 * ada tetapi simpanannya tidak, dan laporan yang dibuat darinya salah tanpa
 * ada yang tahu sebabnya. Satu transaksi berarti: seluruhnya, atau tidak sama
 * sekali.
 */

import { Injectable, Logger } from '@nestjs/common';
import { TenantConnectionService } from '../../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../../common/errors/app-error';
import { AWALAN_CONTOH, URUTAN_PEMBERSIHAN } from '../cooperative-sample';
import {
  BULAN_SIMPANAN_WAJIB,
  KOMPONEN_SHU,
  SIMPANAN_POKOK,
  SIMPANAN_WAJIB_BULANAN,
  SURPLUS_TAHUN_BUKU,
  TAHUN_BUKU,
  bagiSisaTerbesar,
  bangunDataContoh,
} from './cooperative-sample-data';

interface Klien {
  query: <T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: T[] }>;
}

export interface RingkasanPemasangan {
  koperasi: string;
  /**
   * Benar bila koperasinya kami buat sendiri karena belum ada.
   *
   * Penyewa perlu tahu: bila salah, data contoh menumpang pada koperasinya
   * sendiri — dan penghapusan nanti tidak akan menyentuh profil itu.
   */
  koperasiDibuatDisini: boolean;
  anggota: number;
  rekeningSimpanan: number;
  mutasiSimpanan: number;
  pinjaman: number;
  angsuran: number;
  rapat: number;
  suara: number;
  shuDibagikan: number;
  totalBaris: number;
}

export interface RingkasanPenghapusan {
  terhapus: Record<string, number>;
  totalBaris: number;
  dipertahankan: string[];
}

/** Tanggal dalam tahun buku contoh. */
const tgl = (bulanKe: number, hari = 15): string =>
  `${TAHUN_BUKU}-${String(Math.min(12, bulanKe + 1)).padStart(2, '0')}-${String(hari).padStart(2, '0')}`;

@Injectable()
export class CooperativeSampleService {
  private readonly logger = new Logger(CooperativeSampleService.name);

  constructor(private readonly tenantDb: TenantConnectionService) {}

  /** Apakah data contoh sedang terpasang, dan seberapa banyak. */
  async status(schema: string) {
    const rows = await this.tenantDb.query<{ n: number }>(
      schema,
      `SELECT COUNT(*)::int AS n FROM "${schema}".cooperative_member
        WHERE member_number LIKE $1`,
      [`${AWALAN_CONTOH}%`],
    );
    const anggota = Number(rows[0]?.n ?? 0);

    const total = await this.hitungBaris(schema);
    return {
      terpasang: anggota > 0,
      anggota,
      totalBaris: total,
      tahunBuku: TAHUN_BUKU,
    };
  }

  /**
   * Memasang data contoh.
   *
   * Idempoten: bila sudah terpasang, mengembalikan ringkasannya tanpa menyemai
   * ulang. Penyemaian ulang akan menggandakan mutasi dan membuat laporan SHU
   * memuat angka yang tidak dapat dijelaskan.
   */
  async pasang(schema: string, userId: string | null): Promise<RingkasanPemasangan> {
    const keadaan = await this.status(schema);
    if (keadaan.terpasang) {
      throw AppError.conflict(
        ErrorCodes.CONFLICT,
        'Data contoh sudah terpasang. Hapus lebih dahulu bila hendak memasang ulang.',
      );
    }

    const d = bangunDataContoh();

    return this.tenantDb.transaction(schema, async (client) => {
      const S = schema;
      const c = client as unknown as Klien;

      /*
       * --- Koperasi ------------------------------------------------------
       *
       * Satu penyewa hanya boleh punya SATU koperasi — ditegakkan
       * `ux_cooperative_single_per_tenant` sejak K-1. Jadi data contoh
       * **menumpang pada koperasi yang sudah ada** bila ada, dan hanya
       * membuatnya sendiri bila belum.
       *
       * Itulah keadaan yang sebenarnya diinginkan: pengurus yang sudah
       * mengisi profil koperasinya ingin melihat bentuk laporannya dengan
       * anggota contoh — bukan memperoleh koperasi kedua yang tidak dapat
       * dibuat sistemnya.
       *
       * Akibatnya pada penghapusan: koperasi yang BUKAN kami buat tidak
       * pernah ikut terhapus. Pembedanya awalan kodenya sendiri.
       */
      const adaKop = await c.query<{ id: string; name: string; code: string }>(
        `SELECT id, name, code FROM "${S}".cooperative WHERE deleted_at IS NULL LIMIT 1`,
      );

      let KOP: string;
      let namaKoperasi: string;
      let koperasiDibuatDisini = false;

      if (adaKop.rows.length) {
        KOP = adaKop.rows[0].id;
        namaKoperasi = adaKop.rows[0].name;
      } else {
        const jenis = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_type (code, name, allows_lending, allows_retail)
           VALUES ($1, 'Koperasi Serba Usaha', TRUE, TRUE)
           ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [`${AWALAN_CONTOH}KSU`],
        );
        const kop = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative
             (code, name, short_name, slug, cooperative_type_id, status,
              legal_entity_number, legal_entity_date, establishment_date, membership_scope)
           VALUES ($1, 'Koperasi Serba Usaha Sejahtera Bersama', 'KSU Sejahtera', $2, $3,
                   'ACTIVE', '518/BH/XIV.7/2019', '2019-03-11', '2019-02-20', 'OPEN')
           RETURNING id`,
          [
            `${AWALAN_CONTOH}KSU-01`,
            `${AWALAN_CONTOH.toLowerCase()}ksu-sejahtera`,
            jenis.rows[0].id,
          ],
        );
        KOP = kop.rows[0].id;
        namaKoperasi = 'Koperasi Serba Usaha Sejahtera Bersama';
        koperasiDibuatDisini = true;
      }

      // --- Produk simpanan ----------------------------------------------
      const produk: Record<string, string> = {};
      for (const [kode, nama, kind, tarik, equity, wajib] of [
        [`${AWALAN_CONTOH}SP-POK`, 'Simpanan Pokok', 'PRINCIPAL', false, true, SIMPANAN_POKOK],
        [`${AWALAN_CONTOH}SP-WAJ`, 'Simpanan Wajib', 'MANDATORY', false, true, SIMPANAN_WAJIB_BULANAN],
        [`${AWALAN_CONTOH}SP-SUK`, 'Simpanan Sukarela', 'VOLUNTARY', true, false, 0],
      ] as Array<[string, string, string, boolean, boolean, number]>) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_saving_product
             (cooperative_id, code, name, saving_kind, allows_withdrawal, is_equity,
              required_amount, period_unit, counts_for_capital_service, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $6, TRUE)
           RETURNING id`,
          // Simpanan wajib menuntut periodenya pula — tanpa itu "wajib" tidak
          // menyebutkan setiap berapa lama, dan constraint K-3 menolaknya.
          [KOP, kode, nama, kind, tarik, equity, wajib || null, kind === 'MANDATORY' ? 'MONTHLY' : null],
        );
        produk[kind] = r.rows[0].id;
      }

      // --- Produk pinjaman ----------------------------------------------
      const produkPinjaman = await c.query<{ id: string }>(
        `INSERT INTO "${S}".cooperative_loan_product
           (cooperative_id, code, name, method, annual_rate, max_tenor_months, is_active)
         VALUES ($1, $2, 'Pinjaman Anggota Menurun', 'EFFECTIVE', 0.15, 24, TRUE)
         RETURNING id`,
        [KOP, `${AWALAN_CONTOH}PP-01`],
      );

      // --- Anggota ------------------------------------------------------
      const idAnggota: string[] = [];
      for (const a of d.anggota) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_member
             (cooperative_id, member_number, full_name, status, activated_at,
              terminated_at, termination_reason, identity_number, occupation)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id`,
          [
            KOP,
            a.nomorAnggota,
            a.nama,
            a.status,
            a.status === 'PROSPECT' ? null : `${TAHUN_BUKU - 1}-12-01`,
            a.status === 'TERMINATED' ? `${TAHUN_BUKU}-11-30` : null,
            a.status === 'TERMINATED' ? 'Mengundurkan diri.' : null,
            a.nik,
            a.pekerjaan,
          ],
        );
        idAnggota.push(r.rows[0].id);
      }

      // --- Simpanan dan mutasinya ---------------------------------------
      let mutasiSimpanan = 0;
      const idRekening = new Map<string, string>();

      for (const s of d.simpanan) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_saving_account
             (cooperative_id, member_id, product_id, account_number, opened_at, balance, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
           RETURNING id`,
          [
            KOP,
            idAnggota[s.anggotaIndex],
            produk[s.jenis],
            s.nomorRekening,
            `${TAHUN_BUKU - 1}-12-01`,
            s.saldo,
          ],
        );
        const rekId = r.rows[0].id;
        idRekening.set(s.nomorRekening, rekId);

        const tulisMutasi = async (
          bulanKe: number,
          jenis: string,
          nilai: number,
          saldoSesudah: number,
          catatan: string,
          urut: number,
        ) => {
          await c.query(
            `INSERT INTO "${S}".cooperative_saving_transaction
               (account_id, member_id, transaction_date, transaction_type,
                amount, balance_after, note, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [
              rekId,
              idAnggota[s.anggotaIndex],
              tgl(bulanKe),
              jenis,
              nilai,
              saldoSesudah,
              catatan,
              `${AWALAN_CONTOH}${s.nomorRekening}-${urut}`,
            ],
          );
          mutasiSimpanan += 1;
        };

        if (s.jenis === 'PRINCIPAL') {
          await tulisMutasi(0, 'DEPOSIT', s.saldo, s.saldo, 'Setoran simpanan pokok', 1);
        } else if (s.jenis === 'MANDATORY') {
          let saldo = 0;
          for (let m = 0; m < (s.jumlahSetoran ?? 0); m += 1) {
            saldo += s.setoranBulanan!;
            await tulisMutasi(
              BULAN_SIMPANAN_WAJIB - (s.jumlahSetoran ?? 0) + m,
              'DEPOSIT',
              s.setoranBulanan!,
              saldo,
              `Simpanan wajib bulan ke-${m + 1}`,
              m + 1,
            );
          }
        } else {
          let saldo = 0;
          let urut = 0;
          for (const m of s.mutasi ?? []) {
            urut += 1;
            saldo += m.jenis === 'DEPOSIT' ? m.nilai : -m.nilai;
            await tulisMutasi(
              m.bulanKe,
              m.jenis,
              m.nilai,
              saldo,
              m.jenis === 'DEPOSIT' ? 'Setoran sukarela' : 'Penarikan sukarela',
              urut,
            );
          }
        }
      }

      // --- Pinjaman dan angsuran ----------------------------------------
      let angsuran = 0;
      for (const p of d.pinjaman) {
        const pokokPerBulan = Math.round(p.pokok / p.tenor);
        const sisa = p.pokok - pokokPerBulan * (p.angsuranTerbayar);

        const r = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_loan
             (cooperative_id, member_id, product_id, loan_number, principal,
              outstanding_principal, tenor_months, method, annual_rate,
              disbursed_at, first_due_date, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'EFFECTIVE', $8, $9, $11, $10)
           RETURNING id`,
          [
            KOP,
            idAnggota[p.anggotaIndex],
            produkPinjaman.rows[0].id,
            p.nomor,
            p.pokok,
            p.status === 'PAID_OFF' ? 0 : Math.max(0, sisa),
            p.tenor,
            p.tarifTahunan,
            `${TAHUN_BUKU}-01-20`,
            // Menunggak disebut IN_ARREARS pada katalog status pinjaman K-4.
            p.status === 'OVERDUE' ? 'IN_ARREARS' : p.status === 'PAID_OFF' ? 'SETTLED' : 'ACTIVE',
            `${TAHUN_BUKU}-02-20`,
          ],
        );

        for (let n = 1; n <= p.tenor; n += 1) {
          const jasa = Math.round(((p.pokok - pokokPerBulan * (n - 1)) * p.tarifTahunan) / 12);
          const terbayar = n <= p.angsuranTerbayar;
          await c.query(
            `INSERT INTO "${S}".cooperative_installment_schedule
               (loan_id, installment_no, due_date, principal_due, interest_due,
                total_due, principal_paid, interest_paid, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [
              r.rows[0].id,
              n,
              tgl(Math.min(11, n)),
              pokokPerBulan,
              jasa,
              pokokPerBulan + jasa,
              terbayar ? pokokPerBulan : 0,
              terbayar ? jasa : 0,
              terbayar ? 'PAID' : p.status === 'OVERDUE' && n <= 4 ? 'OVERDUE' : 'SCHEDULED',
            ],
          );
          angsuran += 1;
        }
      }

      // --- Rapat Anggota Tahunan ----------------------------------------
      const aktifIndex = d.anggota
        .map((a, i) => ({ a, i }))
        .filter((x) => x.a.status === 'ACTIVE')
        .map((x) => x.i);

      const hadir = d.kehadiran.length;
      const wajibHadir = Math.ceil(aktifIndex.length * 0.5);

      const rapat = await c.query<{ id: string }>(
        `INSERT INTO "${S}".cooperative_meeting
           (cooperative_id, meeting_number, meeting_type, title, fiscal_year, scheduled_at,
            location, required_quorum_ratio, total_active_members, counted_for_quorum,
            required_count, quorum_reached, quorum_computed_at, status, opened_at, closed_at)
         VALUES ($1, $2, 'RAT', $3, $4, $5, 'Aula Koperasi Sejahtera Bersama',
                 0.5, $6, $7, $8, TRUE, $5, 'CLOSED', $5, $5)
         RETURNING id`,
        [
          KOP,
          `${AWALAN_CONTOH}RAT-${TAHUN_BUKU}`,
          `Rapat Anggota Tahunan Tahun Buku ${TAHUN_BUKU}`,
          TAHUN_BUKU,
          `${TAHUN_BUKU + 1}-03-15T09:00:00+07:00`,
          aktifIndex.length,
          hadir,
          wajibHadir,
        ],
      );
      const RAPAT = rapat.rows[0].id;

      const agenda: string[] = [];
      const mataAcara: Array<[string, string]> = [
        ['ANNUAL_REPORT', 'Laporan Pertanggungjawaban Pengurus'],
        ['ANNUAL_REPORT', 'Laporan Pengawas'],
        ['FINANCIAL_REPORT', `Pengesahan Laporan Keuangan Tahun Buku ${TAHUN_BUKU}`],
        ['SHU_DISTRIBUTION', 'Penetapan Pembagian Sisa Hasil Usaha'],
        ['BUDGET_PLAN', 'Rencana Kerja dan Anggaran Tahun Berikutnya'],
      ];
      for (let i = 0; i < mataAcara.length; i += 1) {
        const r = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_meeting_agenda
             (meeting_id, sequence_no, agenda_type, title)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [RAPAT, i + 1, mataAcara[i][0], mataAcara[i][1]],
        );
        agenda.push(r.rows[0].id);
      }

      /*
       * Kehadiran lewat kuasa WAJIB menyebut pemegang kuasanya — ditegakkan
       * constraint K-5. Surat kuasa tanpa nama penerimanya tidak dapat
       * diperiksa keabsahannya, dan kuorum yang dihitung dari surat semacam
       * itu tidak dapat dipertanggungjawabkan.
       */
      const pemegangKuasa = d.kehadiran.find((h) => h.mode === 'IN_PERSON')!;
      for (const h of d.kehadiran) {
        await c.query(
          `INSERT INTO "${S}".cooperative_meeting_attendance
             (meeting_id, member_id, mode, proxy_holder_member_id)
           VALUES ($1, $2, $3, $4)`,
          [
            RAPAT,
            idAnggota[h.anggotaIndex],
            h.mode,
            h.mode === 'PROXY' ? idAnggota[pemegangKuasa.anggotaIndex] : null,
          ],
        );
      }

      let suara = 0;
      for (const s of d.suara) {
        // Tiga mata acara terakhir adalah keputusan; suaranya dipetakan ke sana.
        await c.query(
          `INSERT INTO "${S}".cooperative_meeting_vote
             (meeting_id, agenda_id, member_id, choice, cast_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            RAPAT,
            agenda[s.agendaIndex + 2],
            idAnggota[s.anggotaIndex],
            s.pilihan,
            `${TAHUN_BUKU + 1}-03-15T11:00:00+07:00`,
          ],
        );
        suara += 1;
      }

      const idKeputusan: string[] = [];
      for (let i = 0; i < 3; i += 1) {
        const ya = d.suara.filter((s) => s.agendaIndex === i && s.pilihan === 'YES').length;
        const tidak = d.suara.filter((s) => s.agendaIndex === i && s.pilihan === 'NO').length;
        const abstain = d.suara.filter((s) => s.agendaIndex === i && s.pilihan === 'ABSTAIN').length;
        const kep = await c.query<{ id: string }>(
          `INSERT INTO "${S}".cooperative_meeting_decision
             (meeting_id, agenda_id, summary, decision_rule, votes_yes, votes_no,
              votes_abstain, valid_votes, required_yes, validity, decided_at)
           VALUES ($1, $2, $3, 'SIMPLE_MAJORITY', $4, $5, $6, $7, $8, 'VALID', $9)
           RETURNING id`,
          [
            RAPAT,
            agenda[i + 2],
            `${mataAcara[i + 2][1]} disetujui rapat.`,
            ya,
            tidak,
            abstain,
            // Abstain TIDAK termasuk suara sah — ditegakkan constraint K-5.
            ya + tidak,
            Math.floor((ya + tidak) / 2) + 1,
            `${TAHUN_BUKU + 1}-03-15T11:30:00+07:00`,
          ],
        );
        idKeputusan.push(kep.rows[0].id);
      }

      // --- SHU ------------------------------------------------------------
      const nilaiKomponen = bagiSisaTerbesar(
        SURPLUS_TAHUN_BUKU,
        KOMPONEN_SHU.map((k) => Math.round(k.ratio * 1_000_000)),
      );

      const hitung = await c.query<{ id: string }>(
        /*
         * `DISTRIBUTED` menuntut keputusan RAT, sidik jari masukan yang utuh,
         * dan tanggal pembagiannya — ditegakkan constraint K-6. Rantai itu
         * justru yang membuat laporan SHU dapat dipertanggungjawabkan: angka
         * yang dibagikan menunjuk keputusan rapat yang mengesahkannya.
         */
        `INSERT INTO "${S}".cooperative_shu_calculation
           (cooperative_id, fiscal_year, period_start, period_end, policy_code,
            policy_version, surplus, input_fingerprint, status, approved_at,
            meeting_decision_id, integrity_ok, distributed_at)
         VALUES ($1, $2, $3, $4, $5, 1, $6, $7, 'DISTRIBUTED', $8, $9, TRUE, $8)
         RETURNING id`,
        [
          KOP,
          TAHUN_BUKU,
          `${TAHUN_BUKU}-01-01`,
          `${TAHUN_BUKU}-12-31`,
          `${AWALAN_CONTOH}SHU-POLICY`,
          SURPLUS_TAHUN_BUKU,
          `${AWALAN_CONTOH}fingerprint-${TAHUN_BUKU}`,
          `${TAHUN_BUKU + 1}-03-15T11:30:00+07:00`,
          // Keputusan "Penetapan Pembagian Sisa Hasil Usaha" — mata acara kedua
          // dari tiga yang diputuskan.
          idKeputusan[1],
        ],
      );
      const HITUNG = hitung.rows[0].id;

      for (let i = 0; i < KOMPONEN_SHU.length; i += 1) {
        await c.query(
          `INSERT INTO "${S}".cooperative_shu_allocation
             (calculation_id, component, ratio, amount)
           VALUES ($1, $2, $3, $4)`,
          [HITUNG, KOMPONEN_SHU[i].component, KOMPONEN_SHU[i].ratio, nilaiKomponen[i]],
        );
      }

      /*
       * Bagian anggota dibagi dengan sisa-terbesar, bukan dibulatkan
       * sendiri-sendiri. Jumlah kolomnya wajib sama dengan nilai komponennya —
       * selisih beberapa rupiah di sini adalah hal pertama yang ditanyakan
       * anggota saat membaca laporan SHU.
       */
      const jasaModal = nilaiKomponen[KOMPONEN_SHU.findIndex((k) => k.component === 'CAPITAL_SERVICE')];
      const jasaUsaha = nilaiKomponen[KOMPONEN_SHU.findIndex((k) => k.component === 'PATRONAGE_SERVICE')];

      const bagianModal = bagiSisaTerbesar(jasaModal, d.shu.map((x) => x.rataSimpanan));
      const bagianUsaha = bagiSisaTerbesar(jasaUsaha, d.shu.map((x) => x.patronage));

      let dibagikan = 0;
      for (let i = 0; i < d.shu.length; i += 1) {
        const x = d.shu[i];
        const total = bagianModal[i] + bagianUsaha[i];

        await c.query(
          `INSERT INTO "${S}".cooperative_member_patronage
             (calculation_id, member_id, unit_business_amount, loan_interest_amount,
              service_amount, patronage_amount, average_equity_saving, membership_fraction,
              receives_shu)
           VALUES ($1, $2, $3, 0, 0, $3, $4, 1, TRUE)`,
          [HITUNG, idAnggota[x.anggotaIndex], x.patronage, x.rataSimpanan],
        );

        await c.query(
          `INSERT INTO "${S}".cooperative_shu_distribution
             (calculation_id, member_id, capital_service, patronage_service,
              total_amount, deduction_amount, net_amount, payment_status, idempotency_key)
           VALUES ($1, $2, $3, $4, $5, 0, $5, 'PAID', $6)`,
          [
            HITUNG,
            idAnggota[x.anggotaIndex],
            bagianModal[i],
            bagianUsaha[i],
            total,
            `${AWALAN_CONTOH}SHU-${TAHUN_BUKU}-${x.anggotaIndex}`,
          ],
        );
        dibagikan += 1;
      }

      const total = await this.hitungBarisDalam(c, S);
      this.logger.log(`Data contoh koperasi terpasang pada ${S}: ${total} baris.`);

      return {
        koperasi: namaKoperasi,
        koperasiDibuatDisini,
        anggota: d.anggota.length,
        rekeningSimpanan: d.simpanan.length,
        mutasiSimpanan,
        pinjaman: d.pinjaman.length,
        angsuran,
        rapat: 1,
        suara,
        shuDibagikan: dibagikan,
        totalBaris: total,
        userId,
      } as RingkasanPemasangan;
    });
  }

  /**
   * Menghapus data contoh.
   *
   * Urutannya dari yang paling bergantung ke yang paling dirujuk — kegagalan
   * di tengah karena kunci asing meninggalkan keadaan separuh bersih yang
   * lebih sulit dipulihkan daripada tidak dibersihkan sama sekali.
   */
  async hapus(schema: string): Promise<RingkasanPenghapusan> {
    return this.tenantDb.transaction(schema, async (client) => {
      const S = schema;
      const c = client as unknown as Klien;
      const p = `${AWALAN_CONTOH}%`;
      const terhapus: Record<string, number> = {};

      const hapus = async (label: string, sql: string, params: unknown[] = [p]) => {
        const r = await c.query<Record<string, never>>(sql, params);
        terhapus[label] = (r as unknown as { rowCount?: number }).rowCount ?? 0;
      };

      // Anak-anak lebih dahulu, lewat induknya yang berkode contoh.
      await hapus(
        'shu_distribution',
        `DELETE FROM "${S}".cooperative_shu_distribution WHERE calculation_id IN
           (SELECT id FROM "${S}".cooperative_shu_calculation WHERE input_fingerprint LIKE $1)`,
      );
      await hapus(
        'patronage',
        `DELETE FROM "${S}".cooperative_member_patronage WHERE calculation_id IN
           (SELECT id FROM "${S}".cooperative_shu_calculation WHERE input_fingerprint LIKE $1)`,
      );
      await hapus(
        'shu_allocation',
        `DELETE FROM "${S}".cooperative_shu_allocation WHERE calculation_id IN
           (SELECT id FROM "${S}".cooperative_shu_calculation WHERE input_fingerprint LIKE $1)`,
      );
      await hapus(
        'shu_calculation',
        `DELETE FROM "${S}".cooperative_shu_calculation WHERE input_fingerprint LIKE $1`,
      );

      await hapus(
        'meeting_decision',
        `DELETE FROM "${S}".cooperative_meeting_decision WHERE meeting_id IN
           (SELECT id FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1)`,
      );
      await hapus(
        'meeting_vote',
        `DELETE FROM "${S}".cooperative_meeting_vote WHERE meeting_id IN
           (SELECT id FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1)`,
      );
      await hapus(
        'meeting_attendance',
        `DELETE FROM "${S}".cooperative_meeting_attendance WHERE meeting_id IN
           (SELECT id FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1)`,
      );
      await hapus(
        'meeting_agenda',
        `DELETE FROM "${S}".cooperative_meeting_agenda WHERE meeting_id IN
           (SELECT id FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1)`,
      );
      await hapus('meeting', `DELETE FROM "${S}".cooperative_meeting WHERE meeting_number LIKE $1`);

      await hapus(
        'installment',
        `DELETE FROM "${S}".cooperative_installment_schedule WHERE loan_id IN
           (SELECT id FROM "${S}".cooperative_loan WHERE loan_number LIKE $1)`,
      );
      await hapus('loan', `DELETE FROM "${S}".cooperative_loan WHERE loan_number LIKE $1`);

      await hapus(
        'saving_transaction',
        `DELETE FROM "${S}".cooperative_saving_transaction WHERE idempotency_key LIKE $1`,
      );
      await hapus(
        'saving_account',
        `DELETE FROM "${S}".cooperative_saving_account WHERE account_number LIKE $1`,
      );

      await hapus('member', `DELETE FROM "${S}".cooperative_member WHERE member_number LIKE $1`);

      await hapus(
        'loan_product',
        `DELETE FROM "${S}".cooperative_loan_product WHERE code LIKE $1`,
      );
      await hapus(
        'saving_product',
        `DELETE FROM "${S}".cooperative_saving_product WHERE code LIKE $1`,
      );
      await hapus('cooperative', `DELETE FROM "${S}".cooperative WHERE code LIKE $1`);
      await hapus('cooperative_type', `DELETE FROM "${S}".cooperative_type WHERE code LIKE $1`);

      const totalBaris = Object.values(terhapus).reduce((s, n) => s + n, 0);
      this.logger.log(`Data contoh koperasi dihapus dari ${S}: ${totalBaris} baris.`);

      return {
        terhapus,
        totalBaris,
        /*
         * Disebutkan pada jawabannya, bukan hanya pada dokumentasi. Penyewa
         * yang menekan "Hapus data contoh" berhak tahu apa yang SENGAJA
         * dipertahankan — dan mengapa peran serta hak aksesnya tidak ikut
         * hilang.
         */
        dipertahankan: URUTAN_PEMBERSIHAN.length
          ? ['Peran, menu, dan hak akses koperasi', 'Jenis koperasi acuan', 'Komponen SHU acuan']
          : [],
      };
    });
  }

  private async hitungBaris(schema: string): Promise<number> {
    const r = await this.tenantDb.query<{ n: string }>(
      schema,
      `SELECT
         (SELECT COUNT(*) FROM "${schema}".cooperative_member WHERE member_number LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_saving_account WHERE account_number LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_saving_transaction WHERE idempotency_key LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_loan WHERE loan_number LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_meeting WHERE meeting_number LIKE $1)
         AS n`,
      [`${AWALAN_CONTOH}%`],
    );
    return Number(r[0]?.n ?? 0);
  }

  private async hitungBarisDalam(c: Klien, schema: string): Promise<number> {
    const r = await c.query<{ n: string }>(
      `SELECT
         (SELECT COUNT(*) FROM "${schema}".cooperative_member WHERE member_number LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_saving_account WHERE account_number LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_saving_transaction WHERE idempotency_key LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_loan WHERE loan_number LIKE $1) +
         (SELECT COUNT(*) FROM "${schema}".cooperative_meeting WHERE meeting_number LIKE $1)
         AS n`,
      [`${AWALAN_CONTOH}%`],
    );
    return Number(r.rows[0]?.n ?? 0);
  }
}
