/**
 * Buku besar kasir lokal, sebagaimana dipakai layar kasir.
 *
 * Menyatukan tiga hal yang selama ini terpisah:
 *
 * - **`store.ts`** — penyimpanan berantai hash di IndexedDB;
 * - **`blok-struk.ts`** — jatah nomor struk yang dipesan selagi daring;
 * - **antrean pengiriman** — mengirimkan transaksi yang tertunda begitu peladen
 *   dapat dihubungi lagi.
 *
 * ## Dua urutan yang tidak boleh dibalik
 *
 * 1. **Catat dahulu, cetak kemudian.** Struk yang tercetak untuk transaksi yang
 *    belum tersimpan adalah transaksi yang hilang bila listrik padam sedetik
 *    kemudian — dan pembeli sudah membawa barangnya.
 *
 * 2. **Simpan jatah dahulu, pakai nomornya kemudian.** Bila nomor dipakai lebih
 *    dahulu lalu mesin mati sebelum jatahnya tersimpan, nomor yang sama akan
 *    diterbitkan lagi pada transaksi berikutnya.
 *
 * ## Antrean tidak pernah menyerah diam-diam
 *
 * Transaksi yang ditolak peladen tidak dihapus dari buku besar; ia ditandai
 * `REJECTED` beserta alasannya. Menghapusnya akan membuat angka antrean turun
 * ke nol dan kasir mengira semuanya beres — padahal ada transaksi yang tidak
 * pernah masuk pembukuan.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { ambilNomor, nilaiBlok, type BlokStruk, type PenilaianBlok } from './blok-struk';
import {
  ringkasanAntrean,
  type CatatanLokal,
  type MuatanTransaksi,
  type TemuanRusak,
} from './ledger';
import {
  catat,
  ekspor,
  pastikanPermanen,
  periksaKeutuhan,
  semua,
  tandaiDitolak,
  tandaiTersinkron,
  tertunda,
  type BukaBuku,
} from './store';

/** Bentuk jatah sebagaimana dikirim peladen. */
interface JatahApi {
  blockId: string;
  outletId: string;
  terminalId: string;
  prefix: string;
  padding: number;
  fromNumber: number;
  toNumber: number;
  nextNumber: number;
  businessDate: string | null;
  allocatedAt: string;
}

interface HasilKirim {
  offlineId: string;
  status: 'BOOKED' | 'QUARANTINED' | 'DUPLICATE';
  saleId: string | null;
  receiptNumber: string | null;
  reasonCode: string | null;
  reason: string | null;
}

/**
 * Kunci penyimpanan jatah pada mesin ini.
 *
 * `localStorage` sengaja tidak dipakai — aturan proyek melarangnya untuk data
 * sesi, dan jatah nomor struk termasuk data yang tidak boleh bertahan melewati
 * pemakaian mesin oleh orang lain tanpa disengaja. IndexedDB tempat buku
 * besarnya berada sudah cukup, dan jatah disimpan di sana bersamanya.
 */
const KUNCI_JATAH = 'blok-struk';

export interface HasilBukuLokal {
  /** Seluruh baris buku besar, terbaru lebih dahulu. */
  baris: CatatanLokal[];
  pending: number;
  rejected: number;
  synced: number;
  pendingValue: string;
  /** Jatah nomor struk milik register ini. */
  blok: BlokStruk | null;
  penilaianBlok: PenilaianBlok;
  /** Benar bila transaksi luring boleh diselesaikan sekarang. */
  bolehJualLuring: boolean;
  temuan: TemuanRusak[] | null;
  memeriksa: boolean;
  mengirim: boolean;
  galat: string | null;

  ambilJatah: () => Promise<void>;
  simpanTransaksi: (t: {
    grandTotal: string;
    itemCount: number;
    payload: MuatanTransaksi;
  }) => Promise<{ receiptNumber: string; offlineId: string } | null>;
  kirimAntrean: () => Promise<void>;
  periksaRantaiSekarang: () => Promise<void>;
  unduhBukti: () => Promise<void>;
}

export function useBukuLokal(opsi: {
  konteks: BukaBuku | null;
  /** Peladen sedang terjangkau. */
  daring: boolean;
  /** Penjualan luring diizinkan tenant ini. */
  diizinkan: boolean;
}): HasilBukuLokal {
  const { konteks, daring, diizinkan } = opsi;

  const [baris, setBaris] = useState<CatatanLokal[]>([]);
  const [blok, setBlok] = useState<BlokStruk | null>(null);
  const [temuan, setTemuan] = useState<TemuanRusak[] | null>(null);
  const [memeriksa, setMemeriksa] = useState(false);
  const [mengirim, setMengirim] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const sedangKirim = useRef(false);
  const hidup = useRef(true);

  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  const muat = useCallback(async () => {
    try {
      const isi = await semua();
      if (hidup.current) setBaris(isi.sort((a, b) => b.sequence - a.sequence));
      const j = await bacaMeta<BlokStruk>(KUNCI_JATAH);
      if (hidup.current) setBlok(j);
    } catch (e) {
      if (hidup.current) setGalat(pesan(e));
    }
  }, []);

  useEffect(() => {
    void muat();
    void pastikanPermanen();
  }, [muat]);

  // --- Jatah nomor struk ---------------------------------------------------

  const ambilJatah = useCallback(async () => {
    setGalat(null);
    try {
      const j = await api.post<JatahApi>('/pos/offline/receipt-blocks', {
        terminalId: konteks?.terminalId,
      });
      const baru: BlokStruk = {
        blockId: j.blockId,
        terminalId: j.terminalId,
        outletId: j.outletId,
        prefix: j.prefix,
        padding: j.padding,
        fromNumber: j.fromNumber,
        toNumber: j.toNumber,
        nextNumber: j.nextNumber,
        allocatedAt: j.allocatedAt,
        businessDate: j.businessDate,
      };
      await tulisMeta(KUNCI_JATAH, baru);
      if (hidup.current) setBlok(baru);
    } catch (e) {
      if (hidup.current) setGalat(pesan(e));
    }
  }, [konteks?.terminalId]);

  const penilaianBlok = nilaiBlok(blok, konteks?.terminalId ?? null);

  // --- Mencatat transaksi luring -------------------------------------------

  const simpanTransaksi = useCallback(
    async (t: { grandTotal: string; itemCount: number; payload: MuatanTransaksi }) => {
      if (!konteks || !blok) return null;

      const diambil = ambilNomor(blok);
      if (!diambil) {
        setGalat(
          'Jatah nomor struk habis. Transaksi tidak dicatat — struk tanpa nomor tidak dapat ' +
            'dipertanggungjawabkan.',
        );
        return null;
      }

      /*
       * Jatah disimpan LEBIH DAHULU, sebelum nomornya dipakai.
       *
       * Bila urutannya dibalik dan mesin mati di antara keduanya, nomor yang
       * sama akan diterbitkan lagi pada transaksi berikutnya — dan dua struk
       * bernomor sama tidak dapat diperbaiki setelah keduanya di tangan pembeli.
       */
      await tulisMeta(KUNCI_JATAH, diambil.blok);
      setBlok(diambil.blok);

      const offlineId = idLuring();
      try {
        await catat(konteks, {
          offlineId,
          grandTotal: t.grandTotal,
          itemCount: t.itemCount,
          occurredAt: new Date().toISOString(),
          receiptNumber: diambil.nomor,
          payload: t.payload,
        });
      } catch (e) {
        setGalat(pesan(e));
        return null;
      }

      await muat();
      return { receiptNumber: diambil.nomor, offlineId };
    },
    [konteks, blok, muat],
  );

  // --- Antrean pengiriman --------------------------------------------------

  const kirimAntrean = useCallback(async () => {
    if (sedangKirim.current || !daring || !diizinkan) return;
    sedangKirim.current = true;
    setMengirim(true);
    try {
      const antre = await tertunda();
      for (const c of antre) {
        if (!c.payload) {
          // Baris lama tanpa rincian tidak dapat dibukukan; ditandai supaya
          // tidak dicoba terus-menerus, dan tetap terlihat pada rekonsiliasi.
          await tandaiDitolak(
            c.offlineId,
            'Baris ini dicatat sebelum rincian transaksi disimpan, jadi tidak dapat dibukukan ' +
              'otomatis. Perlu dimasukkan manual.',
          );
          continue;
        }
        try {
          const h = await api.post<HasilKirim>('/pos/offline/sales', {
            offlineId: c.offlineId,
            outletId: c.outletId,
            terminalId: c.terminalId,
            shiftId: c.shiftId,
            businessDate: c.businessDate,
            receiptNumber: c.receiptNumber,
            occurredAt: c.occurredAt,
            currencyCode: c.payload.currencyCode,
            subtotal: c.payload.subtotal,
            taxTotal: c.payload.taxTotal,
            grandTotal: c.grandTotal,
            changeTotal: c.payload.changeTotal,
            catalogSyncedAt: c.payload.catalogSyncedAt,
            localHash: c.hash,
            lines: c.payload.lines,
            payments: c.payload.payments,
          });

          if (h.status === 'QUARANTINED') {
            /*
             * Ditahan peladen BUKAN berarti gagal terkirim.
             *
             * Transaksinya sudah sampai dan sudah tercatat di sana menunggu
             * diperiksa manusia. Membiarkannya `PENDING` akan membuat mesin
             * kasir mengirimnya berulang selamanya, dan angka antrean yang
             * tidak pernah turun membuat kasir berhenti mempercayainya.
             */
            await tandaiDitolak(c.offlineId, h.reason ?? 'Ditahan peladen untuk diperiksa.');
          } else {
            await tandaiTersinkron(c.offlineId, h.saleId ?? '');
          }
        } catch (e) {
          // Kegagalan jaringan: dibiarkan `PENDING` dan dicoba lagi nanti.
          // Yang berhenti hanyalah putaran ini, supaya transaksi berikutnya
          // tidak ikut menumpuk galat yang sama.
          setGalat(pesan(e));
          break;
        }
      }
      await muat();
    } finally {
      sedangKirim.current = false;
      if (hidup.current) setMengirim(false);
    }
  }, [daring, diizinkan, muat]);

  // Antrean dikuras otomatis begitu peladen kembali terjangkau.
  useEffect(() => {
    if (daring && diizinkan) void kirimAntrean();
  }, [daring, diizinkan, kirimAntrean]);

  // --- Keutuhan dan bukti --------------------------------------------------

  const periksaRantaiSekarang = useCallback(async () => {
    setMemeriksa(true);
    try {
      setTemuan(await periksaKeutuhan());
    } catch (e) {
      setGalat(pesan(e));
    } finally {
      if (hidup.current) setMemeriksa(false);
    }
  }, []);

  const unduhBukti = useCallback(async () => {
    const isi = await ekspor();
    const blob = new Blob([isi], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `buku-kasir-${konteks?.terminalId ?? 'register'}-${konteks?.businessDate ?? ''}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [konteks?.terminalId, konteks?.businessDate]);

  const ringkas = ringkasanAntrean(baris);

  return {
    baris,
    ...ringkas,
    blok,
    penilaianBlok,
    bolehJualLuring: diizinkan && penilaianBlok.usable && Boolean(konteks),
    temuan,
    memeriksa,
    mengirim,
    galat,
    ambilJatah,
    simpanTransaksi,
    kirimAntrean,
    periksaRantaiSekarang,
    unduhBukti,
  };
}

/**
 * Identitas transaksi luring.
 *
 * Memakai `crypto.randomUUID` bila ada. Cadangannya menggabungkan waktu dengan
 * angka acak — bukan waktu saja: dua transaksi pada milidetik yang sama akan
 * mendapat identitas yang sama, dan identitas itulah dasar seluruh idempotensi
 * pengiriman.
 */
function idLuring(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  const acak = Math.floor(Math.random() * 0xffffffff).toString(16);
  return `off-${Date.now().toString(36)}-${acak}`;
}

function pesan(e: unknown): string {
  const m = (e as { message?: string })?.message;
  return m || 'Buku besar lokal gagal diakses.';
}

// --- Meta pada basis data buku besar ---------------------------------------
//
// Jatah nomor struk disimpan bersama buku besarnya, bukan di basis data katalog:
// jatah tidak dapat dibangun ulang dari peladen tanpa risiko menerbitkan nomor
// yang sudah terpakai, sehingga ia termasuk data yang tidak tergantikan.

const NAMA_DB = 'ebisnis-pos';
const TOKO_META = 'meta';

function bukaDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NAMA_DB);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB tidak dapat dibuka'));
  });
}

async function bacaMeta<T>(key: string): Promise<T | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await bukaDb();
  try {
    if (!db.objectStoreNames.contains(TOKO_META)) return null;
    return await new Promise<T | null>((resolve, reject) => {
      const tx = db.transaction(TOKO_META, 'readonly');
      const r = tx.objectStore(TOKO_META).get(key);
      tx.oncomplete = () => resolve(((r.result as { value?: T })?.value ?? null) as T | null);
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

async function tulisMeta<T>(key: string, value: T): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await bukaDb();
  try {
    if (!db.objectStoreNames.contains(TOKO_META)) return;
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(TOKO_META, 'readwrite');
      tx.objectStore(TOKO_META).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}
