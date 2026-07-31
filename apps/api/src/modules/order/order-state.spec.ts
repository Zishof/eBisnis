import {
  ALL_ORDER_STATUSES,
  canTransition,
  holdsStock,
  isTerminal,
  type ActorType,
  type OrderStatus,
} from './order-state';

describe('perpindahan status pesanan', () => {
  describe('alur normal', () => {
    const happyPath: [OrderStatus, OrderStatus, ActorType][] = [
      ['AWAITING_PAYMENT', 'PAID', 'SYSTEM'],
      ['PAID', 'PROCESSING', 'SELLER'],
      ['PROCESSING', 'READY_TO_SHIP', 'SELLER'],
      ['READY_TO_SHIP', 'SHIPPED', 'SELLER'],
      ['SHIPPED', 'DELIVERED', 'SYSTEM'],
      ['DELIVERED', 'COMPLETED', 'BUYER'],
    ];

    it.each(happyPath)('mengizinkan %s -> %s oleh %s', (from, to, actor) => {
      expect(canTransition(from, to, actor).allowed).toBe(true);
    });
  });

  describe('siapa boleh melakukan apa', () => {
    it('hanya sistem yang menyatakan pembayaran masuk', () => {
      // Pembayaran masuk lewat callback penyedia, bukan lewat pernyataan
      // penjual maupun pembeli.
      expect(canTransition('AWAITING_PAYMENT', 'PAID', 'SYSTEM').allowed).toBe(true);
      expect(canTransition('AWAITING_PAYMENT', 'PAID', 'SELLER').allowed).toBe(false);
      expect(canTransition('AWAITING_PAYMENT', 'PAID', 'BUYER').allowed).toBe(false);
      expect(canTransition('AWAITING_PAYMENT', 'PAID', 'PLATFORM').allowed).toBe(false);
    });

    it('pembeli tidak dapat menyatakan pesanannya sudah dikirim', () => {
      expect(canTransition('READY_TO_SHIP', 'SHIPPED', 'BUYER').allowed).toBe(false);
      expect(canTransition('READY_TO_SHIP', 'SHIPPED', 'SELLER').allowed).toBe(true);
    });

    it('pembeli dapat membatalkan sebelum membayar', () => {
      expect(canTransition('AWAITING_PAYMENT', 'CANCELLED', 'BUYER').allowed).toBe(true);
    });

    it('pembeli tidak dapat membatalkan sendiri setelah membayar', () => {
      // Pembatalan setelah lunas menuntut pengembalian dana.
      expect(canTransition('PAID', 'CANCELLED', 'BUYER').allowed).toBe(false);
      expect(canTransition('PAID', 'CANCELLED', 'SELLER').allowed).toBe(true);
      expect(canTransition('PAID', 'CANCELLED', 'PLATFORM').allowed).toBe(true);
    });

    it('hanya platform yang memutuskan sengketa', () => {
      expect(canTransition('DISPUTED', 'REFUNDED', 'PLATFORM').allowed).toBe(true);
      expect(canTransition('DISPUTED', 'REFUNDED', 'SELLER').allowed).toBe(false);
      expect(canTransition('DISPUTED', 'REFUNDED', 'BUYER').allowed).toBe(false);
    });

    it('menyebut aktor pada alasan penolakan', () => {
      const result = canTransition('AWAITING_PAYMENT', 'PAID', 'SELLER');
      expect(result.reason).toMatch(/SELLER/);
    });
  });

  describe('status akhir', () => {
    const terminals: OrderStatus[] = ['CANCELLED', 'EXPIRED', 'REFUNDED'];

    it.each(terminals)('%s tidak dapat berubah lagi', (status) => {
      expect(isTerminal(status)).toBe(true);
      const offending = ALL_ORDER_STATUSES.filter(
        (to) => canTransition(status, to, 'PLATFORM').allowed,
      );
      expect(offending).toEqual([]);
    });

    it('pesanan batal tidak dapat kembali dibayar', () => {
      // Inilah alasan tabel perpindahan ditulis di satu tempat: memastikannya
      // cukup dengan membaca satu berkas.
      const actors: ActorType[] = ['BUYER', 'SELLER', 'PLATFORM', 'SYSTEM'];
      for (const actor of actors) {
        expect(canTransition('CANCELLED', 'PAID', actor).allowed).toBe(false);
        expect(canTransition('EXPIRED', 'PAID', actor).allowed).toBe(false);
        expect(canTransition('REFUNDED', 'PAID', actor).allowed).toBe(false);
      }
    });

    it('menandai status berjalan sebagai bukan akhir', () => {
      const running: OrderStatus[] = ['AWAITING_PAYMENT', 'PAID', 'PROCESSING', 'SHIPPED'];
      const offending = running.filter((s) => isTerminal(s));
      expect(offending).toEqual([]);
    });
  });

  describe('perpindahan yang tidak masuk akal', () => {
    it('menolak melompat dari menunggu bayar langsung ke terkirim', () => {
      expect(canTransition('AWAITING_PAYMENT', 'SHIPPED', 'SELLER').allowed).toBe(false);
    });

    it('menolak mundur dari terkirim ke diproses', () => {
      expect(canTransition('SHIPPED', 'PROCESSING', 'SELLER').allowed).toBe(false);
    });

    it('menolak perpindahan ke status yang sama', () => {
      expect(canTransition('PAID', 'PAID', 'SYSTEM').allowed).toBe(false);
    });

    it('menyebut status yang mungkin pada alasannya', () => {
      // Alasan yang hanya berbunyi "ditolak" memaksa pembacanya menebak.
      const result = canTransition('AWAITING_PAYMENT', 'SHIPPED', 'SELLER');
      expect(result.reason).toMatch(/PAID/);
    });

    it('menolak status yang tidak dikenal', () => {
      expect(canTransition('TIDAK_ADA' as OrderStatus, 'PAID', 'SYSTEM').allowed).toBe(false);
    });
  });

  describe('penahanan stok', () => {
    it('hanya menunggu pembayaran yang menahan stok', () => {
      expect(holdsStock('AWAITING_PAYMENT')).toBe(true);
      // Setelah lunas stok sudah dipotong, bukan ditahan.
      expect(holdsStock('PAID')).toBe(false);
      expect(holdsStock('CANCELLED')).toBe(false);
    });
  });

  describe('kelengkapan tabel', () => {
    it('mendefinisikan seluruh status yang dapat dituju', () => {
      // Status yang menjadi tujuan tetapi tidak punya barisnya sendiri akan
      // membuat pesanan tersangkut tanpa jalan keluar.
      const reachable = new Set<string>();
      for (const from of ALL_ORDER_STATUSES) {
        for (const to of ALL_ORDER_STATUSES) {
          if (canTransition(from, to, 'PLATFORM').allowed || canTransition(from, to, 'SYSTEM').allowed) {
            reachable.add(to);
          }
        }
      }
      const undefinedTargets = [...reachable].filter((s) => !ALL_ORDER_STATUSES.includes(s as OrderStatus));
      expect(undefinedTargets).toEqual([]);
    });

    it('memberi setiap status berjalan sedikitnya satu jalan keluar', () => {
      const stuck = ALL_ORDER_STATUSES.filter(
        (s) => !isTerminal(s) && !ALL_ORDER_STATUSES.some((to) =>
          (['BUYER', 'SELLER', 'PLATFORM', 'SYSTEM'] as ActorType[]).some(
            (a) => canTransition(s, to, a).allowed,
          ),
        ),
      );
      expect(stuck).toEqual([]);
    });
  });
});
