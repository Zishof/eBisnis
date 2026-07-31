# K-0 · Peta Domain Koperasi

Batas konteks (*bounded context*) modul koperasi, dan di mana ia bersinggungan
dengan konteks yang sudah ada.

---

## Konteks koperasi dan tetangganya

```
                       ┌──────────────────────────────┐
                       │      KONTEKS KOPERASI        │
                       │  modules/cooperative/**      │
                       │                              │
   ┌───────────┐       │  Koperasi & legalitas        │
   │ IDENTITAS │──────▶│  Organisasi & pengurus       │
   │  (Core)   │ port  │  Calon anggota & anggota     │
   └───────────┘       │  Simpanan                    │
                       │  Pinjaman & pembiayaan       │
   ┌───────────┐       │  Penagihan & risiko          │
   │ AKUNTANSI │◀─────▶│  RAT, kuorum, voting         │
   │  (Core)   │ port  │  SHU & patronage             │
   └───────────┘       │  Unit usaha                  │
                       │  Dompet anggota              │
   ┌───────────┐       └──────────────────────────────┘
   │    POS    │◀──────────────┘  adapter
   │  (Core)   │
   └───────────┘
   ┌───────────┐
   │ PERSEDIAAN│◀────── unit usaha memakai gudang bersama
   │  (Core)   │
   └───────────┘
```

Koperasi **tidak pernah** membaca tabel Core secara langsung. Setiap
persinggungan melewati port yang didefinisikan koperasi dan adapter yang
mengimplementasikannya.

---

## Agregat di dalam konteks koperasi

Delapan agregat. Setiap agregat punya satu akar, dan perubahan di dalamnya
selalu melewati akar itu — bukan menyunting tabel anaknya langsung.

### 1. Koperasi (akar: `cooperative`)

Profil, jenis, legalitas, kebijakan.

```
cooperative
├── cooperative_type                jenis: konsumen/produsen/jasa/simpan-pinjam/syariah
├── cooperative_legal_document      akta pendirian, SK badan hukum, NPWP, izin usaha
├── cooperative_address
├── cooperative_service_area        wilayah kerja
├── cooperative_policy              AD/ART, aturan keanggotaan, kebijakan akuntansi
└── cooperative_domain              <slug>.ekoperasi.id + domain sendiri
```

**Invarian:** satu tenant = satu koperasi. Koperasi sekunder yang beranggotakan
koperasi lain ditangani lewat `cooperative_membership_link`, bukan dengan
beberapa baris `cooperative` pada satu tenant.

### 2. Organisasi (akar: `cooperative_organization_term`)

Kepengurusan berperiode.

```
cooperative_organization_term       periode kepengurusan, mis. 2026–2029
├── cooperative_board_position      ketua, sekretaris, bendahara, pengawas
├── cooperative_appointment         siapa menjabat apa, sejak kapan
├── cooperative_delegation          pelimpahan wewenang sementara
├── cooperative_committee
├── cooperative_branch
└── cooperative_unit_business       unit toko, kantin, simpan pinjam
```

**Invarian:** satu jabatan hanya boleh dipangku satu orang pada satu waktu, dan
periode jabatan tidak boleh tumpang tindih. Ini bukan kerapian — ia menentukan
siapa yang sah menandatangani perjanjian pinjaman.

### 3. Anggota (akar: `cooperative_member`)

```
cooperative_prospective_member      calon anggota
cooperative_membership_application  pengajuan + verifikasi
cooperative_member                  anggota sah
├── cooperative_member_category     biasa, luar biasa, kehormatan
├── cooperative_member_document
├── cooperative_member_consent      persetujuan pemakaian data
├── cooperative_member_kyc
├── cooperative_member_beneficiary  ahli waris
├── cooperative_member_portal_account
└── cooperative_member_termination  pengunduran diri / pemberhentian
```

**Invarian yang paling menentukan:** seseorang menjadi **anggota** hanya setelah
simpanan pokoknya lunas. Sebelum itu ia calon anggota, dan calon anggota tidak
boleh meminjam. Aturan ini ditegakkan di kode dan di basis data — bukan sebagai
kebiasaan.

`cooperative_member.party_id` menunjuk `party` milik Core, sehingga anggota yang
juga pemasok koperasi tidak tercatat dua kali dengan data yang lambat laun
berbeda.

### 4. Simpanan (akar: `cooperative_saving_account`)

```
cooperative_saving_product          pokok, wajib, sukarela, berjangka
cooperative_saving_account          satu rekening per anggota per produk
├── cooperative_saving_transaction  setoran, penarikan, pemindahbukuan, bagi hasil
├── cooperative_saving_statement
└── cooperative_saving_closing
```

**Invarian:** simpanan pokok dan wajib **tidak dapat ditarik** selama
keanggotaan berjalan — keduanya modal koperasi, bukan tabungan. Menariknya
berarti keluar dari keanggotaan, dan itu melewati agregat `member_termination`.

Saldo tidak disimpan sebagai kolom yang disunting; ia proyeksi dari buku besar
transaksinya, dengan tabel saldo sebagai cache yang dapat dibangun ulang.

### 5. Pinjaman (akar: `cooperative_loan`)

```
cooperative_loan_product            konvensional dan syariah
cooperative_loan_application
├── cooperative_loan_eligibility
├── cooperative_credit_analysis
├── cooperative_loan_survey
├── cooperative_collateral
└── cooperative_guarantor
cooperative_loan                    perjanjian yang sudah cair
├── cooperative_loan_disbursement
├── cooperative_installment_schedule
├── cooperative_installment_payment
├── cooperative_loan_penalty
├── cooperative_loan_restructuring
├── cooperative_loan_write_off
└── cooperative_loan_settlement
```

**Invarian:** jadwal angsuran dibekukan saat pencairan. Perubahan sesudahnya
selalu berupa **restrukturisasi** yang membentuk jadwal baru dan menandai yang
lama, bukan penyuntingan jadwal lama. Jadwal yang disunting diam-diam membuat
riwayat tunggakan anggota tidak dapat dipertanggungjawabkan.

### 6. Rapat anggota (akar: `cooperative_meeting`)

```
cooperative_meeting                 RAT dan RALB
├── cooperative_meeting_agenda
├── cooperative_meeting_invitation
├── cooperative_meeting_attendance   hadir langsung / daring / kuasa
├── cooperative_meeting_proxy
├── cooperative_meeting_motion
├── cooperative_meeting_vote
├── cooperative_meeting_decision
├── cooperative_meeting_follow_up
└── cooperative_meeting_minutes
```

**Invarian:** kuorum dihitung dari kehadiran yang tercatat, dan keputusan yang
diambil tanpa kuorum ditandai **tidak sah** — bukan ditolak diam-diam. Keputusan
RAT menentukan pembagian SHU; keputusan yang cacat kuorum harus terlihat, bukan
hilang.

Satu anggota satu suara, tanpa memandang besar simpanannya. Ini prinsip
koperasi, dan menuliskannya sebagai invarian mencegah seseorang kelak
menambahkan pembobotan suara berdasarkan modal.

### 7. SHU (akar: `cooperative_shu_calculation`)

```
cooperative_shu_policy              rumus, berversi, disetujui RAT
├── cooperative_shu_component       cadangan, jasa modal, jasa usaha, dana sosial
cooperative_shu_calculation         satu per periode buku
├── cooperative_member_patronage    jasa usaha per anggota
├── cooperative_capital_participation jasa modal per anggota
├── cooperative_shu_distribution
├── cooperative_shu_payment
└── cooperative_shu_statement
```

**Invarian:** perhitungan SHU harus **dapat diulang**. Menjalankan ulang atas
periode dan kebijakan yang sama wajib menghasilkan angka yang sama. Karena itu
kebijakannya berversi dan angka masukannya dicuplik — bukan dibaca ulang dari
data yang sementara itu sudah berubah.

### 8. Unit usaha (akar: `cooperative_unit_business`)

```
cooperative_unit_business
├── cooperative_unit_budget
├── cooperative_unit_manager
├── cooperative_unit_pos_link        ← adapter ke POS Core
├── cooperative_unit_asset
└── cooperative_unit_period_result
```

**Invarian:** unit usaha **tidak** punya POS sendiri. Ia tertaut ke `outlet` dan
`pos_terminal` milik Core lewat `cooperative_unit_pos_link`. Membuat POS kedua
akan membelah persediaan dan pembukuan menjadi dua kebenaran.

---

## Bahasa yang disepakati

Istilah yang gampang tertukar, ditetapkan sekali di sini:

| Istilah | Artinya di sini | Bukan |
|---|---|---|
| **Anggota** | Sudah melunasi simpanan pokok | Calon anggota |
| **Calon anggota** | Mengajukan, belum lunas simpanan pokok | Anggota tidak aktif |
| **Simpanan pokok** | Sekali bayar saat masuk, tidak dapat ditarik | Setoran awal tabungan |
| **Simpanan wajib** | Berkala, tidak dapat ditarik selama menjadi anggota | Angsuran |
| **Simpanan sukarela** | Dapat ditarik sewaktu-waktu | Modal |
| **Jasa modal** | Bagian SHU menurut besar simpanan | Bunga |
| **Jasa usaha** | Bagian SHU menurut besar transaksi | Komisi |
| **Patronage** | Nilai transaksi anggota dengan koperasi | Poin loyalitas |
| **Margin** (syariah) | Selisih harga jual-beli murabahah | Bunga |
| **Nisbah** (syariah) | Nisbah bagi hasil mudharabah | Persentase bunga |

Pada produk syariah, istilah "bunga" tidak dipakai sama sekali — bukan sekadar
diganti kata. Bila sebuah medan bermakna bunga, produk syariah tidak memakainya.

---

## Peristiwa domain

Namespace `cooperative.*`, diterbitkan lewat `sync_outbox`:

```
cooperative.member.applied
cooperative.member.approved
cooperative.member.activated          ← simpanan pokok lunas
cooperative.member.terminated
cooperative.saving.deposited
cooperative.saving.withdrawn
cooperative.loan.applied
cooperative.loan.approved
cooperative.loan.disbursed
cooperative.installment.paid
cooperative.installment.overdue
cooperative.loan.restructured
cooperative.meeting.opened
cooperative.meeting.quorum_reached
cooperative.meeting.decided
cooperative.shu.calculated
cooperative.shu.distributed
cooperative.unit.sale_recorded        ← dari adapter POS
```

Vertikal lain **tidak** berlangganan peristiwa ini tanpa kesepakatan tertulis.
Peristiwa adalah kontrak publik; menerbitkannya bukan undangan untuk dibaca
siapa saja.
