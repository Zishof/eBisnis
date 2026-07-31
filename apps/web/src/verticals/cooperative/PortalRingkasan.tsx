/**
 * Layar pertama portal anggota.
 *
 * Yang ditampilkan adalah tiga angka yang paling sering dicari anggota —
 * berapa simpanan saya, berapa sisa pinjaman saya, berapa SHU saya — dan
 * angsuran berikutnya bila ada. Selebihnya menunggu diklik.
 */

import { Link, useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarClock } from 'lucide-react';
import { portalApi, type RingkasanPortal } from './portal-api';
import { formatRupiah, formatTanggal } from './portal-menu';

function Kartu({
  judul,
  nilai,
  keterangan,
  ke,
  warna,
}: {
  judul: string;
  nilai: string;
  keterangan: string;
  ke: string;
  warna: string;
}) {
  return (
    <Link
      to={ke}
      className="group rounded-xl border border-slate-200 bg-white p-4 transition hover:border-emerald-400 dark:border-slate-800 dark:bg-slate-900"
    >
      <p className="text-xs uppercase tracking-wide text-slate-500">{judul}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${warna}`}>{nilai}</p>
      <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
        {keterangan}
        <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" aria-hidden />
      </p>
    </Link>
  );
}

export function PortalRingkasan() {
  const ringkasan = useOutletContext<RingkasanPortal>();

  const { data: pinjaman } = useQuery({
    queryKey: ['cooperative', 'portal', 'loans'],
    queryFn: portalApi.pinjaman,
    retry: false,
  });

  const pinjamanAktif = (pinjaman ?? []).find((p) => ['ACTIVE', 'OVERDUE'].includes(p.status));

  const { data: jadwal } = useQuery({
    queryKey: ['cooperative', 'portal', 'schedule', pinjamanAktif?.id],
    queryFn: () => portalApi.jadwal(pinjamanAktif!.id),
    enabled: Boolean(pinjamanAktif),
    retry: false,
  });

  const berikutnya = (jadwal ?? []).find((b) => b.status !== 'PAID');

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kartu
          judul="Simpanan Saya"
          nilai={formatRupiah(ringkasan.totalSimpanan)}
          keterangan={`${ringkasan.jumlahRekening} rekening aktif`}
          ke="simpanan"
          warna="text-emerald-600"
        />
        <Kartu
          judul="Sisa Pinjaman"
          nilai={formatRupiah(ringkasan.sisaPinjaman)}
          keterangan={`${ringkasan.jumlahPinjaman} pinjaman berjalan`}
          ke="pinjaman"
          warna={Number(ringkasan.sisaPinjaman) > 0 ? 'text-amber-600' : 'text-slate-500'}
        />
        <Kartu
          judul="SHU Diterima"
          nilai={formatRupiah(ringkasan.totalShu)}
          keterangan="seluruh tahun buku"
          ke="shu"
          warna="text-sky-600"
        />
      </div>

      {berikutnya && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
          <div className="flex items-start gap-3">
            <CalendarClock className="mt-0.5 h-5 w-5 text-amber-600" aria-hidden />
            <div className="min-w-0">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
                Angsuran ke-{berikutnya.installment_no} jatuh tempo{' '}
                {formatTanggal(berikutnya.due_date)}
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-300">
                {formatRupiah(berikutnya.total_amount)} — pokok{' '}
                {formatRupiah(berikutnya.principal_amount)}, jasa{' '}
                {formatRupiah(berikutnya.interest_amount)}
              </p>
              <Link
                to="pinjaman"
                className="mt-2 inline-block text-sm font-medium text-amber-900 underline dark:text-amber-200"
              >
                Lihat jadwal lengkap
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link
          to="pemberitahuan"
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-sm font-medium">Pemberitahuan</p>
          <p className="mt-1 text-sm text-slate-500">
            {ringkasan.pemberitahuanBelumDibaca > 0
              ? `${ringkasan.pemberitahuanBelumDibaca} belum dibaca`
              : 'Tidak ada yang baru'}
          </p>
        </Link>
        <Link
          to="pengaduan"
          className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
        >
          <p className="text-sm font-medium">Pengaduan</p>
          <p className="mt-1 text-sm text-slate-500">
            {ringkasan.pengaduanTerbuka > 0
              ? `${ringkasan.pengaduanTerbuka} sedang berjalan`
              : 'Ajukan bila ada keberatan'}
          </p>
        </Link>
      </div>
    </div>
  );
}
