/**
 * Pengujian pertanahan administratif.
 *
 * Satu aturan dijaga paling ketat: **surat keterangan tanah wajib memuat
 * penyangkalannya di dalam surat itu sendiri.** Yang membaca surat adalah orang
 * yang tidak pernah membuka dokumentasi apa pun, dan surat keterangan desa yang
 * dianggap bukti kepemilikan adalah awal sengketa yang paling sulit
 * diselesaikan.
 */

import {
  FRASA_WAJIB,
  PENYANGKALAN_BAKU,
  bolehCatatPeralihan,
  bolehTerbitkanSkt,
  periksaBidang,
  periksaPenyangkalan,
  sisipkanPenyangkalan,
  type BidangTanah,
  type PermohonanSkt,
  type Peralihan,
} from './village-land';

const skt = (over: Partial<PermohonanSkt> = {}): PermohonanSkt => ({
  statusSertifikat: 'BELUM_BERSERTIFIKAT',
  jumlahTetangga: 4,
  jumlahPersetujuan: 4,
  namaPenguasa: 'Sumiati',
  badanSurat: `Menerangkan bahwa tanah seluas 300 m2 dikuasai oleh Sumiati. ${PENYANGKALAN_BAKU}`,
  adaSktBerlaku: false,
  ...over,
});

describe('penyangkalan di dalam surat', () => {
  it('penyangkalan baku memuat kedua frasa wajib', () => {
    const h = periksaPenyangkalan(PENYANGKALAN_BAKU);
    expect(h.ada).toBe(true);
    expect(h.hilang).toEqual([]);
  });

  it('menyebut frasa mana yang hilang', () => {
    const h = periksaPenyangkalan('Surat ini bukan bukti kepemilikan hak atas tanah.');
    expect(h.ada).toBe(false);
    expect(h.hilang).toEqual(['tidak menggantikan sertifikat']);
  });

  it('menolak badan surat kosong', () => {
    expect(periksaPenyangkalan('').ada).toBe(false);
    expect(periksaPenyangkalan(undefined as unknown as string).hilang).toHaveLength(2);
  });

  it('tidak peduli huruf besar kecil maupun susunan kalimatnya', () => {
    // Desa boleh menyusun bahasanya sendiri; yang dijaga dua hal yang harus
    // terbaca, bukan susunan kalimatnya.
    const versiDesa =
      'Perlu diketahui bahwa surat ini TIDAK MENGGANTIKAN SERTIFIKAT dan Bukan Bukti ' +
      'Kepemilikan atas tanah dimaksud.';
    expect(periksaPenyangkalan(versiDesa).ada).toBe(true);
  });

  it('menyisipkan penyangkalan baku bila belum ada', () => {
    const hasil = sisipkanPenyangkalan('Menerangkan bahwa tanah dikuasai oleh Sumiati.');
    expect(periksaPenyangkalan(hasil).ada).toBe(true);
    expect(hasil).toContain(PENYANGKALAN_BAKU);
  });

  it('tidak menyisipkan dua kali', () => {
    const sekali = sisipkanPenyangkalan('Isi surat.');
    const duakali = sisipkanPenyangkalan(sekali);
    expect(duakali).toBe(sekali);
  });

  it('kedua frasa wajib menyebut hal yang berbeda', () => {
    expect([...FRASA_WAJIB]).toEqual([
      'bukan bukti kepemilikan',
      'tidak menggantikan sertifikat',
    ]);
  });
});

describe('penerbitan surat keterangan tanah', () => {
  it('menerbitkan surat yang lengkap', () => {
    expect(bolehTerbitkanSkt(skt()).boleh).toBe(true);
  });

  it('MENOLAK bidang yang sudah bersertifikat', () => {
    const h = bolehTerbitkanSkt(skt({ statusSertifikat: 'BERSERTIFIKAT' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('dua kertas atas satu bidang');
  });

  it('menolak bila masih ada surat yang berlaku atas bidang yang sama', () => {
    const h = bolehTerbitkanSkt(skt({ adaSktBerlaku: true }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('Cabut surat sebelumnya');
  });

  it('menolak bila persetujuan batas belum lengkap, menyebut berapa yang kurang', () => {
    const h = bolehTerbitkanSkt(skt({ jumlahTetangga: 4, jumlahPersetujuan: 2 }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('2 dari 4');
    expect(h.alasan).toContain('ke pengadilan');
  });

  it('menerima bidang tanpa tetangga yang persetujuannya juga nol', () => {
    expect(bolehTerbitkanSkt(skt({ jumlahTetangga: 0, jumlahPersetujuan: 0 })).boleh).toBe(true);
  });

  it('menolak jumlah tetangga yang tidak dinyatakan', () => {
    expect(bolehTerbitkanSkt(skt({ jumlahTetangga: -1 })).boleh).toBe(false);
    expect(bolehTerbitkanSkt(skt({ jumlahTetangga: 1.5 })).boleh).toBe(false);
  });

  it('MENOLAK surat yang badan suratnya tidak memuat penyangkalan', () => {
    const h = bolehTerbitkanSkt(skt({ badanSurat: 'Menerangkan bahwa tanah dikuasai Sumiati.' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak pernah membuka dokumentasi');
  });

  it('menolak surat yang penyangkalannya setengah', () => {
    const h = bolehTerbitkanSkt(
      skt({ badanSurat: 'Surat ini bukan bukti kepemilikan hak atas tanah.' }),
    );
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak menggantikan sertifikat');
  });

  it('menolak tanpa nama pihak yang menguasai', () => {
    expect(bolehTerbitkanSkt(skt({ namaPenguasa: '  ' })).boleh).toBe(false);
  });

  it('bidang dalam proses sertifikasi masih dapat memperoleh surat keterangan', () => {
    expect(bolehTerbitkanSkt(skt({ statusSertifikat: 'DALAM_PROSES' })).boleh).toBe(true);
  });
});

describe('bidang tanah', () => {
  const bidang = (over: Partial<BidangTanah> = {}): BidangTanah => ({
    statusSertifikat: 'BELUM_BERSERTIFIKAT',
    luasM2: 300,
    jenisPenguasaan: 'MILIK_ADAT',
    ...over,
  });

  it('menerima bidang yang wajar', () => {
    expect(periksaBidang(bidang()).boleh).toBe(true);
  });

  it('menolak luas yang tidak sah', () => {
    expect(periksaBidang(bidang({ luasM2: 0 })).boleh).toBe(false);
    expect(periksaBidang(bidang({ luasM2: -10 })).boleh).toBe(false);
  });

  it('menuntut nomor sertifikat bila bertanda bersertifikat', () => {
    const h = periksaBidang(bidang({ statusSertifikat: 'BERSERTIFIKAT' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('data pertanahan nasional');
  });

  it('menolak nomor sertifikat pada bidang yang belum bersertifikat', () => {
    expect(
      periksaBidang(bidang({ statusSertifikat: 'BELUM_BERSERTIFIKAT', nomorSertifikat: 'HM-123' }))
        .boleh,
    ).toBe(false);
  });

  it('menerima bidang bersertifikat yang menyebut nomornya', () => {
    expect(
      periksaBidang(bidang({ statusSertifikat: 'BERSERTIFIKAT', nomorSertifikat: 'HM-00123' })).boleh,
    ).toBe(true);
  });
});

describe('riwayat peralihan', () => {
  const alih = (over: Partial<Peralihan> = {}): Peralihan => ({
    cara: 'JUAL_BELI',
    dariNama: 'Karto',
    kepadaNama: 'Sumiati',
    tanggal: '2027-03-11',
    dasarPeralihan: 'Akta Jual Beli Nomor 14/2027',
    ...over,
  });

  it('menerima peralihan yang berdasar', () => {
    expect(bolehCatatPeralihan(alih()).boleh).toBe(true);
  });

  it('MENOLAK peralihan tanpa dasar', () => {
    const h = bolehCatatPeralihan(alih({ dasarPeralihan: '  ' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tampak seperti bukti');
  });

  it('menolak pihak yang sama pada kedua sisi', () => {
    expect(bolehCatatPeralihan(alih({ kepadaNama: 'Karto' })).boleh).toBe(false);
  });

  it('menolak pihak yang kosong', () => {
    expect(bolehCatatPeralihan(alih({ dariNama: '' })).boleh).toBe(false);
    expect(bolehCatatPeralihan(alih({ kepadaNama: '' })).boleh).toBe(false);
  });

  it('menolak tanggal yang bukan ISO', () => {
    expect(bolehCatatPeralihan(alih({ tanggal: '11/03/2027' })).boleh).toBe(false);
  });
});
