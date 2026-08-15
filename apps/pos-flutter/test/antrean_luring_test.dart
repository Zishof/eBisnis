/// Pengujian aturan antrean luring.
///
/// Yang diputuskan modul ini menentukan apakah pekerjaan yang dilakukan saat
/// tidak tersambung akhirnya sampai ke peladen. Kesalahannya tidak memunculkan
/// galat apa pun di perangkat — perintahnya hanya diam di antrean, dan
/// pemakainya mengira semuanya sudah terkirim.
library;

import 'package:ebisnis_pos/inventory/antrean_luring.dart';
import 'package:test/test.dart';

void main() {
  group('memutuskan nasib perintah yang gagal', () {
    test('peladen tidak terjangkau: diulang nanti', () {
      // Tanpa kode status berarti permintaannya tidak pernah sampai.
      expect(putuskanKegagalan(), KeputusanAntrean.ulangiNanti);
      expect(putuskanKegagalan(statusCode: null), KeputusanAntrean.ulangiNanti);
    });

    test('peladen bermasalah (5xx): diulang nanti', () {
      for (final kode in [500, 502, 503, 504]) {
        expect(putuskanKegagalan(statusCode: kode), KeputusanAntrean.ulangiNanti,
            reason: 'HTTP $kode');
      }
    });

    test('peladen menjawab TIDAK (4xx): menyerah', () {
      /*
       * Inti perbaikan ini. Mengulangi penolakan yang sah tiap jam tidak akan
       * mengubah jawabannya -- dan pada antrean lama, pengulangan itu menahan
       * setiap perintah lain di belakangnya.
       */
      for (final kode in [400, 403, 404, 422]) {
        expect(putuskanKegagalan(statusCode: kode), KeputusanAntrean.menyerah,
            reason: 'HTTP $kode');
      }
    });

    test('409 adalah konflik, bukan penolakan biasa', () {
      // Ia 4xx, tetapi penyelesaiannya lewat pendaftaran konflik.
      expect(putuskanKegagalan(statusCode: 409), KeputusanAntrean.konflik);
    });

    test('408 dan 429 berbentuk 4xx tetapi artinya "coba lagi"', () {
      // Membuangnya sebagai penolakan berarti kehilangan perintah yang sah
      // hanya karena peladen sedang sibuk.
      expect(putuskanKegagalan(statusCode: 408), KeputusanAntrean.ulangiNanti);
      expect(putuskanKegagalan(statusCode: 429), KeputusanAntrean.ulangiNanti);
    });

    test('401 diulang, bukan menyerah', () {
      /*
       * Token kedaluwarsa pulih sendiri sesudah pengguna masuk kembali.
       * Menyerah di sini membuang seluruh pekerjaan luring hanya karena
       * sesinya habis selagi perangkat tidak tersambung.
       */
      expect(putuskanKegagalan(statusCode: 401), KeputusanAntrean.ulangiNanti);
    });
  });

  group('pengurasan antrean', () {
    test('BERHENTI hanya ketika peladen tidak terjangkau', () {
      // Perintah berikutnya pasti gagal dengan sebab yang sama.
      expect(lanjutkanPengurasan(KeputusanAntrean.ulangiNanti), isFalse);
    });

    test('JALAN TERUS melewati penolakan', () {
      /*
       * Pengujian terpenting berkas ini. Di sinilah racunnya dulu: satu
       * perintah yang ditolak peladen menahan setiap perintah sesudahnya --
       * selamanya, tanpa galat apa pun.
       */
      expect(lanjutkanPengurasan(KeputusanAntrean.menyerah), isTrue);
    });

    test('JALAN TERUS melewati konflik', () {
      // Konflik menunggu keputusan manusia; ia tidak boleh menahan pekerjaan
      // lain yang tidak berkaitan.
      expect(lanjutkanPengurasan(KeputusanAntrean.konflik), isTrue);
    });
  });

  group('status yang disimpan', () {
    test('setiap keputusan punya status sendiri', () {
      expect(statusUntuk(KeputusanAntrean.ulangiNanti), StatusAntrean.failed);
      expect(statusUntuk(KeputusanAntrean.menyerah), StatusAntrean.rejected);
      expect(statusUntuk(KeputusanAntrean.konflik), StatusAntrean.conflict);
    });

    test('hanya PENDING dan FAILED yang diulang', () {
      // REJECTED dan CONFLICT tidak boleh terambil lagi oleh pengurasan; itu
      // yang membuat penolakan berhenti meracuni antrean.
      expect(StatusAntrean.dapatDiulang, [StatusAntrean.pending, StatusAntrean.failed]);
      expect(StatusAntrean.dapatDiulang, isNot(contains(StatusAntrean.rejected)));
      expect(StatusAntrean.dapatDiulang, isNot(contains(StatusAntrean.conflict)));
      expect(StatusAntrean.dapatDiulang, isNot(contains(StatusAntrean.completed)));
    });
  });

  group('jeda antar percobaan', () {
    test('naik dua kali lipat lalu tertahan di satu jam', () {
      expect(jedaMenit(0), 1);
      expect(jedaMenit(1), 2);
      expect(jedaMenit(2), 4);
      expect(jedaMenit(5), 32);
      expect(jedaMenit(6), 60);
      expect(jedaMenit(99), 60);
    });

    test('jumlah percobaan negatif tidak meledak', () {
      expect(jedaMenit(-1), 1);
    });

    test('tidak pernah nol', () {
      // Jeda nol berarti pengulangan tanpa henti pada perangkat yang luring.
      for (var i = -2; i < 20; i += 1) {
        expect(jedaMenit(i), greaterThan(0), reason: 'percobaan ke-$i');
      }
    });
  });

  group('perintah yang boleh diantre', () {
    test('dokumen pembelian dan transisinya boleh', () {
      expect(bolehDiantre('POST', '/purchase-orders'), isTrue);
      expect(bolehDiantre('POST', '/purchase-orders/$_uuid/submit'), isTrue);
      expect(bolehDiantre('POST', '/purchase-orders/$_uuid/approve'), isTrue);
      expect(bolehDiantre('POST', '/purchase-orders/$_uuid/send'), isTrue);
      expect(bolehDiantre('POST', '/goods-receipts'), isTrue);
      expect(bolehDiantre('POST', '/goods-receipts/$_uuid/inspect'), isTrue);
      expect(bolehDiantre('POST', '/goods-receipts/$_uuid/validate'), isTrue);
      expect(bolehDiantre('POST', '/goods-receipts/$_uuid/supplier-invoice'), isTrue);
    });

    test('master dan pesanan penjualan tetap boleh', () {
      // Sudah berjalan sebelum berkas ini ada; tidak boleh ikut tertutup.
      expect(bolehDiantre('POST', '/suppliers'), isTrue);
      expect(bolehDiantre('PATCH', '/customers/$_uuid'), isTrue);
      expect(bolehDiantre('POST', '/mobile/sales-orders'), isTrue);
    });

    test('PEMBAYARAN TIDAK boleh diantre', () {
      /*
       * Sengaja. Membuat pembayaran saat luring berarti uang tercatat keluar
       * pada saat yang tidak dapat dilihat siapa pun, terhadap saldo hutang
       * yang mungkin sudah berubah ketika akhirnya terkirim. Itu keputusan
       * pemilik, bukan keputusan yang diambil diam-diam di sini.
       */
      expect(bolehDiantre('POST', '/ap/payments'), isFalse);
      expect(bolehDiantre('POST', '/ar/receipts'), isFalse);
      expect(bolehDiantre('POST', '/ap/payments/$_uuid/post'), isFalse);
    });

    test('pembalikan TIDAK boleh diantre', () {
      // Membalik sesuatu yang belum tentu sudah tercatat adalah cara tercepat
      // membuat dua sistem berbeda pendapat.
      expect(bolehDiantre('POST', '/goods-receipts/$_uuid/reverse-validation'), isFalse);
      expect(bolehDiantre('POST', '/ap/payments/$_uuid/reverse'), isFalse);
    });

    test('daftar putih: yang tidak disebut ditolak', () {
      expect(bolehDiantre('POST', '/entah-apa'), isFalse);
      expect(bolehDiantre('POST', '/purchase-orders/$_uuid/entah'), isFalse);
      expect(bolehDiantre('POST', '/purchase-ordersX'), isFalse);
    });

    test('GET dan DELETE tidak pernah diantre', () {
      // Antrean untuk perintah yang mengubah keadaan; membaca tidak perlu
      // diulang, dan menghapus tidak boleh terjadi tanpa dilihat.
      expect(bolehDiantre('GET', '/purchase-orders'), isFalse);
      expect(bolehDiantre('DELETE', '/purchase-orders/$_uuid'), isFalse);
    });

    test('query string tidak mengubah keputusan', () {
      expect(bolehDiantre('POST', '/goods-receipts?draft=1'), isTrue);
    });
  });
}

const _uuid = '7c9e6679-7425-40de-944b-e07fc1f90ae7';
