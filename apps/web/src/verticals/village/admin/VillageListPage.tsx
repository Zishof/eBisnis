/**
 * Kerangka layar daftar petugas desa.
 *
 * Dua puluh layar D-3 sampai D-9 punya bentuk yang sama: judul, saringan,
 * tabel, halaman. Yang berbeda hanya kolomnya. Menulis dua puluh berkas yang
 * isinya sembilan puluh persen sama berarti dua puluh tempat yang harus
 * diperbaiki ketika satu hal keliru — dan sembilan belas di antaranya akan
 * terlewat.
 *
 * ## Yang TIDAK dilakukan berkas ini
 *
 * Ia tidak memutuskan tabel, kolom, urutan, maupun hak akses. Semua itu ada
 * pada `village-listing.ts` di peladen, dan layar ini hanya menyebut kode
 * daftar yang ia mau. Layar yang menentukan kolomnya sendiri lalu mengirim nama
 * kolom ke peladen adalah layar yang dapat diminta mengirim kolom lain.
 */

import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import {
  DataGrid,
  PageHeader,
  Pagination,
  type GridColumn,
} from '../../../components/ui';
import { useDaftarDesa, type BarisDaftar,
  usePesanGalat,
} from './useVillageAdmin';

export interface PilihanSaringan {
  kunci: string;
  label: string;
  /** Kosong berarti kotak isian bebas. */
  pilihan?: Array<{ nilai: string; label: string }>;
  bentuk?: 'teks' | 'tanggal' | 'tahun';
  lebar?: 'sempit' | 'lebar';
}

const UKURAN_HALAMAN = 50;

export function VillageListPage({
  kode,
  judul,
  uraian,
  kolom,
  saringan = [],
  aksi,
  catatan,
  kosong,
}: {
  kode: string;
  judul: string;
  uraian?: string;
  kolom: Array<GridColumn<BarisDaftar>>;
  saringan?: PilihanSaringan[];
  aksi?: ReactNode;
  /** Keterangan yang selalu tampil di bawah tabel. */
  catatan?: ReactNode;
  /** Kalimat ketika memang belum ada isinya. */
  kosong?: string;
}) {
  const { t } = useTranslation();
  const toMessage = usePesanGalat();
  const [nilai, setNilai] = useState<Record<string, string>>({});
  const [halaman, setHalaman] = useState(1);

  const kueri = useDaftarDesa(kode, nilai, {
    limit: UKURAN_HALAMAN,
    offset: (halaman - 1) * UKURAN_HALAMAN,
  });

  const totalHalaman = useMemo(
    () => Math.max(1, Math.ceil((kueri.data?.total ?? 0) / UKURAN_HALAMAN)),
    [kueri.data?.total],
  );

  const ubah = (kunci: string, v: string) => {
    setNilai((s) => ({ ...s, [kunci]: v }));
    // Halaman dikembalikan ke satu. Tanpa ini, menyaring saat berada di halaman
    // tujuh menghasilkan layar kosong meskipun hasilnya ada — pada halaman satu.
    setHalaman(1);
  };

  const diabaikan = kueri.data?.ignoredFilters ?? [];

  return (
    <div>
      <PageHeader title={judul} description={uraian} actions={aksi} />

      {saringan.length > 0 && (
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {saringan.map((s) => (
            <label key={s.kunci} className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                {s.label}
              </span>
              {s.pilihan ? (
                <select
                  className="field-input py-1.5 text-sm"
                  value={nilai[s.kunci] ?? ''}
                  onChange={(e) => ubah(s.kunci, e.target.value)}
                >
                  <option value="">{t('common.all', 'Semua')}</option>
                  {s.pilihan.map((p) => (
                    <option key={p.nilai} value={p.nilai}>
                      {p.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  className={`field-input py-1.5 text-sm ${s.lebar === 'lebar' ? 'w-64' : 'w-44'}`}
                  type={s.bentuk === 'tanggal' ? 'date' : s.bentuk === 'tahun' ? 'number' : 'search'}
                  value={nilai[s.kunci] ?? ''}
                  onChange={(e) => ubah(s.kunci, e.target.value)}
                />
              )}
            </label>
          ))}
          {Object.values(nilai).some((v) => v) && (
            <button
              type="button"
              className="btn-outline mb-0.5 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs"
              onClick={() => {
                setNilai({});
                setHalaman(1);
              }}
            >
              <RotateCcw size={14} aria-hidden />
              {t('common.reset', 'Bersihkan')}
            </button>
          )}
        </div>
      )}

      {/*
        Saringan yang diabaikan DINYATAKAN. Nilai yang salah bentuk membuat
        peladen mengembalikan daftar penuh; tanpa peringatan ini petugas
        menyimpulkan saringannya tidak berfungsi, padahal nilainya yang tidak
        terbaca.
      */}
      {diabaikan.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Saringan <strong>{diabaikan.join(', ')}</strong> tidak terbaca sehingga diabaikan.
            Daftar di bawah belum tersaring.
          </span>
        </div>
      )}

      <DataGrid<BarisDaftar>
        columns={kolom}
        rows={kueri.data?.rows ?? []}
        loading={kueri.isLoading}
        error={kueri.isError ? toMessage(kueri.error) : undefined}
        onRetry={() => kueri.refetch()}
        emptyTitle={kosong ?? 'Belum ada data'}
        rowKey={(r) => String(r.id ?? JSON.stringify(r))}
      />

      <Pagination
        page={halaman}
        totalPages={totalHalaman}
        total={kueri.data?.total ?? 0}
        onChange={setHalaman}
      />

      {catatan && (
        <p className="mt-4 max-w-3xl text-xs text-slate-500 dark:text-slate-400">{catatan}</p>
      )}
    </div>
  );
}
