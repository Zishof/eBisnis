/// Pengujian aturan Aplikasi Warga Desa.
///
/// Dua hal dijaga paling ketat:
///
/// 1. **"Tanpa nama" tidak pernah disebut anonim.** Aplikasi yang mengharuskan
///    masuk selalu tahu siapa yang mengirim; menyebutnya anonim adalah janji
///    yang tidak dapat ditepati.
/// 2. **Draf tidak hilang ketika sinyal hilang.** Sinyal di desa putus-putus,
///    dan warga yang kehilangan tulisannya tidak akan mengetiknya lagi.
library;

import 'package:flutter_test/flutter_test.dart';
import 'package:village_mobile/domain/rules.dart';

void main() {
  group('tautan akun', () {
    test('layanan kependudukan menuntut tautan', () {
      const belum = Tautan(KeadaanTautan.belumTertaut);
      for (final layanan in Tautan.perluTautan) {
        expect(belum.boleh(layanan).bolehkah, isFalse, reason: layanan);
      }
    });

    test('pengumuman dan pengaduan TETAP terbuka tanpa tautan', () {
      // Mengunci seluruh aplikasi sampai penautannya selesai membuat orang
      // menghapusnya sebelum sempat memakainya.
      const belum = Tautan(KeadaanTautan.belumTertaut);
      for (final layanan in ['PENGUMUMAN', 'PENGADUAN', 'AGENDA']) {
        expect(belum.boleh(layanan).bolehkah, isTrue, reason: layanan);
      }
    });

    test('alasannya memberi tahu apa yang harus dilakukan, bukan hanya menolak', () {
      final h = const Tautan(KeadaanTautan.belumTertaut).boleh('PERMOHONAN_SURAT');
      expect(h.alasan, contains('kantor desa'));
      expect(h.alasan, contains('KTP'));
      expect(h.alasan, contains('dari rumah'));
    });

    test('akun yang tautannya dicabut memperoleh pesan yang berbeda', () {
      final h = const Tautan(KeadaanTautan.dicabut).boleh('DATA_DIRI');
      expect(h.bolehkah, isFalse);
      expect(h.alasan, contains('dicabut'));
    });

    test('akun yang tertaut boleh seluruhnya', () {
      const tertaut = Tautan(KeadaanTautan.tertaut);
      for (final layanan in [...Tautan.perluTautan, ...Tautan.terbukaTanpaTautan]) {
        expect(tertaut.boleh(layanan).bolehkah, isTrue, reason: layanan);
      }
    });
  });

  group('mode nama pada pengaduan', () {
    test('TIDAK ada mode yang bernama anonim', () {
      // Aplikasi yang mengharuskan masuk selalu tahu siapa yang mengirim.
      for (final m in ModeNama.values) {
        expect(m.name.toLowerCase(), isNot(contains('anonim')));
        expect(m.name.toLowerCase(), isNot(contains('anonymous')));
      }
    });

    test('mode tanpa nama MENYATAKAN TERUS TERANG bahwa petugas tetap melihat', () {
      final p = pesanMode[ModeNama.tanpaNamaPublik]!;
      expect(p.uraian, contains('Petugas desa tetap dapat melihatnya'));
      expect(p.uraian, contains('tidak dapat menjanjikan anonim'));
    });

    test('mengarahkan ke anjungan bagi yang memerlukan anonim sungguhan', () {
      final p = pesanMode[ModeNama.tanpaNamaPublik]!;
      expect(p.uraian, contains('anjungan'));
    });

    test('setiap mode punya judul pendek dan uraian yang menjelaskan', () {
      for (final m in ModeNama.values) {
        final p = pesanMode[m]!;
        expect(p.judul.length, lessThanOrEqualTo(40), reason: m.name);
        expect(p.uraian.length, greaterThan(30), reason: m.name);
      }
    });
  });

  group('lokasi pengaduan', () {
    test('lokasi ponsel BUKAN bawaan', () {
      // Melampirkan GPS secara otomatis berarti aplikasi melacak di mana
      // warganya berada setiap kali ia melapor.
      const p = Pengaduan(
        judul: 'Jalan berlubang',
        uraian: 'Jalan berlubang cukup dalam di depan masjid.',
        modeNama: ModeNama.cantumkan,
        sumberLokasi: SumberLokasi.ditunjukWarga,
        keteranganLokasi: 'Depan masjid RT 03',
      );
      expect(p.sumberLokasi, SumberLokasi.ditunjukWarga);
      expect(SumberLokasi.values.first, SumberLokasi.ditunjukWarga);
    });

    test('menerima pengaduan yang menyebut tempatnya', () {
      const p = Pengaduan(
        judul: 'Jalan berlubang',
        uraian: 'Jalan berlubang cukup dalam di depan masjid.',
        modeNama: ModeNama.cantumkan,
        sumberLokasi: SumberLokasi.tidakAda,
        keteranganLokasi: 'Depan masjid RT 03',
      );
      expect(periksaPengaduan(p).bolehkah, isTrue);
    });

    test('MENOLAK pengaduan yang tidak menyebut tempat sama sekali', () {
      const p = Pengaduan(
        judul: 'Jalan berlubang',
        uraian: 'Jalan berlubang cukup dalam sekali.',
        modeNama: ModeNama.cantumkan,
        sumberLokasi: SumberLokasi.tidakAda,
      );
      final h = periksaPengaduan(p);
      expect(h.bolehkah, isFalse);
      expect(h.alasan, contains('tidak dapat didatangi petugas'));
    });

    test('titik yang ditunjuk warga sudah cukup sebagai tempat', () {
      const p = Pengaduan(
        judul: 'Lampu mati',
        uraian: 'Lampu jalan mati sudah seminggu.',
        modeNama: ModeNama.cantumkan,
        sumberLokasi: SumberLokasi.ditunjukWarga,
      );
      expect(periksaPengaduan(p).bolehkah, isTrue);
    });

    test('menolak uraian yang terlalu pendek', () {
      const p = Pengaduan(
        judul: 'Rusak',
        uraian: 'rusak',
        modeNama: ModeNama.cantumkan,
        sumberLokasi: SumberLokasi.ditunjukWarga,
      );
      expect(periksaPengaduan(p).bolehkah, isFalse);
    });

    test('membatasi jumlah foto, dengan alasan yang masuk akal', () {
      const p = Pengaduan(
        judul: 'Jalan berlubang',
        uraian: 'Jalan berlubang cukup dalam di depan masjid.',
        modeNama: ModeNama.cantumkan,
        sumberLokasi: SumberLokasi.ditunjukWarga,
        jumlahFoto: kFotoMaksimal + 1,
      );
      final h = periksaPengaduan(p);
      expect(h.bolehkah, isFalse);
      expect(h.alasan, contains('tidak ditindaklanjuti'));
    });
  });

  group('draf tidak hilang ketika sinyal hilang', () {
    test('tanpa sinyal, draf disimpan', () {
      expect(nasibDraf(Jaringan.tidakAda), NasibDraf.simpanSaja);
    });

    test('sinyal lambat, draf disimpan DAN dicoba lagi', () {
      expect(nasibDraf(Jaringan.lambat), NasibDraf.simpanDanCobaLagi);
    });

    test('sinyal ada, dikirim', () {
      expect(nasibDraf(Jaringan.ada), NasibDraf.kirim);
    });

    test('TIDAK ADA keadaan yang membuang draf', () {
      // Warga yang kehilangan tulisannya karena sinyal hilang tidak akan
      // mengetiknya lagi; ia akan berhenti memakai aplikasinya.
      for (final j in Jaringan.values) {
        expect(nasibDraf(j).name.toLowerCase(), isNot(contains('buang')));
        expect(nasibDraf(j).name.toLowerCase(), isNot(contains('hapus')));
      }
    });
  });

  group('status permohonan', () {
    test('setiap status punya label yang dapat dibaca warga', () {
      for (final entry in labelStatus.entries) {
        expect(entry.value, isNot(contains('_')), reason: entry.key);
        expect(entry.value[0], equals(entry.value[0].toUpperCase()), reason: entry.key);
      }
    });

    test('status yang menuntut warga bertindak menyebutkan tindakannya', () {
      // "Berkas belum lengkap" tanpa keterangan membuat warga menunggu sesuatu
      // yang tidak akan datang.
      for (final kode in ['BERKAS_KURANG', 'DITOLAK', 'DITERBITKAN']) {
        expect(tindakanDari(kode), isNotNull, reason: kode);
        expect(tindakanDari(kode)!.length, greaterThan(20), reason: kode);
      }
    });

    test('status yang hanya perlu ditunggu tidak menyuruh warga datang', () {
      for (final kode in ['DIAJUKAN', 'DIVERIFIKASI', 'MENUNGGU_PERSETUJUAN']) {
        expect(tindakanDari(kode), isNull, reason: kode);
      }
    });

    test('status yang tidak dikenal tidak menampilkan kode mentah kosong', () {
      expect(labelDari(null), 'Tidak diketahui');
      expect(labelDari('SESUATU_YANG_BARU'), 'SESUATU_YANG_BARU');
    });
  });

  group('kode ambil', () {
    test('memakai abjad yang sama dengan anjungan', () {
      for (final huruf in ['0', 'O', '1', 'I', 'L']) {
        expect(kHurufKode, isNot(contains(huruf)));
      }
    });

    test('memaafkan tanda hubung, spasi, dan huruf kecil', () {
      for (final masukan in ['A7K2-9MPQ', 'a7k2 9mpq', ' A7K2-9MPQ ']) {
        expect(bersihkanKode(masukan), 'A7K29MPQ');
      }
    });

    test('menampilkan berkelompok empat', () {
      expect(formatKode('A7K29MPQ'), 'A7K2-9MPQ');
    });
  });

  group('menu beranda', () {
    test('memuat kelima menu yang dijanjikan presentasi', () {
      final kode = menuWarga.map((m) => m.kode).toList();
      expect(kode, contains('PERMOHONAN_SURAT'));
      expect(kode, contains('PENGADUAN'));
      expect(kode, contains('POSYANDU'));
      expect(kode, contains('STATUS_BANTUAN'));
      expect(kode, contains('PENGUMUMAN'));
    });

    test('urutannya sama dengan presentasi', () {
      expect(
        menuWarga.map((m) => m.kode).toList(),
        ['PERMOHONAN_SURAT', 'PENGADUAN', 'POSYANDU', 'STATUS_BANTUAN', 'PENGUMUMAN'],
      );
    });

    test('menu yang menuntut tautan ditandai, dan sesuai dengan aturannya', () {
      for (final m in menuWarga) {
        final sesuai = Tautan.perluTautan.contains(m.kode);
        expect(m.perluTautan, sesuai, reason: m.kode);
      }
    });

    test('setiap menu punya keterangan yang dapat dibaca warga', () {
      for (final m in menuWarga) {
        expect(m.label.length, lessThanOrEqualTo(20), reason: m.kode);
        expect(m.keterangan.length, greaterThan(10), reason: m.kode);
      }
    });

    test('TIDAK ada menu pencarian warga', () {
      final gabung = menuWarga.map((m) => '${m.kode} ${m.label}').join(' ').toLowerCase();
      for (final terlarang in ['cari warga', 'data penduduk', 'search', 'daftar warga']) {
        expect(gabung, isNot(contains(terlarang)));
      }
    });
  });
}
