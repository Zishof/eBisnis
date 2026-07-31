/**
 * Pengujian buku besar kasir lokal.
 *
 * Yang dijaga paling ketat: **penyuntingan diam-diam harus ketahuan.** Data
 * uang yang tersimpan di peramban dapat diubah siapa pun yang membuka alat
 * pengembang, dan buku besar yang tidak dapat membuktikan keutuhannya tidak
 * berguna untuk audit.
 */

import { describe, expect, it } from 'vitest';
import {
  HASH_AWAL,
  hitungHash,
  periksaRantai,
  rekonsiliasi,
  ringkasanAntrean,
  type CatatanLokal,
  type CatatanServer,
  hashMuatan,
  type MuatanTransaksi,
} from './ledger';

/** Menyusun rantai yang sah sepanjang n baris. */
async function rantai(n: number, ubah?: (c: CatatanLokal, i: number) => void) {
  const baris: CatatanLokal[] = [];
  let sebelumnya = HASH_AWAL;
  for (let i = 1; i <= n; i += 1) {
    const c: CatatanLokal = {
      offlineId: `off-${i}`,
      sequence: i,
      outletId: 'O1',
      terminalId: 'T1',
      shiftId: 'S1',
      businessDate: '2026-08-01',
      grandTotal: String(10_000 * i),
      itemCount: i,
      occurredAt: `2026-08-01T0${i}:00:00.000Z`,
      receiptNumber: `ST-00000${i}`,
      status: 'PENDING',
      serverSaleId: null,
      previousHash: sebelumnya,
      hash: '',
    };
    ubah?.(c, i);
    c.hash = await hitungHash(c);
    sebelumnya = c.hash;
    baris.push(c);
  }
  return baris;
}

describe('keutuhan rantai', () => {
  it('rantai yang sah tidak menghasilkan temuan', async () => {
    expect(await periksaRantai(await rantai(5))).toEqual([]);
  });

  it('buku besar kosong tidak menghasilkan temuan', async () => {
    // Mesin kasir yang baru dipasang belum punya transaksi. Melaporkannya
    // sebagai rusak akan membuat peringatan pertama yang dilihat penyewa adalah
    // peringatan palsu.
    expect(await periksaRantai([])).toEqual([]);
  });

  it('mendeteksi nilai yang diubah setelah dicatat', async () => {
    const baris = await rantai(3);
    baris[1].grandTotal = '999999';
    const temuan = await periksaRantai(baris);
    expect(temuan.some((t) => t.reason === 'HASH_TIDAK_COCOK')).toBe(true);
    expect(temuan.find((t) => t.reason === 'HASH_TIDAK_COCOK')?.sequence).toBe(2);
  });

  it('mendeteksi baris yang dihapus dari tengah', async () => {
    /*
     * Justru inilah bentuk kecurangan yang paling masuk akal pada mesin kasir:
     * menghapus satu transaksi supaya kas cocok. Nomor urut yang melompat
     * membuatnya terlihat.
     */
    const baris = await rantai(5);
    baris.splice(2, 1);
    const temuan = await periksaRantai(baris);
    expect(temuan.some((t) => t.reason === 'SEQUENCE_LOMPAT')).toBe(true);
  });

  it('mendeteksi rantai yang putus', async () => {
    const baris = await rantai(4);
    baris[2].previousHash = HASH_AWAL;
    baris[2].hash = await hitungHash(baris[2]);
    const temuan = await periksaRantai(baris);
    expect(temuan.some((t) => t.reason === 'RANTAI_PUTUS')).toBe(true);
  });

  it('melaporkan SELURUH temuan, bukan berhenti pada yang pertama', async () => {
    // Ketika buku besar dipersoalkan, yang ditanyakan adalah "berapa banyak dan
    // yang mana". Jawaban yang berhenti pada baris pertama tidak menjawabnya.
    const baris = await rantai(6);
    baris[1].grandTotal = '1';
    baris[4].itemCount = 99;
    const temuan = await periksaRantai(baris);
    const rusak = temuan.filter((t) => t.reason === 'HASH_TIDAK_COCOK');
    expect(rusak).toHaveLength(2);
  });

  it('perubahan status TIDAK memutus rantai', async () => {
    /*
     * Status memang berubah setelah baris dibuat — PENDING menjadi SYNCED
     * begitu terkirim. Bila status ikut dihash, setiap sinkronisasi akan
     * memutus rantainya sendiri, dan peringatan yang selalu menyala adalah
     * peringatan yang selalu diabaikan.
     */
    const baris = await rantai(3);
    baris[0].status = 'SYNCED';
    baris[0].serverSaleId = 'srv-1';
    expect(await periksaRantai(baris)).toEqual([]);
  });

  it('urutan baris yang teracak tidak dianggap rusak', async () => {
    // Penyimpanan tidak menjamin urutan pembacaan; yang menentukan adalah
    // nomor urutnya.
    const baris = await rantai(4);
    const teracak = [baris[2], baris[0], baris[3], baris[1]];
    expect(await periksaRantai(teracak)).toEqual([]);
  });

  it('hash berubah bila satu medan saja berubah', async () => {
    const a = (await rantai(1))[0];
    const b = { ...a, itemCount: a.itemCount + 1 };
    expect(await hitungHash(b)).not.toBe(a.hash);
  });
});

describe('rekonsiliasi lokal dengan server', () => {
  const lokal = async (): Promise<CatatanLokal[]> => rantai(3);
  const srv = (over: Partial<CatatanServer> = {}): CatatanServer => ({
    offlineId: 'off-1',
    saleId: 'srv-1',
    receiptNumber: 'ST-000001',
    grandTotal: '10000',
    status: 'COMPLETED',
    ...over,
  });

  it('seluruhnya cocok berarti seimbang', async () => {
    const l = await lokal();
    const s = l.map((x, i) => srv({ offlineId: x.offlineId, saleId: `srv-${i}`, grandTotal: x.grandTotal }));
    const h = rekonsiliasi(l, s);
    expect(h.balanced).toBe(true);
    expect(h.matched).toBe(3);
    expect(h.differences).toEqual([]);
  });

  it('nilai yang sama dengan angka nol di belakang koma tetap dianggap cocok', async () => {
    /*
     * Server mengirim NUMERIC sebagai "10000.0000"; mesin kasir menyimpan
     * "10000". Melaporkannya sebagai selisih akan membuat setiap transaksi
     * tampak bermasalah, dan laporan yang selalu merah tidak akan dibaca.
     */
    const l = await rantai(1);
    const h = rekonsiliasi(l, [srv({ grandTotal: '10000.0000' })]);
    expect(h.balanced).toBe(true);
  });

  it('yang belum terkirim dilaporkan sebagai belum tersinkron', async () => {
    const l = await rantai(2);
    const h = rekonsiliasi(l, [srv({ offlineId: 'off-1', grandTotal: '10000' })]);
    const d = h.differences.find((x) => x.kind === 'BELUM_TERSINKRON');
    expect(d?.offlineId).toBe('off-2');
    expect(d?.message).toContain('dikirim');
  });

  it('yang ditolak server dibedakan dari yang belum terkirim', async () => {
    // Tindak lanjutnya berbeda: yang belum terkirim cukup dikirim ulang, yang
    // ditolak perlu diketahui sebabnya lebih dahulu.
    const l = await rantai(1);
    l[0].status = 'REJECTED';
    const h = rekonsiliasi(l, []);
    expect(h.differences[0].kind).toBe('DITOLAK_SERVER');
  });

  it('yang hanya ada di server dilaporkan tersendiri', async () => {
    const l = await rantai(1);
    const h = rekonsiliasi(l, [
      srv({ grandTotal: '10000' }),
      srv({ offlineId: 'off-lain', saleId: 'srv-9', grandTotal: '5000' }),
    ]);
    const d = h.differences.find((x) => x.kind === 'HANYA_DI_SERVER');
    expect(d?.saleId).toBe('srv-9');
  });

  it('nilai yang berbeda dilaporkan beserta kedua angkanya', async () => {
    const l = await rantai(1);
    const h = rekonsiliasi(l, [srv({ grandTotal: '12000' })]);
    const d = h.differences[0];
    expect(d.kind).toBe('NILAI_BERBEDA');
    expect(d.localTotal).toBe('10000');
    expect(d.serverTotal).toBe('12000');
    expect(d.message).toContain('10000');
    expect(d.message).toContain('12000');
  });

  it('penjualan daring biasa tanpa offlineId tidak dianggap selisih', async () => {
    /*
     * Kasir yang bekerja daring menghasilkan penjualan tanpa offlineId. Ia
     * memang tidak ada pada buku besar mesin, dan melaporkannya sebagai
     * "hanya di server" akan menenggelamkan selisih yang sungguhan.
     */
    const l = await rantai(1);
    const h = rekonsiliasi(l, [
      srv({ grandTotal: '10000' }),
      srv({ offlineId: null, saleId: 'srv-daring', grandTotal: '7000' }),
    ]);
    expect(h.balanced).toBe(true);
  });

  it('buku besar kosong dengan server kosong seimbang', () => {
    expect(rekonsiliasi([], []).balanced).toBe(true);
  });
});

describe('ringkasan antrean', () => {
  it('menghitung tertunda, ditolak, dan tersinkron', async () => {
    const l = await rantai(4);
    l[0].status = 'SYNCED';
    l[1].status = 'REJECTED';
    const r = ringkasanAntrean(l);
    expect(r.synced).toBe(1);
    expect(r.rejected).toBe(1);
    expect(r.pending).toBe(2);
  });

  it('menjumlahkan nilai yang belum terkirim', async () => {
    // Angka inilah yang perlu dilihat kasir sebelum menutup shift: berapa uang
    // yang sudah diterima tetapi belum sampai ke server.
    const l = await rantai(3);
    l[0].status = 'SYNCED';
    expect(ringkasanAntrean(l).pendingValue).toBe('50000');
  });

  it('buku besar kosong menghasilkan nol, bukan NaN', () => {
    expect(ringkasanAntrean([])).toEqual({
      pending: 0,
      rejected: 0,
      synced: 0,
      pendingValue: '0',
    });
  });
});

describe('rincian transaksi di dalam rantai', () => {
  const muatan = (over: Partial<MuatanTransaksi> = {}): MuatanTransaksi => ({
    lines: [
      {
        productId: 'P1',
        uomId: 'U1',
        quantity: 2,
        unitPrice: '18000',
        lineSubtotal: '36000',
        taxAmount: '0',
        lineTotal: '36000',
        taxRateId: null,
      },
    ],
    payments: [
      { paymentMethodId: 'TUNAI', amount: '36000', tenderedAmount: '50000', reference: null },
    ],
    subtotal: '36000',
    taxTotal: '0',
    changeTotal: '14000',
    currencyCode: 'IDR',
    catalogSyncedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  });

  async function barisBermuatan(m: MuatanTransaksi): Promise<CatatanLokal> {
    const c: CatatanLokal = {
      offlineId: 'off-1',
      sequence: 1,
      outletId: 'O1',
      terminalId: 'T1',
      shiftId: 'S1',
      businessDate: '2026-08-01',
      grandTotal: '36000',
      itemCount: 2,
      occurredAt: '2026-08-01T01:00:00.000Z',
      receiptNumber: 'ST-000001',
      status: 'PENDING',
      serverSaleId: null,
      payload: m,
      payloadHash: await hashMuatan(m),
      previousHash: HASH_AWAL,
      hash: '',
    };
    c.hash = await hitungHash(c);
    return c;
  }

  it('baris bermuatan yang utuh tidak menghasilkan temuan', async () => {
    expect(await periksaRantai([await barisBermuatan(muatan())])).toEqual([]);
  });

  it('baris TANPA muatan tetap sah — rantai lama tidak perlu dibangun ulang', async () => {
    /*
     * Baris yang ditulis versi sebelumnya tidak punya rincian barang. Kalau
     * penambahan medan ini membuat hash lamanya tidak lagi cocok, seluruh buku
     * besar yang sudah ada akan dilaporkan rusak — dan membangunnya ulang berarti
     * menghitung ulang bukti keutuhan dari data yang justru sedang dipertanyakan.
     */
    expect(await periksaRantai(await rantai(3))).toEqual([]);
  });

  it('mengubah jumlah barang ketahuan meski totalnya dibiarkan sama', async () => {
    /*
     * Inilah penyuntingan yang paling menggoda dan paling sulit terlihat:
     * menukar isi keranjang sambil membiarkan nilainya tetap, sehingga seluruh
     * laporan penjualan tetap seimbang dan hanya stoknya yang meleset.
     */
    const c = await barisBermuatan(muatan());
    c.payload!.lines[0].quantity = 5;

    const temuan = await periksaRantai([c]);
    expect(temuan).toHaveLength(1);
    expect(temuan[0].reason).toBe('MUATAN_TIDAK_COCOK');
  });

  it('mengubah metode pembayaran ketahuan', async () => {
    const c = await barisBermuatan(muatan());
    c.payload!.payments[0].paymentMethodId = 'KARTU';
    expect((await periksaRantai([c]))[0].reason).toBe('MUATAN_TIDAK_COCOK');
  });

  it('muatan yang sama isinya menghasilkan hash yang sama', async () => {
    // Bila tidak, rantai akan tampak putus setiap kali objeknya disusun ulang —
    // misalnya sesudah melewati JSON pada IndexedDB.
    const a = await hashMuatan(muatan());
    const b = await hashMuatan(JSON.parse(JSON.stringify(muatan())) as MuatanTransaksi);
    expect(a).toBe(b);
  });

  it('mengubah waktu salinan katalog ketahuan', async () => {
    // Medan itu yang menjawab "harga versi kapan yang dipakai" ketika peladen
    // menghitung angka berbeda; membiarkannya dapat disunting menghapus jawabannya.
    const c = await barisBermuatan(muatan());
    c.payload!.catalogSyncedAt = '2020-01-01T00:00:00.000Z';
    expect((await periksaRantai([c]))[0].reason).toBe('MUATAN_TIDAK_COCOK');
  });
});
