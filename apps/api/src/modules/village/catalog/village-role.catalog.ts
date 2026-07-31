/**
 * Peran bawaan vertikal info-desa.
 *
 * Dua puluh sembilan peran pada spesifikasi §21, masing-masing dengan
 * kelayakan profilnya. Peran `DESA_ONLY` **tidak disemai** pada penyewa
 * kelurahan — bukan disemai lalu disembunyikan.
 *
 * Perbedaannya penting: peran yang ada tetapi tersembunyi masih dapat
 * ditugaskan lewat API penugasan peran. Peran yang tidak pernah dibuat tidak
 * dapat ditugaskan kepada siapa pun.
 */

import type { Kelayakan } from '../village-profile';
import { VILLAGE_MENUS } from './village-permission.catalog';

export interface VillageRoleTemplate {
  code: string;
  name: string;
  description: string;
  eligibility: Kelayakan;
  /** Hak akses, berbentuk `MENU.ACTION`. `*` berarti seluruh aksi menu itu. */
  permissions: string[];
  /** Cakupan data bawaan. */
  defaultScope: 'UNIT' | 'SUB_AREA' | 'RW' | 'RT' | 'SELF' | 'AGGREGATE_ONLY' | 'NONE';
  sortOrder: number;
}

/** Seluruh aksi pada sebuah menu. */
const semua = (menu: string): string[] => {
  const m = VILLAGE_MENUS.find((x) => x.code === menu);
  return (m?.actions ?? []).map((a) => `${menu}.${a}`);
};

/** Hanya baca. */
const baca = (...menu: string[]): string[] => menu.map((m) => `${m}.READ`);

export const VILLAGE_ROLES: VillageRoleTemplate[] = [
  {
    code: 'VILLAGE_ADMIN',
    name: 'Administrator info-desa',
    description: 'Mengelola seluruh konfigurasi sistem desa/kelurahan.',
    eligibility: 'BOTH',
    permissions: VILLAGE_MENUS.flatMap((m) => semua(m.code)),
    defaultScope: 'UNIT',
    sortOrder: 1,
  },
  {
    code: 'VILLAGE_HEAD',
    name: 'Kepala Desa',
    description: 'Pimpinan desa. Menyetujui layanan, perencanaan, anggaran, dan bantuan.',
    eligibility: 'DESA_ONLY',
    permissions: [
      ...VILLAGE_MENUS.filter((m) => m.actions.includes('APPROVE')).flatMap((m) => [
        `${m.code}.READ`,
        `${m.code}.APPROVE`,
        `${m.code}.REJECT`,
      ]),
      ...baca(...VILLAGE_MENUS.map((m) => m.code)),
    ],
    defaultScope: 'UNIT',
    sortOrder: 2,
  },
  {
    code: 'URBAN_VILLAGE_HEAD',
    name: 'Lurah',
    description: 'Pimpinan kelurahan. Menyetujui layanan dan kegiatan.',
    eligibility: 'KELURAHAN_ONLY',
    permissions: [
      ...VILLAGE_MENUS.filter((m) => m.actions.includes('APPROVE')).flatMap((m) => [
        `${m.code}.READ`,
        `${m.code}.APPROVE`,
        `${m.code}.REJECT`,
      ]),
      ...baca(...VILLAGE_MENUS.map((m) => m.code)),
    ],
    defaultScope: 'UNIT',
    sortOrder: 3,
  },
  {
    code: 'VILLAGE_SECRETARY',
    name: 'Sekretaris Desa/Kelurahan',
    description: 'Mengoordinasikan administrasi, register, dan persuratan.',
    eligibility: 'BOTH',
    permissions: [
      ...semua('VILLAGE_REGISTER'),
      ...semua('VILLAGE_SERVICE_REQUEST'),
      ...semua('VILLAGE_OFFICER'),
      ...baca(...VILLAGE_MENUS.map((m) => m.code)),
    ],
    defaultScope: 'UNIT',
    sortOrder: 4,
  },
  {
    code: 'VILLAGE_TREASURER',
    name: 'Bendahara Desa',
    description: 'Mencatat penerimaan dan pengeluaran, menyusun buku kas.',
    eligibility: 'DESA_ONLY',
    permissions: [...semua('VILLAGE_REALIZATION'), ...semua('VILLAGE_CASHBOOK'), ...baca('VILLAGE_APBDES')],
    defaultScope: 'UNIT',
    sortOrder: 5,
  },
  {
    code: 'VILLAGE_KAUR_FINANCE',
    name: 'Kaur Keuangan',
    description: 'Menyusun APBDes dan laporan pertanggungjawaban.',
    eligibility: 'DESA_ONLY',
    permissions: [
      'VILLAGE_APBDES.READ',
      'VILLAGE_APBDES.CREATE',
      'VILLAGE_APBDES.UPDATE',
      ...baca('VILLAGE_REALIZATION', 'VILLAGE_CASHBOOK'),
    ],
    defaultScope: 'UNIT',
    sortOrder: 6,
  },
  {
    code: 'VILLAGE_KAUR_PLANNING',
    name: 'Kaur Perencanaan',
    description: 'Menyusun RPJM dan RKP, menindaklanjuti usulan Musrenbang.',
    eligibility: 'DESA_ONLY',
    permissions: [
      'VILLAGE_RPJMDES.READ',
      'VILLAGE_RPJMDES.CREATE',
      'VILLAGE_RPJMDES.UPDATE',
      'VILLAGE_RKPDES.READ',
      'VILLAGE_RKPDES.CREATE',
      'VILLAGE_RKPDES.UPDATE',
      ...baca('VILLAGE_MUSRENBANG'),
    ],
    defaultScope: 'UNIT',
    sortOrder: 7,
  },
  {
    code: 'VILLAGE_KAUR_GENERAL',
    name: 'Kaur Umum',
    description: 'Mengelola aset, perlengkapan, dan register umum.',
    eligibility: 'BOTH',
    permissions: [...semua('VILLAGE_ASSET_LIST'), ...semua('VILLAGE_REGISTER')],
    defaultScope: 'UNIT',
    sortOrder: 8,
  },
  {
    code: 'VILLAGE_KASI_GOVERNMENT',
    name: 'Kasi Pemerintahan',
    description: 'Kependudukan, pertanahan administratif, dan ketertiban.',
    eligibility: 'BOTH',
    permissions: [...semua('VILLAGE_RESIDENT'), ...semua('VILLAGE_FAMILY'), ...semua('VILLAGE_LAND')],
    defaultScope: 'UNIT',
    sortOrder: 9,
  },
  {
    code: 'VILLAGE_KASI_SERVICE',
    name: 'Kasi Pelayanan',
    description: 'Menyetujui permohonan layanan warga.',
    eligibility: 'BOTH',
    permissions: [...semua('VILLAGE_SERVICE_REQUEST'), ...semua('VILLAGE_SERVICE_CATALOG')],
    defaultScope: 'UNIT',
    sortOrder: 10,
  },
  {
    code: 'VILLAGE_KASI_WELFARE',
    name: 'Kasi Kesejahteraan',
    description: 'Bantuan sosial, penduduk rentan, dan kegiatan kemasyarakatan.',
    eligibility: 'BOTH',
    permissions: [
      ...semua('VILLAGE_AID_PROGRAM'),
      'VILLAGE_BENEFICIARY.READ',
      'VILLAGE_BENEFICIARY.CREATE',
      'VILLAGE_BENEFICIARY.UPDATE',
      ...semua('VILLAGE_VULNERABLE'),
    ],
    defaultScope: 'UNIT',
    sortOrder: 11,
  },
  {
    code: 'VILLAGE_OP_POPULATION',
    name: 'Operator Kependudukan',
    description: 'Merekam dan memutakhirkan data penduduk dan keluarga.',
    eligibility: 'BOTH',
    permissions: [
      'VILLAGE_RESIDENT.READ',
      'VILLAGE_RESIDENT.CREATE',
      'VILLAGE_RESIDENT.UPDATE',
      'VILLAGE_FAMILY.READ',
      'VILLAGE_FAMILY.CREATE',
      'VILLAGE_FAMILY.UPDATE',
      'VILLAGE_VITAL_EVENT.READ',
      'VILLAGE_VITAL_EVENT.CREATE',
    ],
    defaultScope: 'UNIT',
    sortOrder: 12,
  },
  {
    code: 'VILLAGE_OP_SERVICE',
    name: 'Operator Pelayanan',
    description: 'Menerima dan memverifikasi permohonan warga.',
    eligibility: 'BOTH',
    permissions: [
      'VILLAGE_SERVICE_REQUEST.READ',
      'VILLAGE_SERVICE_REQUEST.CREATE',
      'VILLAGE_SERVICE_REQUEST.UPDATE',
      'VILLAGE_SERVICE_REQUEST.SUBMIT',
      ...semua('VILLAGE_QUEUE'),
      ...baca('VILLAGE_RESIDENT', 'VILLAGE_FAMILY'),
    ],
    defaultScope: 'UNIT',
    sortOrder: 13,
  },
  {
    code: 'VILLAGE_OP_LETTER',
    name: 'Operator Surat',
    description: 'Menerbitkan dan mencetak surat.',
    eligibility: 'BOTH',
    permissions: ['VILLAGE_SERVICE_REQUEST.READ', 'VILLAGE_SERVICE_REQUEST.PRINT', ...semua('VILLAGE_REGISTER')],
    defaultScope: 'UNIT',
    sortOrder: 14,
  },
  {
    code: 'VILLAGE_OP_WEBSITE',
    name: 'Operator Website',
    description: 'Mengelola halaman, berita, dan agenda situs desa.',
    eligibility: 'BOTH',
    permissions: [...semua('VILLAGE_SITE_PAGE'), ...semua('VILLAGE_NEWS')],
    defaultScope: 'UNIT',
    sortOrder: 15,
  },
  {
    code: 'VILLAGE_OP_COMPLAINT',
    name: 'Operator Pengaduan',
    description: 'Menerima, menugaskan, dan menindaklanjuti pengaduan.',
    eligibility: 'BOTH',
    permissions: [...semua('VILLAGE_COMPLAINT'), ...baca('VILLAGE_ASPIRATION')],
    defaultScope: 'UNIT',
    sortOrder: 16,
  },
  {
    code: 'VILLAGE_OP_AID',
    name: 'Operator Bantuan',
    description: 'Mendata calon penerima bantuan. TIDAK dapat menetapkannya.',
    eligibility: 'BOTH',
    permissions: [
      'VILLAGE_BENEFICIARY.READ',
      'VILLAGE_BENEFICIARY.CREATE',
      'VILLAGE_BENEFICIARY.UPDATE',
      ...baca('VILLAGE_AID_PROGRAM'),
    ],
    defaultScope: 'UNIT',
    sortOrder: 17,
  },
  {
    code: 'VILLAGE_OP_ASSET',
    name: 'Operator Aset',
    description: 'Mencatat aset, peminjaman, dan pemeliharaan.',
    eligibility: 'BOTH',
    permissions: semua('VILLAGE_ASSET_LIST'),
    defaultScope: 'UNIT',
    sortOrder: 18,
  },
  {
    code: 'VILLAGE_OP_DEVELOPMENT',
    name: 'Operator Pembangunan',
    description: 'Mencatat kemajuan kegiatan pembangunan.',
    eligibility: 'DESA_ONLY',
    permissions: ['VILLAGE_RKPDES.READ', 'VILLAGE_RKPDES.UPDATE'],
    defaultScope: 'UNIT',
    sortOrder: 19,
  },
  {
    code: 'VILLAGE_BPD',
    name: 'BPD',
    description:
      'Badan Permusyawaratan Desa. Mengawasi anggaran dan kebijakan — bukan memeriksa warga per orang.',
    eligibility: 'DESA_ONLY',
    // Cakupan AGGREGATE_ONLY: BPD mengawasi, tidak menyelidiki. Akses data
    // perorangan tidak diperlukan tugasnya, dan akses yang tidak diperlukan
    // adalah akses yang akan dipakai untuk hal lain.
    permissions: baca(
      'VILLAGE_APBDES',
      'VILLAGE_REALIZATION',
      'VILLAGE_RPJMDES',
      'VILLAGE_RKPDES',
      'VILLAGE_MUSRENBANG',
      'VILLAGE_REPORT',
    ),
    defaultScope: 'AGGREGATE_ONLY',
    sortOrder: 20,
  },
  {
    code: 'VILLAGE_AUDITOR',
    name: 'Auditor / APIP',
    description: 'Memeriksa dan membaca jejak audit. Tidak mengubah data.',
    eligibility: 'BOTH',
    permissions: [
      ...baca(...VILLAGE_MENUS.map((m) => m.code)),
      'VILLAGE_RESIDENT.AUDIT_READ',
      'VILLAGE_REPORT.EXPORT',
    ],
    defaultScope: 'UNIT',
    sortOrder: 21,
  },
  {
    code: 'VILLAGE_HAMLET_HEAD',
    name: 'Kepala Dusun',
    description: 'Membina wilayah dusunnya.',
    eligibility: 'DESA_ONLY',
    permissions: baca('VILLAGE_RESIDENT', 'VILLAGE_FAMILY', 'VILLAGE_COMPLAINT'),
    defaultScope: 'SUB_AREA',
    sortOrder: 22,
  },
  {
    code: 'VILLAGE_RW_HEAD',
    name: 'Ketua RW',
    description: 'Membina wilayah RW-nya.',
    eligibility: 'BOTH',
    permissions: baca('VILLAGE_RESIDENT', 'VILLAGE_FAMILY', 'VILLAGE_COMPLAINT'),
    defaultScope: 'RW',
    sortOrder: 23,
  },
  {
    code: 'VILLAGE_RT_HEAD',
    name: 'Ketua RT',
    description: 'Membina wilayah RT-nya. Melihat warga RT-nya saja.',
    eligibility: 'BOTH',
    permissions: baca('VILLAGE_RESIDENT', 'VILLAGE_FAMILY'),
    defaultScope: 'RT',
    sortOrder: 24,
  },
  {
    code: 'VILLAGE_LINMAS',
    name: 'Linmas',
    description: 'Ketertiban dan penanganan insiden. Tanpa akses data kependudukan.',
    eligibility: 'BOTH',
    // Tugasnya ketertiban, bukan pendataan. Tidak ada VILLAGE_RESIDENT di sini,
    // dan itu disengaja.
    permissions: [...semua('VILLAGE_LINMAS'), ...baca('VILLAGE_DISASTER')],
    defaultScope: 'UNIT',
    sortOrder: 25,
  },
  {
    code: 'VILLAGE_POSYANDU_CADRE',
    name: 'Kader Posyandu',
    description: 'Kegiatan Posyandu. Data kesehatan diakses lewat kontrak eMedik, bukan langsung.',
    eligibility: 'BOTH',
    permissions: baca('VILLAGE_VULNERABLE'),
    defaultScope: 'SUB_AREA',
    sortOrder: 26,
  },
  {
    code: 'VILLAGE_BUMDES_MANAGER',
    name: 'Pengelola BUMDes',
    description: 'Mengelola unit usaha milik desa.',
    eligibility: 'DESA_ONLY',
    permissions: semua('VILLAGE_BUMDES'),
    defaultScope: 'UNIT',
    sortOrder: 27,
  },
  {
    code: 'VILLAGE_PPID',
    name: 'PPID',
    description: 'Pejabat Pengelola Informasi dan Dokumentasi.',
    eligibility: 'BOTH',
    permissions: [...semua('VILLAGE_PPID'), ...baca('VILLAGE_REPORT')],
    defaultScope: 'UNIT',
    sortOrder: 28,
  },
  {
    code: 'VILLAGE_CITIZEN',
    name: 'Warga',
    description: 'Portal warga. Melihat data diri dan keluarganya, mengajukan layanan dan pengaduan.',
    eligibility: 'BOTH',
    // Cakupan SELF: dirinya dan anggota keluarganya, ditentukan dari kartu
    // keluarga. Tidak ada pencarian warga lain.
    permissions: [
      'VILLAGE_SERVICE_REQUEST.READ',
      'VILLAGE_SERVICE_REQUEST.CREATE',
      'VILLAGE_COMPLAINT.CREATE',
      'VILLAGE_ASPIRATION.CREATE',
    ],
    defaultScope: 'SELF',
    sortOrder: 29,
  },
];

/** Peran yang layak bagi sebuah profil. */
export function peranLayak(profil: 'DESA' | 'KELURAHAN'): VillageRoleTemplate[] {
  return VILLAGE_ROLES.filter(
    (r) =>
      r.eligibility === 'BOTH' ||
      (r.eligibility === 'DESA_ONLY' && profil === 'DESA') ||
      (r.eligibility === 'KELURAHAN_ONLY' && profil === 'KELURAHAN'),
  );
}
