# 22 · Aturan Tetap

Larangan dan batasan yang berlaku sepanjang pekerjaan eMedik. **Bukan
anjuran.** Dikutip apa adanya dari perintah pengguna supaya tidak bergeser
maknanya lewat parafrase.

---

## 1. Perintah dasar

> Jangan menggunakan SVN. Jangan membuat project baru. Jangan reset atau drop
> database. Jangan mengubah migration yang sudah applied. Jangan menimpa .env.
> Jangan menyimpan credential atau data sensitif pada log atau prompt AI. Jangan
> membiarkan AI melakukan tindakan finansial atau administratif secara otomatis.

## 2. AI

> Gunakan default: `OLLAMA_URL=http://38.47.182.162:11434`. Jangan mengarang
> nama model.

> Jangan memanggil Ollama dari browser. Jangan mengirim cross-tenant data ke AI.
> Jangan mengizinkan AI melakukan payment/posting/approval/delete/RBAC otomatis.
> Jangan hard-delete sample data. Jangan menghapus data real saat cleanup
> sample. Jangan memberi tenant admin akses centralized observability.

## 3. Revisi 2

> Jangan mengubah shared Core secara langsung.
> Jangan mengarang API SATUSEHAT/BPJS.
> Jangan menganggap charge item sebagai reimbursement BPJS resmi.
> Jangan hard-code persentase fee produksi.
> Jangan mengaktifkan system fee atau investor fee tanpa kontrak.
> Jangan memberikan investor akses data pasien.
> Jangan menghubungkan alat medis langsung ke database.
> Implementasikan seluruh fase H-1 sampai H-12 serta H-9A sampai H-9N.
> Setiap logical change wajib migration modular, API, UI, permission, audit,
> Help, tests, docs, commit, push, dan clean worktree.

---

## 4. Berkas bersama yang TIDAK boleh disentuh

Perubahan pada berkas berikut wajib lewat integration request pada
`docs/integration-requests/health/<nomor>-<judul>.md`, **bukan disunting
langsung**:

- `package.json` akar dan `pnpm-lock.yaml`
- pemuat Prisma akar dan indeks skemanya
- resolver auth dan tenant global
- semantik akuntansi, persediaan, dan POS bersama
- mesin investor bersama
- AI Gateway bersama
- observability bersama
- Notification Hub bersama
- registri menu dan peran global
- OpenAPI akar dan Orval
- `CHANGELOG.md` akar
- alur kerja GitHub

**Sudah terjadi tiga kali** bahwa cacat ditemukan pada berkas bersama. Ketiganya
diajukan sebagai integration request dan **tidak satu pun disunting langsung** —
lihat 005 dan 006.

## 5. Batasan lain yang berlaku

- **Jangan merge ke `main`.** Seluruh pekerjaan pada `feature/v12-emedik`.
- **Jangan force push.** Jangan menghapus riwayat Git tanpa persetujuan.
- **Argon2 saja** untuk kata sandi.
- **`.env` tidak pernah di-commit.**
- **Skema audit bersifat tambah-saja.**
- **Tidak ada `eval`, `Function`, atau SQL bebas** pada diskon dan penetapan
  harga.
- **Nama skema hanya dari `platform.tenant_schema_registry`.** `public` tidak
  pernah menjadi cadangan `search_path`.
- **Fee sistem dan fee investor bernilai `NONE`** sampai ada kontraknya.
- **Profil fee contoh** wajib `isSampleData=true`, `active=false`,
  `productionApproved=false`.
- **Kendali jarak jauh alat medis mati secara bawaan.**

---

## 6. Migrasi tenant — aturan yang menyelamatkan banyak waktu

1. **Migrasi yang sudah diterapkan tidak boleh disunting.** Checksum-nya dijaga.
   Perbaikan datang sebagai migrasi baru.

2. **Migrasi yang GAGAL pun menghanguskan nomornya.** Ini cacat Core
   ([005](../integration-requests/health/005-riwayat-migrasi-gagal-mengunci-versi.md)),
   bukan perilaku yang diinginkan — tetapi selama belum diperbaiki, satu
   kegagalan berarti nomor itu tidak dapat dipakai lagi. Sudah terjadi pada
   **H055, H056, dan H064**.

3. **Migrasi harus gagal berisik, bukan melewati diam-diam.** Migrasi yang
   melewati baris yang tidak ditemukan akan menghasilkan sesuatu yang lebih
   buruk daripada kegagalan: daftar yang **tampak penuh**. Sudah terjadi pada
   H055 — dua belas dari dua puluh nama kolomnya keliru, delapan terpasang,
   tidak ada galat.

4. **Nama tabel dan kolom dibaca dari skema, bukan dari ingatan.** Beberapa
   tabel tidak memakai awalan `health_`: `fee_policy`, `fee_settlement`,
   `fee_contract`, `bpjs_sep`, `patient`, `clinical_note`, `lab_result`,
   `medical_device`, `device_inbound_message`.

---

## 7. Yang menyentuh data pasien

- Setiap jalan yang mengembalikan data pasien menuntut tajuk
  **`X-Purpose-Of-Use`**.
- Kosakatanya **TERTUTUP** dan disalin dari constraint
  `health_access_purpose_valid` pada H002:
  `TREATMENT`, `PAYMENT`, `OPERATIONS`, `QUALITY`, `RESEARCH`,
  `PATIENT_REQUEST`, `LEGAL`, `EMERGENCY`.
- **`PUBLIC_HEALTH` tidak ada.** Ia pernah dikarang pada H-12 dan hampir lolos.
- Jalan agregat dan daftar kerja **sengaja tidak** menuntut tajuk itu. Menuntut
  tajuk di mana-mana membuatnya diisi otomatis oleh klien, dan yang diisi
  otomatis tidak menyatakan apa pun.
- **Break-glass tidak pernah ditolak atas dasar penilaian tentang keadaan
  daruratnya.** Satu-satunya dasar penolakan: alasan lebih pendek dari sepuluh
  huruf — ditegakkan constraint `health_access_breakglass_needs_reason`.
