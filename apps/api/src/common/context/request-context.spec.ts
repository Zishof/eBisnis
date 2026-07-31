import { currentScope, runInRequestScope, withRequestScope } from './request-context';

describe('runInRequestScope', () => {
  it('konteks terlihat di dalam, tidak terlihat di luar', () => {
    expect(currentScope()).toBeUndefined();
    runInRequestScope({ requestId: 'r1' }, () => {
      expect(currentScope()?.requestId).toBe('r1');
    });
    expect(currentScope()).toBeUndefined();
  });

  it('konteks mengikuti seluruh rantai await', async () => {
    // Inilah sifat yang membuat pendekatan ini berguna: pencatat yang dipanggil
    // beberapa lapis di dalam tetap dapat menanyakan siapa pelakunya tanpa
    // menerimanya sebagai argumen.
    await runInRequestScope({ requestId: 'r2', actorUsername: 'budi' }, async () => {
      await new Promise((resolve) => setImmediate(resolve));
      const dalam = async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
        return currentScope()?.actorUsername;
      };
      expect(await dalam()).toBe('budi');
    });
  });

  it('dua permintaan bersamaan tidak saling mencemari', async () => {
    const jalankan = (id: string, jeda: number) =>
      runInRequestScope({ requestId: id }, async () => {
        await new Promise((resolve) => setTimeout(resolve, jeda));
        return currentScope()?.requestId;
      });

    // Yang lambat sengaja dimulai lebih dulu: bila konteksnya global alih-alih
    // per-alur, yang lambat akan selesai membawa id milik yang cepat.
    const [lambat, cepat] = await Promise.all([jalankan('lambat', 20), jalankan('cepat', 1)]);
    expect(lambat).toBe('lambat');
    expect(cepat).toBe('cepat');
  });

  it('perubahan setelah konteks dibuka terlihat oleh kode sesudahnya', async () => {
    // Penjaga JWT menulis pelakunya ke konteks yang sudah dibuka middleware.
    await runInRequestScope({ requestId: 'r3' }, async () => {
      currentScope()!.actorUserId = 'u1';
      await new Promise((resolve) => setImmediate(resolve));
      expect(currentScope()?.actorUserId).toBe('u1');
    });
  });
});

describe('withRequestScope', () => {
  it('melengkapi bidang yang tidak disebut pemanggil', () => {
    runInRequestScope({ actorUserId: 'u1', actorUsername: 'budi', activeRoleCode: 'BENDAHARA' }, () => {
      const hasil = withRequestScope({ moduleCode: 'KAS', actionCode: 'APPROVE' } as Record<string, unknown>);
      expect(hasil.actorUserId).toBe('u1');
      expect(hasil.activeRoleCode).toBe('BENDAHARA');
      expect(hasil.moduleCode).toBe('KAS');
    });
  });

  it('TIDAK menimpa nilai yang sudah disebut pemanggil', () => {
    /*
     * Pemanggil yang menyebutkan pelaku secara eksplisit biasanya sedang
     * mencatat perbuatan atas nama orang lain — mis. petugas dukungan yang
     * bertindak untuk penyewa. Konteks yang menimpanya akan menghapus justru
     * perbedaan yang paling penting untuk dicatat.
     */
    runInRequestScope({ actorUserId: 'petugas-dukungan', actorUsername: 'support' }, () => {
      const hasil = withRequestScope({ actorUserId: 'pemilik-tenant', actorUsername: 'budi' });
      expect(hasil.actorUserId).toBe('pemilik-tenant');
      expect(hasil.actorUsername).toBe('budi');
    });
  });

  it('di luar permintaan, masukan dikembalikan apa adanya', () => {
    // Pekerjaan terjadwal memang tidak punya pelaku manusia, dan mengarangkan
    // satu justru membuat jejak auditnya berbohong.
    const masukan: Record<string, unknown> = { moduleCode: 'PENJADWAL', actionCode: 'CLEANUP' };
    expect(withRequestScope(masukan)).toEqual(masukan);
    expect(withRequestScope(masukan).actorUserId).toBeUndefined();
  });

  it('tidak mengubah objek masukan', () => {
    runInRequestScope({ actorUserId: 'u1' }, () => {
      const masukan: Record<string, unknown> = { moduleCode: 'KAS' };
      withRequestScope(masukan);
      expect(masukan.actorUserId).toBeUndefined();
    });
  });
});
