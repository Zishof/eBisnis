/**
 * Kolom dan penanda untuk layar petugas.
 *
 * Dipisahkan dari halamannya supaya keputusan tentang **apa yang ditampilkan**
 * berkumpul di satu tempat dan dapat dibaca sekaligus. Beberapa di antaranya
 * adalah keputusan yang sengaja diambil, bukan kebetulan tata letak — dan
 * keputusan itu ditulis di sini sebagai komentar, di sebelah barisnya.
 */

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Code, StatusBadge, type GridColumn } from '../../../components/ui';
import { formatDate, formatDateTime, formatMoney, formatNumber } from '../../../lib/api';
import type { BarisDaftar } from './useVillageAdmin';

type Kolom = GridColumn<BarisDaftar>;

const nilai = (r: BarisDaftar, k: string) => {
  const v = r[k];
  return v === null || v === undefined || v === '' ? null : v;
};

/** Teks apa adanya; kosong menjadi tanda hubung, bukan ruang kosong. */
export function teksKolom(key: string, header: string, className?: string): Kolom {
  return {
    key,
    header,
    className,
    render: (r) => (nilai(r, key) === null ? '—' : String(r[key])),
  };
}

/** Kode dan nomor dokumen selalu LTR, agar tidak terbalik pada tata letak RTL. */
export function kodeKolom(key: string, header: string): Kolom {
  return {
    key,
    header,
    render: (r) => (nilai(r, key) === null ? '—' : <Code>{String(r[key])}</Code>),
  };
}

export function tanggalKolom(key: string, header: string): Kolom {
  return { key, header, render: (r) => formatDate(r[key] as string | null) };
}

export function waktuKolom(key: string, header: string): Kolom {
  return { key, header, render: (r) => formatDateTime(r[key] as string | null) };
}

export function uangKolom(key: string, header: string): Kolom {
  return {
    key,
    header,
    className: 'text-end tabular-nums',
    render: (r) => (nilai(r, key) === null ? '—' : formatMoney(r[key] as string)),
  };
}

export function angkaKolom(key: string, header: string): Kolom {
  return {
    key,
    header,
    className: 'text-end tabular-nums',
    render: (r) => (nilai(r, key) === null ? '—' : formatNumber(r[key] as string)),
  };
}

/**
 * Warna status untuk istilah Indonesia.
 *
 * `StatusBadge` milik Core menebak warnanya dari daftar istilah Inggris
 * (`APPROVED`, `REJECTED`, dan seterusnya). Seluruh status village berbahasa
 * Indonesia, sehingga tanpa peta ini semuanya tampil abu-abu — dan layar yang
 * seluruh statusnya abu-abu tidak memberi tahu apa pun sekilas pandang.
 *
 * Petanya ditaruh di sini, bukan ditambahkan ke `ui.tsx`, supaya perubahan
 * istilah village tidak menyentuh berkas yang dipakai seluruh vertikal.
 */
const NADA_STATUS: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  // Selesai dengan baik
  AKTIF: 'success', DITERBITKAN: 'success', DISETUJUI: 'success', SELESAI: 'success',
  DISERAHKAN: 'success', TERKIRIM: 'success', TAYANG: 'success', TETAP: 'success',
  BEROPERASI: 'success', DITETAPKAN: 'success', TUNTAS: 'success',
  // Sedang berjalan atau menunggu orang
  DIAJUKAN: 'warning', DIPROSES: 'warning', MENUNGGU_PERSETUJUAN: 'warning',
  DIVERIFIKASI: 'warning', DITERIMA: 'warning', DITINDAKLANJUTI: 'warning',
  BERKAS_KURANG: 'warning', DIRENCANAKAN: 'warning', SEDANG_DINILAI: 'warning',
  TANGGAP_DARURAT: 'warning', DIPINJAM: 'warning',
  // Berhenti tanpa hasil
  DITOLAK: 'danger', DIBATALKAN: 'danger', TIDAK_AKTIF: 'danger', GAGAL: 'danger',
  DICABUT: 'danger', BUBAR: 'danger', KEDALUWARSA: 'danger', TERLAMBAT: 'danger',
  // Perlu diurus orang, bukan dicoba ulang mesin
  TERHALANG: 'info', DRAF: 'neutral', BARU: 'info', DILAPORKAN: 'info',
};

export function nadaStatus(status: string) {
  return NADA_STATUS[status?.toUpperCase?.() ?? ''] ?? 'neutral';
}

export function statusKolom(key: string, header = 'Status'): Kolom {
  return {
    key,
    header,
    render: (r) => {
      const s = String(r[key] ?? '');
      if (!s) return '—';
      // Garis bawah diganti spasi agar terbaca; nilainya sendiri tidak diubah.
      return <StatusBadge status={s.replace(/_/g, ' ')} tone={nadaStatus(s)} />;
    },
  };
}

export function yaTidakKolom(key: string, header: string, ya = 'Ya', tidak = 'Tidak'): Kolom {
  return {
    key,
    header,
    render: (r) => (r[key] === true || r[key] === 'true' ? ya : tidak),
  };
}

/**
 * Nama yang boleh kosong karena pemiliknya memilih tidak ditampilkan.
 *
 * Perbedaannya dengan "tidak ada nama" penting: pada pengaduan dan aspirasi,
 * kolom kosong berarti pelapor **memilih** namanya tidak muncul, bukan bahwa
 * datanya hilang. Menampilkan tanda hubung membuat petugas mengira datanya
 * rusak lalu mencarinya di tempat lain.
 */
export function namaPelaporKolom(header = 'Pelapor'): Kolom {
  return {
    key: 'reporter_name',
    header,
    render: (r) =>
      nilai(r, 'reporter_name') === null ? (
        <span className="text-xs italic text-slate-500 dark:text-slate-400">
          nama tidak ditampilkan
        </span>
      ) : (
        String(r.reporter_name)
      ),
  };
}

/** Jumlah yang boleh nol; nol ditulis nol, bukan tanda hubung. */
export function cacahKolom(key: string, header: string, satuan?: string): Kolom {
  return {
    key,
    header,
    className: 'text-end tabular-nums',
    render: (r) => {
      const n = Number(r[key] ?? 0);
      return Number.isFinite(n) ? `${n}${satuan ? ` ${satuan}` : ''}` : '—';
    },
  };
}

/** Dua nilai berdampingan: yang besar di atas, keterangannya di bawah. */
export function bertumpuk(
  key: string,
  header: string,
  atas: (r: BarisDaftar) => ReactNode,
  bawah: (r: BarisDaftar) => ReactNode,
): Kolom {
  return {
    key,
    header,
    render: (r) => (
      <div>
        <div className="text-sm text-slate-900 dark:text-slate-100">{atas(r)}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">{bawah(r)}</div>
      </div>
    ),
  };
}

/**
 * Kolom yang membuka rincian.
 *
 * Nomor dokumen dipakai sebagai tautannya, bukan tombol "buka" tersendiri.
 * Nomor itu yang dicari petugas ketika warga menyebutkannya lewat telepon, dan
 * kolom tambahan hanya memakan lebar tanpa menambah apa pun.
 */
export function tautanKolom(key: string, header: string, ke: (id: string) => string): Kolom {
  return {
    key,
    header,
    render: (r) => {
      const isi = nilai(r, key);
      if (isi === null) return '—';
      return (
        <Link
          to={ke(String(r.id))}
          className="font-medium text-brand-700 hover:underline dark:text-brand-300"
        >
          <Code>{String(isi)}</Code>
        </Link>
      );
    },
  };
}

/** RT/RW sebagai satu kolom. Dua kolom terpisah memakan lebar tanpa guna. */
export function rtRwKolom(header = 'RT/RW'): Kolom {
  return {
    key: 'rt_number',
    header,
    render: (r) => {
      const rt = nilai(r, 'rt_number');
      const rw = nilai(r, 'rw_number');
      if (rt === null && rw === null) return '—';
      return <Code>{`${rt ?? '—'}/${rw ?? '—'}`}</Code>;
    },
  };
}
