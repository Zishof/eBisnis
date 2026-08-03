import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { api, formatDate, formatMoney } from '../../../lib/api';
import { DataGrid, PageHeader, Pagination, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface ItemTagihan {
  id: string;
  kode: string;
  deskripsi: string;
  jumlah: string;
}

interface Pembayaran {
  id: string;
  jumlah_bayar: string;
  metode: string;
  tanggal_bayar: string;
  catatan: string | null;
  created_at: string;
}

interface TagihanRow extends Record<string, unknown> {
  id: string;
  santri_id: string;
  periode: string;
  status: string;
  jatuh_tempo: string;
  total_tagihan: string;
  catatan: string | null;
  diterbitkan_pada: string | null;
  created_at: string;
  items?: ItemTagihan[];
  pembayaran?: Pembayaran[];
}

interface SantriRingkas {
  id: string;
  nis: string;
  nama_lengkap: string;
}

interface ItemForm {
  kode: string;
  deskripsi: string;
  jumlah: string;
}

const STATUS_TAGIHAN = ['DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOID'];
const METODE_PEMBAYARAN = ['TUNAI', 'TRANSFER', 'ESMARTLINK'];
const PAGE_SIZE = 25;
const ITEM_KOSONG: ItemForm = { kode: '', deskripsi: '', jumlah: '' };

/**
 * Tagihan dan pembayaran SPP (EP-F). Backend sudah lengkap sejak awal --
 * halaman ini yang sebelumnya belum ada (dashboard pondok sudah punya kartu
 * "Buka Tagihan SPP" yang sebelumnya mengarah ke rute kosong).
 *
 * Status TIDAK PERNAH dipilih manual di sini -- server yang menghitung ulang
 * dari total pembayaran vs. total tagihan setiap kali `bayar()` dipanggil
 * (lihat `PesantrenTagihanService`), formulir di sini hanya mengirim jumlah
 * yang dibayarkan.
 */
export function PesantrenTagihanPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [santriId, setSantriId] = useState('');
  const [membuat, setMembuat] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [formBuat, setFormBuat] = useState({ santriId: '', periode: '', jatuhTempo: '', catatan: '' });
  const [items, setItems] = useState<ItemForm[]>([{ ...ITEM_KOSONG }]);

  const santriAktif = useQuery({
    queryKey: ['pesantren-santri-aktif-ringkas'],
    queryFn: () =>
      api.get<{ items: SantriRingkas[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=200'),
  });
  const santriById = new Map((santriAktif.data?.items ?? []).map((s) => [s.id, s]));

  const queryKey = ['pesantren-tagihan', page, status, santriId];
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (status) params.set('status', status);
      if (santriId) params.set('santriId', santriId);
      return api.get<{ items: TagihanRow[]; total: number }>(`/pesantren/tagihan?${params.toString()}`);
    },
  });

  const totalPreview = items.reduce((acc, it) => acc + (Number(it.jumlah) || 0), 0);

  const buat = useMutation({
    mutationFn: () =>
      api.post<TagihanRow>('/pesantren/tagihan', {
        santriId: formBuat.santriId,
        periode: formBuat.periode,
        jatuhTempo: formBuat.jatuhTempo,
        catatan: formBuat.catatan || undefined,
        items: items
          .filter((it) => it.kode && it.deskripsi && it.jumlah)
          .map((it) => ({ kode: it.kode, deskripsi: it.deskripsi, jumlah: Number(it.jumlah) })),
      }),
    onSuccess: () => {
      toast.push('Tagihan berhasil dibuat (DRAFT).', 'success');
      setMembuat(false);
      setFormBuat({ santriId: '', periode: '', jatuhTempo: '', catatan: '' });
      setItems([{ ...ITEM_KOSONG }]);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-tagihan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membuat tagihan.'), 'error'),
  });

  const kolom: Array<GridColumn<TagihanRow>> = [
    {
      key: 'santri_id',
      header: 'Santri',
      render: (row) => {
        const s = santriById.get(row.santri_id);
        return s ? `${s.nis} — ${s.nama_lengkap}` : row.santri_id;
      },
    },
    { key: 'periode', header: 'Periode' },
    { key: 'jatuh_tempo', header: 'Jatuh Tempo', render: (row) => formatDate(row.jatuh_tempo) },
    { key: 'total_tagihan', header: 'Total', render: (row) => formatMoney(row.total_tagihan) },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'aksi',
      header: '',
      render: (row) => (
        <button type="button" className="btn-outline" onClick={() => setDetailId(row.id)}>
          Detail
        </button>
      ),
    },
  ];

  const total = list.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHeader
        title="Tagihan SPP"
        description="Tagihan bulanan, penerbitan, dan pencatatan pembayaran santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Tagihan SPP' }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setMembuat(true)}>
            <Plus className="h-4 w-4" aria-hidden />
            Buat Tagihan
          </button>
        }
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px]">
            <label className="field-label" htmlFor="tagihan-status">
              Status
            </label>
            <select
              id="tagihan-status"
              className="field-input"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua</option>
              {STATUS_TAGIHAN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="field-label" htmlFor="tagihan-santri">
              Santri
            </label>
            <select
              id="tagihan-santri"
              className="field-input"
              value={santriId}
              onChange={(e) => {
                setSantriId(e.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua santri aktif</option>
              {(santriAktif.data?.items ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nis} — {s.nama_lengkap}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <DataGrid
        columns={kolom}
        rows={list.data?.items ?? []}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
        emptyTitle="Belum ada tagihan."
      />

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {membuat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-xl overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Buat Tagihan</h2>

            <div className="mt-4 space-y-3">
              <Field label="Santri *">
                <select className="field-input" value={formBuat.santriId} onChange={(e) => setFormBuat({ ...formBuat, santriId: e.target.value })}>
                  <option value="">— Pilih santri aktif —</option>
                  {(santriAktif.data?.items ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nis} — {s.nama_lengkap}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Periode * (YYYY-MM)">
                  <input
                    type="month"
                    className="field-input"
                    value={formBuat.periode}
                    onChange={(e) => setFormBuat({ ...formBuat, periode: e.target.value })}
                  />
                </Field>
                <Field label="Jatuh Tempo *">
                  <input
                    type="date"
                    className="field-input"
                    value={formBuat.jatuhTempo}
                    onChange={(e) => setFormBuat({ ...formBuat, jatuhTempo: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Catatan">
                <textarea className="field-input" rows={2} value={formBuat.catatan} onChange={(e) => setFormBuat({ ...formBuat, catatan: e.target.value })} />
              </Field>

              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Item Tagihan</h3>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="grid grid-cols-[1fr_2fr_1fr_auto] items-end gap-2">
                      <Field label="Kode">
                        <input
                          className="field-input"
                          value={it.kode}
                          onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, kode: e.target.value } : x)))}
                        />
                      </Field>
                      <Field label="Deskripsi">
                        <input
                          className="field-input"
                          value={it.deskripsi}
                          onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, deskripsi: e.target.value } : x)))}
                        />
                      </Field>
                      <Field label="Jumlah">
                        <input
                          type="number"
                          min="0"
                          className="field-input"
                          value={it.jumlah}
                          onChange={(e) => setItems((arr) => arr.map((x, j) => (j === i ? { ...x, jumlah: e.target.value } : x)))}
                        />
                      </Field>
                      <button
                        type="button"
                        className="btn-outline"
                        disabled={items.length <= 1}
                        onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn-outline mt-2" onClick={() => setItems((arr) => [...arr, { ...ITEM_KOSONG }])}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Tambah Item
                </button>
                <p className="mt-3 text-end text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Total: {formatMoney(totalPreview)}
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setMembuat(false);
                  setFormBuat({ santriId: '', periode: '', jatuhTempo: '', catatan: '' });
                  setItems([{ ...ITEM_KOSONG }]);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!formBuat.santriId || !formBuat.periode || !formBuat.jatuhTempo || totalPreview <= 0 || buat.isPending}
                onClick={() => buat.mutate()}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {detailId && <DetailTagihanModal id={detailId} santriById={santriById} onClose={() => setDetailId(null)} />}
    </>
  );
}

function DetailTagihanModal({
  id,
  santriById,
  onClose,
}: {
  id: string;
  santriById: Map<string, SantriRingkas>;
  onClose: () => void;
}) {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [formBayar, setFormBayar] = useState({ jumlahBayar: '', metode: 'TUNAI', tanggalBayar: '', catatan: '' });

  const detail = useQuery({
    queryKey: ['pesantren-tagihan-detail', id],
    queryFn: () => api.get<TagihanRow>(`/pesantren/tagihan/${id}`),
  });

  const terbitkan = useMutation({
    mutationFn: () => api.post<TagihanRow>(`/pesantren/tagihan/${id}/terbitkan`),
    onSuccess: () => {
      toast.push('Tagihan diterbitkan.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-tagihan-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-tagihan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menerbitkan.'), 'error'),
  });

  const bayar = useMutation({
    mutationFn: () =>
      api.post<TagihanRow>(`/pesantren/tagihan/${id}/bayar`, {
        jumlahBayar: Number(formBayar.jumlahBayar),
        metode: formBayar.metode,
        tanggalBayar: formBayar.tanggalBayar || undefined,
        catatan: formBayar.catatan || undefined,
      }),
    onSuccess: () => {
      toast.push('Pembayaran tercatat.', 'success');
      setFormBayar({ jumlahBayar: '', metode: 'TUNAI', tanggalBayar: '', catatan: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-tagihan-detail', id] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-tagihan'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal mencatat pembayaran.'), 'error'),
  });

  const tagihan = detail.data;
  const santri = tagihan ? santriById.get(tagihan.santri_id) : undefined;
  const bisaBayar = tagihan && ['ISSUED', 'PARTIALLY_PAID', 'OVERDUE'].includes(tagihan.status);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="card max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Detail Tagihan</h2>

        {detail.isLoading ? (
          <p className="mt-4 text-sm text-slate-500">Memuat…</p>
        ) : !tagihan ? (
          <p className="mt-4 text-sm text-rose-600">Tagihan tidak ditemukan.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="text-sm">
              <p>
                <span className="font-semibold">Santri:</span>{' '}
                {santri ? `${santri.nis} — ${santri.nama_lengkap}` : tagihan.santri_id}
              </p>
              <p>
                <span className="font-semibold">Periode:</span> {tagihan.periode}
              </p>
              <p>
                <span className="font-semibold">Status:</span> <StatusBadge status={tagihan.status} />
              </p>
              <p>
                <span className="font-semibold">Jatuh Tempo:</span> {formatDate(tagihan.jatuh_tempo)}
              </p>
              <p>
                <span className="font-semibold">Total:</span> {formatMoney(tagihan.total_tagihan)}
              </p>
            </div>

            {tagihan.items && tagihan.items.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Item</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {tagihan.items.map((it) => (
                      <tr key={it.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1">{it.deskripsi}</td>
                        <td className="py-1 text-end">{formatMoney(it.jumlah)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tagihan.pembayaran && tagihan.pembayaran.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Riwayat Pembayaran</h3>
                <table className="w-full text-sm">
                  <tbody>
                    {tagihan.pembayaran.map((p) => (
                      <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-1">{formatDate(p.tanggal_bayar)}</td>
                        <td className="py-1">{p.metode}</td>
                        <td className="py-1 text-end">{formatMoney(p.jumlah_bayar)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tagihan.status === 'DRAFT' && (
              <button type="button" className="btn-primary w-full" disabled={terbitkan.isPending} onClick={() => terbitkan.mutate()}>
                Terbitkan Tagihan
              </button>
            )}

            {bisaBayar && (
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <h3 className="mb-2 text-sm font-semibold text-slate-700 dark:text-slate-300">Catat Pembayaran</h3>
                <div className="space-y-2">
                  <Field label="Jumlah Bayar *">
                    <input
                      type="number"
                      min="0"
                      className="field-input"
                      value={formBayar.jumlahBayar}
                      onChange={(e) => setFormBayar({ ...formBayar, jumlahBayar: e.target.value })}
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Metode">
                      <select className="field-input" value={formBayar.metode} onChange={(e) => setFormBayar({ ...formBayar, metode: e.target.value })}>
                        {METODE_PEMBAYARAN.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Tanggal Bayar">
                      <input
                        type="date"
                        className="field-input"
                        value={formBayar.tanggalBayar}
                        onChange={(e) => setFormBayar({ ...formBayar, tanggalBayar: e.target.value })}
                      />
                    </Field>
                  </div>
                  <button
                    type="button"
                    className="btn-primary w-full"
                    disabled={!formBayar.jumlahBayar || bayar.isPending}
                    onClick={() => bayar.mutate()}
                  >
                    Simpan Pembayaran
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mt-6 flex justify-end">
          <button type="button" className="btn-outline" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
