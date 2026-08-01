/**
 * Pembangkit data contoh koperasi.
 *
 * Menghasilkan satu koperasi yang **terlihat seperti koperasi sungguhan**:
 * enam puluh anggota, setahun penuh simpanan wajib, dua puluh lima pinjaman
 * pada berbagai keadaan, satu Rapat Anggota Tahunan lengkap dengan kuorum dan
 * pemungutan suara, dan satu perhitungan SHU yang dibagikan kepada seluruh
 * anggota aktif.
 *
 * ## Mengapa sebanyak itu
 *
 * Laporan yang dibuat dari lima anggota tidak menunjukkan apa pun. Kuorum
 * selalu tercapai, SHU selalu bulat, dan pembulatan tidak pernah terlihat.
 * Angka yang mendekati kenyataan justru diperlukan untuk **menemukan cacat**:
 * pembulatan SHU baru salah pada anggota kelima puluh, dan kuorum baru menarik
 * ketika sebagian anggota tidak hadir.
 *
 * ## Mengapa deterministik
 *
 * Tidak ada `Math.random()` di sini. Pemasangan yang sama menghasilkan angka
 * yang sama persis, sehingga:
 *
 *   · laporan contoh dapat dibandingkan antar pemasangan;
 *   · pengujian dapat menyebut angka yang pasti, bukan rentang;
 *   · penyewa yang memasang lalu menghapus lalu memasang lagi melihat hal yang
 *     sama — dan tidak mengira sistemnya berubah sendiri.
 *
 * ## Awalan kode
 *
 * Setiap baris berkode `CONTOH-`. Itulah satu-satunya dasar penghapusannya —
 * bukan tanggal, bukan `is_sample` yang dapat tertulis pada baris sungguhan
 * karena kekeliruan. Lihat `cooperative-sample.ts`.
 */

import { AWALAN_CONTOH } from '../cooperative-sample';

/**
 * Pembangkit acak yang dapat diulang.
 *
 * Mulberry32 — kecil, cepat, dan cukup rata untuk data contoh. Yang penting
 * bukan mutu keacakannya melainkan bahwa benihnya tetap: dua pemasangan
 * menghasilkan barisan yang sama.
 */
function acak(benih: number): () => number {
  let a = benih >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMA_DEPAN = [
  'Ahmad', 'Siti', 'Budi', 'Dewi', 'Eko', 'Fitri', 'Gunawan', 'Hesti',
  'Indra', 'Joko', 'Kartika', 'Lestari', 'Mulyono', 'Nurul', 'Oktavia',
  'Purnama', 'Rahmat', 'Sari', 'Tono', 'Umi', 'Wahyu', 'Yanti', 'Zaenal',
  'Bagus', 'Citra', 'Darmawan', 'Endah', 'Fajar', 'Gita', 'Hadi',
];
const NAMA_BELAKANG = [
  'Santoso', 'Wijaya', 'Kusuma', 'Pratama', 'Hidayat', 'Nugroho', 'Saputra',
  'Rahayu', 'Wibowo', 'Permana', 'Setiawan', 'Anggraini', 'Firmansyah',
  'Maulana', 'Puspita', 'Ramadhan', 'Suryani', 'Utami', 'Yulianto', 'Zulkarnain',
];
const PEKERJAAN = [
  'Pedagang', 'Petani', 'Guru', 'Karyawan Swasta', 'Wiraswasta',
  'Buruh', 'Pengrajin', 'Sopir', 'Penjahit', 'Peternak',
];

export interface AnggotaContoh {
  kode: string;
  nomorAnggota: string;
  nama: string;
  status: 'ACTIVE' | 'PROSPECT' | 'TERMINATED';
  pekerjaan: string;
  nik: string;
  /** Bulan ke berapa sejak awal ia bergabung. Menentukan masa keanggotaan. */
  bergabungBulanKe: number;
}

export interface SimpananContoh {
  anggotaIndex: number;
  jenis: 'PRINCIPAL' | 'MANDATORY' | 'VOLUNTARY';
  nomorRekening: string;
  saldo: number;
  /** Setoran bulanan; hanya untuk simpanan wajib. */
  setoranBulanan?: number;
  jumlahSetoran?: number;
  /**
   * Mutasi simpanan sukarela sepanjang tahun.
   *
   * Rekening koran yang hanya memuat saldo akhir tidak menunjukkan apa pun.
   * Anggota memeriksa mutasinya, dan laporan contoh yang tidak punya mutasi
   * tidak dapat dipakai menilai bentuk laporannya.
   */
  mutasi?: Array<{ bulanKe: number; jenis: 'DEPOSIT' | 'WITHDRAWAL'; nilai: number }>;
}

export interface PinjamanContoh {
  anggotaIndex: number;
  nomor: string;
  pokok: number;
  tenor: number;
  tarifTahunan: number;
  status: 'ACTIVE' | 'PAID_OFF' | 'OVERDUE';
  angsuranTerbayar: number;
}

export interface KehadiranContoh {
  anggotaIndex: number;
  mode: 'IN_PERSON' | 'ONLINE' | 'PROXY';
}

export interface SuaraContoh {
  anggotaIndex: number;
  agendaIndex: number;
  pilihan: 'YES' | 'NO' | 'ABSTAIN';
}

export interface ShuAnggotaContoh {
  anggotaIndex: number;
  /** Rata-rata simpanan ekuitas — dasar jasa modal. */
  rataSimpanan: number;
  /** Belanja di unit usaha + jasa pinjaman — dasar jasa usaha. */
  patronage: number;
}

export interface DataContoh {
  anggota: AnggotaContoh[];
  simpanan: SimpananContoh[];
  pinjaman: PinjamanContoh[];
  kehadiran: KehadiranContoh[];
  suara: SuaraContoh[];
  shu: ShuAnggotaContoh[];
  ringkasan: {
    totalAnggota: number;
    anggotaAktif: number;
    totalSimpanan: number;
    totalPinjaman: number;
    surplus: number;
  };
}

/** Jumlah anggota. Cukup besar agar laporan menunjukkan sesuatu. */
export const JUMLAH_ANGGOTA = 60;
/** Bulan simpanan wajib yang disemai — setahun penuh. */
export const BULAN_SIMPANAN_WAJIB = 12;
export const SIMPANAN_POKOK = 250_000;
export const SIMPANAN_WAJIB_BULANAN = 50_000;

/** Tahun buku data contoh. Tetap, supaya laporannya dapat dibandingkan. */
export const TAHUN_BUKU = 2025;

/**
 * Surplus tahun buku.
 *
 * Sengaja TIDAK bulat. Surplus Rp87.500.000 akan membagi habis tanpa sisa pada
 * banyak pembagi, dan pembulatan SHU — bagian yang paling mudah salah — tidak
 * akan pernah terlihat pada laporan contoh.
 */
export const SURPLUS_TAHUN_BUKU = 87_413_650;

export function bangunDataContoh(benih = 20260801): DataContoh {
  const r = acak(benih);
  const pilih = <T>(daftar: T[]): T => daftar[Math.floor(r() * daftar.length)];
  const antara = (a: number, b: number) => a + Math.floor(r() * (b - a + 1));

  // ------------------------------------------------------------- Anggota
  const anggota: AnggotaContoh[] = [];
  for (let i = 0; i < JUMLAH_ANGGOTA; i += 1) {
    /*
     * Tiga calon anggota dan dua bekas anggota disertakan dengan sengaja.
     * Koperasi contoh yang seluruh anggotanya aktif tidak menunjukkan bagaimana
     * laporan memperlakukan keduanya — dan justru di sanalah kekeliruan paling
     * sering muncul: calon anggota ikut terhitung kuorum, atau bekas anggota
     * ikut memperoleh SHU.
     */
    const status: AnggotaContoh['status'] =
      i >= JUMLAH_ANGGOTA - 3 ? 'PROSPECT' : i >= JUMLAH_ANGGOTA - 5 ? 'TERMINATED' : 'ACTIVE';

    const urut = String(i + 1).padStart(3, '0');
    anggota.push({
      kode: `${AWALAN_CONTOH}ANG-${urut}`,
      nomorAnggota: `${AWALAN_CONTOH}${TAHUN_BUKU}${urut}`,
      nama: `${pilih(NAMA_DEPAN)} ${pilih(NAMA_BELAKANG)}`,
      status,
      pekerjaan: pilih(PEKERJAAN),
      nik: `3271${String(benih).slice(0, 6)}${urut}0`,
      // Anggota lama bergabung lebih awal; masa keanggotaan mempengaruhi
      // bagian SHU-nya, dan variasi itulah yang membuat laporannya berarti.
      bergabungBulanKe: i < 20 ? 0 : i < 40 ? antara(1, 4) : antara(5, 11),
    });
  }

  const aktif = anggota.map((a, i) => ({ a, i })).filter((x) => x.a.status === 'ACTIVE');

  // ------------------------------------------------------------ Simpanan
  const simpanan: SimpananContoh[] = [];
  for (const { i } of aktif) {
    const urut = String(i + 1).padStart(3, '0');

    simpanan.push({
      anggotaIndex: i,
      jenis: 'PRINCIPAL',
      nomorRekening: `${AWALAN_CONTOH}POK-${urut}`,
      saldo: SIMPANAN_POKOK,
    });

    // Simpanan wajib: dibayar sejak ia bergabung, tidak sejak awal tahun.
    const bulan = BULAN_SIMPANAN_WAJIB - anggota[i].bergabungBulanKe;
    simpanan.push({
      anggotaIndex: i,
      jenis: 'MANDATORY',
      nomorRekening: `${AWALAN_CONTOH}WAJ-${urut}`,
      saldo: bulan * SIMPANAN_WAJIB_BULANAN,
      setoranBulanan: SIMPANAN_WAJIB_BULANAN,
      jumlahSetoran: bulan,
    });

    // Tidak semua anggota punya simpanan sukarela — dan itu memang keadaan
    // yang wajar pada koperasi sungguhan.
    if (r() < 0.7) {
      /*
       * Mutasi disusun lebih dahulu, saldonya dihitung DARI mutasi itu.
       * Menetapkan saldo lalu mengarang mutasinya menghasilkan rekening koran
       * yang saldo akhirnya tidak sama dengan saldo awal ditambah mutasinya —
       * dan itu persis yang ditolak constraint K-3.
       */
      const mutasi: Array<{ bulanKe: number; jenis: 'DEPOSIT' | 'WITHDRAWAL'; nilai: number }> = [];
      let saldo = 0;
      const jumlahMutasi = antara(4, 14);
      for (let m = 0; m < jumlahMutasi; m += 1) {
        const bulanKe = Math.min(BULAN_SIMPANAN_WAJIB - 1, anggota[i].bergabungBulanKe + m);
        // Penarikan hanya bila saldonya cukup — simpanan tidak pernah negatif.
        const tarik = r() < 0.28 && saldo >= 100_000;
        const nilai = tarik ? antara(1, 3) * 50_000 : antara(1, 12) * 25_000;
        if (tarik && nilai > saldo) continue;
        saldo += tarik ? -nilai : nilai;
        mutasi.push({ bulanKe, jenis: tarik ? 'WITHDRAWAL' : 'DEPOSIT', nilai });
      }

      simpanan.push({
        anggotaIndex: i,
        jenis: 'VOLUNTARY',
        nomorRekening: `${AWALAN_CONTOH}SUK-${urut}`,
        saldo,
        mutasi,
      });
    }
  }

  // ------------------------------------------------------------ Pinjaman
  const pinjaman: PinjamanContoh[] = [];
  const peminjam = aktif.filter(() => r() < 0.46).slice(0, 25);
  peminjam.forEach(({ i }, n) => {
    const tenor = pilih([6, 10, 12, 18, 24]);
    /*
     * Tiga keadaan pinjaman, dan ketiganya perlu ada. Laporan penagihan yang
     * kosong tidak menunjukkan apa pun, dan koperasi contoh yang seluruh
     * pinjamannya lancar memberi gambaran yang menyesatkan.
     */
    const status: PinjamanContoh['status'] = n < 4 ? 'PAID_OFF' : n < 7 ? 'OVERDUE' : 'ACTIVE';
    const terbayar =
      status === 'PAID_OFF' ? tenor : status === 'OVERDUE' ? antara(1, 3) : antara(2, tenor - 1);

    pinjaman.push({
      anggotaIndex: i,
      nomor: `${AWALAN_CONTOH}PJM-${String(n + 1).padStart(3, '0')}`,
      pokok: antara(4, 40) * 500_000,
      tenor,
      tarifTahunan: pilih([0.12, 0.15, 0.18]),
      status,
      angsuranTerbayar: terbayar,
    });
  });

  // ----------------------------------------------------------------- RAT
  /*
   * Kehadiran 44 dari 55 anggota aktif — kuorum tercapai, tetapi tidak
   * seluruhnya hadir. Kehadiran seratus persen tidak pernah terjadi, dan
   * laporan yang dibuat darinya tidak menguji perhitungan kuorumnya sama
   * sekali.
   */
  const kehadiran: KehadiranContoh[] = [];
  aktif.forEach(({ i }, n) => {
    if (n >= 44) return;
    kehadiran.push({
      anggotaIndex: i,
      mode: n < 34 ? 'IN_PERSON' : n < 40 ? 'ONLINE' : 'PROXY',
    });
  });

  // Tiga mata acara diputuskan lewat pemungutan suara.
  const suara: SuaraContoh[] = [];
  for (let agendaIndex = 0; agendaIndex < 3; agendaIndex += 1) {
    for (const h of kehadiran) {
      const undi = r();
      /*
       * Tidak bulat: laporan RAT yang seluruh suaranya setuju tidak
       * menunjukkan bagaimana ambang keputusan dihitung.
       */
      const pilihan: SuaraContoh['pilihan'] =
        undi < 0.82 ? 'YES' : undi < 0.94 ? 'NO' : 'ABSTAIN';
      suara.push({ anggotaIndex: h.anggotaIndex, agendaIndex, pilihan });
    }
  }

  // ----------------------------------------------------------------- SHU
  const shu: ShuAnggotaContoh[] = aktif.map(({ i }) => {
    const pokok = SIMPANAN_POKOK;
    const wajib = (BULAN_SIMPANAN_WAJIB - anggota[i].bergabungBulanKe) * SIMPANAN_WAJIB_BULANAN;
    return {
      anggotaIndex: i,
      // Rata-rata sederhana: simpanan ekuitas pada akhir tahun. Cukup untuk
      // menunjukkan bahwa jasa modal mengikuti besar simpanan.
      rataSimpanan: pokok + wajib,
      // Belanja di unit usaha ditambah jasa pinjaman yang ia bayarkan.
      patronage: antara(0, 48) * 25_000,
    };
  });

  const totalSimpanan = simpanan.reduce((s, x) => s + x.saldo, 0);
  const totalPinjaman = pinjaman
    .filter((p) => p.status !== 'PAID_OFF')
    .reduce((s, p) => s + p.pokok, 0);

  return {
    anggota,
    simpanan,
    pinjaman,
    kehadiran,
    suara,
    shu,
    ringkasan: {
      totalAnggota: anggota.length,
      anggotaAktif: aktif.length,
      totalSimpanan,
      totalPinjaman,
      surplus: SURPLUS_TAHUN_BUKU,
    },
  };
}

/**
 * Komponen pembagian SHU.
 *
 * Enam komponen yang disebut Undang-Undang Koperasi, dengan porsi yang lazim
 * dipakai koperasi simpan pinjam. Jumlahnya wajib tepat satu — bila tidak,
 * sebagian surplus tidak dibagikan ke mana pun dan tidak ada yang tahu ke mana
 * perginya.
 */
export const KOMPONEN_SHU: Array<{ component: string; ratio: number; label: string }> = [
  { component: 'RESERVE', ratio: 0.25, label: 'Cadangan' },
  { component: 'CAPITAL_SERVICE', ratio: 0.25, label: 'Jasa Modal' },
  { component: 'PATRONAGE_SERVICE', ratio: 0.3, label: 'Jasa Usaha' },
  { component: 'BOARD_INCENTIVE', ratio: 0.1, label: 'Dana Pengurus' },
  { component: 'EDUCATION_FUND', ratio: 0.05, label: 'Dana Pendidikan' },
  { component: 'SOCIAL_FUND', ratio: 0.05, label: 'Dana Sosial' },
];

/**
 * Membagi sebuah nilai kepada beberapa penerima menurut bobotnya, dengan
 * pembulatan sisa-terbesar.
 *
 * Pembagian yang membulatkan tiap bagian sendiri-sendiri hampir selalu
 * meleset dari totalnya — dan selisih beberapa rupiah pada laporan SHU adalah
 * hal yang ditanyakan anggota, sebab jumlah kolomnya tidak sama dengan
 * totalnya. Sisa-terbesar menjamin jumlahnya persis.
 */
export function bagiSisaTerbesar(total: number, bobot: number[]): number[] {
  const jumlahBobot = bobot.reduce((s, b) => s + b, 0);
  if (jumlahBobot <= 0) return bobot.map(() => 0);

  const tepat = bobot.map((b) => (total * b) / jumlahBobot);
  const bawah = tepat.map((x) => Math.floor(x));
  let sisa = total - bawah.reduce((s, x) => s + x, 0);

  const urutan = tepat
    .map((x, i) => ({ i, pecahan: x - Math.floor(x) }))
    /*
     * Tie-break menurut indeks, bukan dibiarkan pada urutan sort yang tidak
     * ditentukan. Dua anggota berpecahan sama harus selalu memperoleh hasil
     * yang sama pada setiap perhitungan ulang.
     */
    .sort((a, b) => b.pecahan - a.pecahan || a.i - b.i);

  const hasil = [...bawah];
  for (const { i } of urutan) {
    if (sisa <= 0) break;
    hasil[i] += 1;
    sisa -= 1;
  }
  return hasil;
}
