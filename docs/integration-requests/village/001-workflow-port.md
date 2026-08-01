# Integration Request 001 — WorkflowPort

**Vertikal:** info-desa
**Cabang:** `feature/v12-info-desa`
**Diajukan:** 31 Juli 2026
**Sifat:** Bukan pemblokir. Village dapat berjalan tanpanya; permintaan ini
untuk menghindari empat mesin persetujuan yang tumbuh terpisah.

---

## Kebutuhan

Perintah eksekusi paralel §7 mencantumkan `WorkflowPort` di antara *shared port*
yang wajib dipakai vertikal, dan spesifikasi info-desa §7 menyatakan
*"Gunakan workflow engine shared melalui adapter."*

**Mesin itu belum ada.**

Yang ada hanyalah empat tabel dari `V007__workflow_reporting.sql`:

```
workflow_definition
workflow_step
workflow_instance
workflow_action_log
```

Pencarian `workflow` pada seluruh `apps/api/src` hanya menemukan tiga berkas,
dan ketiganya menyebut nama tabel itu dalam konteks penyediaan skema — bukan
sebagai mesin yang berjalan:

```
src/cli/generate-docs.cli.ts
src/infrastructure/provisioning/tenant-bootstrap.service.ts
src/infrastructure/provisioning/tenant-menu.seed.ts
```

Tidak ada `WorkflowService`, tidak ada evaluator langkah, tidak ada mesin
transisi, tidak ada penyelesai penerima tugas. Tidak ada yang dapat diadaptasi.

## Mengapa ini penting bagi lebih dari satu vertikal

Empat vertikal memerlukan persetujuan berjenjang atas dokumen:

| Vertikal | Yang disetujui |
|---|---|
| Core | Pengadaan, penerimaan barang, void/refund kasir |
| eMedik | Rujukan, klaim, resep tertentu |
| eKoperasi | Pengajuan pinjaman, penarikan simpanan, RAT |
| info-desa | Permohonan layanan warga, APBDes, penetapan penerima bantuan |

Bila keempatnya membangun mesinnya sendiri, akan ada empat perilaku berbeda
untuk pertanyaan yang sama — *"siapa yang boleh menyetujui, dan apa yang terjadi
bila ia menolak?"* — dan penyewa yang memakai dua vertikal sekaligus akan
menemukan dua jawaban.

Modul `surat` sudah menjadi contoh kelimanya: ia punya alur persetujuannya
sendiri (`surat_approval_flow`, `surat_approval_flow_step`, `surat_approval`)
yang bekerja baik, tetapi hanya untuk surat.

## Kontrak yang diusulkan

Antarmuka minimum yang cukup bagi keempat vertikal:

```ts
export interface WorkflowPort {
  /** Memulai satu contoh alur atas sebuah dokumen. */
  start(input: {
    schemaName: string;
    definitionCode: string;
    subjectType: string;      // 'VILLAGE_SERVICE_REQUEST', 'PURCHASE_ORDER', ...
    subjectId: string;
    context: Record<string, unknown>;   // dipakai menyelesaikan penerima tugas
    initiatedBy: string;
  }): Promise<{ instanceId: string; currentStep: WorkflowStepView }>;

  /** Menyetujui, menolak, atau meminta perbaikan pada langkah berjalan. */
  act(input: {
    schemaName: string;
    instanceId: string;
    action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'DELEGATE';
    actorUserId: string;
    activeRoleId: string | null;
    reason?: string;
    delegateTo?: string;
  }): Promise<{ status: WorkflowStatus; currentStep: WorkflowStepView | null }>;

  /** Langkah yang menunggu tindakan seorang pengguna. */
  pendingFor(input: {
    schemaName: string;
    userId: string;
    activeRoleId: string | null;
  }): Promise<WorkflowStepView[]>;

  current(schemaName: string, instanceId: string): Promise<WorkflowInstanceView>;
}
```

Dua hal yang **harus** ada pada mesinnya, dan keduanya berasal dari cacat nyata
yang sudah pernah ditemui pada proyek ini:

1. **Pemohon tidak dapat menyetujui permintaannya sendiri.** Ditegakkan pada
   mesin, bukan diserahkan kepada setiap pemanggil. Aturan yang diserahkan
   kepada pemanggil akan benar pada sebagian besar jalan dan terlewat pada satu.

2. **Setiap tindakan tercatat beserta peran aktif pelakunya.** Kolom
   `active_role_code` sudah ada pada `audit_event` sejak V017 justru untuk
   pertanyaan ini. Di desa kecil satu orang kerap menjabat lebih dari satu
   peran, dan "dalam kapasitas apa ia menyetujui" adalah pertanyaan yang pasti
   muncul saat diperiksa.

## Yang dikerjakan village sementara ini

Village **tidak menunggu**. D-4 membangun alur persetujuan layanan warga di
dalam `modules/village/`, mengikuti pola `surat`, **di balik antarmuka
`WorkflowPort` yang didefinisikan village sendiri** pada
`modules/village/ports/workflow.port.ts`.

Akibatnya, bila Core kelak membangun mesin generiknya:

- yang berubah hanyalah satu adapter;
- tidak ada layanan village yang perlu disentuh;
- tabel village dapat dimigrasikan atau dibiarkan, dan keputusan itu dapat
  diambil belakangan tanpa tekanan.

## File shared yang perlu diubah

Bila Core menyetujui:

```
apps/api/src/modules/workflow/**          (baru — milik Core)
apps/api/src/common/ports/workflow.port.ts (baru — kontrak bersama)
```

Tidak ada migrasi baru: keempat tabelnya sudah ada sejak V007.

## Backward compatibility

Penuh. Tidak ada yang memakai tabel workflow hari ini, sehingga mesin baru tidak
dapat merusak apa pun yang berjalan.

## Pengujian yang diminta

```
pemohon tidak dapat menyetujui permintaannya sendiri
penolakan mengembalikan dokumen ke pemohon, bukan menggantung
delegasi tercatat beserta alasannya
langkah paralel menunggu seluruhnya sebelum lanjut
definisi yang diubah tidak mengubah instance yang sedang berjalan
tindakan bersamaan pada satu langkah hanya satu yang berlaku
peran aktif tercatat pada setiap tindakan
```

Butir kelima layak disebut: definisi alur yang disunting saat ada permohonan
berjalan tidak boleh mengubah aturan main di tengah jalan. Permohonan warga yang
sudah masuk harus diselesaikan dengan aturan yang berlaku saat ia masuk.

## Sikap

Village tidak meminta Core mendahulukan ini. Yang diminta hanyalah: bila kelak
dibangun, kontraknya kira-kira seperti di atas, dan village siap berpindah ke
sana tanpa membongkar apa pun.
