/**
 * Seluruh rute vertikal koperasi, dalam satu berkas.
 *
 * Dikemas begini dengan sengaja. `App.tsx` adalah berkas bersama yang juga
 * disunting sesi lain; menambahkan sepuluh rute di sana berarti sepuluh baris
 * yang berpotensi bentrok saat digabungkan. Dengan bentuk ini, jejaknya di
 * berkas bersama tinggal satu impor dan satu baris rute — sama seperti yang
 * dilakukan pada `app.module.ts` di sisi peladen (panduan koordinasi §3).
 */

import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { RequireAuth } from '../../app/RequireAuth';

const PortalLayout = lazy(() =>
  import('./PortalLayout').then((m) => ({ default: m.PortalLayout })),
);
const PortalRingkasan = lazy(() =>
  import('./PortalRingkasan').then((m) => ({ default: m.PortalRingkasan })),
);
const PortalSimpanan = lazy(() =>
  import('./PortalSimpanan').then((m) => ({ default: m.PortalSimpanan })),
);
const PortalPinjaman = lazy(() =>
  import('./PortalPinjaman').then((m) => ({ default: m.PortalPinjaman })),
);
const PortalShu = lazy(() => import('./PortalShu').then((m) => ({ default: m.PortalShu })));
const PortalRat = lazy(() => import('./PortalRat').then((m) => ({ default: m.PortalRat })));
const PortalPengaduan = lazy(() =>
  import('./PortalPengaduan').then((m) => ({ default: m.PortalPengaduan })),
);
const PortalPemberitahuan = lazy(() =>
  import('./PortalPemberitahuan').then((m) => ({ default: m.PortalPemberitahuan })),
);
const DataContohPage = lazy(() =>
  import('./DataContohPage').then((m) => ({ default: m.DataContohPage })),
);
const SitusKoperasi = lazy(() =>
  import('./SitusKoperasi').then((m) => ({ default: m.SitusKoperasi })),
);

function Memuat() {
  return <div className="p-8 text-center text-sm text-slate-500">Memuat…</div>;
}

export function CooperativeRoutes() {
  return (
    <Suspense fallback={<Memuat />}>
      <Routes>
        {/*
          Portal anggota selalu berada di balik RequireAuth. Anggota memang
          selalu masuk lebih dahulu, sehingga skema penyewanya datang dari sesi
          dan tidak perlu — dan tidak boleh — diambil dari alamat.
        */}
        <Route
          path="portal"
          element={
            <RequireAuth>
              <PortalLayout />
            </RequireAuth>
          }
        >
          <Route index element={<PortalRingkasan />} />
          <Route path="simpanan" element={<PortalSimpanan />} />
          <Route path="pinjaman" element={<PortalPinjaman />} />
          <Route path="shu" element={<PortalShu />} />
          <Route path="rat" element={<PortalRat />} />
          <Route path="pengaduan" element={<PortalPengaduan />} />
          <Route path="pemberitahuan" element={<PortalPemberitahuan />} />
        </Route>

        {/*
          Situs koperasi. Rutenya sudah ada, tetapi jalur publiknya belum —
          pengunjung tanpa sesi tidak membawa konteks penyewa, dan menerima
          nama skema dari alamat adalah hal yang dilarang tegas. Menunggu
          IR-005; sampai saat itu layar ini menjelaskan keadaannya alih-alih
          berpura-pura bekerja.
        */}
        {/*
          Data contoh — dua tombol. Di balik RequireAuth: memasang 1.700 baris
          dan menghapusnya kembali bukan sesuatu yang boleh dilakukan pengunjung.
        */}
        <Route
          path="data-contoh"
          element={
            <RequireAuth>
              <DataContohPage />
            </RequireAuth>
          }
        />

        <Route path="situs/:slug" element={<SitusKoperasi />} />
        <Route path="*" element={<Memuat />} />
      </Routes>
    </Suspense>
  );
}
