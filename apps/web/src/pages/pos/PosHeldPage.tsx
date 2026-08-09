/**
 * Layar transaksi ditahan.
 *
 * ## Mengapa layar ini ada
 *
 * Menu "Transaksi Ditahan" sudah lama menunjuk `/app/pos/ditahan`, dan rute itu
 * tidak pernah ada. Kasir yang menahan keranjang — karena pembeli pergi
 * mengambil satu barang lagi, atau karena antrean di belakangnya sudah panjang —
 * tidak punya jalan mengambilnya kembali selain mengingat nomor struknya.
 *
 * Keranjang yang tidak ditemukan tidak menghasilkan galat apa pun. Ia berakhir
 * sebagai pemindaian ulang seluruh barang di depan antrean yang sama.
 *
 * ## Yang ditampilkan
 *
 * Daftarnya diurutkan peladen: milik mesin yang sedang dipakai lebih dahulu,
 * lalu yang paling baru ditahan. Urutan itu bukan kenyamanan — keranjang yang
 * paling mungkin dicari adalah yang baru saja ditahan pada mesin yang sama.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Play, RefreshCw, Search } from 'lucide-react';
import { api, formatMoney } from '../../lib/api';
import {
  Code,
  DataGrid,
  PageHeader,
  StatusBadge,
  useToast,
  type GridColumn,
} from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';

interface BarisTertahan extends Record<string, unknown> {
  id: string;
  receiptNumber: string;
  businessDate: string;
  heldAt: string | null;
  outletId: string;
  outletName: string | null;
  terminalId: string | null;
  terminalName: string | null;
  customerName: string | null;
  currencyCode: string;
  grandTotal: string;
  itemCount: number;
  dariMesinIni: boolean;
}

/** Jam:menit setempat. Tanggalnya sudah ada pada kolom tersendiri. */
function jam(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

export function PosHeldPage() {
  const toast = useToast();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const toMessage = useErrorMessage();
  const [kunci, setKunci] = useState('');
  const [kunciAktif, setKunciAktif] = useState('');

  const daftar = useQuery({
    queryKey: ['pos', 'held', kunciAktif],
    queryFn: () =>
      api.get<BarisTertahan[]>(
        `/pos/held${kunciAktif ? `?q=${encodeURIComponent(kunciAktif)}` : ''}`,
      ),
  });

  const lanjutkan = useMutation({
    mutationFn: (id: string) => api.post(`/pos/sales/${id}/resume`, {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pos', 'held'] });
      /*
       * Langsung ke layar kasir sesudah dilanjutkan.
       *
       * Melanjutkan keranjang lalu meninggalkan kasir di halaman daftar berarti
       * ia harus menekan sekali lagi untuk sampai ke tempat barang dipindai —
       * dan pembeli sudah berdiri di depan meja.
       */
      navigate('/app/pos/kasir');
    },
    onError: (e) =>
      toast.push(
        toMessage(e, (_k, f) => f ?? 'Keranjang tidak dapat dilanjutkan.'),
        'error',
      ),
  });

  const kolom: Array<GridColumn<BarisTertahan>> = [
    {
      key: 'receiptNumber',
      header: 'Nomor',
      render: (r) => (
        <div className="flex items-center gap-2">
          <Code>{r.receiptNumber}</Code>
          {/*
            * Badge mesin sendiri. Gerai dengan beberapa terminal menahan
            * keranjang di mesin yang berbeda-beda, dan tanpa tanda ini kasir
            * membaca seluruh daftar satu per satu.
            */}
          {r.dariMesinIni && <StatusBadge status="Mesin ini" tone="info" />}
        </div>
      ),
    },
    {
      key: 'customerName',
      header: 'Pelanggan',
      render: (r) => r.customerName ?? <span className="text-slate-400">Umum</span>,
    },
    {
      key: 'itemCount',
      header: 'Barang',
      className: 'text-end',
      render: (r) => `${r.itemCount}`,
    },
    {
      key: 'grandTotal',
      header: 'Total',
      className: 'text-end',
      render: (r) => (
        <span className="font-semibold">
          {formatMoney(Number(r.grandTotal), r.currencyCode)}
        </span>
      ),
    },
    {
      key: 'terminalName',
      header: 'Mesin',
      render: (r) => r.terminalName ?? <span className="text-slate-400">—</span>,
    },
    {
      key: 'heldAt',
      header: 'Ditahan',
      render: (r) => (
        <span title={r.heldAt ?? ''}>
          {r.businessDate} · {jam(r.heldAt)}
        </span>
      ),
    },
    {
      key: 'aksi',
      header: '',
      className: 'text-end',
      render: (r) => (
        <button
          type="button"
          className="btn-primary btn-sm inline-flex items-center gap-1"
          disabled={lanjutkan.isPending}
          onClick={() => lanjutkan.mutate(r.id)}
        >
          <Play className="h-3.5 w-3.5" aria-hidden />
          Lanjutkan
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transaksi Ditahan"
        description="Keranjang yang ditahan kasir dan belum dibayar. Milik mesin ini tampil lebih dahulu."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <input
            className="field-input w-72 ps-9"
            placeholder="Cari nomor struk atau nama pelanggan"
            value={kunci}
            onChange={(e) => setKunci(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setKunciAktif(kunci.trim());
            }}
            aria-label="Cari transaksi ditahan"
          />
        </div>
        <button type="button" className="btn-secondary" onClick={() => setKunciAktif(kunci.trim())}>
          Cari
        </button>
        {kunciAktif && (
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setKunci('');
              setKunciAktif('');
            }}
          >
            Bersihkan
          </button>
        )}
        <button
          type="button"
          className="btn-ghost ms-auto inline-flex items-center gap-1"
          onClick={() => void daftar.refetch()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden />
          Muat ulang
        </button>
      </div>

      <DataGrid
        columns={kolom}
        rows={daftar.data ?? []}
        loading={daftar.isLoading}
        error={
          daftar.isError
            ? toMessage(daftar.error, (_k, f) => f ?? 'Gagal memuat transaksi ditahan.')
            : undefined
        }
        rowKey={(row) => row.id}
        onRetry={() => void daftar.refetch()}
        emptyTitle={
          kunciAktif
            ? `Tidak ada transaksi ditahan yang cocok dengan "${kunciAktif}".`
            : 'Tidak ada transaksi yang sedang ditahan.'
        }
      />
    </div>
  );
}
