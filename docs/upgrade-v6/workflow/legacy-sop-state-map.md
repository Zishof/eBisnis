# Peta State dan Runtime SOP Legacy

> Fase V6-0. Perilaku runtime dikarakterisasi dari
> `action/master/sop/helper/ProsesDisposisiSopService.java` (626 baris) dan entity
> `DisposisiSop` / `DisposisiAlurSop`.

## Model runtime legacy

Legacy tidak memiliki kolom `status` bertipe enum. State direpresentasikan oleh
**kombinasi boolean dan pointer**:

### `DisposisiSop` (instance)

| Field | Tipe | Makna state |
| --- | --- | --- |
| `aktif` | Boolean | instance masih berjalan |
| `disposisiStart` | FK task | task pertama |
| `disposisiSetuju` | FK task | task yang menyetujui (penanda "sudah disetujui") |
| `disposisiEnd` | FK task | task terakhir (penanda selesai) |
| `diajukanOleh` | FK user | pengaju |
| `properti` | String | payload bebas |

State efektif diturunkan:

```text
aktif=true,  disposisiEnd=null                 -> BERJALAN
aktif=true,  disposisiSetuju≠null, End=null     -> DISETUJUI SEBAGIAN
aktif=false, disposisiEnd≠null                  -> SELESAI
aktif=false, disposisiEnd=null                  -> DIBATALKAN/DIHAPUS
```

**Masalah:** state tidak eksplisit, tidak dapat difilter dengan indeks, dan tidak
membedakan SELESAI-disetujui dari SELESAI-ditolak.

### `DisposisiAlurSop` (task)

| Field | Tipe | Makna state |
| --- | --- | --- |
| `aktif` | Boolean | task masih relevan |
| `selesai` | Boolean | task sudah diproses |
| `kembali` | Boolean | task hasil pengembalian (return/revise) |
| `waktu` | Date | waktu tindakan |
| `waktuMaksimal` | Date | **batas SLA** |
| `sebelumnya` / `setelahnya` | FK self | rantai task |
| `parameterTambahan` / `parameterTambahanInds` | String | nilai form (serialisasi string) |
| `usernamePengguna` | String | aktor yang ditetapkan |
| `keterangan` | String | catatan |

State efektif:

```text
aktif=true,  selesai=false               -> MENUNGGU (task terbuka)
aktif=true,  selesai=true                -> SELESAI
kembali=true                             -> DIKEMBALIKAN ke pengaju/aktor sebelumnya
aktif=false                              -> DIBATALKAN/tidak berlaku
waktuMaksimal < now && selesai=false     -> TERLAMBAT (dihitung, tidak disimpan)
```

## Alur `prosesLangkah(...)`

Tanda tangan (`ProsesDisposisiSopService.java:130-132`):

```text
prosesLangkah(tbmuser, disposisiSopId, disposisiAlurSopId, alurSopId,
              usernamePengguna, waktu, waktuMaksimal, keterangan,
              boolean setujui, boolean kembali, List<Long> selanjutnyaAlurSopIds)
```

Langkah yang terbukti dari source:

```text
1.  Validasi sesi, instance, dan definisi step         (baris 134-138)
2.  Muat AlurSop + DisposisiSop                        (baris 148-152)
3.  Hitung opsiRute = alurSop.ambilAlurSetelahnya()    (baris 153)
4.  Tentukan "ujung" (apakah step punya anak) dengan
    MENGHITUNG DisposisiAlurSop yang sebelumnya=task
    ini — bukan dengan membaca kolom setelahnya        (baris 157-167)
5.  Terapkan keputusan: setujui / kembali
6.  Buat task berikutnya via cariAtauBuatBerikutnya()  (baris 608)
7.  Efek samping asinkron pada Thread terpisah         (baris 342, 541)
```

Catatan penting pada baris 158-160 (komentar asli source):

> "ujung" robust: langkah punya anak bila ADA DisposisiAlurSop lain dgn sebelumnya = langkah ini.
> (langkah START tidak pernah di-set setelahnya, jadi cek anak lebih andal daripada getSetelahnya.)

Ini bukti bahwa definisi graph (`setelahnya*`) **tidak dapat dipercaya**, sehingga
runtime harus menyimpulkan struktur dari data instance. Redesign V6 menghilangkan
ambiguitas ini dengan `WorkflowTransition` sebagai satu-satunya sumber kebenaran
graph.

## Aksi yang didukung legacy

| Aksi legacy | Direpresentasikan oleh | Aksi V6 |
| --- | --- | --- |
| Ajukan | `buatPengajuanBaru(...)` (baris 395) | `SUBMIT` |
| Setujui | `prosesLangkah(..., setujui=true, ...)` | `APPROVE` |
| Tolak | `prosesLangkah(..., setujui=false, ...)` + `penolakanAdaDiSini` | `REJECT` |
| Kembalikan | `prosesLangkah(..., kembali=true, ...)` + `kembaliKePengaju` / `kembaliKeAktorSebelumnya` | `RETURN`, `REVISE` |
| Pilih rute | `selanjutnyaAlurSopIds` (list) | transisi dengan `WorkflowCondition` / pilihan eksplisit |
| Ubah catatan | `updateKeterangan(...)` (baris 582) | `WorkflowComment` |
| Hapus pengajuan | `SopUtil.hapusDisposisi(...)` | `CANCEL` / `WITHDRAW` (soft, bukan hard delete) |
| Revisi | `RevisiDisposisiSopHelper`, `RevisiDisposisiAlurSopHelper` | `REVISE` |

Aksi yang **tidak ada** pada legacy dan wajib ditambahkan V6 (BRD V6 bagian 9.3):
`DELEGATE`, `CLAIM`, `RELEASE`, `ESCALATE`, `SKIP`, `RETRY`.

## SLA legacy

| Aspek | Legacy | V6 |
| --- | --- | --- |
| Durasi rencana | `AlurSop.jangkaWaktu` (Integer, satuan tidak eksplisit) | `WorkflowStep.slaDuration` + `slaUnit` eksplisit |
| Batas aktual | `DisposisiAlurSop.waktuMaksimal` (Date) | `WorkflowTask.dueAt` |
| Kalender kerja | **tidak ada** | `WorkflowSlaEvent` dengan business calendar + hari libur (BRD WF-010) |
| Reminder | **tidak ada** | `WorkflowTimer` + `WorkflowEscalation` |
| Eskalasi otomatis | **tidak ada** | `WorkflowEscalation` |

## Versioning

| Aspek | Legacy | V6 |
| --- | --- | --- |
| Versi SOP | `Sop.versi` (String bebas), `Sop.mulai`/`sampai`, `Sop.untukUjiCoba` | `WorkflowDefinitionVersion` immutable setelah published |
| Instance saat definisi berubah | **ikut berubah** — instance menunjuk `AlurSop` yang diedit | instance menunjuk `workflowDefinitionVersionId`; versi lama tetap dipakai (BRD 9.8) |

Ini perbedaan perilaku yang paling berisiko dan wajib diuji eksplisit:
"Workflow active tetap memakai version lama setelah version baru published".

## Form dinamis

| Legacy | V6 |
| --- | --- |
| `AlurSop.formInputan`, `labelFormInputan` (string) | `WorkflowFormSchema` + `WorkflowFormField` bertipe |
| `KelompokParameterTambahanAlurSop` + `ParameterTambahanAlurSop` | grup + field pada schema |
| `DisposisiAlurSop.parameterTambahan` (nilai diserialisasi jadi satu string) | `WorkflowInstanceVariable` bertipe, dapat di-query |
| `bekukanFormTampilan`, `bekukanDokumen` | `WorkflowFormSchema.frozenAfterStep` |

Perilaku pembekuan form/dokumen setelah step tertentu **wajib dipertahankan**:
data yang sudah disetujui tidak boleh berubah di belakang approver.
