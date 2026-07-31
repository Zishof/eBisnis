/**
 * Pengujian usaha desa.
 *
 * Yang dijaga paling ketat: **kerugian BUMDes tidak pernah menjadi bagian desa
 * yang negatif.** Begitu kerugian dapat mengalir kembali mengurangi APBDes,
 * pemisahan badan hukumnya sudah runtuh — bukan lewat keputusan, melainkan
 * lewat satu baris pembukuan.
 */

import {
  TRANSISI_BUMDES,
  bagiHasil,
  bolehDirikanBumdes,
  bolehPindahBumdes,
  bolehSertakanModal,
  bolehTautkanListing,
  bolehTayangkanWisata,
  bolehTetapkanHasil,
  periksaBagianDesa,
  skalaUsaha,
  type PendirianBumdes,
  type PenyertaanModal,
  type StatusBumdes,
} from './village-business';

const pendirian = (over: Partial<PendirianBumdes> = {}): PendirianBumdes => ({
  profil: 'DESA',
  nomorPerdes: 'Perdes Nomor 5 Tahun 2027',
  adArtDitetapkan: true,
  bagianDesaPersen: 30,
  ...over,
});

const modal = (over: Partial<PenyertaanModal> = {}): PenyertaanModal => ({
  jumlah: 150_000_000,
  nomorPerdes: 'Perdes Nomor 6 Tahun 2027',
  budgetTransactionId: 'trx-1',
  statusBumdes: 'AKTIF',
  ...over,
});

describe('pendirian BUMDes', () => {
  it('menerima pendirian yang lengkap', () => {
    expect(bolehDirikanBumdes(pendirian()).boleh).toBe(true);
  });

  it('menolak kelurahan mendirikan BUMDes', () => {
    const h = bolehDirikanBumdes(pendirian({ profil: 'KELURAHAN' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('perangkat daerah');
  });

  it('menolak pendirian tanpa peraturan desa', () => {
    const h = bolehDirikanBumdes(pendirian({ nomorPerdes: '  ' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('kebetulan dikelola perangkat desa');
  });

  it('menolak pendirian sebelum AD/ART ditetapkan', () => {
    const h = bolehDirikanBumdes(pendirian({ adArtDitetapkan: false }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('setelah labanya diketahui');
  });

  it('menolak bagian desa di luar 0 sampai 100', () => {
    expect(periksaBagianDesa(-1).boleh).toBe(false);
    expect(periksaBagianDesa(101).boleh).toBe(false);
    expect(periksaBagianDesa(Number.NaN).boleh).toBe(false);
  });

  it('menolak bagian desa seratus persen', () => {
    const h = periksaBagianDesa(100);
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak akan tumbuh');
  });

  it('menerima bagian desa nol, yang berarti seluruhnya dipupuk kembali', () => {
    expect(periksaBagianDesa(0).boleh).toBe(true);
  });
});

describe('transisi BUMDes', () => {
  it('mengizinkan alur pendirian yang biasa', () => {
    expect(bolehPindahBumdes('DIRENCANAKAN', 'BERDIRI').boleh).toBe(true);
    expect(bolehPindahBumdes('BERDIRI', 'AKTIF').boleh).toBe(true);
    expect(bolehPindahBumdes('AKTIF', 'TIDAK_AKTIF').boleh).toBe(true);
    expect(bolehPindahBumdes('TIDAK_AKTIF', 'AKTIF').boleh).toBe(true);
  });

  it('tidak menghidupkan kembali BUMDes yang bubar', () => {
    expect(TRANSISI_BUMDES.BUBAR).toEqual([]);
    const h = bolehPindahBumdes('BUBAR', 'AKTIF');
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('musyawarah desa');
  });

  it('tidak melompati pendirian', () => {
    expect(bolehPindahBumdes('DIRENCANAKAN', 'AKTIF').boleh).toBe(false);
  });

  it('menolak perpindahan ke status yang sama', () => {
    for (const s of Object.keys(TRANSISI_BUMDES) as StatusBumdes[]) {
      expect(bolehPindahBumdes(s, s).boleh).toBe(false);
    }
  });

  it('setiap status hanya menyebut status yang dikenal', () => {
    const dikenal = new Set(Object.keys(TRANSISI_BUMDES));
    for (const tujuan of Object.values(TRANSISI_BUMDES)) {
      for (const t of tujuan) expect(dikenal.has(t)).toBe(true);
    }
  });
});

describe('penyertaan modal', () => {
  it('menerima penyertaan yang lengkap', () => {
    expect(bolehSertakanModal(modal()).boleh).toBe(true);
  });

  it('menolak penyertaan tanpa transaksi APBDes', () => {
    const h = bolehSertakanModal(modal({ budgetTransactionId: null }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('keluar tanpa dicatat');
  });

  it('menolak penyertaan tanpa peraturan desa', () => {
    const h = bolehSertakanModal(modal({ nomorPerdes: '' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('pemindahan uang');
  });

  it('menolak nilai yang tidak sah', () => {
    expect(bolehSertakanModal(modal({ jumlah: 0 })).boleh).toBe(false);
    expect(bolehSertakanModal(modal({ jumlah: -1 })).boleh).toBe(false);
  });

  it('menolak penyertaan kepada BUMDes yang belum berdiri atau sudah bubar', () => {
    expect(bolehSertakanModal(modal({ statusBumdes: 'DIRENCANAKAN' })).boleh).toBe(false);
    expect(bolehSertakanModal(modal({ statusBumdes: 'BUBAR' })).boleh).toBe(false);
  });
});

describe('pembagian hasil usaha', () => {
  it('membagi laba menurut persentase yang berlaku', () => {
    const h = bagiHasil({ pendapatan: 500_000_000, beban: 380_000_000, bagianDesaPersen: 30 });
    expect(h.labaBersih).toBe(120_000_000);
    expect(h.bagianDesa).toBe(36_000_000);
    expect(h.bagianBumdes).toBe(84_000_000);
    expect(h.rugi).toBe(false);
  });

  it('bagian desa dan bagian BUMDes selalu berjumlah laba bersih', () => {
    for (const persen of [0, 7, 12.5, 30, 45, 99]) {
      const h = bagiHasil({ pendapatan: 333_333_333, beban: 111_111_111, bagianDesaPersen: persen });
      expect(h.bagianDesa + h.bagianBumdes).toBe(h.labaBersih);
    }
  });

  it('KERUGIAN TIDAK PERNAH menjadi bagian desa yang negatif', () => {
    const h = bagiHasil({ pendapatan: 100_000_000, beban: 160_000_000, bagianDesaPersen: 30 });
    expect(h.labaBersih).toBe(-60_000_000);
    expect(h.rugi).toBe(true);
    expect(h.bagianDesa).toBe(0);
    expect(h.keterangan).toContain('tidak mengurangi APBDes');
  });

  it('kerugian tetap nol bagi desa pada persentase berapa pun', () => {
    for (const persen of [0, 10, 50, 99]) {
      const h = bagiHasil({ pendapatan: 10, beban: 1_000, bagianDesaPersen: persen });
      expect(h.bagianDesa).toBe(0);
      expect(h.bagianDesa).not.toBeLessThan(0);
    }
  });

  it('impas tidak membagi apa pun', () => {
    const h = bagiHasil({ pendapatan: 50_000_000, beban: 50_000_000, bagianDesaPersen: 30 });
    expect(h.rugi).toBe(false);
    expect(h.bagianDesa).toBe(0);
    expect(h.keterangan).toContain('Tidak ada yang dibagi');
  });

  it('membulatkan ke rupiah penuh', () => {
    const h = bagiHasil({ pendapatan: 1_000_001, beban: 0, bagianDesaPersen: 33 });
    expect(Number.isInteger(h.bagianDesa)).toBe(true);
  });
});

describe('penetapan laporan hasil usaha', () => {
  it('menolak sebelum periodenya berakhir', () => {
    expect(bolehTetapkanHasil({ bagianDesaPersenTercuplik: 30, periodeSelesai: false }).boleh).toBe(
      false,
    );
  });

  it('menuntut persentase yang dicuplik', () => {
    const h = bolehTetapkanHasil({ bagianDesaPersenTercuplik: null, periodeSelesai: true });
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('berubah artinya');
  });

  it('menerima laporan yang mencuplik persentasenya', () => {
    expect(bolehTetapkanHasil({ bagianDesaPersenTercuplik: 0, periodeSelesai: true }).boleh).toBe(
      true,
    );
  });
});

describe('skala usaha UMKM', () => {
  it('menggolongkan dari omzet, bukan dari isian pelaku usaha', () => {
    expect(skalaUsaha(500_000_000)).toBe('MIKRO');
    expect(skalaUsaha(2_000_000_000)).toBe('MIKRO');
    expect(skalaUsaha(2_000_000_001)).toBe('KECIL');
    expect(skalaUsaha(15_000_000_000)).toBe('KECIL');
    expect(skalaUsaha(15_000_000_001)).toBe('MENENGAH');
  });

  it('menerima ambang yang berbeda bila peraturannya berubah', () => {
    expect(skalaUsaha(3_000_000_000, { mikro: 5_000_000_000, kecil: 20_000_000_000 })).toBe('MIKRO');
  });
});

describe('penautan listing marketplace', () => {
  const tautan = (over = {}) => ({
    listingId: 'lst-1',
    ownerUserId: 'user-warga',
    umkmOwnerUserId: 'user-warga',
    tersedia: true,
    ...over,
  });

  it('menerima listing milik pelaku usahanya sendiri', () => {
    expect(bolehTautkanListing(tautan()).boleh).toBe(true);
  });

  it('menolak listing milik orang lain', () => {
    const h = bolehTautkanListing(tautan({ ownerUserId: 'user-lain' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('bukan mendaftarkan produk atas namanya');
  });

  it('menolak menautkan ketika marketplace belum tersambung', () => {
    // Menautkan tanpa memeriksa berarti desa menjamin sesuatu yang tidak
    // diketahuinya — persis keadaan yang paling mudah terjadi saat integrasinya
    // belum jadi.
    const h = bolehTautkanListing(tautan({ tersedia: false }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('menjamin sesuatu yang tidak diketahuinya');
  });

  it('menolak bila listing tidak ditemukan', () => {
    expect(bolehTautkanListing(tautan({ ownerUserId: null })).boleh).toBe(false);
  });

  it('menolak bila profil UMKM belum tertaut ke akun pelaku usahanya', () => {
    expect(bolehTautkanListing(tautan({ umkmOwnerUserId: null })).boleh).toBe(false);
  });
});

describe('penayangan destinasi wisata', () => {
  const wisata = (over = {}) => ({
    namaPengelola: 'Pokdarwis Krajan',
    kontakPengelola: '0812-0000-0000',
    tarifMasuk: 5_000,
    gratis: false,
    adaFoto: true,
    ...over,
  });

  it('menerima destinasi yang lengkap', () => {
    expect(bolehTayangkanWisata(wisata()).boleh).toBe(true);
  });

  it('menolak penayangan tanpa pengelola', () => {
    const h = bolehTayangkanWisata(wisata({ namaPengelola: '  ' }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('tidak ada penanggung jawabnya');
  });

  it('menolak penayangan tanpa kontak pengelola', () => {
    expect(bolehTayangkanWisata(wisata({ kontakPengelola: null })).boleh).toBe(false);
  });

  it('menolak penayangan tanpa tarif yang dinyatakan', () => {
    const h = bolehTayangkanWisata(wisata({ tarifMasuk: null }));
    expect(h.boleh).toBe(false);
    expect(h.alasan).toContain('ditentukan di pintu masuk');
  });

  it('menerima destinasi gratis yang dinyatakan gratis', () => {
    expect(bolehTayangkanWisata(wisata({ gratis: true, tarifMasuk: null })).boleh).toBe(true);
    expect(bolehTayangkanWisata(wisata({ gratis: true, tarifMasuk: 0 })).boleh).toBe(true);
  });

  it('menolak destinasi yang gratis sekaligus bertarif', () => {
    expect(bolehTayangkanWisata(wisata({ gratis: true, tarifMasuk: 5_000 })).boleh).toBe(false);
  });

  it('menolak penayangan tanpa foto', () => {
    expect(bolehTayangkanWisata(wisata({ adaFoto: false })).boleh).toBe(false);
  });
});
