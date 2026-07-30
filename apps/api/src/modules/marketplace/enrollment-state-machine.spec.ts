import { MarketplaceEnrollmentStatus as S } from '@prisma/client';
import {
  ALLOWED_TRANSITIONS,
  SELLING_STATUSES,
  canTransition,
  nextStatusFromReadiness,
} from './enrollment-state-machine';

describe('mesin status pendaftaran seller', () => {
  it('mengenal seluruh 14 status blueprint', () => {
    expect(Object.keys(ALLOWED_TRANSITIONS).sort()).toEqual(Object.values(S).sort());
  });

  it('hanya ACTIVE yang berarti boleh berjualan', () => {
    expect(SELLING_STATUSES).toEqual([S.ACTIVE]);
  });

  describe('jalur normal', () => {
    it('menerima rangkaian dari DRAFT sampai ACTIVE', () => {
      const path = [
        S.DRAFT,
        S.PAYMENT_ACCOUNT_REQUIRED,
        S.ACTIVATION_TICKET_REQUIRED,
        S.ACTIVATION_TICKET_OPENED,
        S.WAITING_PROVIDER,
        S.CREDENTIAL_RECEIVED,
        S.CREDENTIAL_CONFIGURED,
        S.PAYMENT_TESTING,
        S.UNDER_REVIEW,
        S.ACTIVE,
      ];
      const rejected = path
        .slice(0, -1)
        .map((from, i) => ({ from, to: path[i + 1], check: canTransition(from, path[i + 1]) }))
        .filter((step) => !step.check.allowed)
        .map((step) => `${step.from}->${step.to}`);
      expect(rejected).toEqual([]);
    });
  });

  describe('jalur mundur yang memang harus ada', () => {
    it('mengizinkan uji pembayaran gagal kembali ke konfigurasi credential', () => {
      expect(canTransition(S.PAYMENT_TESTING, S.CREDENTIAL_CONFIGURED).allowed).toBe(true);
    });

    it('mengizinkan credential salah dimasukkan ulang', () => {
      expect(canTransition(S.CREDENTIAL_CONFIGURED, S.CREDENTIAL_RECEIVED).allowed).toBe(true);
    });

    it('mengizinkan tinjauan menemukan profil kurang lengkap', () => {
      expect(canTransition(S.UNDER_REVIEW, S.PROFILE_INCOMPLETE).allowed).toBe(true);
    });

    it('mengizinkan provider menolak lalu berkas kembali ke tiket', () => {
      expect(canTransition(S.WAITING_PROVIDER, S.ACTIVATION_TICKET_OPENED).allowed).toBe(true);
    });
  });

  describe('yang dilarang', () => {
    it('menolak lompatan langsung dari DRAFT ke ACTIVE', () => {
      const check = canTransition(S.DRAFT, S.ACTIVE);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/Yang mungkin/);
    });

    it('menolak seller aktif kembali ke tahap persiapan', () => {
      // Toko yang sudah menerima pesanan tidak boleh tiba-tiba dianggap belum siap.
      for (const to of [S.DRAFT, S.PAYMENT_ACCOUNT_REQUIRED, S.UNDER_REVIEW, S.PAYMENT_TESTING]) {
        expect(canTransition(S.ACTIVE, to).allowed).toBe(false);
      }
    });

    it('menolak penolakan dibatalkan', () => {
      expect(canTransition(S.REJECTED, S.ACTIVE).allowed).toBe(false);
      expect(canTransition(S.REJECTED, S.DRAFT).allowed).toBe(false);
      expect(canTransition(S.REJECTED, S.CLOSED).allowed).toBe(true);
    });

    it('menolak perpindahan dari status akhir', () => {
      expect(canTransition(S.CLOSED, S.ACTIVE).allowed).toBe(false);
      expect(ALLOWED_TRANSITIONS[S.CLOSED]).toEqual([]);
    });

    it('menolak perpindahan ke status yang sama', () => {
      const check = canTransition(S.DRAFT, S.DRAFT);
      expect(check.allowed).toBe(false);
      expect(check.reason).toMatch(/sudah DRAFT/);
    });

    it('menyebut alasan yang dapat ditindaklanjuti, bukan sekadar ditolak', () => {
      expect(canTransition(S.DRAFT, S.PAYMENT_TESTING).reason).toContain('PROFILE_INCOMPLETE');
    });
  });

  describe('penutupan', () => {
    it('dapat dilakukan dari setiap status kecuali yang sudah tertutup', () => {
      const notClosable = Object.values(S)
        .filter((s) => s !== S.CLOSED)
        .filter((s) => !canTransition(s, S.CLOSED).allowed);
      expect(notClosable).toEqual([]);
    });
  });

  describe('status berikutnya dari hasil pemeriksaan kesiapan', () => {
    const ready = { profileComplete: true, paymentAccountReady: true, activationTicketOpen: false };

    it('menunjuk profil ketika profil belum lengkap', () => {
      expect(nextStatusFromReadiness(S.DRAFT, { ...ready, profileComplete: false })).toBe(
        S.PROFILE_INCOMPLETE,
      );
    });

    it('menunjuk akun pembayaran ketika belum ada dan tiket belum dibuka', () => {
      expect(nextStatusFromReadiness(S.DRAFT, { ...ready, paymentAccountReady: false })).toBe(
        S.PAYMENT_ACCOUNT_REQUIRED,
      );
    });

    it('menunjuk tiket yang sudah dibuka ketika akun pembayaran masih ditunggu', () => {
      expect(
        nextStatusFromReadiness(S.DRAFT, {
          ...ready,
          paymentAccountReady: false,
          activationTicketOpen: true,
        }),
      ).toBe(S.ACTIVATION_TICKET_OPENED);
    });

    it('menunjuk tinjauan ketika seluruh syarat terpenuhi', () => {
      expect(nextStatusFromReadiness(S.DRAFT, ready)).toBe(S.UNDER_REVIEW);
    });

    it('tidak menghitung ulang berkas yang sudah aktif, ditangguhkan, ditolak, atau ditutup', () => {
      for (const status of [S.ACTIVE, S.SUSPENDED, S.REJECTED, S.CLOSED]) {
        expect(
          nextStatusFromReadiness(status, { ...ready, profileComplete: false }),
        ).toBe(status);
      }
    });
  });

  describe('keutuhan tabel transisi', () => {
    it('tidak merujuk status yang tidak dikenal', () => {
      const known = new Set(Object.values(S));
      const unknown = Object.values(ALLOWED_TRANSITIONS)
        .flat()
        .filter((s) => !known.has(s));
      expect(unknown).toEqual([]);
    });

    it('tidak memuat transisi ke diri sendiri', () => {
      const selfLoops = Object.entries(ALLOWED_TRANSITIONS)
        .filter(([from, list]) => (list as S[]).includes(from as S))
        .map(([from]) => from);
      expect(selfLoops).toEqual([]);
    });

    it('membuat setiap status dapat dicapai dari DRAFT', () => {
      const seen = new Set<S>([S.DRAFT]);
      const queue: S[] = [S.DRAFT];
      while (queue.length > 0) {
        for (const next of ALLOWED_TRANSITIONS[queue.shift()!]) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      const unreachable = Object.values(S).filter((s) => !seen.has(s));
      expect(unreachable).toEqual([]);
    });
  });
});
