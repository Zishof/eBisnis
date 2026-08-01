# E13-0 · Garis Dasar Pengujian

Angka pada dokumen ini diambil dengan menjalankan perintahnya, bukan dari catatan lama.
Ia menjadi lantai: setiap fase E13 wajib berakhir pada angka yang sama atau lebih tinggi.

---

## 1. Angka saat audit

| Rangkaian | Hasil | Perintah |
| --- | --- | --- |
| API (Jest) | **2.069 lulus / 77 suite**, 0 gagal | `pnpm --filter @ebisnis/api test` |
| Web (Vitest) | **193 lulus / 13 berkas**, 0 gagal | `pnpm --filter @ebisnis/web test` |
| E2E peramban (Playwright) | **73 lulus, 0 gagal, 0 flaky**, 15 dilewati | Job `E2E` pada CI |
| Klien kasir Flutter | **126 lulus** | Job `Klien kasir Flutter` pada CI |
| Lint | bersih | `pnpm lint` |

Catatan tentang E2E: angka 73/0/0 baru tercapai setelah perbaikan refresh token
serentak. Sebelumnya 68 lulus dengan 1 gagal dan 1–4 flaky. **Nol flaky lebih berarti
daripada nol gagal** — jumlah flaky yang naik adalah tanda paling awal bahwa sesuatu
menjadi tidak deterministik, dan itu perlu diawasi selama E13 menambah permukaan uji.

## 2. Penjaga yang sudah ada dan wajib tetap hijau

| Penjaga | Menjaga apa |
| --- | --- |
| Langkah **Vektor konformansi mutakhir** (`ci.yml`) | Aturan uang TypeScript dan Dart tidak menyimpang diam-diam |
| Uji konformansi Flutter | 79 vektor dibaca kedua bahasa |
| `hanya lib/api.ts yang memanggil /auth/refresh` | Mencegah jalur refresh kedua muncul lagi |
| `vertical-catalog.spec.ts` | Awalan menu vertical tidak bertabrakan |
| `migration-catalog.spec.ts` | Penggabungan manifest inti dan modul |
| `segregation-of-duty.service.spec.ts` | SoD |

E13 menambah vertical ke registry yang sama, sehingga `vertical-catalog.spec.ts`
akan langsung menangkap tabrakan awalan menu pendidikan.

## 3. Uji yang wajib ada pada E13 (prompt §11)

Belum satu pun ada. Daftar ini menjadi target, bukan laporan:

```text
penamaan schema dan isolasi tenant
aktivasi/deaktivasi modul
dedup/merge/unmerge Person
konversi pendaftar menjadi peserta didik
prasyarat dan bentrok jadwal
siklus KRS/rapor/tahfiz
attainment OBE dan CQI
pembayaran dan academic hold
usage metering dan override tarif tenant
policy billing lintas vertical
idempotency PDDikti/Dapodik/EMIS
scope orang tua/wali
tinjauan manusia atas keluaran AI
pembuatan dan penghapusan sample
rekonsiliasi migrasi
```

Ditambah tiga E2E: eCampus, eSchool, ePesantren (§224.2–224.4).

## 4. Uji yang paling menentukan

Bukan yang paling banyak, melainkan yang bila hijau palsu paling mahal:

| Uji | Bila lolos padahal salah |
| --- | --- |
| Isolasi lintas vertical | Data anak satu unit terbaca unit lain |
| Scope wali | Wali membaca anak orang lain |
| Usage metering idempotent | Tenant ditagih dua kali; kepercayaan hilang sekali |
| Perhitungan IPK/rapor | Nilai berbeda dari sistem lama, ketahuan saat kelulusan |
| Nilai versioned | Perubahan nilai tanpa jejak |
| Idempotency pelaporan nasional | Data ganda di sistem pemerintah, sulit ditarik |

Keenamnya perlu diuji dengan kasus negatif — bukan hanya "jalur bahagia" yang berhasil,
melainkan percobaan yang **harus** ditolak.

## 5. Cara mengukur ulang

```bash
pnpm --filter @ebisnis/api test
```

```bash
pnpm --filter @ebisnis/web test
```

```bash
pnpm lint
```

E2E dan Flutter berjalan pada CI setiap PR; keduanya sudah menjadi check wajib.

## 6. Aturan regresi

- Fase yang menurunkan jumlah uji lulus **tidak selesai**, meskipun fiturnya jalan.
- Uji yang dilewati (`skip`) dihitung sebagai utang dan disebut namanya pada PR.
- Flaky bukan "kadang merah" — ia cacat yang belum dipahami. Perlakuannya sama dengan
  gagal.
