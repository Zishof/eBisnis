# D-0 · Matriks Pakai-Ulang / Perluas / Bangun-Baru

Perintah §3 menutup daftar larangannya dengan satu kalimat:
*"Jangan menyalin modul tersebut ke village."* Dokumen ini adalah jawabannya —
apa yang dipakai apa adanya, apa yang diperluas, apa yang dibangun baru, dan
**apa yang terdengar dapat dipakai tetapi sebenarnya tidak**.

| Putusan | Arti |
|---|---|
| `PAKAI` | Dipanggil apa adanya lewat port/adapter; village tidak menyentuh isinya |
| `PERLUAS` | Village menambah katalog/baris data pada kerangka yang sudah ada |
| `TIRU` | Polanya dipakai ulang, kodenya tidak — bentuknya berbeda |
| `BARU` | Dibangun di `modules/village/` |
| `KONTRAK` | Milik vertikal lain; diakses lewat kontrak publik |

---

## PAKAI — apa adanya

| Yang ada | Berkas | Dipakai village untuk |
|---|---|---|
| Penyediaan skema penyewa | `infrastructure/provisioning/` | Satu desa satu skema |
| Identitas dan sesi | `modules/auth/` | Masuk, peran aktif, step-up |
| Cakupan data pengguna | `V011__user_scope_assignment` | Ketua RT hanya melihat warganya |
| Pemisahan wewenang | `V010__role_governance` | Pengusul bantuan bukan penyetujunya |
| Jejak audit | `V008__audit_triggers` | Setiap perubahan data penduduk tercatat |
| Hub notifikasi | `modules/notification/` | Status layanan, pengaduan, jadwal Posyandu |
| Gerbang AI | `modules/ai/` | Draf surat, ringkasan berkas, analisis demografi |
| Peristiwa akuntansi | `V015` + `posting-engine.ts` | APBDes lewat adapter |
| Penomoran anti-kembar | `modules/surat/surat-number.service.ts` | Nomor surat desa |
| Kerangka data contoh | `modules/master-seed/` | 100–500 penduduk contoh, dapat dihapus |
| Observabilitas | V10-2/3/5 | Galat, kinerja, aktivitas |
| Penyimpanan berkas | `file_object`, `entity_attachment` | Unggahan persyaratan layanan |

**`SuratNumberService` layak disebut khusus.** Ia menjamin nomor tidak kembar
bahkan ketika dua petugas menerbitkan surat pada milidetik yang sama —
dibuktikan pada V10-6 di bawah uji bersamaan. Surat desa memerlukan jaminan
yang persis sama, dan membangunnya ulang berarti mengulang seluruh pembuktian
itu untuk hasil yang sama.

---

## PERLUAS — menambah pada kerangka yang ada

| Kerangka | Yang ditambahkan village |
|---|---|
| Katalog menu | `village-menu.catalog.ts` — modular, tidak menyentuh registri global |
| Katalog peran | `village-role.catalog.ts` — 29 peran pada spesifikasi §21 |
| Katalog hak akses | `village-permission.catalog.ts` — awalan `VILLAGE.*` |
| Aturan pemisahan wewenang | Baris baru pada `segregation_of_duty_rule` |
| Keperluan AI | Delapan keperluan pada spesifikasi §24 |
| Templat notifikasi | Templat khusus layanan warga |
| Registri data contoh | Definisi seed village, bergolongan `EXAMPLE` |

Seluruhnya modular sesuai perintah koordinasi §9 — tidak ada ratusan baris yang
ditambahkan ke satu berkas global dari empat cabang sekaligus.

---

## TIRU — polanya, bukan kodenya

| Yang ditiru | Dari | Mengapa tidak dipakai langsung |
|---|---|---|
| Alur persetujuan layanan | `surat_approval_flow` + `surat_approval_flow_step` | Pemohon layanan warga adalah **warga**, bukan pegawai. Alurnya dimulai dari luar organisasi, dan tabel surat tidak mengenal pemohon dari luar |
| Mesin transisi status | `surat-state.ts`, `order-state.ts` | Statusnya berbeda seluruhnya |
| Klasifikasi dan retensi arsip | `surat_classification`, `surat_retention_period` | Register desa punya jenis dan masa retensi sendiri menurut peraturan kearsipan desa |
| Penyaringan cakupan data pada kueri | Penegakan V8-R1b | Cakupan village adalah dusun/RW/RT, bukan outlet/gudang |
| Kelengkapan kode peristiwa akuntansi | `posting-engine.spec.ts` | Uji yang memaksa setiap kode punya aturan posting — pola yang wajib ditiru untuk kode `VILLAGE_*` |

---

## BARU — dibangun di `modules/village/`

Seluruh cakupan inti. Tidak ada padanannya di mana pun:

```
D-1  local_government_unit, village_profile, urban_village_profile,
     administrative_code, hamlet, neighborhood, rt, rw, boundary,
     geospatial_area, village_potential, village_indicator, village_domain

D-2  resident, family, family_card, resident_status, birth, death,
     move_in, move_out, temporary_resident, vulnerable_resident,
     resident_document, resident_history, resident_duplicate

D-3  village_officer, appointment, term, bpd_member, committee,
     organization_structure, delegation

D-4  citizen_service_catalog, citizen_service_request, service_requirement,
     request_document, verification, service_approval, letter_draft,
     letter_issuance, qr_verification, service_sla, queue, counter

D-5  citizen_complaint, complaint_category, complaint_assignment,
     complaint_followup, aspiration, musrenbang, public_consultation, survey

D-6  rpjmdes, rkpdes, program, activity, sub_activity, apbdes,
     budget_version, budget_realization, cash_book, lpj

D-7  village_asset, asset_category, asset_borrowing, asset_maintenance,
     aid_program, eligibility_rule, beneficiary, distribution

D-8  bumdes, bumdes_unit, umkm, business_profile, tourism_destination

D-9  linmas, patrol, incident, disaster_event, environmental_*, land_parcel_admin

D-10 village_site_page, village_news, village_agenda, kiosk_session, broadcast

D-11 ppid_request, public_information, transparency_publication, finding
```

---

## KONTRAK — milik vertikal lain

| Kebutuhan | Sumber | Cara mengaksesnya |
|---|---|---|
| Posyandu, Puskesmas, indikator kesehatan | eMedik | `HealthAggregatePort` — **hanya agregat**, tidak pernah rekam medis perorangan |
| Koperasi desa, simpan pinjam warga | eKoperasi | `CooperativeIntegrationPort` |
| Penjualan BUMDes | Core POS | `PosIntegrationPort` |
| Listing produk UMKM | Core marketplace | Kontrak listing publik |

Rinciannya pada [04](04-health-cooperative-pos-contracts.md).

---

## Terdengar dapat dipakai, tetapi **tidak**

Bagian yang paling menghemat waktu kemudian.

### `workflow_definition` dan kawan-kawan — tabel tanpa mesin

Empat tabel workflow ada sejak V007. Tidak ada kode yang menjalankannya.
Menyimpulkan "mesin workflow sudah ada" dari keberadaan tabelnya akan membuat
D-4 diperkirakan jauh lebih ringan daripada kenyataannya. Lihat
[00](00-current-state.md) temuan 1 dan
[integration request 001](../integration-requests/village/001-workflow-port.md).

### `modules/health/` — pemeriksa kesehatan aplikasi, bukan vertikal kesehatan

`GET /health` untuk liveness/readiness. Tidak ada hubungannya dengan Posyandu.
Lihat [integration request 002](../integration-requests/village/002-health-namespace-collision.md).

### `modules/governance/` — aturan biaya marketplace

Namanya menjanjikan tata kelola. Isinya `fee-rules.ts` — perhitungan biaya
penjual pada marketplace. Tidak ada hubungannya dengan tata kelola pemerintahan
desa.

### `modules/surat/` — korespondensi kantor, bukan layanan warga

Sudah disebut di atas, tetapi patut diulang karena godaannya besar. `surat_incoming`
dan `surat_outgoing` adalah surat-menyurat antar lembaga. Surat keterangan
domisili bukan surat keluar — ia adalah **produk layanan** yang pemohonnya
warga, punya persyaratan, verifikasi berkas, antrean, dan SLA.

Memaksakan keduanya ke satu tabel akan menghasilkan tabel yang setengah
kolomnya selalu kosong, dan laporan surat kantor yang tercemar ribuan surat
keterangan.

### `party` / `customer` — bukan penduduk

`party` dan `customer` adalah mitra dagang. Penduduk desa bukan pelanggan: ia
punya NIK, kartu keluarga, status kependudukan, riwayat pindah, dan hubungan
keluarga. Memakai `customer` untuk penduduk akan membuat pendataan penduduk
tergantung pada bentuk yang dirancang untuk berjualan.

---

## Aturan yang dipegang

1. **Bila sudah ada dan netral terhadap vertikal, pakai lewat port.**
2. **Bila polanya terbukti, tiru polanya — jangan salin kodenya.**
3. **Bila milik vertikal lain, akses lewat kontrak publik.** Tidak pernah baca
   tabelnya langsung.
4. **Bila nama berkasnya cocok tetapi isinya tidak, jangan dipaksa.** Empat
   contoh di atas semuanya berawal dari nama yang menjanjikan.
