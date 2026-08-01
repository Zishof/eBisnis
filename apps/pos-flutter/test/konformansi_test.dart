/// Konformansi aturan Dart terhadap vektor bersama.
///
/// Inilah berkas yang membuat klien kedua aman untuk ada.
///
/// Aturan uang kini punya dua implementasi dalam dua bahasa. Penyimpangannya
/// tidak menampakkan diri sebagai galat — melainkan sebagai pembeli yang
/// ditagih berbeda dari struk sebelumnya, atau rantai buku besar yang
/// dilaporkan rusak padahal utuh.
///
/// `packages/pos-rules-vectors/vectors.json` dibangkitkan dari implementasi
/// TypeScript, dan berkas ini menuntut Dart menghasilkan **angka yang sama
/// persis** dari masukan yang sama. Sisi TypeScript dijaga uji kembarannya,
/// `apps/web/src/pos-offline/vektor-konformansi.spec.ts`.
///
/// Akibatnya: aturan yang diubah di satu sisi tanpa sisi lain tidak dapat
/// digabungkan. Penyimpangan berubah dari perbedaan yang baru ketahuan di kasir
/// menjadi uji yang merah.
library;

import 'dart:convert';
import 'dart:io';

import 'package:ebisnis_pos/aturan/blok_struk.dart';
import 'package:ebisnis_pos/aturan/harga_luring.dart';
import 'package:ebisnis_pos/aturan/katalog.dart';
import 'package:ebisnis_pos/aturan/koneksi.dart';
import 'package:ebisnis_pos/aturan/ledger.dart';
import 'package:test/test.dart';

/// Vektornya berada di luar paket ini, dan itu disengaja: satu berkas dipakai
/// bersama, bukan disalin ke tiap klien. Salinan akan menyimpang.
final Map<String, Object?> v = jsonDecode(
  File('../../packages/pos-rules-vectors/vectors.json').readAsStringSync(),
) as Map<String, Object?>;

List<Map<String, Object?>> daftar(String kunci) =>
    (v[kunci]! as List).cast<Map<String, Object?>>();

final List<TarifLuring> tarif = [
  const TarifLuring(taxRateId: 'T1', code: 'PPN11', rate: 11, isInclusive: false),
  const TarifLuring(taxRateId: 'T2', code: 'PPN11I', rate: 11, isInclusive: true),
];

BarisLuring barisDari(Map<String, Object?> j) => BarisLuring(
      productId: j['productId']! as String,
      name: j['name']! as String,
      uomId: j['uomId'] as String?,
      quantity: j['quantity']! as int,
      unitPrice: j['unitPrice']! as String,
      taxRateId: j['taxRateId'] as String?,
    );

BlokStruk blokDari(Map<String, Object?> j) => BlokStruk(
      blockId: j['blockId']! as String,
      terminalId: j['terminalId']! as String,
      outletId: j['outletId']! as String,
      prefix: j['prefix']! as String,
      padding: j['padding']! as int,
      fromNumber: j['fromNumber']! as int,
      toNumber: j['toNumber']! as int,
      nextNumber: j['nextNumber']! as int,
      allocatedAt: j['allocatedAt']! as String,
      businessDate: j['businessDate'] as String?,
    );

void main() {
  final now = v['now']! as int;

  group('aritmetika uang', () {
    test('perubahan desimal ke satuan terkecil', () {
      for (final k in daftar('satuanTerkecil')) {
        final teks = k['teks']! as String;
        final pecahan = k['pecahan']! as int;
        expect(
          keSatuanTerkecil(teks, pecahan),
          k['satuan'],
          reason: '"$teks" @ pecahan $pecahan',
        );
        expect(
          keDesimal(k['satuan']! as int, pecahan),
          k['kembali'],
          reason: 'kembali dari "$teks"',
        );
      }
    });

    test('pecahan mata uang', () {
      for (final k in daftar('pecahanMataUang')) {
        expect(pecahanMataUang(k['kode']! as String), k['pecahan']);
      }
    });

    test('perhitungan baris', () {
      for (final k in daftar('baris')) {
        final hasil = hitungBarisLuring(
          barisDari(k['masukan']! as Map<String, Object?>),
          tarif,
          k['currencyCode']! as String,
        );
        expect(hasil.toJson(), k['hasil'], reason: hasil.name);
      }
    });

    test('total keranjang', () {
      for (final k in daftar('keranjang')) {
        final lines = (k['lines']! as List)
            .map((e) => barisDari(e as Map<String, Object?>))
            .toList();
        final hasil = hitungKeranjangLuring(lines, tarif, k['currencyCode']! as String);
        expect(hasil.toJson(), k['hasil'], reason: k['label'] as String?);
      }
    });

    test('kembalian', () {
      for (final k in daftar('kembalian')) {
        final hasil = hitungKembalian(
          k['total']! as String,
          k['diserahkan']! as String,
          k['currencyCode']! as String,
        );
        expect(hasil.toJson(), k['hasil']);
      }
    });
  });

  group('jatah nomor struk', () {
    test('pengambilan nomor dan penilaian jatah', () {
      for (final k in daftar('nomorStruk')) {
        final b = blokDari(k['blok']! as Map<String, Object?>);
        expect(sisaBlok(b), k['sisa']);

        final diambil = ambilNomor(b);
        expect(diambil?.nomor, k['nomor']);
        expect(diambil?.blok.nextNumber, k['nextSesudah']);

        final p = nilaiBlok(b, 'REG1');
        final harapan = k['penilaian']! as Map<String, Object?>;
        expect(p.state.nama, harapan['state']);
        expect(p.remaining, harapan['remaining']);

        // Jatah milik register lain tidak boleh dipakai, meskipun ada di mesin ini.
        expect(nilaiBlok(b, 'REG2').state.nama, k['penilaianRegisterLain']);
      }
    });
  });

  group('kesegaran katalog', () {
    test('tingkat dan kelayakan pakai', () {
      for (final k in daftar('kesegaranKatalog')) {
        final jenis = JenisKatalogNama.dariNama(k['jenis']! as String);
        final ageMs = k['ageMs'] as int?;
        final h = nilaiKesegaran(
          jenis: jenis,
          syncedAt: ageMs == null ? null : now - ageMs,
          now: now,
        );
        expect(h.level.nama, k['level'], reason: '${k['jenis']} @ ${k['bagianUmur']}');
        expect(h.usable, k['usable']);
      }
    });
  });

  group('keadaan sambungan', () {
    test('penilaian dan warna lencana', () {
      for (final k in daftar('keadaanKoneksi')) {
        final m = k['masukan']! as Map<String, Object?>;
        final h = nilaiKoneksi(
          browserOnline: m['browserOnline']! as bool,
          lastReachableAt: m['lastReachableAt'] as int?,
          lastAttemptAt: m['lastAttemptAt'] as int?,
          lastAttemptOk: m['lastAttemptOk'] as bool?,
          now: now,
        );
        expect(h.state.nama, k['state']);
        expect(h.queueing, k['queueing']);
        expect(warnaKoneksi(h.state), k['warna']);
      }
    });

    test('jeda percobaan ulang', () {
      for (final k in daftar('jedaPercobaan')) {
        expect(jedaPercobaan(k['gagal']! as int), k['jedaMs']);
      }
    });
  });

  group('bahan hash — kontrak paling menentukan', () {
    final b = v['bahanHash']! as Map<String, Object?>;

    test('hash awal', () {
      expect(hashAwal, b['hashAwal']);
    });

    test('bahan muatan transaksi', () {
      final m = MuatanTransaksi.dariJson(b['muatan']! as Map<String, Object?>);
      expect(bahanMuatan(m), b['bahanMuatan']);
    });

    test('bahan baris tanpa rincian', () {
      final c = MedanTertutup.dariJson(b['barisTanpaMuatan']! as Map<String, Object?>);
      expect(bahanHash(c), b['bahanTanpaMuatan']);
    });

    test('bahan baris dengan rincian mengawali bahan tanpa rincian', () {
      // `payloadHash` ditambahkan di UJUNG dengan cadangan string kosong, supaya
      // baris lama menghasilkan teks yang persis sama seperti dahulu.
      final c = MedanTertutup.dariJson(b['barisTanpaMuatan']! as Map<String, Object?>);
      expect(bahanHash(c.salinDengan(payloadHash: 'a' * 64)), b['bahanDenganMuatan']);
      expect(
        (b['bahanDenganMuatan']! as String).startsWith(b['bahanTanpaMuatan']! as String),
        isTrue,
      );
    });

    test('pemisah medan adalah U+001F', () {
      // Nilainya tidak boleh berubah: mengubahnya membatalkan seluruh buku besar
      // yang sudah tercatat pada mesin kasir mana pun.
      expect(pemisahMedan, '\u001F');
      expect((b['bahanTanpaMuatan']! as String).contains('\u001F'), isTrue);
    });

    test('sumber Dart tidak memuat karakter kendali tak terlihat', () {
      /// Penjaga terhadap jebakan yang sungguh terjadi pada sisi TypeScript:
      /// pemisahnya diketik sebagai karakter U+001F harfiah, sehingga barisnya
      /// terbaca `.join('')` pada editor dan diff mana pun. Siapa pun yang
      /// merapikan tanda kutip itu mengubah setiap hash, tanpa diff yang terlihat.
      /*
       * `test/` ikut disapu, bukan hanya `lib/`.
       *
       * Semula penjaga ini hanya menyapu `lib/`. Sebuah uji yang justru menguji
       * PENOLAKAN karakter kendali kemudian ditulis dengan mengetikkan karakter
       * itu harfiah ke dalam sumbernya — uji yang benar, ditulis dengan cara
       * yang persis dijaga di sini, dan ia lulus tanpa ada yang tahu. Siapa pun
       * yang merapikan barisnya kelak akan mengubah apa yang diuji tanpa diff
       * yang terlihat.
       */
      for (final akar in ['lib', 'test']) {
        for (final f in Directory(akar).listSync(recursive: true).whereType<File>()) {
          if (!f.path.endsWith('.dart')) continue;
          final kendali = f
              .readAsStringSync()
              .codeUnits
              .where((k) => k < 32 && k != 9 && k != 10 && k != 13);
          expect(kendali, isEmpty, reason: '${f.path} memuat karakter kendali');
        }
      }
    });
  });
}
