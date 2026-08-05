/**
 * Halaman solusi/fitur mitrainap.id -- rincian per modul yang sedang dibangun.
 *
 * MI-2 secara harfiah meminta "seluruh section BRD/UI" (100+ layar). Itu
 * tidak realistis dibangun sekaligus sebagai halaman statis yang jujur --
 * modul yang belum ada backend-nya tidak boleh diberi halaman fitur yang
 * terdengar seolah sudah berfungsi. Halaman ini memuat rincian modul yang
 * BENAR-BENAR direncanakan (BRD §modul), ditandai tahap, bukan salinan
 * pemasaran generik.
 */

import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BedDouble,
  Building2,
  CalendarRange,
  ClipboardList,
  Globe2,
  Layers,
  ReceiptText,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Wrench,
} from 'lucide-react';

interface RincianModul {
  ikon: typeof BedDouble;
  judul: string;
  keterangan: string;
  cakupan: string[];
}

const RINCIAN: RincianModul[] = [
  {
    ikon: Building2,
    judul: 'Property Foundation',
    keterangan: 'Struktur dasar properti -- portofolio, bangunan, lantai, zona, tipe kamar.',
    cakupan: ['Portofolio dan brand', 'Building/floor/zone', 'Room type dan room', 'Business date per properti'],
  },
  {
    ikon: BedDouble,
    judul: 'Room Inventory dan Availability',
    keterangan: 'Ketersediaan kamar per tanggal, status OOO/OOS, dan kebijakan alotmen.',
    cakupan: ['Status kamar real-time', 'Ledger ketersediaan per stay date', 'Kebijakan overbooking', 'Fitur dan aksesibilitas kamar'],
  },
  {
    ikon: UsersRound,
    judul: 'Guest CRM',
    keterangan: 'Profil tamu tunggal lintas kunjungan, preferensi, dan consent.',
    cakupan: ['Identitas dan kontak tamu', 'Preferensi dan riwayat menginap', 'Consent dan privasi', 'Deteksi duplikat'],
  },
  {
    ikon: CalendarRange,
    judul: 'Reservasi dan CRS',
    keterangan: 'Siklus reservasi penuh -- individu, grup, korporat, alotmen.',
    cakupan: ['Hold/confirm/modify/cancel', 'Multi-kamar dan multi-tamu', 'Waitlist dan walk-in', 'Snapshot harga dan restriksi'],
  },
  {
    ikon: Globe2,
    judul: 'Booking Engine Langsung',
    keterangan: 'Situs pemesanan resmi properti sendiri, tanpa komisi OTA.',
    cakupan: ['Pencarian dan hasil transparan', 'Validasi rate dan ketersediaan real-time', 'Orkestrasi pembayaran', 'Kelola pemesanan mandiri'],
  },
  {
    ikon: Layers,
    judul: 'Rate dan Revenue Management',
    keterangan: 'Rate plan, restriksi, dan kalender harga yang terkendali.',
    cakupan: ['BAR dan derived rate', 'MinLOS/MaxLOS/CTA/CTD', 'Kalender rate', 'Persetujuan sebelum publikasi'],
  },
  {
    ikon: ClipboardList,
    judul: 'Front Office dan Housekeeping',
    keterangan: 'Check-in, check-out, room move, dan status kebersihan kamar.',
    cakupan: ['Check-in/check-out', 'Room move', 'Status housekeeping', 'Linen, laundry, minibar'],
  },
  {
    ikon: ReceiptText,
    judul: 'Folio, Kasir, dan Night Audit',
    keterangan: 'Tagihan tamu, kasir, deposit, dan tutup buku malam yang tertelusur.',
    cakupan: ['Folio dan split billing', 'Deposit dan city ledger', 'Night audit', 'Integrasi akuntansi eBisnis.id'],
  },
  {
    ikon: Wrench,
    judul: 'Maintenance dan Asset',
    keterangan: 'Perawatan, engineering, dan status out-of-order/out-of-service.',
    cakupan: ['Work order perawatan', 'OOO/OOS kamar dan fasilitas', 'Riwayat aset properti'],
  },
  {
    ikon: ShieldCheck,
    judul: 'Keamanan dan Kepatuhan',
    keterangan: 'Data tamu, pembayaran, dan audit trail ditangani sesuai batas yang ketat.',
    cakupan: ['Tidak menyimpan nomor kartu/CVV penuh', 'Audit trail transaksi terposting', 'Kontrol akses berbasis peran per properti'],
  },
];

export function MitrainapSolusiPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800 dark:bg-violet-900/40 dark:text-violet-300">
        <Sparkles className="h-3.5 w-3.5" />
        Peta modul
      </span>
      <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
        Cakupan modul MitraInap.id
      </h1>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-slate-400">
        Dibangun bertahap, modul demi modul, dengan pengujian dan verifikasi
        nyata pada setiap tahap -- bukan sekadar rancangan di atas kertas.
        Halaman ini menjelaskan cakupan yang direncanakan, bukan daftar fitur
        yang sudah aktif untuk pelanggan hari ini.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {RINCIAN.map((m) => (
          <div key={m.judul} className="rounded-xl border border-slate-200 p-6 dark:border-slate-800">
            <m.ikon className="h-7 w-7 text-violet-700 dark:text-violet-400" />
            <h2 className="mt-3 text-base font-semibold text-slate-900 dark:text-white">{m.judul}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{m.keterangan}</p>
            <ul className="mt-3 space-y-1.5">
              {m.cakupan.map((c) => (
                <li key={c} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-violet-500" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-xl border border-violet-200 bg-violet-50 p-6 dark:border-violet-900 dark:bg-violet-950/20">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Punya kebutuhan properti yang spesifik? Sampaikan kepada kami --
          kami akan menjelaskan modul mana yang relevan dan kapan tersedia.
        </p>
        <Link
          to="/kontak"
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-800"
        >
          Hubungi Kami
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
