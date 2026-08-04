# H-0 · Peta Domain dan Bounded Context

Perintah eMedik menyebut lebih dari dua ratus model. Dokumen ini menyusunnya
menjadi bounded context, dan — yang lebih penting — menetapkan **di mana batas
antara kesehatan dan inti perdagangan berada**.

---

## Aturan pertama: pasien bukan pelanggan

Godaan terbesar dalam membangun vertical kesehatan di atas mesin ERP adalah
memakai kembali `customer` untuk pasien. Keduanya sama-sama orang, sama-sama
punya nama dan nomor telepon, dan sama-sama menerima tagihan.

**Itu keliru, dan kekeliruannya tidak dapat diperbaiki belakangan.**

| | `customer` | `patient` |
|---|---|---|
| Identitas ganda | Merepotkan | **Membahayakan nyawa.** Dua rekam medis untuk satu orang berarti alergi yang tercatat di satu berkas tidak terlihat saat obat diresepkan dari berkas lain |
| Penggabungan | Boleh disatukan begitu saja | Penggabungan rekam medis adalah tindakan terkendali, tercatat, dan dapat dibatalkan |
| Penghapusan | Boleh dihapus lunak | Terikat masa retensi hukum; tidak boleh hilang meski diminta |
| Siapa yang boleh melihat | Siapa pun yang punya hak baca pelanggan | Hanya yang punya **hubungan perawatan** dengan pasien itu, dan itu harus dapat dibuktikan |
| Yang dicatat saat dibaca | Tidak ada | Setiap pembacaan dicatat, termasuk tujuannya |
| Sebutan | Boleh berubah kapan saja | Riwayat nama disimpan; nama saat kunjungan lampau tidak boleh berubah surut |

Karena itu `patient` adalah tabel tersendiri dengan siklus hidupnya sendiri.
Kaitan ke `customer` boleh ada — pasien yang membayar sendiri memang menjadi
pihak tertagih — tetapi kaitannya **eksplisit dan searah**, bukan penyamaan.

## Aturan kedua: kunjungan bukan pesanan

Serupa. `sales_order` dan `pos_sale` mencatat pertukaran barang dengan uang.
`encounter` mencatat **pertemuan perawatan**, yang mungkin tidak menghasilkan
tagihan sama sekali (Posyandu), mungkin menghasilkan tagihan berbulan-bulan
kemudian (klaim), dan yang isinya tetap harus tersimpan meski tidak ada uang
yang berpindah.

---

## Bounded context

Sepuluh konteks. Batasnya ditarik pada tempat yang bila dilanggar akan
menimbulkan kerugian nyata — bukan sekadar pengelompokan berkas.

### 1. Identitas Pasien (Patient Identity)

```
Patient · PatientIdentifier · MedicalRecordNumber · NationalIdentifier
PatientNameHistory · PatientAddress · PatientContact · EmergencyContact
PatientFamilyLink · PatientProxy · PatientConsent
PatientMerge · PatientPotentialDuplicate · PatientIdentityAudit
```

Konteks paling berbahaya, dan karena itu dikerjakan lebih dahulu (H-2).
Kesalahan identitas menjalar ke setiap konteks lain: obat diberikan kepada orang
yang salah, hasil laboratorium masuk ke berkas yang salah, alergi tidak
terlihat.

**Invarian:** satu orang, satu identitas perusahaan (`enterprise patient id`),
berapa pun nomor rekam medis yang dimilikinya pada fasilitas berbeda.

### 2. Fasilitas dan Organisasi (Facility)

```
HealthTenantProfile · HealthFacility · HealthFacilityType
Department · ServiceUnit · Polyclinic · Ward · Room · Bed
OperatingTheatre · LaboratoryUnit · RadiologyUnit · PharmacyUnit
BloodBankUnit · CSSDUnit · AmbulanceUnit · MorgueUnit · HomecareUnit
ServicePoint · HealthFacilityDomain
```

Dikerjakan pertama (H-1) karena setiap konteks lain menunjuk kepadanya.

### 3. Front Office

```
Appointment · Schedule · ProviderAvailability
OnlineRegistration · WalkInRegistration · Referral
Queue · CheckIn · Eligibility · Counter · Cancellation · NoShow
```

Satu-satunya konteks yang menghasilkan `BillablePatientRegistration` — dasar
penagihan SaaS eMedik. Definisinya harus tegas sebelum ditagihkan.

### 4. Klinis (Clinical)

```
Encounter (outpatient/inpatient/emergency)
ClinicalNote · SOAP · VitalSign · Problem · Diagnosis · Procedure
Allergy · ClinicalAlert · ClinicalOrder · OrderSet
MedicalCertificate · PatientEducation · FollowUpPlan
```

**Invarian:** catatan klinis yang sudah ditandatangani tidak dapat diubah.
Perubahan menjadi amandemen bertanda tangan tersendiri, dan yang asli tetap
terbaca. Riwayat perawatan yang dapat disunting diam-diam tidak bernilai sebagai
bukti maupun sebagai dasar keputusan medis berikutnya.

### 5. Farmasi dan Obat (Pharmacy)

```
DrugMaster · Formulary · MedicationCatalog
Prescription · PrescriptionLine · PharmacistReview · Dispensing
MedicationSubstitution · MedicationReturn · ControlledMedication
DrugInteractionAlert · AllergyAlert · MedicationReconciliation
MedicationAdministrationRecord · MedicationAdministration
MedicationSchedule · MedicationOmission · MedicationWaste
MedicationDoubleCheck · MedicationIncident
```

Berbatasan langsung dengan persediaan inti. **Batasnya: farmasi tidak pernah
menulis ke `stock_balance`.** Ia meminta lewat `InventoryPort`. Alasannya bukan
kerapian arsitektur — obat memiliki aturan yang barang dagangan tidak punya
(golongan terkendali, kedaluwarsa yang menghentikan pemberian, penarikan
sediaan), dan menaruh aturan itu di mesin persediaan umum akan membuat aturannya
berlaku pada kaus dan kopi.

### 6. Diagnostik (Diagnostics)

```
LabCatalog · LabOrder · Specimen · SpecimenCollection · SpecimenTransport
LabWorklist · LabResult · ResultReferenceRange · CriticalResult
ResultVerification · ResultAmendment · ExternalLab
RadiologyCatalog · RadiologyOrder · ModalityWorklist · Study
Report · CriticalFinding · ReportVerification · PacsLink · DicomMetadata
```

**Invarian:** hasil kritis wajib memiliki penerimaan (`acknowledgement`) oleh
manusia yang berwenang. Hasil kritis yang terkirim tetapi tidak pernah dibaca
adalah kegagalan sistem, bukan kegagalan orang — jadi sistem yang harus
menagihnya.

### 7. Rawat Inap dan Keperawatan (Inpatient)

```
Admission · Transfer · Discharge · BedRequest · BedAssignment
BedReservation · WardRound · InpatientCarePlan · DischargePlanning
DischargeSummary · AgainstMedicalAdvice · DeathDischarge
BedCleaning · BedTurnaround
NursingAssessment · NursingDiagnosis · NursingCarePlan
NursingIntervention · NursingEvaluation · FluidBalance
FallRisk · PressureInjuryRisk · PainAssessment · Handover
NursingTask · PatientObservation
```

**Invarian:** satu tempat tidur, satu pasien, pada satu saat. Ditegakkan basis
data, bukan layanan.

### 8. Layanan Khusus (Special Services)

```
EmergencyVisit · TriageAssessment · EmergencyDisposition
SurgeryRequest · OperatingRoomSchedule · SurgicalChecklist · OperationNote
AnesthesiaRecord · RecoveryRoom
CriticalCareEncounter · VentilatorObservation · DialysisSession
OncologyProtocol · ChemotherapyCycle · RehabilitationPlan
DentalChart · MentalHealthAssessment
Pregnancy · AntenatalVisit · Labour · Partograph · Delivery
Newborn · NeonatalAssessment · PostnatalVisit · FamilyPlanning
NutritionAssessment · MealProduction · CSSDRequest · SterilizationBatch
BloodDonor · BloodProduct · Crossmatch · Transfusion
AmbulanceRequest · DeathRecord · BodyRelease
```

### 9. Layanan Primer (Primary Care)

```
UKP · UKM · ServiceArea · FamilyFolder · ProgramTarget
CommunicableDisease · NonCommunicableDisease · MaternalChildHealth
Immunization · Nutrition · EnvironmentalHealth · SchoolHealth
HomeVisit · OutreachActivity · PuskesmasNetwork · ProgramIndicator
PosyanduSchedule · Cadre · TargetPopulation · ServiceTable
ChildGrowthMeasurement · DigitalKMS · NutritionRisk · StuntingRisk
```

Konteks yang paling berbeda wataknya. Posyandu dijalankan **kader, bukan tenaga
medis**, sering **tanpa internet**, dan sasarannya **populasi, bukan pasien yang
datang**. Antarmukanya tidak boleh sekadar versi kecil dari layar rumah sakit.

### 10. Keuangan Kesehatan (Health Revenue)

```
HealthChargeCatalog · ChargeCapture · PatientBill · BillLine · Deposit
Coverage · Guarantor · InsurancePlan
Claim · ClaimLine · ClaimDocument · ClaimStatus · ClaimReconciliation
Casemix · Coding · Payment · Refund
MedicalRecordCompletion · DocumentDeficiency · CodingWorklist
ClinicalCode · ReleaseOfInformation · Retention · LegalHold
```

Berbatasan dengan akuntansi inti. **Batasnya: kesehatan tidak pernah menulis
jurnal.** Ia menerbitkan peristiwa akuntansi lewat `AccountingEventPort`, dan
mesin posting yang sudah ada memetakannya ke akun.

---

## Peta ketergantungan antar konteks

```
                    Fasilitas
                        |
        +---------------+---------------+
        |               |               |
   Identitas        Front Office    Layanan Primer
   Pasien               |
        |               |
        +-------+-------+
                |
             Klinis
                |
        +-------+-------+-------------+
        |       |       |             |
    Farmasi Diagnostik Rawat Inap  Layanan Khusus
        |       |       |             |
        +-------+-------+-------------+
                |
        Keuangan Kesehatan
                |
        +-------+-------+
        |               |
  AccountingEventPort  Klaim
```

Aturan: panah hanya mengarah ke bawah. Farmasi tidak membaca tabel klaim;
klaim membaca hasil farmasi lewat kontrak.

---

## Batas terhadap vertical lain

Panduan koordinasi §6 melarang vertical saling membaca tabel internal. Yang
paling menggoda untuk dilanggar:

| Godaan | Mengapa dilarang | Yang benar |
|---|---|---|
| Kesehatan membaca `village.penduduk` untuk mengisi data pasien | Data kependudukan bukan milik fasilitas kesehatan, dan menyalinnya tanpa dasar hukum melanggar perlindungan data pribadi | Tautan eksplisit dengan persetujuan, tujuan, dan jejak audit |
| info-desa membaca rekam medis warganya untuk laporan kesehatan desa | Rekam medis tidak boleh dibaca pemerintah desa | Kesehatan menerbitkan **agregat**, bukan baris |
| Koperasi membaca tagihan pasien anggotanya | Sama | Peristiwa terbatas lewat kontrak |

---

## Yang dikerjakan lebih dahulu, dan mengapa

Urutan H-1 sampai H-12 pada perintah sudah masuk akal. Satu penyesuaian
diusulkan, dengan alasannya:

**Identitas pasien (H-2) sebaiknya sebagian dikerjakan bersama H-1**, khususnya
`Patient`, `MedicalRecordNumber`, dan deteksi ganda. Alasannya: `Appointment`
pada H-2 dan seluruh konteks setelahnya menunjuk pasien. Membangun janji temu di
atas identitas yang belum punya aturan penggandaan berarti menumpuk janji temu
pada rekam medis ganda, dan membersihkannya kemudian jauh lebih mahal daripada
mencegahnya.

Rinciannya pada [06 — rencana implementasi](06-implementation-plan.md).
