/**
 * Booking engine publik (MI-9) -- pencarian ketersediaan, pemesanan
 * mandiri, dan kelola pemesanan TANPA staf. Sengaja TIDAK menduplikasi
 * logika kapasitas/idempotensi/kunci optimistik -- memakai ULANG
 * `HospitalityReservationService.catatReservasi()`/`ubahStatus()` yang
 * sudah teruji (MI-8), supaya jalur publik dan jalur staf mendapat
 * jaminan yang SAMA persis, bukan implementasi kedua yang bisa berbeda
 * perilakunya diam-diam.
 */

import { Injectable } from '@nestjs/common';
import { TenantConnectionService } from '../../infrastructure/database/tenant-connection.service';
import { AppError, ErrorCodes } from '../../common/errors/app-error';
import { HospitalityReservationService, type DetailReservasi } from './hospitality-reservation.service';
import {
  MasukanPemesananPublik,
  MasukanPencarian,
  jumlahMalam,
  validasiPemesananPublik,
  validasiPencarian,
} from './hospitality-booking-engine';

export interface HasilPencarianTipeKamar {
  room_type_id: string;
  code: string;
  nama: string;
  deskripsi: string | null;
  okupansi_maks: number;
  rate_per_malam: string;
  malam: number;
  total: number;
  tersedia: number;
}

@Injectable()
export class HospitalityBookingEngineService {
  constructor(
    private readonly tenantDb: TenantConnectionService,
    private readonly reservasi: HospitalityReservationService,
  ) {}

  /**
   * Mencari tipe kamar yang TERSEDIA dan TERPUBLIKASI (`published_rate_amount`
   * terisi) untuk rentang menginap yang diminta.
   *
   * Perhitungan ketersediaan sama persis dengan MI-6/MI-8: kamar aktif
   * tanpa blokir (MI-6) yang tumpang tindih rentang, dikurangi reservasi
   * HOLD/CONFIRMED (MI-8) yang tumpang tindih, ditambah alotmen lebih.
   * Transparan -- total ditampilkan sebagai rate x malam, bukan angka
   * tersembunyi yang baru muncul di langkah berikutnya.
   */
  async cariKetersediaan(
    schemaName: string,
    propertyId: string,
    masukan: MasukanPencarian,
  ): Promise<HasilPencarianTipeKamar[]> {
    const galat = validasiPencarian(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    const S = `"${schemaName}"`;
    const properti = await this.tenantDb.queryOne(
      schemaName,
      `SELECT id FROM ${S}.hospitality_property WHERE id = $1 AND deleted_at IS NULL AND status = 'ACTIVE'`,
      [propertyId],
    );
    if (!properti) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Properti tidak ditemukan.');
    }

    const malam = jumlahMalam(masukan.checkin!, masukan.checkout!);
    const okupansiDiminta = (masukan.dewasa ?? 1) + (masukan.anak ?? 0);

    const tipeKamar = await this.tenantDb.query<{
      id: string;
      code: string;
      name: string;
      description: string | null;
      max_occupancy: number;
      published_rate_amount: string;
      overbooking_limit: number;
    }>(
      schemaName,
      `SELECT id, code, name, description, max_occupancy, published_rate_amount, overbooking_limit
         FROM ${S}.hospitality_room_type
        WHERE property_id = $1 AND deleted_at IS NULL
          AND published_rate_amount IS NOT NULL
          AND max_occupancy >= $2
        ORDER BY published_rate_amount ASC`,
      [propertyId, okupansiDiminta],
    );

    const hasil: HasilPencarianTipeKamar[] = [];
    for (const rt of tipeKamar) {
      const bebasRow = await this.tenantDb.queryOne<{ n: string }>(
        schemaName,
        `SELECT COUNT(*)::text AS n
           FROM ${S}.hospitality_room r
          WHERE r.room_type_id = $1 AND r.deleted_at IS NULL AND r.status = 'AVAILABLE'
            AND NOT EXISTS (
              SELECT 1 FROM ${S}.hospitality_room_block b
               WHERE b.room_id = r.id AND b.deleted_at IS NULL
                 AND b.stay_date >= $2 AND b.stay_date < $3
            )`,
        [rt.id, masukan.checkin, masukan.checkout],
      );
      const sudahDipesanRow = await this.tenantDb.queryOne<{ n: string }>(
        schemaName,
        `SELECT COUNT(*)::text AS n
           FROM ${S}.hospitality_reservation_room_stay rrs
           JOIN ${S}.hospitality_reservation r ON r.id = rrs.reservation_id
          WHERE rrs.room_type_id = $1 AND rrs.deleted_at IS NULL
            AND r.status IN ('HOLD', 'CONFIRMED') AND r.deleted_at IS NULL
            AND rrs.checkin_date < $3 AND rrs.checkout_date > $2`,
        [rt.id, masukan.checkin, masukan.checkout],
      );
      const tersedia =
        Number(bebasRow?.n ?? 0) + rt.overbooking_limit - Number(sudahDipesanRow?.n ?? 0);
      if (tersedia <= 0) continue;

      hasil.push({
        room_type_id: rt.id,
        code: rt.code,
        nama: rt.name,
        deskripsi: rt.description,
        okupansi_maks: rt.max_occupancy,
        rate_per_malam: rt.published_rate_amount,
        malam,
        total: Math.round(Number(rt.published_rate_amount) * malam),
        tersedia,
      });
    }
    return hasil;
  }

  /**
   * Memesan mandiri tanpa staf.
   *
   * Tamu dicari lebih dulu lewat email ATAU telepon yang sama -- tamu
   * yang pernah memesan langsung sebelumnya memakai profil yang SAMA,
   * bukan profil baru setiap kali (persis alasan MI-7 punya
   * `cariKemiripan`, hanya di sini pencocokan kontak dipakai untuk
   * MENYATUKAN otomatis, bukan sekadar anjuran, sebab tamu sendiri yang
   * mengisi datanya -- risiko salah gabung jauh lebih kecil daripada
   * saat staf menebak dari nama/telepon mirip).
   */
  async pesanPublik(
    schemaName: string,
    masukan: MasukanPemesananPublik,
    idempotencyKey: string | undefined,
  ): Promise<{ reservasi: DetailReservasi; diulang: boolean }> {
    const galat = validasiPemesananPublik(masukan);
    if (galat.length) {
      throw AppError.badRequest(ErrorCodes.VALIDATION_FAILED, 'Ada isian yang belum benar.', { errors: galat });
    }
    // Berbeda dari layar staf (idempotency key opsional, mis. reservasi
    // walk-in yang jelas satu kali dicatat langsung di depan tamu) --
    // jalur publik WAJIB menyertakannya. Klik ganda tombol "Pesan" pada
    // koneksi lambat adalah kejadian nyata yang harus dicegah, bukan
    // kemungkinan.
    if (!idempotencyKey?.trim()) {
      throw AppError.badRequest(
        ErrorCodes.VALIDATION_FAILED,
        'Tajuk Idempotency-Key wajib disertakan pada pemesanan publik.',
      );
    }

    const S = `"${schemaName}"`;
    const roomType = await this.tenantDb.queryOne<{ published_rate_amount: string | null }>(
      schemaName,
      `SELECT published_rate_amount::text FROM ${S}.hospitality_room_type
        WHERE id = $1 AND property_id = $2 AND deleted_at IS NULL`,
      [masukan.roomTypeId, masukan.propertyId],
    );
    if (!roomType || roomType.published_rate_amount === null) {
      throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Tipe kamar tidak ditemukan atau tidak dijual lewat booking engine.');
    }

    let guest = await this.tenantDb.queryOne<{ id: string; do_not_rent: boolean }>(
      schemaName,
      `SELECT id, do_not_rent FROM ${S}.hospitality_guest
        WHERE deleted_at IS NULL
          AND ((email IS NOT NULL AND email = $1) OR (phone IS NOT NULL AND phone = $2))
        ORDER BY created_at DESC LIMIT 1`,
      [bersihkan(masukan.email), bersihkan(masukan.telepon)],
    );
    if (!guest) {
      const rows = await this.tenantDb.query<{ id: string; do_not_rent: boolean }>(
        schemaName,
        `INSERT INTO ${S}.hospitality_guest (full_name, email, phone)
         VALUES ($1, $2, $3)
         RETURNING id, do_not_rent`,
        [masukan.namaLengkap!.trim(), bersihkan(masukan.email), bersihkan(masukan.telepon)],
      );
      guest = rows[0];
    }
    if (guest.do_not_rent) {
      // Pesan yang SAMA dengan penolakan sisi staf (lihat
      // HospitalityReservationService.catatReservasi) -- tidak
      // menjelaskan LEBIH lanjut kepada pengunjung publik supaya tidak
      // membocorkan alasan larangan menginapnya sendiri lewat layar
      // publik yang siapa saja bisa mencoba.
      throw AppError.forbidden(ErrorCodes.FORBIDDEN, 'Pemesanan tidak dapat diproses untuk data ini.');
    }

    const malam = jumlahMalam(masukan.checkin!, masukan.checkout!);
    const rateTotal = Math.round(Number(roomType.published_rate_amount) * malam);

    const { reservasi, diulang } = await this.reservasi.catatReservasi(
      schemaName,
      {
        propertyId: masukan.propertyId,
        guestId: guest.id,
        source: 'WEBSITE',
        specialRequests: masukan.permintaanKhusus,
        statusAwal: 'CONFIRMED',
        roomStays: [
          {
            roomTypeId: masukan.roomTypeId,
            checkinDate: masukan.checkin,
            checkoutDate: masukan.checkout,
            adults: masukan.dewasa ?? 1,
            children: masukan.anak ?? 0,
            rateAmount: rateTotal,
          },
        ],
      },
      idempotencyKey,
      // Reservasi publik tidak punya "petugas" -- guestId sendiri
      // dipakai sebagai pencatat, konsisten dengan kolom created_by
      // yang menerima UUID mana pun (tidak menunjuk user_subject
      // secara paksa, hanya jejak siapa/apa yang menulis baris ini).
      guest.id,
    );
    return { reservasi, diulang };
  }

  /**
   * Melihat pemesanan lewat kode + verifikasi kontak.
   *
   * Kode reservasi SAJA tidak cukup untuk membuka data -- kode mudah
   * ditebak/diterka berurutan (`RES-000001`, `RES-000002`, ...).
   * Verifikasi kontak (email ATAU telepon yang tercatat pada tamu
   * utamanya) wajib cocok. Ketidakcocokan dijawab NOT_FOUND yang SAMA
   * dengan kode yang tidak ada -- supaya tebakan tidak dapat membedakan
   * "kode ada tapi kontak salah" dari "kode tidak pernah ada".
   */
  async lihatPemesanan(schemaName: string, code: string, kontak: string): Promise<DetailReservasi> {
    const S = `"${schemaName}"`;
    const reservasi = await this.tenantDb.queryOne<{ id: string; guest_id: string }>(
      schemaName,
      `SELECT id, guest_id::text FROM ${S}.hospitality_reservation WHERE code = $1 AND deleted_at IS NULL`,
      [code],
    );
    if (reservasi) {
      const cocok = await this.tenantDb.queryOne(
        schemaName,
        `SELECT id FROM ${S}.hospitality_guest
          WHERE id = $1 AND deleted_at IS NULL AND (email = $2 OR phone = $2)`,
        [reservasi.guest_id, kontak],
      );
      if (cocok) {
        return this.reservasi.detailReservasi(schemaName, reservasi.id);
      }
    }
    throw AppError.notFound(ErrorCodes.NOT_FOUND, 'Pemesanan tidak ditemukan.');
  }

  /** Membatalkan mandiri, verifikasi kontak sama seperti `lihatPemesanan`. */
  async batalkanPemesanan(
    schemaName: string,
    code: string,
    kontak: string,
    alasan: string,
  ): Promise<DetailReservasi> {
    const reservasi = await this.lihatPemesanan(schemaName, code, kontak);
    await this.reservasi.ubahStatus(schemaName, reservasi.id, 'CANCELLED', reservasi.version, reservasi.guest_id, {
      alasan,
    });
    return this.reservasi.detailReservasi(schemaName, reservasi.id);
  }
}

function bersihkan(nilai?: string | null): string | null {
  const bersih = (nilai ?? '').trim();
  return bersih ? bersih : null;
}
