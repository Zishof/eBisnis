/**
 * Antarmuka onboarding merchant pada provider pembayaran.
 *
 * Dokumen Versi 9 meminta antarmuka ini dibuat **tetapi melarang mengarang
 * endpoint provider**. Keduanya dipenuhi dengan cara berikut: antarmukanya ada
 * dan lengkap, sedangkan satu-satunya implementasi yang tersedia menyatakan
 * dirinya `MANUAL_TICKET` dan menolak setiap metode yang menuntut panggilan API
 * yang belum terdokumentasi.
 *
 * Menolak lebih baik daripada mengembalikan nilai palsu. Metode yang
 * mengembalikan "berhasil" tanpa benar-benar memanggil provider akan membuat
 * akun ditandai aktif padahal tidak, dan kegagalannya baru terlihat saat
 * pembeli pertama membayar.
 *
 * Ketika provider menyediakan dokumentasi resmi, implementasi API ditambahkan
 * sebagai kelas kedua tanpa mengubah antarmuka maupun pemanggilnya.
 */

export type OnboardingMode = 'MANUAL_TICKET' | 'PROVIDER_API';

export interface OnboardingCapability {
  mode: OnboardingMode;
  /** Metode yang benar-benar dapat dipanggil pada implementasi ini. */
  supports: {
    createApplication: boolean;
    submitDocuments: boolean;
    getApplicationStatus: boolean;
    retrieveCredentialReference: boolean;
    activateAccount: boolean;
    suspendAccount: boolean;
  };
  /** Penjelasan yang ditampilkan kepada admin, bukan kode error. */
  note: string;
}

export interface OnboardingApplication {
  applicationId: string;
  status: string;
  submittedAt: Date;
}

export interface OnboardingDocument {
  code: string;
  fileObjectId: string;
}

/**
 * Kontrak onboarding. Setiap metode dapat menolak; pemanggil wajib memeriksa
 * `checkCapability()` lebih dulu alih-alih mengandalkan pengecualian.
 */
export interface PaymentMerchantOnboardingProvider {
  readonly providerCode: string;

  checkCapability(): OnboardingCapability;

  createApplication(input: {
    tenantId: string;
    accountId: string;
    legalName: string;
    contactEmail: string;
  }): Promise<OnboardingApplication>;

  submitDocuments(applicationId: string, documents: OnboardingDocument[]): Promise<void>;

  getApplicationStatus(applicationId: string): Promise<string>;

  /**
   * Mengambil **referensi** credential, bukan nilainya.
   *
   * Provider yang mendukung onboarding otomatis pun sebaiknya tidak mengirim
   * rahasia lewat jalur yang sama dengan status aplikasi.
   */
  retrieveCredentialReference(applicationId: string): Promise<string>;

  activateAccount(applicationId: string): Promise<void>;

  suspendAccount(applicationId: string, reason: string): Promise<void>;
}

/** Dilempar ketika sebuah metode tidak tersedia pada mode yang aktif. */
export class OnboardingNotSupportedError extends Error {
  constructor(
    readonly method: string,
    readonly mode: OnboardingMode,
  ) {
    super(
      `Metode "${method}" tidak tersedia pada mode ${mode}. ` +
        'Aktivasi berjalan melalui tiket dukungan; lihat Pusat Aktivasi Marketplace.',
    );
    this.name = 'OnboardingNotSupportedError';
  }
}

/**
 * Implementasi eSmartlink.
 *
 * Audit V9-0 tidak menemukan satu pun dokumentasi onboarding otomatis pada
 * source referensi maupun kontrak provider yang tersedia
 * (docs/upgrade-v9/04-esmartlink-capability-inventory.md). Maka seluruh metode
 * yang menuntut panggilan API menolak, dan aktivasi berjalan lewat tiket.
 */
export class EsmartlinkMerchantOnboardingProvider implements PaymentMerchantOnboardingProvider {
  readonly providerCode = 'ESMARTLINK';

  checkCapability(): OnboardingCapability {
    return {
      mode: 'MANUAL_TICKET',
      supports: {
        createApplication: false,
        submitDocuments: false,
        getApplicationStatus: false,
        retrieveCredentialReference: false,
        activateAccount: false,
        suspendAccount: false,
      },
      note:
        'eSmartlink belum menyediakan API onboarding merchant yang terdokumentasi. ' +
        'Aktivasi dilakukan melalui tiket dukungan, dan credential dimasukkan ' +
        'melalui formulir aman oleh petugas berwenang.',
    };
  }

  createApplication(): Promise<OnboardingApplication> {
    return Promise.reject(new OnboardingNotSupportedError('createApplication', 'MANUAL_TICKET'));
  }

  submitDocuments(): Promise<void> {
    return Promise.reject(new OnboardingNotSupportedError('submitDocuments', 'MANUAL_TICKET'));
  }

  getApplicationStatus(): Promise<string> {
    return Promise.reject(new OnboardingNotSupportedError('getApplicationStatus', 'MANUAL_TICKET'));
  }

  retrieveCredentialReference(): Promise<string> {
    return Promise.reject(
      new OnboardingNotSupportedError('retrieveCredentialReference', 'MANUAL_TICKET'),
    );
  }

  activateAccount(): Promise<void> {
    return Promise.reject(new OnboardingNotSupportedError('activateAccount', 'MANUAL_TICKET'));
  }

  suspendAccount(): Promise<void> {
    return Promise.reject(new OnboardingNotSupportedError('suspendAccount', 'MANUAL_TICKET'));
  }
}
