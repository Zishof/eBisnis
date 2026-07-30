import {
  EsmartlinkMerchantOnboardingProvider,
  OnboardingNotSupportedError,
} from './payment-onboarding.provider';

describe('EsmartlinkMerchantOnboardingProvider', () => {
  const provider = new EsmartlinkMerchantOnboardingProvider();

  it('menyatakan dirinya bermodus MANUAL_TICKET', () => {
    expect(provider.checkCapability().mode).toBe('MANUAL_TICKET');
    expect(provider.providerCode).toBe('ESMARTLINK');
  });

  it('tidak mengklaim satu pun metode API tersedia', () => {
    // Dokumen Versi 9 melarang mengarang endpoint provider. Kapabilitas yang
    // dinyatakan harus mencerminkan apa yang benar-benar ada.
    const supports = provider.checkCapability().supports;
    expect(Object.values(supports).every((v) => v === false)).toBe(true);
  });

  it('menjelaskan alasannya dengan kalimat, bukan kode error', () => {
    expect(provider.checkCapability().note).toMatch(/tiket dukungan/i);
  });

  describe('metode yang menuntut panggilan API', () => {
    // Menolak lebih baik daripada mengembalikan nilai palsu: metode yang
    // mengembalikan "berhasil" tanpa memanggil provider membuat akun ditandai
    // aktif padahal tidak, dan kegagalannya baru terlihat saat pembeli membayar.
    const cases: Array<[string, () => Promise<unknown>]> = [
      ['createApplication', () => provider.createApplication()],
      ['submitDocuments', () => provider.submitDocuments()],
      ['getApplicationStatus', () => provider.getApplicationStatus()],
      ['retrieveCredentialReference', () => provider.retrieveCredentialReference()],
      ['activateAccount', () => provider.activateAccount()],
      ['suspendAccount', () => provider.suspendAccount()],
    ];

    it.each(cases)('%s menolak alih-alih mengembalikan nilai palsu', async (_name, invoke) => {
      await expect(invoke()).rejects.toBeInstanceOf(OnboardingNotSupportedError);
    });

    it('menyebut nama metode dan mode pada pesannya', async () => {
      await expect(provider.createApplication()).rejects.toThrow(/createApplication/);
      await expect(provider.createApplication()).rejects.toThrow(/MANUAL_TICKET/);
    });

    it('mengarahkan ke tempat aktivasi yang sebenarnya', async () => {
      await expect(provider.activateAccount()).rejects.toThrow(/Pusat Aktivasi Marketplace/);
    });
  });
});
