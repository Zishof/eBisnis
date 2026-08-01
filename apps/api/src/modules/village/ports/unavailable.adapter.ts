/**
 * Adapter tiruan untuk mitra yang belum ada.
 *
 * eMedik dan eKoperasi belum dibuat; POS Core belum masuk `main`. Adapter di
 * sini menyatakan keadaan itu **dengan jujur** dan tidak mengembalikan satu pun
 * angka karangan.
 *
 * Godaannya besar: mengisi jadwal Posyandu dengan tiga baris contoh membuat
 * halaman tampak selesai, demo berjalan mulus, dan tidak seorang pun bertanya.
 * Lalu vertikal kesehatannya jadi, datanya berbeda, dan yang berubah bukan
 * hanya angkanya — kepercayaan pada seluruh halaman itu ikut hilang. Data
 * karangan pada kontrak yang belum ada adalah cara tercepat membuat fitur
 * tampak jadi padahal belum.
 *
 * Ketika mitranya siap, yang berubah hanya berkas ini. Tidak ada layanan
 * village yang perlu disentuh.
 */

import { Injectable } from '@nestjs/common';
import type {
  CooperativeIntegrationPort,
  HasilLuar,
  HealthAggregatePort,
  IndikatorKesehatanView,
  JadwalPosyanduView,
  KampanyeKesehatanView,
  KoperasiPublikView,
  KoperasiRingkasView,
  ListingRingkasView,
  MarketplaceLinkPort,
  PenjualanProdukView,
  PosIntegrationPort,
} from './external.ports';

function belumTersedia<T>(sistem: string, data: T): HasilLuar<T> {
  return {
    tersedia: false,
    keterangan:
      `${sistem} belum tersambung. Yang ditampilkan bukan "tidak ada data", ` +
      'melainkan "belum dapat dibaca".',
    data,
  };
}

@Injectable()
export class HealthUnavailableAdapter implements HealthAggregatePort {
  private static readonly SISTEM = 'Sistem kesehatan desa (eMedik)';

  async jadwalPosyandu(): Promise<HasilLuar<JadwalPosyanduView[]>> {
    return belumTersedia(HealthUnavailableAdapter.SISTEM, []);
  }

  async indikatorAgregat(): Promise<HasilLuar<IndikatorKesehatanView[]>> {
    return belumTersedia(HealthUnavailableAdapter.SISTEM, []);
  }

  async cacahSasaran(): Promise<HasilLuar<{ total: number; reached: number }>> {
    // Nol pada `total` di sini tidak berarti tidak ada sasaran. Yang menyatakan
    // artinya adalah `tersedia: false` di sampingnya, dan itulah sebabnya
    // keduanya tidak pernah dipisahkan.
    return belumTersedia(HealthUnavailableAdapter.SISTEM, { total: 0, reached: 0 });
  }

  async kampanyeAktif(): Promise<HasilLuar<KampanyeKesehatanView[]>> {
    return belumTersedia(HealthUnavailableAdapter.SISTEM, []);
  }
}

@Injectable()
export class CooperativeUnavailableAdapter implements CooperativeIntegrationPort {
  private static readonly SISTEM = 'Sistem koperasi (eKoperasi)';

  async koperasiDiDesa(): Promise<HasilLuar<KoperasiRingkasView[]>> {
    return belumTersedia(CooperativeUnavailableAdapter.SISTEM, []);
  }

  async ringkasanKeanggotaan(): Promise<
    HasilLuar<{ memberCount: number; activeCount: number; newThisPeriod: number }>
  > {
    return belumTersedia(CooperativeUnavailableAdapter.SISTEM, {
      memberCount: 0,
      activeCount: 0,
      newThisPeriod: 0,
    });
  }

  async apakahAnggota(): Promise<HasilLuar<{ isMember: boolean; checkedAt: string }>> {
    // `isMember: false` yang tidak tersedia TIDAK boleh diperlakukan sebagai
    // "bukan anggota" oleh pemanggilnya. Pemeriksaan bantuan ganda yang
    // menganggapnya begitu akan meloloskan penerima ganda justru ketika
    // sistemnya sedang tidak dapat memeriksa.
    return belumTersedia(CooperativeUnavailableAdapter.SISTEM, {
      isMember: false,
      checkedAt: new Date().toISOString(),
    });
  }

  async kinerjaPublik(): Promise<HasilLuar<KoperasiPublikView | null>> {
    return belumTersedia(CooperativeUnavailableAdapter.SISTEM, null);
  }
}

@Injectable()
export class PosUnavailableAdapter implements PosIntegrationPort {
  private static readonly SISTEM = 'POS Core';

  async ringkasanPenjualan(): Promise<
    HasilLuar<{ transactionCount: number; grossSales: string; currency: string }>
  > {
    return belumTersedia(PosUnavailableAdapter.SISTEM, {
      transactionCount: 0,
      grossSales: '0',
      currency: 'IDR',
    });
  }

  async produkTerlaris(): Promise<HasilLuar<PenjualanProdukView[]>> {
    return belumTersedia(PosUnavailableAdapter.SISTEM, []);
  }

  async tautkanUnitUsaha(): Promise<HasilLuar<{ linked: boolean }>> {
    return belumTersedia(PosUnavailableAdapter.SISTEM, { linked: false });
  }
}

@Injectable()
export class MarketplaceUnavailableAdapter implements MarketplaceLinkPort {
  private static readonly SISTEM = 'Marketplace eBisnis';

  async periksaListing(): Promise<HasilLuar<ListingRingkasView | null>> {
    return belumTersedia(MarketplaceUnavailableAdapter.SISTEM, null);
  }

  async listingPelakuUsaha(): Promise<HasilLuar<ListingRingkasView[]>> {
    return belumTersedia(MarketplaceUnavailableAdapter.SISTEM, []);
  }
}
