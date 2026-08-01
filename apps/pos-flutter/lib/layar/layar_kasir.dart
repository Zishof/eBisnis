/// Layar kasir.
///
/// Bentuknya mengikuti layar kasir web, dan itu disengaja: kasir yang berpindah
/// antara keduanya tidak boleh perlu belajar ulang. Yang menentukannya sama:
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
/// Yang berbeda dari klien web hanya tiga: seluruh tombol fungsi tersedia,
/// printer dan laci kas terjangkau langsung, dan ada layar kedua yang menghadap
/// pembeli.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../aturan/harga_luring.dart';
import '../perangkat/escpos.dart';
import 'pintasan.dart';
import 'sumber.dart';
import 'tampilan_pelanggan.dart';

class LayarKasir extends StatefulWidget {
  const LayarKasir({
    required this.katalog,
    required this.metode,
    required this.pencetak,
    required this.namaToko,
    this.pelanggan,
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

  @override
  State<LayarKasir> createState() => _LayarKasirState();
}

class _LayarKasirState extends State<LayarKasir> {
  final List<BarisLuring> _baris = [];
  final TextEditingController _pindai = TextEditingController();
  final FocusNode _fokusPindai = FocusNode();
  final FocusNode _fokusLayar = FocusNode();

  String? _pesan;
  bool _pesanGalat = false;
  BarisLuring? _terakhir;

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
  void _kembalikanFokus() {
    _pindai.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) => _fokusPindai.requestFocus());
  }

  void _pindaiMasuk(String kode) {
    final bersih = kode.trim();
    if (bersih.isEmpty) return;

    final p = widget.katalog.dariBarcode(bersih);
    if (p == null) {
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
    _tambah(p);
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
        });
        _perbaruiPelanggan();
        _kembalikanFokus();
      case AksiKasir.hapusBaris:
        if (_baris.isNotEmpty) _ubahJumlah(_baris.length - 1, -_baris.last.quantity);
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

  Future<void> _bayar() async {
    if (_baris.isEmpty) {
      _kabar('Keranjang masih kosong.');
      _kembalikanFokus();
      return;
    }
    final t = _total;
    final metode = widget.metode.isEmpty ? null : widget.metode.first;
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
    await _selesaikan(t, diserahkan, kembalian.change);
  }

  Future<void> _selesaikan(HasilKeranjang t, String diserahkan, String kembalian) async {
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
        ..barisKiriKanan('Tunai', _uang(diserahkan))
        ..barisKiriKanan('Kembali', _uang(kembalian))
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
    });
    _kabar(
      widget.pencetak.siap
          ? 'Transaksi selesai. Kembalian ${_uang(kembalian)}.'
          : 'Transaksi selesai. Kembalian ${_uang(kembalian)}. Struk TIDAK tercetak — printer tidak terpasang.',
      galat: !widget.pencetak.siap,
    );
    _kembalikanFokus();
  }

  @override
  Widget build(BuildContext context) {
    final t = _total;

    return Focus(
      focusNode: _fokusLayar,
      onKeyEvent: _tangkapTombol,
      child: Scaffold(
        body: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.all(12),
                child: TextField(
                  key: const Key('kotak-pindai'),
                  controller: _pindai,
                  focusNode: _fokusPindai,
                  autofocus: true,
                  style: const TextStyle(fontSize: 22),
                  decoration: const InputDecoration(
                    labelText: 'Pindai barcode di sini (F2)',
                    border: OutlineInputBorder(),
                  ),
                  onSubmitted: _pindaiMasuk,
                ),
              ),
              if (_pesan != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  child: Container(
                    key: const Key('pesan'),
                    width: double.infinity,
                    padding: const EdgeInsets.all(10),
                    color: _pesanGalat ? const Color(0xFFFEE2E2) : const Color(0xFFE0F2FE),
                    child: Text(_pesan!),
                  ),
                ),
              Expanded(
                child: _baris.isEmpty
                    ? const Center(
                        key: Key('keranjang-kosong'),
                        child: Text('Pindai barang untuk mulai melayani pembeli.'),
                      )
                    : ListView.builder(
                        key: const Key('daftar-keranjang'),
                        itemCount: t.lines.length,
                        itemBuilder: (c, i) {
                          final l = t.lines[i];
                          return ListTile(
                            title: Text(l.name),
                            subtitle: Text('${l.quantity} × ${_uang(l.unitPrice)}'),
                            trailing: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                IconButton(
                                  key: Key('kurang-$i'),
                                  onPressed: () => _ubahJumlah(i, -1),
                                  icon: const Icon(Icons.remove),
                                ),
                                IconButton(
                                  key: Key('tambah-$i'),
                                  onPressed: () => _ubahJumlah(i, 1),
                                  icon: const Icon(Icons.add),
                                ),
                                SizedBox(
                                  width: 120,
                                  child: Text(
                                    _uang(l.lineTotal),
                                    textAlign: TextAlign.end,
                                    style: const TextStyle(fontWeight: FontWeight.bold),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
              ),
              const Divider(height: 1),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Text('${t.itemCount} barang'),
                    const Spacer(),
                    Text(
                      _uang(t.grandTotal),
                      key: const Key('total'),
                      style: const TextStyle(fontSize: 34, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(width: 16),
                    FilledButton(
                      key: const Key('tombol-bayar'),
                      onPressed: _baris.isEmpty ? null : () => _jalankan(AksiKasir.bayar),
                      child: const Text('Bayar (F9)'),
                    ),
                  ],
                ),
              ),
              // Bilah pintasan selalu terlihat. Kasir baru tidak perlu membuka
              // bantuan untuk tahu tombol mana yang membayar.
              Container(
                width: double.infinity,
                color: const Color(0xFFF1F5F9),
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                child: Text(
                  daftarPintasan()
                      .map((p) => '${p.tombol} ${keteranganAksi[p.aksi]}')
                      .join('   ·   '),
                  style: const TextStyle(fontSize: 11),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
        ),
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
