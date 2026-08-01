/// Buku besar kasir lokal — bahan hash dan rantainya.
///
/// Salinan Dart dari `apps/web/src/pos-offline/ledger.ts`.
///
/// Bagian paling menentukan pada seluruh klien ini. Rantai hash hanya berguna
/// bila kedua implementasi menyusun teks yang **persis sama** sebelum
/// menghashnya. Satu pemisah yang berbeda, satu medan yang urutannya tertukar,
/// dan rantai yang dibuat klien Flutter akan dilaporkan rusak ketika diperiksa
/// klien web — atau sebaliknya, kerusakan sungguhan akan lolos tanpa terlihat.
///
/// Karena itu bahan hashnya diikat vektor bersama, bukan kehati-hatian orang
/// yang menyalinnya.
library;

import 'dart:convert';

/// Hash awal rantai; menandai bahwa tidak ada baris sebelum yang pertama.
final String hashAwal = '0' * 64;

/// Pemisah antar-medan pada bahan hash.
///
/// Ditulis sebagai escape `\u001F`, BUKAN sebagai karakter harfiah. Pada sisi
/// TypeScript ia semula memang diketik langsung, dan karena tidak dapat dicetak,
/// barisnya terbaca `.join('')` pada editor dan diff mana pun — siapa pun yang
/// merapikan tanda kutip itu akan mengubah setiap hash tanpa diff yang terlihat.
///
/// Pemisahnya sendiri memang diperlukan: tanpanya, outlet "AB" dengan terminal
/// "C" tidak dapat dibedakan dari outlet "A" dengan terminal "BC", dan keduanya
/// menghasilkan hash yang identik.
///
/// Nilainya TIDAK boleh diubah: mengubahnya membatalkan seluruh buku besar yang
/// sudah tercatat pada mesin kasir mana pun.
const String pemisahMedan = '\u001F';

class BarisMuatan {
  const BarisMuatan({
    required this.productId,
    required this.uomId,
    required this.quantity,
    required this.unitPrice,
    required this.lineSubtotal,
    required this.taxAmount,
    required this.lineTotal,
    required this.taxRateId,
  });

  factory BarisMuatan.dariJson(Map<String, Object?> j) => BarisMuatan(
        productId: j['productId']! as String,
        uomId: j['uomId'] as String?,
        quantity: j['quantity']! as int,
        unitPrice: j['unitPrice']! as String,
        lineSubtotal: j['lineSubtotal']! as String,
        taxAmount: j['taxAmount']! as String,
        lineTotal: j['lineTotal']! as String,
        taxRateId: j['taxRateId'] as String?,
      );

  final String productId;
  final String? uomId;
  final int quantity;
  final String unitPrice;
  final String lineSubtotal;
  final String taxAmount;
  final String lineTotal;
  final String? taxRateId;
}

class PembayaranMuatan {
  const PembayaranMuatan({
    required this.paymentMethodId,
    required this.amount,
    required this.tenderedAmount,
    required this.reference,
  });

  factory PembayaranMuatan.dariJson(Map<String, Object?> j) => PembayaranMuatan(
        paymentMethodId: j['paymentMethodId']! as String,
        amount: j['amount']! as String,
        tenderedAmount: j['tenderedAmount'] as String?,
        reference: j['reference'] as String?,
      );

  final String paymentMethodId;
  final String amount;
  final String? tenderedAmount;
  final String? reference;
}

class MuatanTransaksi {
  const MuatanTransaksi({
    required this.lines,
    required this.payments,
    required this.subtotal,
    required this.taxTotal,
    required this.changeTotal,
    required this.currencyCode,
    required this.catalogSyncedAt,
  });

  factory MuatanTransaksi.dariJson(Map<String, Object?> j) => MuatanTransaksi(
        lines: (j['lines']! as List)
            .map((e) => BarisMuatan.dariJson(e as Map<String, Object?>))
            .toList(),
        payments: (j['payments']! as List)
            .map((e) => PembayaranMuatan.dariJson(e as Map<String, Object?>))
            .toList(),
        subtotal: j['subtotal']! as String,
        taxTotal: j['taxTotal']! as String,
        changeTotal: j['changeTotal']! as String,
        currencyCode: j['currencyCode']! as String,
        catalogSyncedAt: j['catalogSyncedAt']! as String,
      );

  final List<BarisMuatan> lines;
  final List<PembayaranMuatan> payments;
  final String subtotal;
  final String taxTotal;
  final String changeTotal;
  final String currencyCode;

  /// Kapan salinan katalog yang menetapkan harga ini diambil.
  ///
  /// Dicatat supaya ketika peladen menghitung angka yang berbeda, pertanyaan
  /// "harga versi kapan yang dipakai" punya jawaban — bukan dugaan.
  final String catalogSyncedAt;
}

/// Menyusun teks kanonik dari rincian transaksi, untuk dihash.
///
/// Ditulis medan per medan dengan urutan tetap, bukan dari serialisasi JSON:
/// urutan kunci JSON tidak dijamin sama antar bahasa, dan objek yang sama isinya
/// tetapi disusun berbeda akan menghasilkan teks berbeda — sehingga rantai
/// tampak putus padahal datanya utuh.
String bahanMuatan(MuatanTransaksi m) {
  final baris = m.lines
      .map((b) => [
            b.productId,
            b.uomId ?? '',
            b.quantity,
            b.unitPrice,
            b.lineSubtotal,
            b.taxAmount,
            b.lineTotal,
            b.taxRateId ?? '',
          ].join('|'))
      .join(';');
  final bayar = m.payments
      .map((p) => [
            p.paymentMethodId,
            p.amount,
            p.tenderedAmount ?? '',
            p.reference ?? '',
          ].join('|'))
      .join(';');
  return [
    baris,
    bayar,
    m.subtotal,
    m.taxTotal,
    m.changeTotal,
    m.currencyCode,
    m.catalogSyncedAt,
  ].join('#');
}

/// Medan yang ikut dihitung ke dalam hash sebuah baris buku besar.
///
/// `status` dan `serverSaleId` sengaja TIDAK ikut: keduanya memang berubah
/// setelah baris dibuat (PENDING menjadi SYNCED). Yang tidak boleh berubah
/// adalah isi transaksinya.
class MedanTertutup {
  const MedanTertutup({
    required this.sequence,
    required this.offlineId,
    required this.outletId,
    required this.terminalId,
    required this.shiftId,
    required this.businessDate,
    required this.grandTotal,
    required this.itemCount,
    required this.occurredAt,
    required this.receiptNumber,
    required this.previousHash,
    this.payloadHash,
  });

  factory MedanTertutup.dariJson(Map<String, Object?> j) => MedanTertutup(
        sequence: j['sequence']! as int,
        offlineId: j['offlineId']! as String,
        outletId: j['outletId']! as String,
        terminalId: j['terminalId']! as String,
        shiftId: j['shiftId']! as String,
        businessDate: j['businessDate']! as String,
        grandTotal: j['grandTotal']! as String,
        itemCount: j['itemCount']! as int,
        occurredAt: j['occurredAt']! as String,
        receiptNumber: j['receiptNumber'] as String?,
        previousHash: j['previousHash']! as String,
        payloadHash: j['payloadHash'] as String?,
      );

  final int sequence;
  final String offlineId;
  final String outletId;
  final String terminalId;
  final String shiftId;
  final String businessDate;
  final String grandTotal;
  final int itemCount;
  final String occurredAt;
  final String? receiptNumber;
  final String previousHash;

  /// Hash dari rincian transaksi; opsional karena baris yang ditulis versi
  /// sebelumnya tidak memilikinya.
  final String? payloadHash;

  MedanTertutup salinDengan({String? payloadHash}) => MedanTertutup(
        sequence: sequence,
        offlineId: offlineId,
        outletId: outletId,
        terminalId: terminalId,
        shiftId: shiftId,
        businessDate: businessDate,
        grandTotal: grandTotal,
        itemCount: itemCount,
        occurredAt: occurredAt,
        receiptNumber: receiptNumber,
        previousHash: previousHash,
        payloadHash: payloadHash ?? this.payloadHash,
      );
}

/// Menyusun teks yang dihash untuk satu baris buku besar.
///
/// Urutan medannya tetap dan ditulis tegas. `payloadHash` berada di **ujung**
/// dengan cadangan string kosong, supaya baris yang dicatat ketika buku besar
/// belum menyimpan rincian barang menghasilkan teks yang persis sama seperti
/// dahulu — dan hash lamanya tetap sah.
String bahanHash(MedanTertutup c) => [
      c.sequence,
      c.offlineId,
      c.outletId,
      c.terminalId,
      c.shiftId,
      c.businessDate,
      c.grandTotal,
      c.itemCount,
      c.occurredAt,
      c.receiptNumber ?? '',
      c.previousHash,
      c.payloadHash ?? '',
    ].join(pemisahMedan);

/// SHA-256 sebagai heksadesimal.
///
/// Memakai `crypto` dari pub bila kelak ditambahkan; untuk sekarang bahan
/// hashnya yang diikat kontrak, sebab bila teksnya sama maka hashnya pasti sama
/// — dan bila berbeda, teksnyalah yang menunjukkan di mana letak bedanya.
String bahanSebagaiUtf8Hex(String teks) =>
    utf8.encode(teks).map((b) => b.toRadixString(16).padLeft(2, '0')).join();
