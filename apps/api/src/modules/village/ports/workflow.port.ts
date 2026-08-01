/**
 * `WorkflowPort` — antarmuka milik village.
 *
 * Perintah §7 mengharuskan village memakai mesin workflow bersama lewat adapter.
 * Mesin itu tidak ada: yang tersedia hanya empat tabel `workflow_*` dari V007
 * tanpa satu baris kode pun yang menjalankannya. Rinciannya pada
 * `docs/integration-requests/village/001-workflow-port.md`.
 *
 * Village karena itu mendefinisikan antarmukanya **sendiri** dan
 * mengimplementasikannya sendiri, mengikuti pola `surat` yang sudah terbukti.
 * Bila Core kelak membangun mesin generiknya, yang berubah hanya satu adapter —
 * tidak ada layanan village yang perlu disentuh.
 *
 * Antarmuka ini sengaja sesempit yang diperlukan D-4. Antarmuka yang lebih luas
 * daripada kebutuhannya lebih sulit diganti, bukan lebih mudah.
 */

export type AksiWorkflow = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DELEGATE';

export type StatusWorkflow = 'BERJALAN' | 'SELESAI' | 'DITOLAK' | 'DIKEMBALIKAN' | 'DIBATALKAN';

export interface LangkahWorkflow {
  /** Urutan langkah, mulai dari 1. */
  sequence: number;
  /** Kode langkah, untuk keterangan. */
  code: string;
  name: string;
  /** Peran yang berwenang menindaklanjuti langkah ini. */
  roleCode: string;
  /** Benar bila langkah ini boleh dilewati saat perannya tidak ada di desa itu. */
  skippable: boolean;
}

/**
 * Cuplikan definisi alur.
 *
 * Disimpan pada permohonan, bukan hanya dirujuk. Bila katalog layanan diubah —
 * persyaratan ditambah, jenjang persetujuan diubah — permohonan yang sudah
 * berjalan tetap memakai aturan yang berlaku saat ia masuk.
 *
 * Warga yang mengajukan surat pada hari Senin tidak boleh tiba-tiba dituntut
 * melengkapi berkas yang baru diwajibkan pada hari Rabu.
 */
export interface CuplikanAlur {
  definitionCode: string;
  version: number;
  capturedAt: string;
  steps: LangkahWorkflow[];
}

export interface TilikanLangkah {
  sequence: number;
  code: string;
  name: string;
  roleCode: string;
  status: 'MENUNGGU' | 'SELESAI' | 'DILEWATI' | 'DITOLAK';
  actorUserId?: string | null;
  activeRoleId?: string | null;
  actedAt?: string | null;
  reason?: string | null;
}

export interface TilikanInstansi {
  instanceId: string;
  status: StatusWorkflow;
  currentStep: TilikanLangkah | null;
  steps: TilikanLangkah[];
}

export interface MulaiWorkflowInput {
  schemaName: string;
  definitionCode: string;
  subjectType: string;
  subjectId: string;
  snapshot: CuplikanAlur;
  initiatedBy: string;
}

export interface TindakanWorkflowInput {
  schemaName: string;
  instanceId: string;
  action: AksiWorkflow;
  actorUserId: string;
  activeRoleId: string | null;
  reason?: string;
  delegateTo?: string;
}

export interface WorkflowPort {
  /** Memulai satu contoh alur atas sebuah dokumen. */
  mulai(input: MulaiWorkflowInput): Promise<TilikanInstansi>;

  /** Menyetujui, menolak, meminta perbaikan, atau melimpahkan. */
  tindak(input: TindakanWorkflowInput): Promise<TilikanInstansi>;

  /** Keadaan satu instansi. */
  keadaan(schemaName: string, instanceId: string): Promise<TilikanInstansi>;

  /** Langkah yang menunggu tindakan seorang pengguna. */
  menungguUntuk(
    schemaName: string,
    roleCodes: string[],
  ): Promise<Array<{ instanceId: string; subjectType: string; subjectId: string; step: TilikanLangkah }>>;
}

export const WORKFLOW_PORT = Symbol('VillageWorkflowPort');
