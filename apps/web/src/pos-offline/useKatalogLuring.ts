/**
 * Kait React yang menjaga salinan katalog di mesin kasir.
 *
 * Aturan kesegaran ada di `katalog.ts` dan penyimpanannya di `katalog-store.ts`;
 * berkas ini hanya memutuskan **kapan menyalin** dan menyediakan pencarian
 * lokal bagi layar kasir.
 *
 * Kapan disalin:
 *
 * - saat layar kasir pertama dibuka dan belum ada salinan sama sekali;
 * - saat peladen terjangkau lagi sementara salinan sudah mulai menua.
 *
 * Yang sengaja **tidak** dilakukan: menyalin berulang-ulang selama jam sibuk.
 * Katalog beberapa ribu produk bukan permintaan yang ringan, dan mesin kasir
 * yang sibuk melayani antrean tidak boleh diperlambat demi menyegarkan data
 * yang belum tentu berubah.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../lib/api';
import {
  cariBarcode,
  cariProduk,
  nilaiKesegaran,
  siapLuring,
  type PenilaianKatalog,
  type ProdukLokal,
} from './katalog';
import {
  JENIS_DALAM_SALINAN,
  bacaSalinan,
  indexedDbTersedia,
  pastikanPermanen,
  simpanSalinan,
  type MetodeLokal,
  type SalinanKatalog,
  type TarifLokal,
} from './katalog-store';

/** Bentuk jawaban `/pos/catalog/snapshot`. */
interface SnapshotApi {
  generatedAt: string;
  currency: string;
  timezone: string;
  productCount: number;
  productTotal: number;
  truncated: boolean;
  products: Array<{
    productId: string;
    code: string;
    name: string;
    sku: string | null;
    uomId: string;
    defaultSalePrice: string | null;
    barcodes: string[];
  }>;
  taxRates: TarifLokal[];
  paymentMethods: MetodeLokal[];
}

export interface HasilKatalogLuring {
  salinan: SalinanKatalog | null;
  penilaian: PenilaianKatalog[];
  siap: boolean;
  penghalang: PenilaianKatalog[];
  peringatan: PenilaianKatalog[];
  menyalin: boolean;
  galat: string | null;
  salinSekarang: () => void;
  cariLokal: (kunci: string) => ProdukLokal[];
  barcodeLokal: (kode: string) => ProdukLokal | null;
}

export function useKatalogLuring(opsi: {
  tenantId: string | null;
  /** Peladen sedang terjangkau. Menyalin hanya masuk akal bila benar. */
  daring: boolean;
  /** Layar kasir sedang dipakai. Salinan tidak diambil di layar lain. */
  aktif: boolean;
}): HasilKatalogLuring {
  const { tenantId, daring, aktif } = opsi;

  const [salinan, setSalinan] = useState<SalinanKatalog | null>(null);
  const [menyalin, setMenyalin] = useState(false);
  const [galat, setGalat] = useState<string | null>(null);
  const sedangJalan = useRef(false);
  const hidup = useRef(true);

  useEffect(() => {
    hidup.current = true;
    return () => {
      hidup.current = false;
    };
  }, []);

  // Salinan yang sudah ada dibaca lebih dahulu, sebelum menyentuh jaringan.
  // Mesin kasir yang dinyalakan saat peladen mati harus langsung punya katalog,
  // bukan menunggu satu permintaan gagal dulu.
  useEffect(() => {
    if (!tenantId || !aktif || !indexedDbTersedia()) return;
    let batal = false;
    void (async () => {
      try {
        const isi = await bacaSalinan(tenantId);
        if (!batal && hidup.current) setSalinan(isi);
      } catch (e) {
        if (!batal && hidup.current) setGalat(pesan(e));
      }
    })();
    return () => {
      batal = true;
    };
  }, [tenantId, aktif]);

  const salin = useCallback(async () => {
    if (!tenantId || sedangJalan.current || !indexedDbTersedia()) return;
    sedangJalan.current = true;
    setMenyalin(true);
    setGalat(null);
    try {
      const snap = await api.get<SnapshotApi>('/pos/catalog/snapshot');
      const isi: SalinanKatalog = {
        tenantId,
        syncedAt: Date.now(),
        generatedAt: snap.generatedAt,
        currency: snap.currency,
        timezone: snap.timezone,
        productTotal: snap.productTotal,
        truncated: snap.truncated,
        produk: snap.products.map((p) => ({
          productId: p.productId,
          code: p.code,
          name: p.name,
          sku: p.sku,
          uomId: p.uomId,
          price: p.defaultSalePrice,
          currencyCode: snap.currency,
          barcodes: p.barcodes ?? [],
        })),
        taxRates: snap.taxRates ?? [],
        paymentMethods: snap.paymentMethods ?? [],
      };
      await simpanSalinan(isi);
      void pastikanPermanen();
      if (hidup.current) setSalinan(isi);
    } catch (e) {
      if (hidup.current) setGalat(pesan(e));
    } finally {
      sedangJalan.current = false;
      if (hidup.current) setMenyalin(false);
    }
  }, [tenantId]);

  const penilaian = useMemo(
    () =>
      JENIS_DALAM_SALINAN.map((jenis) =>
        nilaiKesegaran({ jenis, syncedAt: salinan?.syncedAt ?? null, now: Date.now() }),
      ),
    [salinan],
  );

  const kesiapan = useMemo(() => siapLuring(penilaian), [penilaian]);

  // Penyalinan otomatis: hanya saat peladen terjangkau, dan hanya bila salinan
  // memang perlu — belum ada, atau sudah menua.
  const perluSalin = !salinan || !kesiapan.ready || kesiapan.warnings.length > 0;
  useEffect(() => {
    if (!aktif || !daring || !tenantId || !perluSalin) return;
    void salin();
  }, [aktif, daring, tenantId, perluSalin, salin]);

  const produk = salinan?.produk ?? EMPTY;

  return {
    salinan,
    penilaian,
    siap: kesiapan.ready,
    penghalang: kesiapan.blockers,
    peringatan: kesiapan.warnings,
    menyalin,
    galat,
    salinSekarang: () => void salin(),
    cariLokal: (kunci: string) => cariProduk(produk, kunci),
    barcodeLokal: (kode: string) => cariBarcode(produk, kode),
  };
}

/** Rujukan tetap supaya `cariLokal` tidak berubah identitasnya tiap render. */
const EMPTY: ProdukLokal[] = [];

function pesan(e: unknown): string {
  const m = (e as { message?: string })?.message;
  return m || 'Katalog luring gagal disalin.';
}
