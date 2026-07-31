/**
 * Aturan Sisa Hasil Usaha (SHU) — fungsi murni.
 *
 * Satu sifat menentukan seluruh berkas ini:
 *
 *   **Perhitungan SHU harus dapat diulang.**
 *
 * Menjalankannya ulang atas periode dan kebijakan yang sama wajib menghasilkan
 * angka yang persis sama — sampai ke rupiah terakhir. Bukan tuntutan
 * kerapian: SHU dibagikan kepada ratusan anggota berdasarkan angka ini, dan
 * angka yang berubah saat dihitung ulang berarti tidak ada yang tahu mana yang
 * benar. Anggota yang menerima jumlah berbeda dari yang tercantum pada notulen
 * RAT punya alasan yang sah untuk tidak mempercayai seluruh pembukuan
 * koperasinya.
 *
 * Sifat itu dijaga tiga hal:
 *
 * 1. Seluruh fungsi di sini murni — tidak membaca jam, tidak mengacak, tidak
 *    menyentuh basis data.
 * 2. Pembulatan memakai **metode sisa terbesar** yang deterministik, dengan
 *    pengurutan yang pasti saat sisanya seri.
 * 3. Angka masukannya **dicuplik**, bukan dibaca ulang dari data yang
 *    sementara itu sudah berubah.
 */

/**
 * Berapa angka di belakang koma yang disimpan basis data untuk bagian masa
 * keanggotaan — `NUMERIC(9,6)`.
 *
 * Dinyatakan sebagai tetapan karena **perhitungan wajib memakai presisi yang
 * sama dengan penyimpanannya.** Menghitung pada presisi penuh lalu menyimpannya
 * dibulatkan berarti perhitungan ulang dari data tersimpan memakai masukan yang
 * sedikit berbeda — dan pada metode sisa terbesar, selisih sekecil apa pun
 * dapat memindahkan satu rupiah dari seorang anggota ke anggota lain.
 *
 * Cacat itu sungguh terjadi saat K-6 dikerjakan: sidik jari menyatakan
 * masukannya sama sementara bagian delapan dari sebelas anggota berbeda.
 */
export const PRESISI_FRAKSI = 1_000_000;

// ------------------------------------------------------------------ Komponen

export const SHU_COMPONENTS = [
  'RESERVE',
  'CAPITAL_SERVICE',
  'PATRONAGE_SERVICE',
  'EDUCATION_FUND',
  'SOCIAL_FUND',
  'BOARD_INCENTIVE',
  'DEVELOPMENT_FUND',
] as const;
export type ShuComponent = (typeof SHU_COMPONENTS)[number];

/** Komponen yang dibagikan kepada anggota secara perorangan. */
export const KOMPONEN_ANGGOTA: ShuComponent[] = ['CAPITAL_SERVICE', 'PATRONAGE_SERVICE'];

export interface KomponenKebijakan {
  component: ShuComponent;
  /** Bagian dari surplus, 0..1. */
  ratio: number;
}

export interface Verdict {
  allowed: boolean;
  message?: string;
}

/**
 * Memeriksa kebijakan SHU sebelum dipakai menghitung.
 *
 * Jumlah seluruh komponen wajib **tepat** 100%. Kurang berarti ada surplus yang
 * tidak diketahui ke mana perginya; lebih berarti membagikan uang yang tidak
 * ada. Keduanya baru ketahuan saat pembayaran gagal, dan saat itu angka SHU
 * sudah diumumkan kepada seluruh anggota.
 */
export function periksaKebijakan(komponen: KomponenKebijakan[]): Verdict {
  if (komponen.length === 0) {
    return { allowed: false, message: 'Kebijakan SHU belum memiliki satu pun komponen.' };
  }

  const kode = komponen.map((k) => k.component);
  if (new Set(kode).size !== kode.length) {
    return { allowed: false, message: 'Ada komponen SHU yang tercantum lebih dari sekali.' };
  }

  for (const k of komponen) {
    if (!Number.isFinite(k.ratio) || k.ratio < 0 || k.ratio > 1) {
      return {
        allowed: false,
        message: `Bagian komponen ${k.component} harus antara 0 dan 1.`,
      };
    }
  }

  /*
   * Dibandingkan dalam basis per sepuluh ribu, bukan sebagai pecahan desimal.
   * 0.25 + 0.25 + 0.30 + 0.20 tidak selalu menghasilkan tepat 1 pada aritmetika
   * pecahan biner, dan kebijakan yang benar akan ditolak karena selisih
   * 0,0000000000000002.
   */
  const totalBps = komponen.reduce((n, k) => n + Math.round(k.ratio * 10_000), 0);
  if (totalBps !== 10_000) {
    const persen = (totalBps / 100).toFixed(2);
    return {
      allowed: false,
      message: `Jumlah seluruh komponen SHU adalah ${persen}%, seharusnya tepat 100%.`,
    };
  }

  return { allowed: true };
}

// ------------------------------------------------------- Alokasi ke komponen

export interface AlokasiKomponen {
  component: ShuComponent;
  ratio: number;
  amount: number;
}

/**
 * Membagi surplus ke komponen-komponennya.
 *
 * Selisih pembulatan dibebankan pada **cadangan**, bukan disebar. Alasannya
 * praktis: cadangan adalah milik koperasi, bukan milik anggota perorangan, jadi
 * selisih beberapa rupiah di sana tidak mengubah hak siapa pun. Membebankannya
 * pada jasa usaha akan mengubah bagian seorang anggota tanpa sebab yang dapat
 * dijelaskan kepadanya.
 */
export function alokasikanSurplus(
  surplus: number,
  komponen: KomponenKebijakan[],
): AlokasiKomponen[] {
  const bulat = Math.round(surplus);
  const hasil: AlokasiKomponen[] = komponen.map((k) => ({
    component: k.component,
    ratio: k.ratio,
    amount: Math.floor(bulat * k.ratio),
  }));

  const terpakai = hasil.reduce((n, h) => n + h.amount, 0);
  const sisa = bulat - terpakai;

  if (sisa !== 0) {
    const cadangan = hasil.find((h) => h.component === 'RESERVE');
    if (cadangan) cadangan.amount += sisa;
    else hasil[0].amount += sisa;
  }

  return hasil;
}

// ------------------------------------------------------------ Dasar anggota

export interface DasarAnggota {
  memberId: string;
  /** Rata-rata simpanan ekuitas selama periode — dasar jasa modal. */
  averageEquitySaving: number;
  /** Nilai transaksi anggota dengan koperasi — dasar jasa usaha. */
  patronageAmount: number;
  /**
   * Bagian periode yang dijalani sebagai anggota, 0..1.
   *
   * Anggota yang masuk atau keluar di tengah periode memperoleh bagian
   * sebanding masa keanggotaannya. Memberinya bagian penuh berarti mengambil
   * dari anggota yang menjalani setahun penuh.
   */
  membershipFraction: number;
  receivesShu: boolean;
}

export interface BagianAnggota {
  memberId: string;
  capitalService: number;
  patronageService: number;
  total: number;
}

/**
 * Membagi satu komponen kepada anggota menurut dasarnya.
 *
 * Memakai **metode sisa terbesar**: setiap anggota memperoleh bagian yang
 * dibulatkan ke bawah, lalu sisa rupiah dibagikan satu per satu kepada yang
 * pecahannya terbesar. Bila pecahannya seri, urutannya ditentukan `memberId` —
 * bukan urutan baris yang dikembalikan basis data, yang dapat berbeda antar
 * pemanggilan dan membuat hasilnya tidak dapat diulang.
 */
export function bagiKomponen(
  total: number,
  dasar: Array<{ memberId: string; basis: number }>,
): Map<string, number> {
  const hasil = new Map<string, number>();
  const totalBulat = Math.round(total);
  const jumlahDasar = dasar.reduce((n, d) => n + Math.max(0, d.basis), 0);

  if (totalBulat <= 0 || jumlahDasar <= 0) {
    for (const d of dasar) hasil.set(d.memberId, 0);
    return hasil;
  }

  const antara = dasar.map((d) => {
    const tepat = (totalBulat * Math.max(0, d.basis)) / jumlahDasar;
    const bawah = Math.floor(tepat);
    return { memberId: d.memberId, bawah, pecahan: tepat - bawah };
  });

  let terpakai = 0;
  for (const a of antara) {
    hasil.set(a.memberId, a.bawah);
    terpakai += a.bawah;
  }

  let sisa = totalBulat - terpakai;

  // Pengurutan yang pasti: pecahan terbesar dahulu, lalu memberId sebagai
  // pemutus seri. Tanpa pemutus yang pasti, dua pemanggilan atas data yang
  // sama dapat menghasilkan pembagian sisa yang berbeda.
  const urut = [...antara].sort(
    (a, b) => b.pecahan - a.pecahan || a.memberId.localeCompare(b.memberId),
  );

  let i = 0;
  while (sisa > 0 && urut.length > 0) {
    const m = urut[i % urut.length];
    hasil.set(m.memberId, (hasil.get(m.memberId) ?? 0) + 1);
    sisa -= 1;
    i += 1;
  }

  return hasil;
}

export interface HasilPembagian {
  perMember: BagianAnggota[];
  totalCapitalService: number;
  totalPatronageService: number;
  totalDistributed: number;
  eligibleCount: number;
  excludedCount: number;
}

/**
 * Membagi jasa modal dan jasa usaha kepada anggota.
 *
 * Dasar jasa modal adalah **simpanan ekuitas** — pokok dan wajib. Simpanan
 * sukarela tidak ikut, sebab ia kewajiban koperasi kepada anggota, bukan modal
 * anggota pada koperasi; ia memperoleh bagi hasil tersendiri, bukan SHU.
 */
export function bagikanKeAnggota(input: {
  capitalServiceTotal: number;
  patronageServiceTotal: number;
  members: DasarAnggota[];
}): HasilPembagian {
  const berhak = input.members.filter((m) => m.receivesShu);
  const tidakBerhak = input.members.length - berhak.length;

  // Dasar dikalikan bagian masa keanggotaan lebih dahulu, supaya anggota yang
  // baru masuk tidak memperoleh bagian setahun penuh.
  const dasarModal = berhak.map((m) => ({
    memberId: m.memberId,
    basis: m.averageEquitySaving * clamp01(m.membershipFraction),
  }));
  const dasarUsaha = berhak.map((m) => ({
    memberId: m.memberId,
    basis: m.patronageAmount * clamp01(m.membershipFraction),
  }));

  const modal = bagiKomponen(input.capitalServiceTotal, dasarModal);
  const usaha = bagiKomponen(input.patronageServiceTotal, dasarUsaha);

  const perMember: BagianAnggota[] = berhak
    .map((m) => {
      const c = modal.get(m.memberId) ?? 0;
      const p = usaha.get(m.memberId) ?? 0;
      return { memberId: m.memberId, capitalService: c, patronageService: p, total: c + p };
    })
    .sort((a, b) => a.memberId.localeCompare(b.memberId));

  const totalCapitalService = perMember.reduce((n, m) => n + m.capitalService, 0);
  const totalPatronageService = perMember.reduce((n, m) => n + m.patronageService, 0);

  return {
    perMember,
    totalCapitalService,
    totalPatronageService,
    totalDistributed: totalCapitalService + totalPatronageService,
    eligibleCount: berhak.length,
    excludedCount: tidakBerhak,
  };
}

/**
 * Menjepit ke rentang 0..1 **dan** membulatkan ke presisi penyimpanan.
 *
 * Pembulatan di sini, bukan saat menyimpan, yang membuat perhitungan dan
 * perhitungan ulang memakai angka yang benar-benar sama.
 */
function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const dijepit = Math.min(1, Math.max(0, n));
  return Math.round(dijepit * PRESISI_FRAKSI) / PRESISI_FRAKSI;
}

// --------------------------------------------------------------- Keutuhan

export interface PemeriksaanKeutuhan {
  ok: boolean;
  issues: string[];
}

/**
 * Memeriksa keutuhan satu perhitungan SHU.
 *
 * Empat hal yang, bila salah, membuat angka SHU tidak dapat
 * dipertanggungjawabkan pada RAT.
 */
export function periksaKeutuhan(input: {
  surplus: number;
  allocations: AlokasiKomponen[];
  distribution: HasilPembagian;
}): PemeriksaanKeutuhan {
  const issues: string[] = [];

  const jumlahAlokasi = input.allocations.reduce((n, a) => n + a.amount, 0);
  if (jumlahAlokasi !== Math.round(input.surplus)) {
    issues.push(
      `Jumlah alokasi komponen ${jumlahAlokasi} tidak sama dengan surplus ${Math.round(input.surplus)}.`,
    );
  }

  const modal = input.allocations.find((a) => a.component === 'CAPITAL_SERVICE')?.amount ?? 0;
  if (input.distribution.totalCapitalService !== modal) {
    issues.push(
      `Jasa modal yang dibagikan ${input.distribution.totalCapitalService} tidak sama dengan alokasinya ${modal}.`,
    );
  }

  const usaha = input.allocations.find((a) => a.component === 'PATRONAGE_SERVICE')?.amount ?? 0;
  if (input.distribution.totalPatronageService !== usaha) {
    issues.push(
      `Jasa usaha yang dibagikan ${input.distribution.totalPatronageService} tidak sama dengan alokasinya ${usaha}.`,
    );
  }

  for (const m of input.distribution.perMember) {
    if (m.total < 0) {
      issues.push(`Bagian anggota ${m.memberId} bernilai negatif.`);
      break;
    }
  }

  return { ok: issues.length === 0, issues };
}

// -------------------------------------------------------------- Perhitungan

export interface CuplikanPerhitungan {
  fiscalYear: number;
  periodStart: string;
  periodEnd: string;
  surplus: number;
  policyCode: string;
  policyVersion: number;
  components: KomponenKebijakan[];
  members: DasarAnggota[];
}

export interface HasilPerhitungan {
  allocations: AlokasiKomponen[];
  distribution: HasilPembagian;
  integrity: PemeriksaanKeutuhan;
  /**
   * Sidik jari masukannya.
   *
   * Dua perhitungan bersidik jari sama wajib menghasilkan angka yang sama.
   * Disimpan bersama hasilnya supaya perhitungan ulang dapat dibuktikan
   * memakai masukan yang benar-benar sama — bukan sekadar diyakini demikian.
   */
  inputFingerprint: string;
}

/**
 * Menghitung SHU dari cuplikan masukannya.
 *
 * Seluruhnya deterministik. Tidak membaca jam, tidak mengacak, tidak menyentuh
 * basis data. Masukan yang sama selalu menghasilkan keluaran yang sama.
 */
export function hitungShu(cuplikan: CuplikanPerhitungan): HasilPerhitungan {
  const allocations = alokasikanSurplus(cuplikan.surplus, cuplikan.components);

  const modal = allocations.find((a) => a.component === 'CAPITAL_SERVICE')?.amount ?? 0;
  const usaha = allocations.find((a) => a.component === 'PATRONAGE_SERVICE')?.amount ?? 0;

  const distribution = bagikanKeAnggota({
    capitalServiceTotal: modal,
    patronageServiceTotal: usaha,
    members: cuplikan.members,
  });

  return {
    allocations,
    distribution,
    integrity: periksaKeutuhan({ surplus: cuplikan.surplus, allocations, distribution }),
    inputFingerprint: sidikJari(cuplikan),
  };
}

/**
 * Sidik jari masukan perhitungan.
 *
 * Bukan hash kriptografis — ia tidak perlu tahan serangan, hanya perlu berubah
 * bila masukannya berubah dan tetap sama bila tidak. Anggota diurutkan lebih
 * dahulu supaya urutan baris dari basis data tidak memengaruhinya.
 */
export function sidikJari(c: CuplikanPerhitungan): string {
  const bagian = [
    `y=${c.fiscalYear}`,
    `p=${c.periodStart}..${c.periodEnd}`,
    `s=${Math.round(c.surplus)}`,
    `pol=${c.policyCode}v${c.policyVersion}`,
    'k=' +
      [...c.components]
        .sort((a, b) => a.component.localeCompare(b.component))
        .map((k) => `${k.component}:${Math.round(k.ratio * 10_000)}`)
        .join(','),
    'm=' +
      [...c.members]
        .sort((a, b) => a.memberId.localeCompare(b.memberId))
        .map(
          (m) =>
            `${m.memberId}:${Math.round(m.averageEquitySaving)}:${Math.round(m.patronageAmount)}:` +
            `${Math.round(clamp01(m.membershipFraction) * PRESISI_FRAKSI)}:${m.receivesShu ? 1 : 0}`,
        )
        .join(','),
  ].join('|');

  // FNV-1a 32 bit, dinyatakan sebagai heksadesimal. Cukup untuk membedakan
  // masukan yang berbeda pada skala satu koperasi.
  let h = 0x811c9dc5;
  for (let i = 0; i < bagian.length; i += 1) {
    h ^= bagian.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ------------------------------------------------------------- Masa anggota

/**
 * Bagian periode yang dijalani sebagai anggota penuh.
 *
 * Dihitung dari hari, bukan dari bulan. Anggota yang masuk pada 20 Januari
 * memperoleh bagian yang berbeda dari yang masuk pada 1 Januari, dan pembulatan
 * ke bulan akan menyamakan keduanya.
 */
export function bagianMasaKeanggotaan(
  activatedAt: string | null,
  terminatedAt: string | null,
  periodStart: string,
  periodEnd: string,
): number {
  const awal = Date.parse(periodStart);
  const akhir = Date.parse(periodEnd);
  if (!Number.isFinite(awal) || !Number.isFinite(akhir) || akhir < awal) return 0;

  const totalHari = Math.round((akhir - awal) / 86_400_000) + 1;
  if (totalHari <= 0) return 0;

  const mulai = activatedAt ? Math.max(awal, Date.parse(activatedAt)) : awal;
  const selesai = terminatedAt ? Math.min(akhir, Date.parse(terminatedAt)) : akhir;
  if (selesai < mulai) return 0;

  const hari = Math.round((selesai - mulai) / 86_400_000) + 1;
  // Dibulatkan ke presisi penyimpanan sejak awal, supaya angka yang dihitung
  // dan angka yang tersimpan tidak pernah berbeda.
  return clamp01(hari / totalHari);
}

// ------------------------------------------------------------- Gerbang RAT

/**
 * Bolehkah SHU dibagikan?
 *
 * Pembagian SHU tanpa keputusan RAT yang sah adalah pengurus membagikan uang
 * anggota atas keputusannya sendiri. Aturan hukum koperasi, bukan sekadar
 * prosedur.
 */
export function bolehDibagikan(input: {
  calculationStatus: string;
  meetingDecisionId: string | null;
  decisionValidity: string | null;
  integrityOk: boolean;
}): Verdict {
  if (!input.integrityOk) {
    return {
      allowed: false,
      message: 'Perhitungan SHU belum utuh; jumlah alokasi tidak cocok dengan surplusnya.',
    };
  }
  if (!input.meetingDecisionId) {
    return {
      allowed: false,
      message:
        'Pembagian SHU hanya sah setelah diputuskan Rapat Anggota. Sertakan keputusan RAT-nya.',
    };
  }
  if (input.decisionValidity !== 'VALID') {
    return {
      allowed: false,
      message: `Keputusan RAT yang menyertainya berstatus ${input.decisionValidity} dan tidak dapat menjadi dasar pembagian.`,
    };
  }
  if (input.calculationStatus !== 'APPROVED') {
    return {
      allowed: false,
      message: `Perhitungan berstatus ${input.calculationStatus} belum dapat dibagikan.`,
    };
  }
  return { allowed: true };
}
