/// Endpoint yang dipakai Aplikasi Warga Desa.
///
/// ## Tidak satu pun memuat pencarian warga
///
/// Aturan yang sama dengan portal warga dan anjungan: yang ditampilkan
/// ditentukan **sesinya**, bukan permintaannya. Tidak ada metode yang menerima
/// `residentId`, `nik`, maupun nama untuk dicari — endpoint yang menerimanya
/// akan dicoba dengan nilai lain oleh orang pertama yang menyadarinya.
library;

import 'dart:typed_data';

import 'api_client.dart';
import '../domain/rules.dart';

class ProfilWarga {
  ProfilWarga({required this.nama, this.rt, this.rw, this.alamat, this.statusPenduduk});
  final String nama;
  final String? rt;
  final String? rw;
  final String? alamat;
  final String? statusPenduduk;

  factory ProfilWarga.dariJson(Map<String, dynamic> j) => ProfilWarga(
        nama: (j['full_name'] ?? j['fullName'] ?? '-') as String,
        rt: j['rt_number'] as String?,
        rw: j['rw_number'] as String?,
        alamat: j['address'] as String?,
        statusPenduduk: j['resident_status'] as String?,
      );
}

class AnggotaKeluarga {
  AnggotaKeluarga({required this.nama, this.hubungan});
  final String nama;
  final String? hubungan;

  factory AnggotaKeluarga.dariJson(Map<String, dynamic> j) => AnggotaKeluarga(
        nama: (j['full_name'] ?? '-') as String,
        hubungan: j['family_relation'] as String?,
      );
}

class Permohonan {
  Permohonan({required this.id, this.nomor, this.status, this.diajukanPada});
  final String id;
  final String? nomor;
  final String? status;
  final String? diajukanPada;

  factory Permohonan.dariJson(Map<String, dynamic> j) => Permohonan(
        id: (j['id'] ?? '') as String,
        nomor: j['request_number'] as String?,
        status: j['status'] as String?,
        diajukanPada: j['submitted_at']?.toString(),
      );
}

class Berita {
  Berita({required this.judul, this.ringkas, this.tayangPada});
  final String judul;
  final String? ringkas;
  final String? tayangPada;

  factory Berita.dariJson(Map<String, dynamic> j) => Berita(
        judul: (j['title'] ?? '-') as String,
        ringkas: j['summary'] as String?,
        tayangPada: j['publishedAt']?.toString(),
      );
}

class Agenda {
  Agenda({required this.judul, required this.mulai, this.tempat});
  final String judul;
  final String mulai;
  final String? tempat;

  factory Agenda.dariJson(Map<String, dynamic> j) => Agenda(
        judul: (j['title'] ?? '-') as String,
        mulai: (j['startAt'] ?? '') as String,
        tempat: j['location'] as String?,
      );
}

class ProgramBantuan {
  ProgramBantuan({required this.nama, required this.jenis, this.mulai, this.selesai});
  final String nama;
  final String jenis;
  final String? mulai;
  final String? selesai;

  factory ProgramBantuan.dariJson(Map<String, dynamic> j) => ProgramBantuan(
        nama: (j['programName'] ?? '-') as String,
        jenis: (j['aidCategory'] ?? '-') as String,
        mulai: j['periodStart']?.toString(),
        selesai: j['periodEnd']?.toString(),
      );
}

class JenisLayanan {
  JenisLayanan({required this.id, required this.nama});
  final String id;
  final String nama;

  factory JenisLayanan.dariJson(Map<String, dynamic> j) =>
      JenisLayanan(id: (j['id'] ?? '') as String, nama: (j['name'] ?? '-') as String);
}

/// Jadwal Posyandu.
///
/// Datang dari `HealthAggregatePort` milik vertikal info-desa, yang sampai
/// eMedik tersambung mengembalikan **"belum tersambung"** dengan jujur — bukan
/// jadwal karangan. Aplikasi meneruskan keadaan itu apa adanya; jadwal palsu
/// pada aplikasi warga berarti ibu-ibu datang ke Posyandu yang tidak ada.
class JadwalPosyandu {
  JadwalPosyandu({required this.tersedia, required this.keterangan, required this.jadwal});
  final bool tersedia;
  final String? keterangan;
  final List<Map<String, dynamic>> jadwal;
}

/// Isi layar Pengumuman.
class Pengumuman {
  Pengumuman({
    required this.namaDesa,
    required this.berita,
    required this.agenda,
    required this.programBantuan,
  });
  final String namaDesa;
  final List<Berita> berita;
  final List<Agenda> agenda;
  final List<ProgramBantuan> programBantuan;
}

/// Satu penyaluran yang sudah diterima.
class Penyaluran {
  Penyaluran({required this.termin, required this.tanggal, this.jumlah});
  final int termin;
  final String tanggal;
  final String? jumlah;

  factory Penyaluran.dariJson(Map<String, dynamic> j) => Penyaluran(
        termin: (j['installmentNo'] as num?)?.toInt() ?? 1,
        tanggal: j['distributedAt']?.toString() ?? '',
        jumlah: j['amount']?.toString(),
      );
}

/// Keadaan warga terhadap satu program bantuan.
///
/// Perhatikan apa yang TIDAK ada: alasan penolakan. Ia memang tidak dikirim
/// peladen — D-7 menetapkan warga yang tidak menerima berhak mendapat jawaban
/// dari seseorang, dan layar ponsel bukan seseorang.
class StatusBantuanSaya {
  StatusBantuanSaya({
    required this.namaProgram,
    required this.jenis,
    required this.status,
    required this.penyaluran,
    this.mulai,
    this.selesai,
  });

  final String namaProgram;
  final String jenis;
  final StatusPenerima status;
  final List<Penyaluran> penyaluran;
  final String? mulai;
  final String? selesai;

  factory StatusBantuanSaya.dariJson(Map<String, dynamic> j) {
    final d = j['distributions'];
    return StatusBantuanSaya(
      namaProgram: (j['programName'] ?? '-') as String,
      jenis: (j['aidCategory'] ?? '-') as String,
      status: switch (j['status']) {
        'PENERIMA' => StatusPenerima.penerima,
        'SEDANG_DINILAI' => StatusPenerima.sedangDinilai,
        _ => StatusPenerima.bukanPenerima,
      },
      penyaluran: d is List
          ? d.whereType<Map<String, dynamic>>().map(Penyaluran.dariJson).toList()
          : const [],
      mulai: j['periodStart']?.toString(),
      selesai: j['periodEnd']?.toString(),
    );
  }
}

class VillageApi {
  VillageApi(this.klien);
  final ApiClient klien;

  // --- Diri dan keluarga ----------------------------------------------------

  Future<ProfilWarga> profil() async =>
      ProfilWarga.dariJson(await klien.get('/village/portal/me'));

  Future<List<AnggotaKeluarga>> keluarga() async {
    final r = await klien.get('/village/portal/family');
    final anggota = r['members'];
    if (anggota is! List) return const [];
    return anggota
        .whereType<Map<String, dynamic>>()
        .map(AnggotaKeluarga.dariJson)
        .toList();
  }

  Future<List<Permohonan>> permohonanSaya() async {
    final r = await klien.getList('/village/portal/requests');
    return r.whereType<Map<String, dynamic>>().map(Permohonan.dariJson).toList();
  }

  // --- Pengumuman -----------------------------------------------------------

  /// Berita, agenda, dan program bantuan sekaligus.
  ///
  /// Satu pemanggilan, bukan tiga. Sinyal desa putus-putus, dan tiga
  /// pemanggilan berarti tiga kesempatan untuk gagal pada satu layar.
  ///
  /// Memakai jalur portal yang menentukan desanya dari **sesi**, bukan jalur
  /// publik yang menuntut slug. Aplikasi yang membawa slug akan menampilkan
  /// desa lain begitu slugnya salah sekali — dan warga tidak akan menyadarinya,
  /// sebab pengumuman desa tetangga terlihat sama masuk akalnya.
  Future<Pengumuman> pengumuman() async {
    final r = await klien.get('/village/portal/announcements');
    List<T> ambil<T>(String kunci, T Function(Map<String, dynamic>) urai) {
      final d = r[kunci];
      if (d is! List) return const [];
      return d.whereType<Map<String, dynamic>>().map(urai).toList();
    }

    return Pengumuman(
      namaDesa: (r['unitName'] ?? '') as String,
      berita: ambil('news', Berita.dariJson),
      agenda: ambil('agenda', Agenda.dariJson),
      programBantuan: ambil('aidPrograms', ProgramBantuan.dariJson),
    );
  }

  /// Status bantuan **milik sendiri**.
  ///
  /// Tidak ada daftar penerima lain, dan tidak ada alasan penolakan — keduanya
  /// memang tidak dikirim peladen.
  Future<List<StatusBantuanSaya>> statusBantuanSaya() async {
    final r = await klien.get('/village/portal/aid');
    final p = r['programs'];
    if (p is! List) return const [];
    return p.whereType<Map<String, dynamic>>().map(StatusBantuanSaya.dariJson).toList();
  }

  // --- Posyandu -------------------------------------------------------------

  Future<JadwalPosyandu> posyandu() async {
    final r = await klien.get('/village/health/posyandu-schedule');
    final data = r['data'];
    return JadwalPosyandu(
      tersedia: r['available'] == true,
      keterangan: r['note'] as String?,
      jadwal: data is List ? data.whereType<Map<String, dynamic>>().toList() : const [],
    );
  }

  // --- Pengajuan ------------------------------------------------------------

  Future<List<JenisLayanan>> jenisLayanan() async {
    final r = await klien.getList('/village/portal/services');
    return r.whereType<Map<String, dynamic>>().map(JenisLayanan.dariJson).toList();
  }

  /// Mengajukan surat sebagai diri sendiri.
  ///
  /// Tidak ada parameter pemohon: pemohonnya adalah pemilik akun, ditentukan
  /// peladen dari tautan sesinya.
  Future<Map<String, dynamic>> ajukanSurat({
    required String jenisLayananId,
    String? keperluan,
  }) =>
      klien.post('/village/portal/requests', {
        'serviceCatalogId': jenisLayananId,
        if (keperluan != null) 'purpose': keperluan,
      });

  /// Menyampaikan pengaduan.
  ///
  /// `tampilkanNama` menentukan apakah nama pelapor muncul pada daftar yang
  /// dilihat warga lain. Ia **bukan** anonim: aplikasi ini memakai akun,
  /// sehingga petugas tetap dapat melihat siapa yang melapor. Yang benar-benar
  /// tanpa identitas adalah jalur anjungan di kantor desa.
  Future<Map<String, dynamic>> lapor({
    required String judul,
    required String uraian,
    required bool tampilkanNama,
    String? keteranganTempat,
  }) =>
      klien.post('/village/portal/complaints', {
        'title': judul,
        'description': uraian,
        'showReporterName': tampilkanNama,
        if (keteranganTempat != null) 'locationNote': keteranganTempat,
      });

  /// Melampirkan satu foto pada pengaduan yang sudah tersimpan.
  ///
  /// Metadatanya sudah dibuang di ponsel sebelum sampai ke sini — lihat
  /// `domain/foto.dart`. Peladen membuangnya sekali lagi dan menolak berkas
  /// yang metadatanya bertahan; pembuangan di ponsel bukan penggantinya,
  /// melainkan yang membuat koordinatnya tidak pernah meninggalkan perangkat.
  Future<Map<String, dynamic>> unggahFotoPengaduan({
    required String pengaduanId,
    required Uint8List isi,
    required String mime,
    String? namaBerkas,
    String? keterangan,
  }) {
    final tanya = <String, String>{
      if (namaBerkas != null && namaBerkas.isNotEmpty) 'name': namaBerkas,
      if (keterangan != null && keterangan.trim().isNotEmpty) 'caption': keterangan.trim(),
    };
    final kueri = tanya.isEmpty
        ? ''
        : '?${tanya.entries.map((e) => '${e.key}=${Uri.encodeQueryComponent(e.value)}').join('&')}';
    return klien.unggahBiner(
      '/village/portal/complaints/$pengaduanId/photos$kueri',
      isi,
      mime,
    );
  }

  /// Daftar foto pada sebuah pengaduan — keterangannya saja, bukan isinya.
  Future<List<dynamic>> fotoPengaduan(String pengaduanId) =>
      klien.getList('/village/portal/complaints/$pengaduanId/photos');

  Future<Map<String, dynamic>> hapusFotoPengaduan(String fotoId) =>
      klien.hapus('/village/portal/photos/$fotoId');
}
