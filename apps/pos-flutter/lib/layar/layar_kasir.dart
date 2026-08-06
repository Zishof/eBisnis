/// Layar kasir.
///
/// Bentuknya mengikuti rancangan eBisnis POS: bilah samping gelap, bilah atas
/// berisi keadaan mesin, kisi produk di tengah, dan panel keranjang di kanan.
///
/// Yang menentukan perilakunya tetap sama seperti sebelum tampilannya berubah:
///
/// - **Fokus selalu kembali ke kotak pindai.** Pemindai barcode mengetik lalu
///   menekan Enter; bila fokus berpindah, pindaian berikutnya mendarat di tempat
///   yang salah dan kasir baru menyadarinya beberapa barang kemudian.
/// - **Keranjang selalu terlihat.** Tidak ada dialog yang menutupinya kecuali
///   pembayaran, yang memang menuntut perhatian penuh.
/// - **Angka tidak dihitung layar ini.** Ia mengalikan harga yang sudah
///   dibekukan peladen pada salinan katalog, lewat modul aturan yang sama dengan
///   klien web dan diikat vektor konformansi bersama.
///
/// Satu kotak melayani dua hal, sebagaimana rancangan: pemindai **dan**
/// pengetikan nama. Yang menentukan perlakuannya adalah bentuk teksnya, bukan
/// tombol mode yang harus diingat kasir.
library;

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../aturan/harga_luring.dart';
import '../aturan/koneksi.dart';
import '../pembaruan/pengelola_pembaruan.dart';
import '../pembaruan/versi.dart';
import '../perangkat/escpos.dart';
import 'bilah_atas.dart';
import 'bilah_samping.dart';
import 'halaman_menu.dart';
import 'kisi_produk.dart';
import 'panel_keranjang.dart';
import 'pintasan.dart';
import 'sumber.dart';
import 'tampilan_pelanggan.dart';
import 'tema.dart';

enum ModeKasir { penjualan, apotik }

class LayarKasir extends StatefulWidget {
  const LayarKasir({
    required this.katalog,
    required this.metode,
    required this.pencetak,
    required this.namaToko,
    this.pelanggan,
    this.namaOutlet,
    this.shift,
    this.koneksi,
    this.namaPengguna,
    this.onKeluar,
    this.pembaruan,
    this.pembukuan,
    this.mode = ModeKasir.penjualan,
    super.key,
  });

  final SumberKatalog katalog;
  final List<MetodeBayar> metode;
  final Pencetak pencetak;
  final String namaToko;

  /// Keadaan yang ditampilkan pada layar pelanggan.
  ///
  /// Dilewatkan sebagai notifier, bukan dibaca dari dalam: jendela layar kedua
  /// hidup pada pohon widget yang berbeda, dan pada sebagian platform bahkan
  /// pada mesin render yang berbeda.
  final ValueNotifier<KeadaanPelanggan>? pelanggan;

  final String? namaOutlet;
  final String? shift;
  final KeadaanKoneksi? koneksi;
  final String? namaPengguna;
  final VoidCallback? onKeluar;
  final PengelolaPembaruan? pembaruan;
  final PembukuanKasir? pembukuan;
  final ModeKasir mode;

  @override
  State<LayarKasir> createState() => _LayarKasirState();
}

class _LayarKasirState extends State<LayarKasir> {
  final List<BarisLuring> _baris = [];
  final TextEditingController _pindai = TextEditingController();
  final TextEditingController _catatan = TextEditingController();
  final TextEditingController _nomorResep = TextEditingController();
  final TextEditingController _namaPasien = TextEditingController();
  final FocusNode _fokusPindai = FocusNode();
  final FocusNode _fokusLayar = FocusNode();

  String? _pesan;
  bool _pesanGalat = false;
  BarisLuring? _terakhir;

  String _kategori = kategoriSemua;
  String _kunciCari = '';
  JenisPesanan _jenis = JenisPesanan.dineIn;
  String _menu = 'kasir';
  List<ProdukLokal>? _produkUnggahan;
  final List<RiwayatPembayaranKasir> _riwayatPembayaran = [];
  String? _versiPembaruanDitampilkan;
  bool _dialogPembaruanTerbuka = false;

  bool get _apotik => widget.mode == ModeKasir.apotik;

  SumberKatalog get _katalogAktif {
    final produk = _produkUnggahan;
    if (produk == null) return widget.katalog;
    return KatalogMemori(
      produk: produk,
      mataUang: widget.katalog.mataUang,
      tarif: widget.katalog.tarif,
    );
  }

  HasilKeranjang get _total => hitungKeranjangLuring(
      _baris, _katalogAktif.tarif, _katalogAktif.mataUang);

  @override
  void initState() {
    super.initState();
    if (_apotik) _jenis = JenisPesanan.takeAway;
    widget.pembaruan?.addListener(_pembaruanBerubah);
    _perbaruiPelanggan();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fokusPindai.requestFocus();
      _pembaruanBerubah();
    });
  }

  @override
  void didUpdateWidget(covariant LayarKasir oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.pembaruan == widget.pembaruan) return;
    oldWidget.pembaruan?.removeListener(_pembaruanBerubah);
    widget.pembaruan?.addListener(_pembaruanBerubah);
    WidgetsBinding.instance.addPostFrameCallback((_) => _pembaruanBerubah());
  }

  @override
  void dispose() {
    widget.pembaruan?.removeListener(_pembaruanBerubah);
    _pindai.dispose();
    _catatan.dispose();
    _nomorResep.dispose();
    _namaPasien.dispose();
    _fokusPindai.dispose();
    _fokusLayar.dispose();
    super.dispose();
  }

  /// Menuliskan angka uang. Satu tempat, supaya layar kasir, layar pelanggan,
  /// dan struk memakai bentuk yang sama persis.
  String _uang(String n) {
    final angka = n.split('.').first;
    final terbalik = angka.split('').reversed.join();
    final berkelompok = <String>[];
    for (var i = 0; i < terbalik.length; i += 3) {
      berkelompok.add(terbalik.substring(i, (i + 3).clamp(0, terbalik.length)));
    }
    return 'Rp ${berkelompok.join('.').split('').reversed.join()}';
  }

  void _perbaruiPelanggan() {
    final p = widget.pelanggan;
    if (p == null) return;
    if (_baris.isEmpty) {
      p.value = PelangganMenunggu(
          namaToko: widget.namaToko, sapaan: 'Selamat datang');
      return;
    }
    final t = _total;
    p.value = PelangganBerbelanja(
      baris: [
        for (final l in t.lines)
          BarisPelanggan(
            nama: l.name,
            jumlah: l.quantity,
            hargaSatuan: l.unitPrice,
            total: l.lineTotal,
          ),
      ],
      total: t.grandTotal,
      jumlahBarang: t.itemCount,
      terakhirDitambah: _terakhir == null
          ? null
          : () {
              final l = t.lines
                  .firstWhere((x) => x.productId == _terakhir!.productId);
              return BarisPelanggan(
                nama: l.name,
                jumlah: l.quantity,
                hargaSatuan: l.unitPrice,
                total: l.lineTotal,
              );
            }(),
    );
  }

  void _kabar(String teks, {bool galat = false}) {
    setState(() {
      _pesan = teks;
      _pesanGalat = galat;
    });
  }

  // --- Katalog --------------------------------------------------------------

  List<ProdukLokal> get _produkTampil {
    var daftar = _katalogAktif.semua();

    if (_kategori == kategoriFavorit) {
      daftar = daftar.where((p) => p.favorit).toList();
    } else if (_kategori != kategoriSemua) {
      daftar = daftar.where((p) => p.kategori == _kategori).toList();
    }

    final kunci = _kunciCari.trim();
    if (kunci.isNotEmpty) {
      final kecil = kunci.toLowerCase();
      daftar = daftar
          .where((p) =>
              p.nama.toLowerCase().contains(kecil) ||
              p.barcodes.any((b) => b.contains(kunci)))
          .toList();
    }
    return daftar;
  }

  void _tambah(ProdukLokal p) {
    setState(() {
      final i = _baris.indexWhere((b) => b.productId == p.productId);
      if (i >= 0) {
        _baris[i] = BarisLuring(
          productId: _baris[i].productId,
          name: _baris[i].name,
          uomId: _baris[i].uomId,
          quantity: _baris[i].quantity + 1,
          unitPrice: _baris[i].unitPrice,
          taxRateId: _baris[i].taxRateId,
        );
        _terakhir = _baris[i];
      } else {
        final baru = BarisLuring(
          productId: p.productId,
          name: p.nama,
          uomId: p.uomId,
          quantity: 1,
          unitPrice: p.harga,
          taxRateId: p.taxRateId,
        );
        _baris.add(baru);
        _terakhir = baru;
      }
      _pesan = null;
    });
    _perbaruiPelanggan();
    _kembalikanFokus();
  }

  /// Mengembalikan fokus ke kotak pindai sesudah setiap tindakan.
  ///
  /// Dipanggil dari mana pun, termasuk sesudah dialog tertutup: pemindai tidak
  /// tahu dialog apa yang barusan terbuka, dan pindaian berikutnya akan datang
  /// entah kapan.
  void _kembalikanFokus({bool bersihkanCari = true}) {
    if (bersihkanCari) {
      _pindai.clear();
      if (_kunciCari.isNotEmpty) setState(() => _kunciCari = '');
    }
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _fokusPindai.requestFocus());
  }

  /// Benar bila teksnya berbentuk barcode: hanya angka dan cukup panjang.
  ///
  /// Dipakai untuk membedakan pindaian yang gagal dari pencarian nama. Keduanya
  /// tiba lewat kotak yang sama dan menuntut jawaban yang sama sekali berbeda:
  /// barcode yang tak dikenal adalah masalah data master, sedangkan nama yang
  /// tak ditemukan cukup dijawab dengan mempersempit kisi.
  static bool _tampakBarcode(String teks) =>
      teks.length >= 8 && RegExp(r'^\d+$').hasMatch(teks);

  void _pindaiMasuk(String kode) {
    final bersih = kode.trim();
    if (bersih.isEmpty) return;

    final p = _katalogAktif.dariBarcode(bersih);
    if (p != null) {
      _tambah(p);
      return;
    }

    if (_tampakBarcode(bersih)) {
      /*
       * Menyebutkan kodenya dan apa yang dapat dilakukan berikutnya.
       * "Barcode tidak dikenali" tanpa kodenya tidak memberi tahu kasir apakah
       * ia salah pindai atau barangnya memang belum terdaftar.
       */
      _kabar(
        'Barcode $bersih tidak ada pada salinan di mesin ini. '
        'Cari produk menurut namanya, atau daftarkan barcode ini pada master produk.',
        galat: true,
      );
      _kembalikanFokus();
      return;
    }

    // Bukan barcode: perlakukan sebagai pencarian nama dan persempit kisi.
    // Tidak langsung dimasukkan meski hanya satu yang cocok -- memasukkan barang
    // yang tidak sempat dilihat kasir adalah cara termudah menjual barang yang
    // salah kepada orang yang sedang menunggu.
    final cocok = _katalogAktif.cari(bersih);
    setState(() {
      _kunciCari = bersih;
      _kategori = kategoriSemua;
      _pesan = cocok.isEmpty ? 'Tidak ada produk bernama "$bersih".' : null;
      _pesanGalat = cocok.isEmpty;
    });
    _kembalikanFokus(bersihkanCari: false);
  }

  void _ubahJumlah(int index, int selisih) {
    setState(() {
      final b = _baris[index];
      final jumlahBaru = b.quantity + selisih;
      if (jumlahBaru <= 0) {
        _baris.removeAt(index);
        if (_terakhir?.productId == b.productId) _terakhir = null;
      } else {
        _baris[index] = BarisLuring(
          productId: b.productId,
          name: b.name,
          uomId: b.uomId,
          quantity: jumlahBaru,
          unitPrice: b.unitPrice,
          taxRateId: b.taxRateId,
        );
      }
    });
    _perbaruiPelanggan();
    _kembalikanFokus();
  }

  void _hapusBaris(int index) {
    setState(() {
      final b = _baris.removeAt(index);
      if (_terakhir?.productId == b.productId) _terakhir = null;
    });
    _perbaruiPelanggan();
    _kembalikanFokus();
  }

  // --- Pintasan papan ketik -------------------------------------------------

  KeyEventResult _tangkapTombol(FocusNode node, KeyEvent e) {
    if (e is! KeyDownEvent) return KeyEventResult.ignored;

    final modifier = HardwareKeyboard.instance.isControlPressed ||
        HardwareKeyboard.instance.isAltPressed ||
        HardwareKeyboard.instance.isMetaPressed ||
        HardwareKeyboard.instance.isShiftPressed;

    final aksi = aksiUntukTombol(e.logicalKey, adaModifier: modifier);
    if (aksi == null) return KeyEventResult.ignored;

    _jalankan(aksi);
    return KeyEventResult.handled;
  }

  Future<void> _jalankan(AksiKasir aksi) async {
    // Aksi yang menghilangkan pekerjaan atau menyentuh uang dikonfirmasi lebih
    // dahulu -- jari yang terlatih menekan lebih cepat daripada mata membaca.
    if (wajibKonfirmasi.contains(aksi)) {
      final lanjut = await _konfirmasi(keteranganAksi[aksi]!);
      if (!lanjut) {
        _kembalikanFokus();
        return;
      }
    }

    switch (aksi) {
      case AksiKasir.bantuan:
        await _tampilkanBantuan();
        _kembalikanFokus();
      case AksiKasir.bukaLaci:
        await _bukaLaci();
      case AksiKasir.bayar:
        await _bayar();
      case AksiKasir.batalTransaksi:
        setState(() {
          _baris.clear();
          _terakhir = null;
          _pesan = null;
          _catatan.clear();
        });
        _perbaruiPelanggan();
        _kembalikanFokus();
      case AksiKasir.hapusBaris:
        if (_baris.isNotEmpty) _hapusBaris(_baris.length - 1);
      case AksiKasir.tutupDialog:
        _kembalikanFokus();
      default:
        // Aksi yang perilakunya menuntut peladen belum tersambung. Dikatakan
        // apa adanya, bukan didiamkan: tombol yang tidak melakukan apa pun
        // membuat kasir menekannya lagi lebih keras.
        _kabar('${keteranganAksi[aksi]} belum tersedia pada klien ini.');
        _kembalikanFokus();
    }
  }

  Future<bool> _konfirmasi(String tindakan) async {
    final hasil = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        key: const Key('dialog-konfirmasi'),
        title: Text(tindakan),
        content: Text('Lanjutkan $tindakan?'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c, false),
              child: const Text('Batal')),
          FilledButton(
              onPressed: () => Navigator.pop(c, true),
              child: const Text('Lanjutkan')),
        ],
      ),
    );
    return hasil ?? false;
  }

  Future<void> _tampilkanBantuan() async {
    await showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        key: const Key('dialog-bantuan'),
        title: const Text('Pintasan papan ketik'),
        content: SizedBox(
          width: 420,
          child: ListView(
            key: const Key('daftar-pintasan'),
            shrinkWrap: true,
            children: [
              for (final p in daftarPintasan())
                ListTile(
                  dense: true,
                  leading: SizedBox(width: 48, child: Text(p.tombol)),
                  title: Text(keteranganAksi[p.aksi]!),
                  // Ditandai supaya kasir yang berpindah dari klien web tahu
                  // mana yang memang berbeda, alih-alih mengira salah satu rusak.
                  trailing: hanyaDiAplikasiAsli.contains(p.aksi)
                      ? const Text('hanya di aplikasi',
                          style: TextStyle(fontSize: 11))
                      : null,
                ),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(c), child: const Text('Tutup'))
        ],
      ),
    );
  }

  // --- Pembaruan ------------------------------------------------------------

  void _pembaruanBerubah() {
    final pengelola = widget.pembaruan;
    final hasil = pengelola?.hasil;
    if (!mounted ||
        pengelola == null ||
        pengelola.sedangMemeriksa ||
        hasil == null ||
        hasil.keadaan != KeadaanPembaruan.tersedia ||
        _dialogPembaruanTerbuka) {
      return;
    }
    final rilis = hasil.rilis;
    if (rilis == null || _versiPembaruanDitampilkan == rilis.versi) return;

    _versiPembaruanDitampilkan = rilis.versi;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _dialogPembaruanTerbuka) return;
      unawaited(_tampilkanDialogPembaruan(hasil, otomatis: true));
    });
  }

  Future<void> _cekPembaruan() async {
    final p = widget.pembaruan;
    if (p == null) return;

    await p.periksa();
    if (!mounted) return;

    final h = p.hasil;
    if (h == null) return;

    if (h.rilis case final rilis?) {
      _versiPembaruanDitampilkan = rilis.versi;
    }
    await _tampilkanDialogPembaruan(h, otomatis: false);
    _kembalikanFokus();
  }

  Future<void> _tampilkanDialogPembaruan(
    HasilPeriksaPembaruan h, {
    required bool otomatis,
  }) async {
    if (!mounted || _dialogPembaruanTerbuka) return;
    _dialogPembaruanTerbuka = true;
    final tersedia = h.keadaan == KeadaanPembaruan.tersedia;
    await showDialog<void>(
      context: context,
      barrierDismissible: !h.wajib,
      builder: (c) => AlertDialog(
        key: Key(otomatis ? 'dialog-pembaruan-otomatis' : 'dialog-pembaruan'),
        icon: Icon(
          h.wajib ? Icons.warning_amber_rounded : Icons.system_update_alt,
          color: h.wajib ? Warna.merah : Warna.utama,
          size: 34,
        ),
        title: Text(switch (h.keadaan) {
          KeadaanPembaruan.tersedia =>
            h.wajib ? 'Pembaruan wajib tersedia' : 'Pembaruan POS tersedia',
          KeadaanPembaruan.mutakhir => 'Sudah versi terbaru',
          KeadaanPembaruan.lebihBaru => 'Versi ini lebih baru',
          KeadaanPembaruan.gagalDiperiksa => 'Tidak dapat diperiksa',
        }),
        content: SizedBox(
          width: 460,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(h.pesan),
              if (h.rilis?.catatan case final catatan?
                  when catatan.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text('Catatan rilis',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 160),
                  child: SingleChildScrollView(child: Text(catatan)),
                ),
              ],
              if (h.rilis case final rilis?) ...[
                const SizedBox(height: 14),
                const Text('Tautan unduhan',
                    style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                SelectableText(
                  rilis.jalurUnduh,
                  key: const Key('tautan-unduh'),
                  style: const TextStyle(fontSize: 12, color: Warna.utama),
                ),
              ],
            ],
          ),
        ),
        actions: [
          if (h.rilis case final rilis?)
            TextButton(
              onPressed: () async {
                await Clipboard.setData(ClipboardData(text: rilis.jalurUnduh));
                _kabar('Tautan unduhan disalin.');
              },
              child: const Text('Salin tautan'),
            ),
          if (!h.wajib)
            TextButton(
              key: const Key('tombol-tunda-pembaruan'),
              onPressed: () => Navigator.pop(c),
              child: Text(tersedia ? 'Ingatkan nanti' : 'Tutup'),
            ),
          if (tersedia && h.rilis != null)
            FilledButton.icon(
              key: const Key('tombol-unduh-pembaruan'),
              onPressed: () async {
                final uri = Uri.tryParse(h.rilis!.jalurUnduh);
                final terbuka = uri != null &&
                    await launchUrl(uri, mode: LaunchMode.externalApplication);
                if (!terbuka) {
                  await Clipboard.setData(
                      ClipboardData(text: h.rilis!.jalurUnduh));
                  _kabar('Browser tidak dapat dibuka. Tautan unduhan disalin.',
                      galat: true);
                  return;
                }
                if (c.mounted) Navigator.pop(c);
              },
              icon: const Icon(Icons.download_outlined),
              label: const Text('Unduh sekarang'),
            )
          else if (h.wajib)
            FilledButton(
              onPressed: () => Navigator.pop(c),
              child: const Text('Tutup'),
            ),
        ],
      ),
    );
    _dialogPembaruanTerbuka = false;
  }

  // --- Perangkat ------------------------------------------------------------

  Future<void> _bukaLaci() async {
    if (!widget.pencetak.siap) {
      // Laci dibuka lewat printer. Tanpa printer tidak ada jalan lain, dan itu
      // harus dikatakan -- kasir yang menunggu laci terbuka akan menekan lagi.
      _kabar(
          'Printer tidak terpasang, sehingga laci kas tidak dapat dibuka dari sini.',
          galat: true);
      _kembalikanFokus();
      return;
    }
    await widget.pencetak.kirim(perintahBukaLaci());
    _kabar('Laci kas dibuka.');
    _kembalikanFokus();
  }

  Future<void> _cetakByteStruk(List<int> byte) async {
    if (!widget.pencetak.siap) {
      _kabar('Printer tidak terpasang, sehingga struk belum dapat dicetak.',
          galat: true);
      _kembalikanFokus();
      return;
    }
    await widget.pencetak.kirim(byte);
    _kabar('Struk dicetak.');
    _kembalikanFokus();
  }

  List<int> _susunStruk(
    HasilKeranjang t,
    MetodeBayar metode,
    String diserahkan,
    String kembalian,
    String nomorStruk,
    String jenisPesanan,
    String catatan,
  ) {
    final struk = StrukEscPos()
      ..rata(Rata.tengah)
      ..ukuranGanda(lebar: true, tinggi: true)
      ..baris(widget.namaToko)
      ..ukuranGanda()
      ..rata(Rata.kiri)
      ..baris(jenisPesanan)
      ..garis()
      ..baris('Struk: $nomorStruk');
    for (final l in t.lines) {
      struk
        ..baris(l.name)
        ..barisKiriKanan(
            '  ${l.quantity} x ${_uang(l.unitPrice)}', _uang(l.lineTotal));
    }
    struk
      ..garis()
      ..tebal(true)
      ..barisKiriKanan('TOTAL', _uang(t.grandTotal))
      ..tebal(false)
      ..barisKiriKanan(metode.nama, _uang(diserahkan))
      ..barisKiriKanan('Kembali', _uang(kembalian));
    if (catatan.isNotEmpty) {
      struk
        ..barisKosong()
        ..baris('Catatan: $catatan');
    }
    struk
      ..barisKosong()
      ..rata(Rata.tengah)
      ..baris('Terima kasih')
      ..potong();
    return struk.selesai();
  }

  Future<void> _bayar([MetodeBayar? pilihan]) async {
    if (_baris.isEmpty) {
      _kabar('Keranjang masih kosong.');
      _kembalikanFokus();
      return;
    }
    final t = _total;
    final metode =
        pilihan ?? (widget.metode.isEmpty ? null : widget.metode.first);
    if (metode == null) {
      _kabar('Belum ada metode pembayaran pada salinan di mesin ini.',
          galat: true);
      _kembalikanFokus();
      return;
    }

    widget.pelanggan?.value = PelangganMembayar(total: t.grandTotal);

    final diserahkan = await showDialog<String>(
      context: context,
      builder: (c) => _DialogBayar(
        total: t.grandTotal,
        metode: metode,
        mataUang: _katalogAktif.mataUang,
        uang: _uang,
        onUbah: (nilai) {
          final k =
              hitungKembalian(t.grandTotal, nilai, _katalogAktif.mataUang);
          widget.pelanggan?.value = PelangganMembayar(
            total: t.grandTotal,
            diserahkan: nilai.isEmpty ? null : nilai,
            kembalian: k.cukup ? k.change : null,
          );
        },
      ),
    );

    if (diserahkan == null) {
      widget.pelanggan?.value = PelangganMembayar(total: t.grandTotal);
      _perbaruiPelanggan();
      _kembalikanFokus();
      return;
    }

    final kembalian =
        hitungKembalian(t.grandTotal, diserahkan, _katalogAktif.mataUang);
    await _selesaikan(t, metode, diserahkan, kembalian.change);
  }

  Future<void> _selesaikan(
    HasilKeranjang t,
    MetodeBayar metode,
    String diserahkan,
    String kembalian,
  ) async {
    String? nomorStruk;
    if (widget.pembukuan != null) {
      try {
        _kabar('Membukukan transaksi ke peladen...');
        nomorStruk = await widget.pembukuan!(
          TransaksiKasir(
            baris: List.unmodifiable(_baris),
            hasil: t,
            metode: metode,
            diserahkan: diserahkan,
            kembalian: kembalian,
            jenisPesanan: namaJenisPesanan[_jenis]!,
            catatan: _catatan.text.trim(),
          ),
        );
      } catch (e) {
        _kabar('Transaksi belum dibukukan: $e', galat: true);
        _perbaruiPelanggan();
        _kembalikanFokus();
        return;
      }
    }

    // Transaksi sudah sah pada titik ini. Struk dan laci menjadi tindakan
    // lanjutan yang dipilih kasir dari layar sukses.
    final nomorStrukTampil = nomorStruk ??
        'LOKAL-${DateTime.now().millisecondsSinceEpoch.toString()}';
    final jenisPesanan = namaJenisPesanan[_jenis]!;
    final catatan = _catatan.text.trim();
    final byteStruk = _susunStruk(
      t,
      metode,
      diserahkan,
      kembalian,
      nomorStrukTampil,
      jenisPesanan,
      catatan,
    );

    widget.pelanggan?.value =
        PelangganSelesai(total: t.grandTotal, kembalian: kembalian);

    late final RiwayatPembayaranKasir riwayat;
    setState(() {
      riwayat = RiwayatPembayaranKasir(
        nomorStruk: nomorStrukTampil,
        waktu: DateTime.now(),
        metode: metode,
        total: t.grandTotal,
        diserahkan: diserahkan,
        kembalian: kembalian,
        jumlahBarang: t.lines
            .fold<int>(0, (jumlah, baris) => jumlah + baris.quantity.round()),
        jenisPesanan: jenisPesanan,
        catatan: catatan,
        byteStruk: byteStruk,
      );
      _riwayatPembayaran.insert(
        0,
        riwayat,
      );
      _baris.clear();
      _terakhir = null;
      _catatan.clear();
    });
    _kabar(
        'Transaksi selesai ($nomorStrukTampil). Kembalian ${_uang(kembalian)}.');
    if (mounted) {
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (c) => _DialogTransaksiBerhasil(
          riwayat: riwayat,
          uang: _uang,
          printerSiap: widget.pencetak.siap,
          onCetakStruk: () => _cetakByteStruk(riwayat.byteStruk),
          onBukaLaci: _bukaLaci,
        ),
      );
    }
    _kembalikanFokus();
  }

  // --- Tampilan -------------------------------------------------------------

  Future<void> _konfirmasiKeluar() async {
    if (widget.onKeluar == null) return;
    final setuju = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Keluar dari POS Apotik?'),
        content: Text(
          _baris.isEmpty
              ? 'Sesi akun pada perangkat ini akan ditutup.'
              : 'Keranjang saat ini belum diselesaikan dan akan dikosongkan.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Batal'),
          ),
          FilledButton.icon(
            onPressed: () => Navigator.pop(context, true),
            icon: const Icon(Icons.logout),
            label: const Text('Keluar'),
          ),
        ],
      ),
    );
    if (setuju == true) widget.onKeluar?.call();
  }

  @override
  Widget build(BuildContext context) {
    final t = _total;
    final ringkasLayar = MediaQuery.sizeOf(context).width < 760;

    return Focus(
      focusNode: _fokusLayar,
      onKeyEvent: _tangkapTombol,
      child: Scaffold(
        backgroundColor: Warna.halaman,
        bottomNavigationBar: ringkasLayar && _apotik
            ? NavigationBar(
                height: 64,
                selectedIndex: _menu == 'riwayat-pembayaran'
                    ? 2
                    : _menu == 'dashboard'
                        ? 3
                        : _jenis == JenisPesanan.dineIn
                            ? 1
                            : 0,
                onDestinationSelected: (i) {
                  setState(() {
                    _menu = switch (i) {
                      2 => 'riwayat-pembayaran',
                      3 => 'dashboard',
                      _ => 'kasir',
                    };
                    if (i == 0) _jenis = JenisPesanan.takeAway;
                    if (i == 1) _jenis = JenisPesanan.dineIn;
                  });
                  if (i < 2) _kembalikanFokus(bersihkanCari: false);
                },
                destinations: const [
                  NavigationDestination(
                      icon: Icon(Icons.shopping_bag_outlined), label: 'Kasir'),
                  NavigationDestination(
                      icon: Icon(Icons.assignment_outlined), label: 'Resep'),
                  NavigationDestination(
                      icon: Icon(Icons.history), label: 'Riwayat'),
                  NavigationDestination(
                      icon: Icon(Icons.grid_view_outlined), label: 'Lainnya'),
                ],
              )
            : null,
        body: LayoutBuilder(
          builder: (context, batas) {
            final ringkas = batas.maxWidth < 760;
            final isi = Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                BilahAtas(
                  namaOutlet: widget.namaOutlet ?? widget.namaToko,
                  printerSiap: widget.pencetak.siap,
                  shift: widget.shift,
                  koneksi: widget.koneksi,
                  namaPengguna: widget.namaPengguna,
                  pembaruan: widget.pembaruan,
                  onCekPembaruan: _cekPembaruan,
                  onKeluar: widget.onKeluar == null ? null : _konfirmasiKeluar,
                  ringkas: ringkas,
                  apotik: _apotik,
                ),
                Expanded(child: _isiMenu(t, ringkas: ringkas)),
              ],
            );
            if (ringkas) return isi;
            return Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                BilahSamping(
                  terpilih: _menu,
                  judul: _apotik ? 'POS Apotik' : 'eBisnis POS',
                  ikon: _apotik ? Icons.medication_outlined : Icons.bolt,
                  menu: _apotik ? daftarMenuApotik : daftarMenu,
                  onPilih: (m) {
                    setState(() {
                      _menu = m.kunci;
                      _pesan = null;
                    });
                    if (m.kunci == 'kasir') {
                      _kembalikanFokus(bersihkanCari: false);
                    }
                  },
                ),
                Expanded(child: isi),
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _isiMenu(HasilKeranjang t, {required bool ringkas}) {
    if (_menu != 'kasir') return _halamanMenu();
    return Padding(
      padding: EdgeInsets.all(ringkas ? 8 : 12),
      child: ringkas
          ? Column(
              children: [
                Expanded(child: _tengah(t, ringkas: true)),
                const SizedBox(height: 8),
                _RingkasanKeranjangMobile(
                  jumlah: t.itemCount,
                  total: _uang(t.grandTotal),
                  onTekan: () => _bukaKeranjangMobile(t),
                ),
              ],
            )
          : Row(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Expanded(child: _tengah(t)),
                const SizedBox(width: 12),
                _panelKeranjang(t),
              ],
            ),
    );
  }

  Widget _panelKeranjang(HasilKeranjang t) => PanelKeranjang(
        hasil: t,
        metode: widget.metode,
        uang: _uang,
        jenis: _jenis,
        labelJenis: _apotik ? _labelJenisApotik : namaJenisPesanan,
        ikonJenis: _apotik ? _ikonJenisApotik : ikonJenisPesanan,
        labelPelanggan: _apotik ? 'Pasien umum' : 'Pelanggan Umum',
        labelMeja: _apotik ? 'Resep / racikan' : 'Tanpa meja',
        pesanKosong: _apotik
            ? 'Pindai barcode obat, cari nama generik/dagang,\natau pilih item racikan dari katalog.'
            : 'Pindai barang atau tekan produk di sebelah kiri\nuntuk mulai melayani pembeli.',
        labelCatatan: _apotik
            ? 'Catatan Farmasi (Opsional)'
            : 'Catatan Pesanan (Opsional)',
        hintCatatan: _apotik
            ? 'Contoh: aturan pakai, alergi, nomor batch, konseling'
            : 'Contoh: tanpa gula, pisah saus, dll',
        onJenis: (j) {
          setState(() => _jenis = j);
          _kembalikanFokus(bersihkanCari: false);
        },
        onUbahJumlah: _ubahJumlah,
        onHapus: _hapusBaris,
        onBayar: _bayar,
        kendaliCatatan: _catatan,
      );

  Future<void> _bukaKeranjangMobile(HasilKeranjang t) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (context) => FractionallySizedBox(
        heightFactor: 0.92,
        child: ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(16)),
          child: _panelKeranjang(t),
        ),
      ),
    );
    _kembalikanFokus(bersihkanCari: false);
  }

  Widget _halamanMenu() {
    final produk = _katalogAktif.semua();
    return switch (_menu) {
      'dashboard' => HalamanDashboard(
          produk: produk,
          riwayat: _riwayatPembayaran,
          uang: _uang,
        ),
      'produk' => HalamanProduk(
          produk: produk,
          uang: _uang,
          onProdukDiunggah: (baru) {
            setState(() {
              _produkUnggahan = baru;
              _kategori = kategoriSemua;
              _kunciCari = '';
              _baris.clear();
              _terakhir = null;
            });
            _perbaruiPelanggan();
          },
        ),
      'riwayat-pembayaran' => HalamanRiwayatPembayaran(
          riwayat: _riwayatPembayaran,
          uang: _uang,
          printerSiap: widget.pencetak.siap,
          onCetakStruk: (riwayat) => _cetakByteStruk(riwayat.byteStruk),
        ),
      'pelanggan' => const HalamanRingkas(
          judul: 'Pelanggan',
          ikon: Icons.person_outline,
          keterangan: 'Daftar pelanggan aktif untuk transaksi kasir.',
          angka: [
            (label: 'Pelanggan umum', nilai: '1'),
            (label: 'Member hari ini', nilai: '0'),
          ],
        ),
      'stok' => HalamanRingkas(
          judul: 'Stok',
          ikon: Icons.warehouse_outlined,
          keterangan: 'Pantau ketersediaan barang pada salinan katalog.',
          angka: [
            (
              label: 'Stok diketahui',
              nilai: '${produk.where((p) => p.stok != null).length}'
            ),
            (
              label: 'Habis',
              nilai: '${produk.where((p) => p.stok == 0).length}'
            ),
          ],
        ),
      'pembelian' => const HalamanRingkas(
          judul: 'Pembelian',
          ikon: Icons.shopping_bag_outlined,
          keterangan: 'Ruang kerja pembelian dan penerimaan barang.',
          angka: [
            (label: 'Draft pembelian', nilai: '0'),
            (label: 'Menunggu terima', nilai: '0'),
          ],
        ),
      'promo' => const HalamanRingkas(
          judul: 'Promo',
          ikon: Icons.local_offer_outlined,
          keterangan: 'Aturan promo yang berlaku untuk kasir.',
          angka: [
            (label: 'Promo aktif', nilai: '0'),
            (label: 'Kupon', nilai: '0'),
          ],
        ),
      'laporan' => const HalamanRingkas(
          judul: 'Laporan',
          ikon: Icons.description_outlined,
          keterangan: 'Ringkasan transaksi dan laporan shift.',
          angka: [
            (label: 'Transaksi shift ini', nilai: '0'),
            (label: 'Retur', nilai: '0'),
          ],
        ),
      'pengaturan' => HalamanRingkas(
          judul: 'Pengaturan',
          ikon: Icons.settings_outlined,
          keterangan: 'Konfigurasi mesin kasir dan sumber data.',
          angka: [
            (
              label: 'Produk lokal',
              nilai: _produkUnggahan == null ? 'Tidak' : 'Ya'
            ),
            (label: 'Printer', nilai: widget.pencetak.siap ? 'Siap' : 'Tidak'),
          ],
        ),
      _ => HalamanDashboard(
          produk: produk,
          riwayat: _riwayatPembayaran,
          uang: _uang,
        ),
    };
  }

  Widget _tengah(HasilKeranjang t, {bool ringkas = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          decoration: hiasanKartu(),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: TextField(
            key: const Key('kotak-pindai'),
            controller: _pindai,
            focusNode: _fokusPindai,
            autofocus: true,
            style: const TextStyle(fontSize: 15),
            decoration: InputDecoration(
              icon: const Icon(Icons.search, color: Warna.teksRedup, size: 20),
              hintText: _apotik
                  ? 'Cari obat, barcode, nomor batch, atau SKU... (F2)'
                  : 'Cari produk, barcode, atau SKU... (F2)',
              hintStyle: const TextStyle(color: Warna.teksRedup, fontSize: 15),
              border: InputBorder.none,
              contentPadding: const EdgeInsets.symmetric(vertical: 14),
            ),
            onChanged: (v) => setState(() => _kunciCari = v),
            onSubmitted: _pindaiMasuk,
          ),
        ),
        if (_apotik) ...[
          const SizedBox(height: 10),
          _PanelKonteksApotik(
            nomorResep: _nomorResep,
            namaPasien: _namaPasien,
            onFokusSelesai: () => _kembalikanFokus(bersihkanCari: false),
            ringkas: ringkas,
          ),
        ],
        if (_pesan != null) ...[
          const SizedBox(height: 8),
          Container(
            key: const Key('pesan'),
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: _pesanGalat
                  ? const Color(0xFFFEE2E2)
                  : const Color(0xFFE0F2FE),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(_pesan!, style: const TextStyle(fontSize: 13)),
          ),
        ],
        const SizedBox(height: 12),
        Expanded(
          child: KisiProduk(
            produk: _produkTampil,
            kategori: _katalogAktif.kategori(),
            terpilih: _kategori,
            kunciCari: _kunciCari,
            /*
             * Fokus dikembalikan ke kotak pindai sesudah menekan chip kategori.
             *
             * Spesifikasi bagian 3.2 menyelesaikan ini dengan perebutan fokus global
             * berjeda 50 ms. Cara itu TIDAK dipakai di sini: layar ini punya
             * kotak catatan pesanan dan dialog pembayaran, dan perebut fokus
             * global akan menarik kursor keluar dari keduanya saat kasir sedang
             * mengetik.
             *
             * Yang dilakukan adalah versi sempitnya -- setiap tempat yang
             * meninggalkan fokus pada tombol dikembalikan satu per satu. Lebih
             * sedikit yang tercakup, tetapi tidak ada yang dirusak.
             */
            onKategori: (k) {
              setState(() => _kategori = k);
              _kembalikanFokus(bersihkanCari: false);
            },
            onPilih: _tambah,
            uang: _uang,
          ),
        ),
        if (!ringkas) ...[
          const SizedBox(height: 10),
          const _BilahPintasan(),
        ],
      ],
    );
  }
}

class _RingkasanKeranjangMobile extends StatelessWidget {
  const _RingkasanKeranjangMobile({
    required this.jumlah,
    required this.total,
    required this.onTekan,
  });

  final int jumlah;
  final String total;
  final VoidCallback onTekan;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        key: const Key('ringkasan-keranjang-mobile'),
        onTap: onTekan,
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.all(10),
          decoration: hiasanKartu(garis: Warna.utama),
          child: Row(
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  const Icon(Icons.shopping_cart_outlined,
                      size: 28, color: Warna.utama),
                  if (jumlah > 0)
                    Positioned(
                      right: -8,
                      top: -8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 6, vertical: 2),
                        decoration: const BoxDecoration(
                          color: Warna.utama,
                          shape: BoxShape.circle,
                        ),
                        child: Text(
                          '$jumlah',
                          style: const TextStyle(
                              color: Colors.white,
                              fontSize: 10,
                              fontWeight: FontWeight.w800),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              const Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text('Keranjang',
                        style: TextStyle(fontWeight: FontWeight.w800)),
                    Text('Lihat detail transaksi',
                        style: TextStyle(fontSize: 11, color: Warna.teksRedup)),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('Total',
                      style: TextStyle(fontSize: 11, color: Warna.teksRedup)),
                  Text(total,
                      style: const TextStyle(
                          color: Warna.utama,
                          fontSize: 16,
                          fontWeight: FontWeight.w900)),
                ],
              ),
              const SizedBox(width: 8),
              const Icon(Icons.chevron_right, color: Warna.utama),
            ],
          ),
        ),
      ),
    );
  }
}

const Map<JenisPesanan, String> _labelJenisApotik = {
  JenisPesanan.dineIn: 'Resep',
  JenisPesanan.takeAway: 'Bebas',
  JenisPesanan.delivery: 'Antar',
};

const Map<JenisPesanan, IconData> _ikonJenisApotik = {
  JenisPesanan.dineIn: Icons.assignment_outlined,
  JenisPesanan.takeAway: Icons.medication_liquid_outlined,
  JenisPesanan.delivery: Icons.local_shipping_outlined,
};

class _PanelKonteksApotik extends StatelessWidget {
  const _PanelKonteksApotik({
    required this.nomorResep,
    required this.namaPasien,
    required this.onFokusSelesai,
    this.ringkas = false,
  });

  final TextEditingController nomorResep;
  final TextEditingController namaPasien;
  final VoidCallback onFokusSelesai;
  final bool ringkas;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('panel-konteks-apotik'),
      decoration: hiasanKartu(garis: const Color(0xFFBAE6FD)),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                const Icon(Icons.health_and_safety_outlined,
                    color: Warna.utama, size: 20),
                const SizedBox(width: 8),
                const Text(
                  'Konteks farmasi',
                  style: TextStyle(fontWeight: FontWeight.w800),
                ),
                const SizedBox(width: 12),
                _ChipFarmasi(label: 'OTC', warna: Color(0xFF047857)),
                const SizedBox(width: 6),
                _ChipFarmasi(label: 'Resep dokter', warna: Warna.utama),
                const SizedBox(width: 6),
                _ChipFarmasi(label: 'Racikan', warna: Color(0xFF0891B2)),
                const SizedBox(width: 6),
                _ChipFarmasi(label: 'Produksi', warna: Color(0xFF7C3AED)),
              ],
            ),
          ),
          const SizedBox(height: 10),
          if (ringkas) ...[
            TextField(
              key: const Key('nomor-resep-apotik'),
              controller: nomorResep,
              style: const TextStyle(fontSize: 12.5),
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'No. resep / e-resep',
                prefixIcon: Icon(Icons.receipt_long_outlined, size: 18),
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => onFokusSelesai(),
            ),
            const SizedBox(height: 8),
            TextField(
              key: const Key('nama-pasien-apotik'),
              controller: namaPasien,
              style: const TextStyle(fontSize: 12.5),
              decoration: const InputDecoration(
                isDense: true,
                labelText: 'Pasien / penanggung jawab',
                prefixIcon: Icon(Icons.person_search_outlined, size: 18),
                border: OutlineInputBorder(),
              ),
              onSubmitted: (_) => onFokusSelesai(),
            ),
          ] else
            Row(
              children: [
                Expanded(
                  child: TextField(
                    key: const Key('nomor-resep-apotik'),
                    controller: nomorResep,
                    style: const TextStyle(fontSize: 12.5),
                    decoration: const InputDecoration(
                      isDense: true,
                      labelText: 'No. resep / e-resep',
                      prefixIcon: Icon(Icons.receipt_long_outlined, size: 18),
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => onFokusSelesai(),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    key: const Key('nama-pasien-apotik'),
                    controller: namaPasien,
                    style: const TextStyle(fontSize: 12.5),
                    decoration: const InputDecoration(
                      isDense: true,
                      labelText: 'Pasien / penanggung jawab',
                      prefixIcon: Icon(Icons.person_search_outlined, size: 18),
                      border: OutlineInputBorder(),
                    ),
                    onSubmitted: (_) => onFokusSelesai(),
                  ),
                ),
              ],
            ),
          if (!ringkas) ...[
            const SizedBox(height: 10),
            const Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _GuardrailFarmasi(
                  ikon: Icons.warning_amber_outlined,
                  teks: 'High-alert dan obat keras ditandai sebelum bayar.',
                ),
                _GuardrailFarmasi(
                  ikon: Icons.science_outlined,
                  teks: 'Racikan memakai item formula, bahan, dan jasa.',
                ),
                _GuardrailFarmasi(
                  ikon: Icons.event_available_outlined,
                  teks: 'Batch dan kedaluwarsa dicatat pada catatan farmasi.',
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _ChipFarmasi extends StatelessWidget {
  const _ChipFarmasi({required this.label, required this.warna});

  final String label;
  final Color warna;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: warna.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(7),
      ),
      child: Text(
        label,
        style:
            TextStyle(color: warna, fontSize: 11, fontWeight: FontWeight.w800),
      ),
    );
  }
}

class _GuardrailFarmasi extends StatelessWidget {
  const _GuardrailFarmasi({required this.ikon, required this.teks});

  final IconData ikon;
  final String teks;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 220,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(ikon, size: 16, color: Warna.teksRedup),
          const SizedBox(width: 6),
          Expanded(
            child: Text(
              teks,
              style: const TextStyle(
                color: Warna.teksRedup,
                fontSize: 11.5,
                height: 1.3,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bilah pintasan di kaki kolom tengah.
///
/// Selalu terlihat: kasir baru tidak perlu membuka bantuan untuk tahu tombol
/// mana yang membayar. Isinya dibangkitkan dari `pintasan.dart`, sehingga peta
/// tombol yang berubah tidak dapat meninggalkan bilah ini menampilkan yang lama.
class _BilahPintasan extends StatelessWidget {
  const _BilahPintasan();

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView(
        key: const Key('bilah-pintasan'),
        scrollDirection: Axis.horizontal,
        children: [
          for (final p in daftarPintasan())
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10),
                decoration: hiasanKartu(radius: 8),
                child: Row(
                  children: [
                    Text(
                      keteranganAksi[p.aksi]!,
                      style: const TextStyle(
                          fontSize: 12, fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(width: 7),
                    Text(
                      p.tombol,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: Warna.utama,
                      ),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _DialogTransaksiBerhasil extends StatelessWidget {
  const _DialogTransaksiBerhasil({
    required this.riwayat,
    required this.uang,
    required this.printerSiap,
    required this.onCetakStruk,
    required this.onBukaLaci,
  });

  final RiwayatPembayaranKasir riwayat;
  final String Function(String) uang;
  final bool printerSiap;
  final Future<void> Function() onCetakStruk;
  final Future<void> Function() onBukaLaci;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      key: const Key('dialog-transaksi-berhasil'),
      title: const Text('Transaksi Berhasil'),
      content: SizedBox(
        width: 330,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CircleAvatar(
              radius: 24,
              backgroundColor: Color(0xFF16A34A),
              child: Icon(Icons.check, color: Colors.white, size: 32),
            ),
            const SizedBox(height: 14),
            const Text(
              'Berhasil',
              style: TextStyle(
                color: Color(0xFF16A34A),
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              riwayat.nomorStruk,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Warna.teksRedup),
            ),
            const Divider(height: 28),
            _BarisSukses(label: 'Jenis', nilai: riwayat.jenisPesanan),
            _BarisSukses(label: 'Item', nilai: '${riwayat.jumlahBarang}'),
            _BarisSukses(label: 'Metode', nilai: riwayat.metode.nama),
            _BarisSukses(
                label: 'Total', nilai: uang(riwayat.total), tebal: true),
            _BarisSukses(
                label: 'Kembalian',
                nilai: uang(riwayat.kembalian),
                tebal: true),
            if (!printerSiap) ...[
              const SizedBox(height: 10),
              const Text(
                'Printer tidak terpasang. Struk bisa dicetak dari Riwayat Pembayaran setelah printer siap.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Warna.teksRedup, fontSize: 12),
              ),
            ],
          ],
        ),
      ),
      actions: [
        OutlinedButton.icon(
          key: const Key('aksi-cetak-struk-selesai'),
          onPressed: printerSiap ? () => onCetakStruk() : null,
          icon: const Icon(Icons.print_outlined),
          label: const Text('Cetak Struk'),
        ),
        OutlinedButton.icon(
          key: const Key('aksi-buka-laci-selesai'),
          onPressed: printerSiap ? () => onBukaLaci() : null,
          icon: const Icon(Icons.inventory_2_outlined),
          label: const Text('Buka Laci'),
        ),
        FilledButton(
          key: const Key('aksi-transaksi-baru'),
          onPressed: () => Navigator.pop(context),
          child: const Text('Transaksi Baru'),
        ),
      ],
    );
  }
}

class _BarisSukses extends StatelessWidget {
  const _BarisSukses({
    required this.label,
    required this.nilai,
    this.tebal = false,
  });

  final String label;
  final String nilai;
  final bool tebal;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          Expanded(
            child: Text(label, style: const TextStyle(color: Warna.teksRedup)),
          ),
          Text(
            nilai,
            style: TextStyle(
              fontWeight: tebal ? FontWeight.w800 : FontWeight.w500,
              color: Warna.teks,
            ),
          ),
        ],
      ),
    );
  }
}

class _DialogBayar extends StatefulWidget {
  const _DialogBayar({
    required this.total,
    required this.metode,
    required this.mataUang,
    required this.uang,
    required this.onUbah,
  });

  final String total;
  final MetodeBayar metode;
  final String mataUang;
  final String Function(String) uang;
  final void Function(String) onUbah;

  @override
  State<_DialogBayar> createState() => _DialogBayarState();
}

class _DialogBayarState extends State<_DialogBayar> {
  final _kendali = TextEditingController();

  @override
  void dispose() {
    _kendali.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final k = hitungKembalian(widget.total,
        _kendali.text.isEmpty ? '0' : _kendali.text, widget.mataUang);

    return AlertDialog(
      key: const Key('dialog-bayar'),
      title: Text('Bayar ${widget.uang(widget.total)}'),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(widget.metode.nama),
          const SizedBox(height: 12),
          if (widget.metode.memberiKembalian) ...[
            TextField(
              key: const Key('uang-diserahkan'),
              controller: _kendali,
              autofocus: true,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Uang diserahkan',
                border: OutlineInputBorder(),
              ),
              onChanged: (v) {
                setState(() {});
                widget.onUbah(v);
              },
            ),
            const SizedBox(height: 12),
            Text(
              k.cukup
                  ? 'Kembalian ${widget.uang(k.change)}'
                  : 'Kurang ${widget.uang(k.kurang)}',
              key: const Key('kembalian'),
              style: TextStyle(
                fontSize: 24,
                fontWeight: FontWeight.bold,
                color: k.cukup ? Colors.green.shade700 : Colors.red.shade700,
              ),
            ),
          ],
        ],
      ),
      actions: [
        TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Batal')),
        FilledButton(
          key: const Key('selesaikan'),
          // Tidak dapat ditekan selama uangnya kurang. Menyelesaikan transaksi
          // dengan pembayaran kurang berarti selisih laci kas yang baru ketahuan
          // saat tutup shift, tanpa cara mengetahui transaksi mana penyebabnya.
          onPressed: widget.metode.memberiKembalian && !k.cukup
              ? null
              : () => Navigator.pop(
                    context,
                    _kendali.text.isEmpty ? widget.total : _kendali.text,
                  ),
          child: const Text('Selesaikan'),
        ),
      ],
    );
  }
}
