# Inventaris Class SOP Legacy (eCampus / AIS)

> Fase V6-0, **read-only characterization**. Tidak ada kode legacy yang disalin.
> Dokumen ini merekam apa yang benar-benar ada pada source, agar redesign V6
> dapat dibuktikan menutup perilaku lama, bukan menebaknya.

## Lokasi source

| Path | Berkas | Total baris |
| --- | --- | --- |
| `C:\opt\AIS\ais\src\main\src\ais\action\master\sop\` | 10 action + 8 helper | ~12.900 |
| `C:\opt\AIS\ais\src\main\src\ais\database\model\sop\` | 12 entity | ~1.900 |

Total yang diaudit: **~19.700 baris** (`wc -l` pada kedua direktori).

## Entity model (`database/model/sop`)

| Class | Baris | Peran | Padanan V6 |
| --- | --- | --- | --- |
| `Sop` | 578 | Master SOP: kode, nama, **versi**, jenis, tanggal terbit, masa berlaku (`mulai`/`sampai`), scope organisasi, `untukUjiCoba` | `WorkflowDefinition` + `WorkflowDefinitionVersion` |
| `JenisSop` | 6.108 B | Kategori SOP + warna UI + aktor default | `WorkflowDefinition.category` (atribut, bukan tabel terpisah) |
| `AktorSop` | 15.500 B | Definisi aktor: jenis pengguna, username, dan **11 boolean peran** (`semuaPegawai`, `kaprodiPengajuMahasiswa`, `semuaAtasanLangsungPegawai`, …) | `WorkflowActorRule` (baris data, bukan kolom boolean) |
| `AlurSop` | 63.032 B | **Step + transisi + form + SLA + aktor dalam satu tabel.** Lihat analisis di bawah. | `WorkflowStep` + `WorkflowTransition` + `WorkflowFormSchema` + `WorkflowActorRule` |
| `DokumenAlurSop` | 4.061 B | Dokumen yang dilampirkan pada step, dengan flag `wajib` | `WorkflowDocumentRequirement` |
| `PembatasanAlurSop` | 4.733 B | Pembatasan step (kolom `pembatasan` bertipe string bebas) | `WorkflowCondition` (whitelist field/operator) |
| `KelompokParameterTambahanAlurSop` | 5.404 B | Grup field form tambahan, `nomorUrut`, `defaultData` | `WorkflowFormSchema` |
| `ParameterTambahanAlurSop` | 3.759 B | Field dalam grup | `WorkflowFormField` |
| `DisposisiSop` | 12.191 B | **Instance runtime**: SOP, pengaju, waktu, aktif, pointer `disposisiStart`/`disposisiSetuju`/`disposisiEnd` | `WorkflowInstance` |
| `DisposisiAlurSop` | 32.430 B | **Task runtime**: step, aktor, waktu, `waktuMaksimal` (SLA), `parameterTambahan`, `sebelumnya`/`setelahnya`, `selesai`, `kembali`, `aktif` | `WorkflowTask` + `WorkflowInstanceVariable` |
| `KomentarDisposisi` | 3.655 B | Komentar pada disposisi | `WorkflowComment` |
| `DataSop` | 340 B | Wadah data kecil | tidak dipetakan |

## Action/UI layer (`action/master/sop`)

| Class | Ukuran | Peran |
| --- | --- | --- |
| `TampilanAlurSopAction` | 171 KB | Perancang alur (designer) berbasis ZK |
| `AlurSopAction` | 158 KB | CRUD step |
| `DisposisiAlurSopAction` | 86 KB | Pemrosesan task |
| `DisposisiSopAction` | 77 KB | Pengajuan dan monitoring instance |
| `SopAction` | 23 KB | CRUD master SOP |
| `AktorSopAction` | 18 KB | CRUD aktor |
| `ParameterTambahanAlurSopAction` | 16 KB | Form builder |
| `JenisSopAction` | 16 KB | CRUD jenis |
| `DokumenAlurSopAction` | 15 KB | CRUD dokumen |
| `KelompokParameterTambahanAlurSopAction` | 12 KB | CRUD grup parameter |

### Helper

| Class | Baris | Peran | Catatan untuk V6 |
| --- | --- | --- | --- |
| `DasboardSop` | 4.332 | Dashboard task/monitoring | Perilaku dashboard dipetakan ke task inbox + timeline |
| `SopUtil` | 717 | **Resolusi aktor** (`resolveAktor`, `hitungAktor`, `tampilAktor`) | Inti logika yang wajib dipertahankan; lihat `legacy-sop-actor-rules.md` |
| `ProsesDisposisiSopService` | 626 | Mesin runtime: `buatPengajuanBaru`, `prosesLangkah`, `cariAtauBuatBerikutnya`, `updateKeterangan` | Inti state machine; lihat `legacy-sop-state-map.md` |
| `PengajuanAndaSopUtil` | 205 | Daftar pengajuan milik pengguna | `GET /workflow/tasks/my` |
| `ParameterTambahanDisposisiAlurSopListener` | 181 | Listener form dinamis | Form runtime V6 |
| `SopKodeUtil` | 109 | Generator kode | `number_sequence` yang sudah ada |
| `RevisiDisposisiSopHelper` / `RevisiDisposisiAlurSopHelper` | 20 + 21 | Penanda revisi | Aksi `REVISE` |

## Anti-pattern yang WAJIB tidak ditiru

`AlurSop` mengkodekan graph sebagai **60 kolom sejajar**, bukan koleksi transisi:

| Pola kolom | Jumlah | Isi |
| --- | --- | --- |
| `setelahnya`, `setelahnya2` … `setelahnya20` | 20 | FK ke step berikutnya |
| `opsiSetelahnya`, `opsiSetelahnya2` … `opsiSetelahnya20` | 20 | Label opsi cabang |
| `persetujuanAdaDiSini`, `persetujuanAdaDiSini1` … `persetujuanAdaDiSini20` | 20 | Titik persetujuan per cabang |

Bukti: `AlurSop.java:131-202`; `grep -c 'name = "setelahnya[0-9]*"'` mengembalikan **20**.

Konsekuensi cacat yang terbukti dari struktur ini:

1. **Batas keras 20 cabang.** BRD V6 bagian 9.8 secara eksplisit mensyaratkan
   "Tidak ada fixed maximum jumlah next step".
2. **Tidak dapat di-query.** Mencari "step apa saja yang menuju step X" memerlukan
   `OR` atas 20 kolom.
3. **Tidak ada kondisi transisi terstruktur.** Cabang hanya punya label string
   (`opsiSetelahnya`), sehingga keputusan percabangan tidak dapat dievaluasi mesin.
4. **Tidak ada versioning transisi.** Mengubah alur mengubah baris yang sama,
   sehingga instance berjalan ikut berubah.

Redesign V6: satu tabel `WorkflowTransition(fromStepId, toStepId, sequence,
conditionGroupId, label, isDefault)` tanpa batas jumlah baris. Lihat
`legacy-sop-reuse-redesign.md`.

## Ketergantungan teknologi legacy yang TIDAK dibawa

| Legacy | Alasan tidak dibawa |
| --- | --- |
| ZKoss (`Component`, `hbox`, listener UI di layer domain) | UI framework; V6 memakai React. `SopUtil.renderAktor` mencampur render UI ke logika aktor — dipisah pada V6. |
| Hibernate 3 (`Session`, `CascadeType.PERSIST/MERGE`, lazy proxy) | V6 memakai Prisma untuk control plane dan `pg` untuk schema tenant |
| Domain akademik (`Mahasiswa`, `Siswa`, `Dosen`, `Fakultas`, `Jurusan`, `Yayasan`, `Sekolah`, `SatuanKerja`) | Di luar domain eBisnis; dipetakan ke `legal_entity`, `outlet`, `department`, `employee` |
| `Thread`/`Runnable` inline (`ProsesDisposisiSopService.java:342,541`) | Efek samping asinkron tanpa transaksi; V6 memakai outbox/queue yang replay-safe |
| Kolom audit `oleh`/`olehId` string pada setiap entity | V6 memakai audit append-only pada schema `<tenant>__audit` |
