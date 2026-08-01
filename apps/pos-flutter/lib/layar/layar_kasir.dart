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

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../aturan/harga_luring.dart';
import '../aturan/koneksi.dart';
import '../pembaruan/pengelola_pembaruan.dart';
import '../pembaruan/versi.dart';
import '../perangkat/escpos.dart';
import 'bilah_atas.dart';
import 'bilah_samping.dart';
import 'kisi_produk.dart';
import 'panel_keranjang.dart';
import 'pintasan.dart';
import 'sumber.dart';
import 'tampilan_pelanggan.dart';
import 'tema.dart';

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
    this.pembaruan,
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
  final PengelolaPembaruan? pembaruan;

  @override
  State<LayarKasir> createState() => _LayarKasirState();
}

class _LayarKasirState extends State<LayarKasir> {
  final List<BarisLuring> _baris = [];
  final TextEditingController _pindai = TextEditingController();
  final TextEditingController _catatan = TextEditingController();
  final FocusNode _fokusPindai = FocusNode();
  final FocusNode _fokusLayar = FocusNode();

  String? _pesan;
  bool _pesanGalat = false;
  BarisLuring? _terakhir;

  String _kategori = kategoriSemua;
  String _kunciCari = '';
  JenisPesanan _jenis = JenisPesanan.dineIn;

  HasilKeranjang get _total =>
      hitungKeranjangLuring(_baris, widget.katalog.tarif, widget.katalog.mataUang);

  @override
  void initState() {
    super.initState();
    _perbaruiPelanggan();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fokusPindai.requestFocus());
  }

  @override
  void dispose() {
    _pindai.dispose();
    _catatan.dispose();
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
      p.value = PelangganMenunggu(namaToko: widget.namaToko, sapaan: 'Selamat datang');
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
              final l = t.lines.firstWhere((x) => x.productId == _terakhir!.productId);
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
    var daftar = widget.katalog.semua();

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
    WidgetsBinding.instance.addPostFrameCallback((_) => _fokusPindai.requestFocus());
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

    final p = widget.katalog.dariBarcode(bersih);
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
    // Tidak langsung dimasukkan meski hanya satu yang cocok — memasukkan barang
    // yang tidak sempat dilihat kasir adalah cara termudah menjual barang yang
    // salah kepada orang yang sedang menunggu.
    final cocok = widget.katalog.cari(bersih);
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
    // dahulu — jari yang terlatih menekan lebih cepat daripada mata membaca.
    if (wajibKonfirmasi.contains(aksi)) {
      final lanjut = await _konfirmasi(keteranganAksi[aksi]!);
      if (!lanjut) {
        _kembalikanFokus();
        return;
      }
    }

    switch (aksi) {
      case AksiKasir.fokusPindai:
        _kembalikanFokus();
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
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('Batal')),
          FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Lanjutkan')),
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
                      ? const Text('hanya di aplikasi', style: TextStyle(fontSize: 11))
                      : null,
                ),
            ],
          ),
        ),
        actions: [TextButton(onPressed: () => Navigator.pop(c), child: const Text('Tutup'))],
      ),
    );
  }

  // --- Pembaruan ------------------------------------------------------------

  Future<void> _cekPembaruan() async {
    final p = widget.pembaruan;
    if (p == null) return;

    await p.periksa();
    if (!mounted) return;

    final h = p.hasil;
    if (h == null) return;

    await showDialog<void>(
      context: context,
      builder: (c) => AlertDialog(
        key: const Key('dialog-pembaruan'),
        title: Text(switch (h.keadaan) {
          KeadaanPembaruan.tersedia => 'Pembaruan tersedia',
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
              if (h.rilis?.catatan case final catatan? when catatan.trim().isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text('Catatan rilis', style: TextStyle(fontWeight: FontWeight.w600)),
                const SizedBox(height: 4),
                ConstrainedBox(
                  constraints: const BoxConstraints(maxHeight: 160),
                  child: SingleChildScrollView(child: Text(catatan)),
                ),
              ],
              if (h.rilis case final rilis?) ...[
                const SizedBox(height: 14),
                /*
                 * Tautannya ditampilkan dan disalin, bukan dijalankan.
                 *
                 * Klien ini sengaja tidak mengunduh dan tidak memasang apa pun
                 * sendiri: mengganti berkas aplikasi kasir di tengah hari kerja
                 * adalah tindakan yang harus dipilih manusia, pada saat yang ia
                 * pilih sendiri — dan gerai umumnya memperbarui sesudah tutup.
                 */
                const Text('Tautan unduhan', style: TextStyle(fontWeight: FontWeight.w600)),
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
                if (c.mounted) Navigator.pop(c);
                _kabar('Tautan unduhan disalin. Pasang sesudah gerai tutup.');
              },
              child: const Text('Salin tautan'),
            ),
          FilledButton(onPressed: () => Navigator.pop(c), child: const Text('Tutup')),
        ],
      ),
    );
    _kembalikanFokus();
  }

  // --- Perangkat ------------------------------------------------------------

  Future<void> _bukaLaci() async {
    if (!widget.pencetak.siap) {
      // Laci dibuka lewat printer. Tanpa printer tidak ada jalan lain, dan itu
      // harus dikatakan — kasir yang menunggu laci terbuka akan menekan lagi.
      _kabar('Printer tidak terpasang, sehingga laci kas tidak dapat dibuka dari sini.',
          galat: true);
      _kembalikanFokus();
      return;
    }
    await widget.pencetak.kirim(perintahBukaLaci());
    _kabar('Laci kas dibuka.');
    _kembalikanFokus();
  }

  Future<void> _bayar([MetodeBayar? pilihan]) async {
    if (_baris.isEmpty) {
      _kabar('Keranjang masih kosong.');
      _kembalikanFokus();
      return;
    }
    final t = _total;
    final metode = pilihan ?? (widget.metode.isEmpty ? null : widget.metode.first);
    if (metode == null) {
      _kabar('Belum ada metode pembayaran pada salinan di mesin ini.', galat: true);
      _kembalikanFokus();
      return;
    }

    widget.pelanggan?.value = PelangganMembayar(total: t.grandTotal);

    final diserahkan = await showDialog<String>(
      context: context,
      builder: (c) => _DialogBayar(
        total: t.grandTotal,
        metode: metode,
        mataUang: widget.katalog.mataUang,
        uang: _uang,
        onUbah: (nilai) {
          final k = hitungKembalian(t.grandTotal, nilai, widget.katalog.mataUang);
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

    final kembalian = hitungKembalian(t.grandTotal, diserahkan, widget.katalog.mataUang);
    await _selesaikan(t, metode, diserahkan, kembalian.change);
  }

  Future<void> _selesaikan(
    HasilKeranjang t,
    MetodeBayar metode,
    String diserahkan,
    String kembalian,
  ) async {
    /*
     * Struk dicetak dan laci dibuka pada perintah yang sama.
     *
     * Keduanya digabung bukan demi ringkas, melainkan karena laci yang terbuka
     * tanpa struk — atau sebaliknya — membuat kasir tidak yakin transaksinya
     * sudah selesai atau belum, dan ketidakyakinan itu berakhir sebagai
     * transaksi yang diulang.
     */
    if (widget.pencetak.siap) {
      final struk = StrukEscPos()
        ..rata(Rata.tengah)
        ..ukuranGanda(lebar: true, tinggi: true)
        ..baris(widget.namaToko)
        ..ukuranGanda()
        ..rata(Rata.kiri)
        ..baris(namaJenisPesanan[_jenis]!)
        ..garis();
      for (final l in t.lines) {
        struk
          ..baris(l.name)
          ..barisKiriKanan('  ${l.quantity} x ${_uang(l.unitPrice)}', _uang(l.lineTotal));
      }
      struk
        ..garis()
        ..tebal(true)
        ..barisKiriKanan('TOTAL', _uang(t.grandTotal))
        ..tebal(false)
        ..barisKiriKanan(metode.nama, _uang(diserahkan))
        ..barisKiriKanan('Kembali', _uang(kembalian));
      // Catatan pesanan ikut tercetak. Ia ditulis untuk dapur atau barista, dan
      // struk adalah satu-satunya kertas yang sampai ke sana.
      if (_catatan.text.trim().isNotEmpty) {
        struk
          ..barisKosong()
          ..baris('Catatan: ${_catatan.text.trim()}');
      }
      struk
        ..barisKosong()
        ..rata(Rata.tengah)
        ..baris('Terima kasih')
        ..bukaLaci()
        ..potong();
      await widget.pencetak.kirim(struk.selesai());
    }

    widget.pelanggan?.value = PelangganSelesai(total: t.grandTotal, kembalian: kembalian);

    setState(() {
      _baris.clear();
      _terakhir = null;
      _catatan.clear();
    });
    _kabar(
      widget.pencetak.siap
          ? 'Transaksi selesai. Kembalian ${_uang(kembalian)}.'
          : 'Transaksi selesai. Kembalian ${_uang(kembalian)}. Struk TIDAK tercetak — printer tidak terpasang.',
      galat: !widget.pencetak.siap,
    );
    _kembalikanFokus();
  }

  // --- Tampilan -------------------------------------------------------------

  @override
  Widget build(BuildContext context) {
    final t = _total;

    return Focus(
      focusNode: _fokusLayar,
      onKeyEvent: _tangkapTombol,
      child: Scaffold(
        backgroundColor: Warna.halaman,
        body: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            BilahSamping(
              terpilih: 'kasir',
              onPilih: (m) {
                if (m.diKlienIni) return;
                // Menu yang layarnya ada di aplikasi web menjawab di mana
                // layarnya berada. Diam akan membuat kasir menekannya lagi.
                _kabar('${m.label} ada pada aplikasi web eBisnis, belum pada klien kasir ini.');
              },
            ),
            Expanded(
              child: Column(
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
                  ),
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.all(12),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(child: _tengah(t)),
                          const SizedBox(width: 12),
                          PanelKeranjang(
                            hasil: t,
                            metode: widget.metode,
                            uang: _uang,
                            jenis: _jenis,
                            onJenis: (j) => setState(() => _jenis = j),
                            onUbahJumlah: _ubahJumlah,
                            onHapus: _hapusBaris,
                            onBayar: _bayar,
                            kendaliCatatan: _catatan,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tengah(HasilKeranjang t) {
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
            decoration: const InputDecoration(
              icon: Icon(Icons.search, color: Warna.teksRedup, size: 20),
              hintText: 'Cari produk, barcode, atau SKU… (F2)',
              hintStyle: TextStyle(color: Warna.teksRedup, fontSize: 15),
              border: InputBorder.none,
              contentPadding: EdgeInsets.symmetric(vertical: 14),
            ),
            onChanged: (v) => setState(() => _kunciCari = v),
            onSubmitted: _pindaiMasuk,
          ),
        ),
        if (_pesan != null) ...[
          const SizedBox(height: 8),
          Container(
            key: const Key('pesan'),
            width: double.infinity,
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: _pesanGalat ? const Color(0xFFFEE2E2) : const Color(0xFFE0F2FE),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Text(_pesan!, style: const TextStyle(fontSize: 13)),
          ),
        ],
        const SizedBox(height: 12),
        Expanded(
          child: KisiProduk(
            produk: _produkTampil,
            kategori: widget.katalog.kategori(),
            terpilih: _kategori,
            kunciCari: _kunciCari,
            onKategori: (k) => setState(() => _kategori = k),
            onPilih: _tambah,
            uang: _uang,
          ),
        ),
        const SizedBox(height: 10),
        const _BilahPintasan(),
      ],
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
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
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
    final k = hitungKembalian(widget.total, _kendali.text.isEmpty ? '0' : _kendali.text,
        widget.mataUang);

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
        TextButton(onPressed: () => Navigator.pop(context), child: const Text('Batal')),
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
