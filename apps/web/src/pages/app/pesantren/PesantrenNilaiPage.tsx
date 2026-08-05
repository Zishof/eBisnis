import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, LockKeyhole, Plus, Printer, RefreshCw, RotateCcw, Save, ShieldCheck } from 'lucide-react';
import { api } from '../../../lib/api';
import { DataGrid, PageHeader, StatusBadge, useToast, type GridColumn } from '../../../components/ui';
import { useErrorMessage } from '../../../app/auth-context';

interface MataPelajaranRow extends Record<string, unknown> {
  id: string;
  code: string;
  nama: string;
  kelompok: string | null;
  jenjang: string | null;
}

interface KomponenRow extends Record<string, unknown> {
  id: string;
  kode: string;
  nama: string;
  bobot_persen: string;
}

interface SantriRow {
  id: string;
  nis: string;
  nama_lengkap: string;
}

interface RombonganRow {
  id: string;
  tingkat: string;
  nama: string;
}

interface AnggotaRombonganRow {
  id: string;
  santri_id: string;
  nis: string | null;
  nama_lengkap: string | null;
}

interface TahunAjaranRow {
  id: string;
  code: string;
  name: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: string;
}

interface RaporRow {
  mata_pelajaran: string;
  komponen: Array<{ nama: string; nilai: number; bobot_persen: number }>;
  nilai_akhir: number | null;
  huruf_mutu: string | null;
}

interface RaporFinalisasi {
  id: string;
  santri_id: string;
  tahun_ajaran_id: string;
  status: 'FINALIZED' | 'VOID';
  snapshot: RaporRow[];
  summary: Record<string, unknown>;
  checksum: string;
  verification_code: string;
  qr_payload: string;
  catatan_finalisasi: string | null;
  wali_kelas_signed_at: string | null;
  kepala_signed_at: string | null;
  finalized_at: string;
  voided_at: string | null;
  void_reason: string | null;
}

export function PesantrenNilaiPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'mapel' | 'input' | 'rapor'>('mapel');
  const [mapelId, setMapelId] = useState('');
  const [tahunAjaranId, setTahunAjaranId] = useState('');
  const [formMapel, setFormMapel] = useState({ code: '', nama: '', kelompok: '', jenjang: '' });
  const [formKomponen, setFormKomponen] = useState({ kode: '', nama: '', bobotPersen: '0' });
  const [formNilai, setFormNilai] = useState({ santriId: '', komponenId: '', nilaiAngka: '', catatan: '' });
  const [rombonganNilaiId, setRombonganNilaiId] = useState('');
  const [nilaiMassal, setNilaiMassal] = useState<Record<string, string>>({});
  const [filterRapor, setFilterRapor] = useState({ santriId: '', tahunAjaranId: '' });

  const tahunAjaran = useQuery({
    queryKey: ['pesantren-nilai-tahun-ajaran'],
    queryFn: () => api.get<TahunAjaranRow[]>('/pesantren/nilai/tahun-ajaran'),
  });

  const mapel = useQuery({
    queryKey: ['pesantren-nilai-mapel'],
    queryFn: () => api.get<MataPelajaranRow[]>('/pesantren/nilai/mata-pelajaran'),
  });

  const komponen = useQuery({
    queryKey: ['pesantren-nilai-komponen', mapelId],
    enabled: Boolean(mapelId),
    queryFn: () => api.get<KomponenRow[]>(`/pesantren/nilai/mata-pelajaran/${mapelId}/komponen`),
  });

  const santri = useQuery({
    queryKey: ['pesantren-nilai-santri'],
    queryFn: () => api.get<{ items: SantriRow[]; total: number }>('/pesantren/santri?status=AKTIF&halaman=1&ukuranHalaman=100'),
  });

  const rombongan = useQuery({
    queryKey: ['pesantren-nilai-rombongan'],
    queryFn: () => api.get<{ items: RombonganRow[]; total: number }>('/pesantren/rombongan?halaman=1&ukuranHalaman=100'),
  });

  const anggotaRombongan = useQuery({
    queryKey: ['pesantren-nilai-anggota-rombongan', rombonganNilaiId],
    enabled: Boolean(rombonganNilaiId),
    queryFn: () => api.get<AnggotaRombonganRow[]>(`/pesantren/rombongan/${rombonganNilaiId}/anggota`),
  });

  const tahunAktif = tahunAjaran.data?.find((item) => item.status === 'ACTIVE') ?? tahunAjaran.data?.[0];
  const selectedTahunInputId = tahunAjaranId || tahunAktif?.id || '';
  const selectedTahunRaporId = filterRapor.tahunAjaranId || tahunAktif?.id || '';

  const rapor = useQuery({
    queryKey: ['pesantren-nilai-rapor', filterRapor.santriId, selectedTahunRaporId],
    enabled: Boolean(filterRapor.santriId && selectedTahunRaporId),
    queryFn: () => api.get<RaporRow[]>(`/pesantren/nilai/rapor/${filterRapor.santriId}/${selectedTahunRaporId}`),
  });

  const finalisasi = useQuery({
    queryKey: ['pesantren-nilai-rapor-finalisasi', filterRapor.santriId, selectedTahunRaporId],
    enabled: Boolean(filterRapor.santriId && selectedTahunRaporId),
    queryFn: () => api.get<RaporFinalisasi | null>(`/pesantren/nilai/rapor/${filterRapor.santriId}/${selectedTahunRaporId}/finalisasi`),
  });

  const tambahMapel = useMutation({
    mutationFn: () =>
      api.post<MataPelajaranRow>('/pesantren/nilai/mata-pelajaran', {
        code: formMapel.code,
        nama: formMapel.nama,
        kelompok: formMapel.kelompok.trim() || undefined,
        jenjang: formMapel.jenjang.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Mata pelajaran tersimpan.', 'success');
      setFormMapel({ code: '', nama: '', kelompok: '', jenjang: '' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-mapel'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan mata pelajaran.'), 'error'),
  });

  const tambahKomponen = useMutation({
    mutationFn: () =>
      api.post<KomponenRow>(`/pesantren/nilai/mata-pelajaran/${mapelId}/komponen`, {
        kode: formKomponen.kode,
        nama: formKomponen.nama,
        bobotPersen: Number(formKomponen.bobotPersen),
      }),
    onSuccess: () => {
      toast.push('Komponen nilai tersimpan.', 'success');
      setFormKomponen({ kode: '', nama: '', bobotPersen: '0' });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-komponen', mapelId] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan komponen.'), 'error'),
  });

  const simpanNilai = useMutation({
    mutationFn: () =>
      api.post('/pesantren/nilai', {
        santriId: formNilai.santriId,
        komponenId: formNilai.komponenId,
        tahunAjaranId: selectedTahunInputId,
        nilaiAngka: Number(formNilai.nilaiAngka),
        catatan: formNilai.catatan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Nilai santri tersimpan.', 'success');
      setFormNilai({ santriId: '', komponenId: formNilai.komponenId, nilaiAngka: '', catatan: '' });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan nilai.'), 'error'),
  });

  const simpanNilaiMassal = useMutation({
    mutationFn: async () => {
      const baris = Object.entries(nilaiMassal)
        .map(([santriId, nilai]) => ({ santriId, nilai: nilai.trim() }))
        .filter((row) => row.nilai !== '');
      await Promise.all(
        baris.map((row) =>
          api.post('/pesantren/nilai', {
            santriId: row.santriId,
            komponenId: formNilai.komponenId,
            tahunAjaranId: selectedTahunInputId,
            nilaiAngka: Number(row.nilai),
          }),
        ),
      );
      return baris.length;
    },
    onSuccess: (jumlah) => {
      toast.push(`${jumlah} nilai santri tersimpan.`, 'success');
      setNilaiMassal({});
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-rapor'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan nilai massal.'), 'error'),
  });

  const finalisasiRapor = useMutation({
    mutationFn: () =>
      api.post<RaporFinalisasi>(`/pesantren/nilai/rapor/${filterRapor.santriId}/${selectedTahunRaporId}/finalisasi`, {
        catatanFinalisasi: `Difinalisasi dari halaman rapor pada ${new Date().toLocaleString('id-ID')}`,
      }),
    onSuccess: () => {
      toast.push('Rapor difinalisasi dan dikunci.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-rapor-finalisasi'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal finalisasi rapor.'), 'error'),
  });

  const batalkanFinalisasi = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      api.post<RaporFinalisasi>(`/pesantren/nilai/rapor/finalisasi/${id}/batalkan`, { reason }),
    onSuccess: () => {
      toast.push('Finalisasi rapor dibatalkan. Nilai bisa dikoreksi kembali.', 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-rapor-finalisasi'] });
      void queryClient.invalidateQueries({ queryKey: ['pesantren-nilai-rapor'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal membatalkan finalisasi.'), 'error'),
  });

  const santriMassal: SantriRow[] = rombonganNilaiId
    ? (anggotaRombongan.data ?? []).map((item) => ({
        id: item.santri_id,
        nis: item.nis ?? '-',
        nama_lengkap: item.nama_lengkap ?? item.santri_id,
      }))
    : santri.data?.items ?? [];
  const rombonganTerpilih = (rombongan.data?.items ?? []).find((item) => item.id === rombonganNilaiId);
  const santriTerpilih = (santri.data?.items ?? []).find((item) => item.id === filterRapor.santriId);
  const tahunInput = tahunAjaran.data?.find((item) => item.id === selectedTahunInputId);
  const tahunRapor = tahunAjaran.data?.find((item) => item.id === selectedTahunRaporId);
  const raporDitampilkan = finalisasi.data?.snapshot ?? rapor.data ?? [];
  const ringkasanRapor = hitungRingkasanRapor(raporDitampilkan);

  const columns: Array<GridColumn<MataPelajaranRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Mata Pelajaran' },
    { key: 'kelompok', header: 'Kelompok', render: (row) => row.kelompok ?? '-' },
    { key: 'jenjang', header: 'Jenjang', render: (row) => row.jenjang ? <StatusBadge status={row.jenjang} /> : '-' },
  ];

  const pilihTahunInput = (value: string) => setTahunAjaranId(value);
  const pilihTahunRapor = (value: string) => setFilterRapor({ ...filterRapor, tahunAjaranId: value });
  const pakaiTahunAktif = () => {
    if (!tahunAktif) return;
    setTahunAjaranId(tahunAktif.id);
    setFilterRapor((sebelumnya) => ({ ...sebelumnya, tahunAjaranId: tahunAktif.id }));
  };

  const unduhCsvRapor = () => {
    if (!raporDitampilkan.length || !santriTerpilih) return;
    const rows = [
      ['Santri', santriTerpilih.nama_lengkap],
      ['NIS', santriTerpilih.nis],
      ['Tahun Ajaran', tahunRapor?.name ?? selectedTahunRaporId],
      [],
      ['Mata Pelajaran', 'Komponen', 'Nilai Akhir', 'Huruf'],
      ...raporDitampilkan.map((row) => [
        row.mata_pelajaran,
        row.komponen.map((komponen) => `${komponen.nama}: ${komponen.nilai} (${komponen.bobot_persen}%)`).join('; '),
        row.nilai_akhir ?? '',
        row.huruf_mutu ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.map(formatCsv).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rapor-${santriTerpilih.nis || santriTerpilih.id}-${tahunRapor?.code ?? 'tahun-ajaran'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        title="Nilai dan Rapor"
        description="Kelola mata pelajaran, komponen penilaian, dan input nilai santri."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Nilai' }]}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-outline" disabled={!tahunAktif} onClick={pakaiTahunAktif}>
              Tahun Aktif
            </button>
            <button type="button" className="btn-outline" onClick={() => {
              void mapel.refetch();
              void tahunAjaran.refetch();
            }}>
              <RefreshCw className="h-4 w-4" aria-hidden />
              Muat Ulang
            </button>
          </div>
        }
      />

      <div className="mb-4 grid gap-2 rounded-xl border border-slate-200 bg-white p-1 shadow-sm dark:border-slate-800 dark:bg-slate-950 sm:grid-cols-3">
        <TabButton active={tab === 'mapel'} title="Mata Pelajaran" description={`${mapel.data?.length ?? 0} mapel`} onClick={() => setTab('mapel')} />
        <TabButton active={tab === 'input'} title="Input Nilai" description={tahunInput ? `TA ${tahunInput.code}` : 'Pilih tahun'} onClick={() => setTab('input')} />
        <TabButton active={tab === 'rapor'} title="Rapor" description={filterRapor.santriId ? 'Siap cetak' : 'Pilih santri'} onClick={() => setTab('rapor')} />
      </div>

      {tab === 'mapel' ? (
        <>
          <div className="card mb-4 p-4">
            <div className="grid gap-3 md:grid-cols-[140px_minmax(220px,1fr)_180px_160px_auto]">
              <Input label="Kode" value={formMapel.code} onChange={(value) => setFormMapel({ ...formMapel, code: value.toUpperCase() })} />
              <Input label="Nama" value={formMapel.nama} onChange={(value) => setFormMapel({ ...formMapel, nama: value })} />
              <Input label="Kelompok" value={formMapel.kelompok} onChange={(value) => setFormMapel({ ...formMapel, kelompok: value })} />
              <Input label="Jenjang" value={formMapel.jenjang} onChange={(value) => setFormMapel({ ...formMapel, jenjang: value.toUpperCase() })} />
              <div className="flex items-end">
                <button type="button" className="btn-primary" disabled={!formMapel.code || !formMapel.nama || tambahMapel.isPending} onClick={() => tambahMapel.mutate()}>
                  <Plus className="h-4 w-4" aria-hidden />
                  Tambah
                </button>
              </div>
            </div>
          </div>
          <DataGrid
            columns={columns}
            rows={mapel.data ?? []}
            loading={mapel.isLoading}
            error={mapel.isError ? toMessage(mapel.error, (_key, fallback) => fallback ?? 'Gagal memuat mata pelajaran.') : undefined}
            rowKey={(row) => row.id}
            onRetry={() => void mapel.refetch()}
            emptyTitle="Belum ada mata pelajaran."
          />
        </>
      ) : tab === 'input' ? (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,0.85fr)_minmax(360px,1.15fr)]">
          <div className="card p-4">
            <Field label="Mata pelajaran">
              <select className="field-input" value={mapelId} onChange={(e) => { setMapelId(e.target.value); setFormNilai({ ...formNilai, komponenId: '' }); }}>
                <option value="">Pilih mata pelajaran</option>
                {(mapel.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.nama}</option>)}
              </select>
            </Field>
            <div className="mt-4 grid gap-3 md:grid-cols-[120px_minmax(180px,1fr)_120px_auto]">
              <Input label="Kode" value={formKomponen.kode} onChange={(value) => setFormKomponen({ ...formKomponen, kode: value.toUpperCase() })} />
              <Input label="Komponen" value={formKomponen.nama} onChange={(value) => setFormKomponen({ ...formKomponen, nama: value })} />
              <Input label="Bobot %" type="number" value={formKomponen.bobotPersen} onChange={(value) => setFormKomponen({ ...formKomponen, bobotPersen: value })} />
              <div className="flex items-end">
                <button type="button" className="btn-outline" disabled={!mapelId || !formKomponen.kode || !formKomponen.nama || tambahKomponen.isPending} onClick={() => tambahKomponen.mutate()}>
                  Tambah
                </button>
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {(komponen.data ?? []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm dark:border-slate-800">
                  <span>{item.kode} - {item.nama}</span>
                  <StatusBadge status={`${item.bobot_persen}%`} />
                </div>
              ))}
            </div>
          </div>

          <div className="card p-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Tahun ajaran *">
                <select className="field-input" value={selectedTahunInputId} onChange={(e) => pilihTahunInput(e.target.value)}>
                  <option value="">Pilih tahun ajaran</option>
                  {(tahunAjaran.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.status === 'ACTIVE' ? '(aktif)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Komponen *">
                <select className="field-input" value={formNilai.komponenId} onChange={(e) => setFormNilai({ ...formNilai, komponenId: e.target.value })}>
                  <option value="">Pilih komponen</option>
                  {(komponen.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.kode} - {item.nama}</option>)}
                </select>
              </Field>
              <Field label="Santri *">
                <select className="field-input" value={formNilai.santriId} onChange={(e) => setFormNilai({ ...formNilai, santriId: e.target.value })}>
                  <option value="">Pilih santri</option>
                  {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
                </select>
              </Field>
              <Input label="Nilai angka *" type="number" value={formNilai.nilaiAngka} onChange={(value) => setFormNilai({ ...formNilai, nilaiAngka: value })} />
              <div className="md:col-span-2">
                <Field label="Catatan">
                  <textarea className="field-input min-h-24" value={formNilai.catatan} onChange={(e) => setFormNilai({ ...formNilai, catatan: e.target.value })} />
                </Field>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button type="button" className="btn-primary" disabled={!selectedTahunInputId || !formNilai.santriId || !formNilai.komponenId || !formNilai.nilaiAngka || simpanNilai.isPending} onClick={() => simpanNilai.mutate()}>
                <Save className="h-4 w-4" aria-hidden />
                Simpan Nilai
              </button>
            </div>
            {tahunInput && (
              <p className="mt-3 text-xs text-slate-500">
                Nilai akan dicatat untuk {tahunInput.name}, periode {tahunInput.tanggal_mulai} sampai {tahunInput.tanggal_selesai}.
              </p>
            )}

            <div className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-800">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Input massal per kelas/komponen</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Pilih tahun ajaran dan komponen di atas, batasi rombongan bila perlu, lalu isi nilai yang perlu disimpan.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-outline"
                  disabled={
                    !selectedTahunInputId ||
                    !formNilai.komponenId ||
                    !santriMassal.length ||
                    Object.values(nilaiMassal).every((nilai) => !nilai.trim()) ||
                    simpanNilaiMassal.isPending
                  }
                  onClick={() => simpanNilaiMassal.mutate()}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  Simpan Massal
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto]">
                <Field label="Rombongan/kelas">
                  <select
                    className="field-input"
                    value={rombonganNilaiId}
                    onChange={(e) => {
                      setRombonganNilaiId(e.target.value);
                      setNilaiMassal({});
                    }}
                  >
                    <option value="">Semua santri aktif</option>
                    {(rombongan.data?.items ?? []).map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.tingkat} - {item.nama}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="flex items-end">
                  <span className="inline-flex min-h-10 items-center rounded-md border border-slate-200 px-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:text-slate-300">
                    {anggotaRombongan.isFetching ? 'Memuat santri...' : `${santriMassal.length} santri`}
                  </span>
                </div>
              </div>
              {rombonganTerpilih && (
                <p className="mt-2 text-xs text-slate-500">
                  Daftar dibatasi ke {rombonganTerpilih.tingkat} - {rombonganTerpilih.nama}; nilai kosong tidak dikirim.
                </p>
              )}
              <div className="mt-4 max-h-[420px] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900">
                    <tr>
                      <th className="px-3 py-2 text-left">Santri</th>
                      <th className="w-32 px-3 py-2 text-right">Nilai</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                    {santriMassal.map((item) => (
                      <tr key={item.id}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900 dark:text-white">{item.nama_lengkap}</p>
                          <p className="text-xs text-slate-500">{item.nis}</p>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            className="field-input text-right"
                            value={nilaiMassal[item.id] ?? ''}
                            onChange={(e) => setNilaiMassal((nilai) => ({ ...nilai, [item.id]: e.target.value }))}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {santriMassal.length === 0 && (
                  <p className="bg-white p-4 text-sm text-slate-500 dark:bg-slate-950">Belum ada santri pada filter ini.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="card p-4 print:hidden">
            <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto_auto]">
              <Field label="Santri">
                <select className="field-input" value={filterRapor.santriId} onChange={(e) => setFilterRapor({ ...filterRapor, santriId: e.target.value })}>
                  <option value="">Pilih santri</option>
                  {(santri.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.nis} - {item.nama_lengkap}</option>)}
                </select>
              </Field>
              <Field label="Tahun ajaran">
                <select className="field-input" value={selectedTahunRaporId} onChange={(e) => pilihTahunRapor(e.target.value)}>
                  <option value="">Pilih tahun ajaran</option>
                  {(tahunAjaran.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.status === 'ACTIVE' ? '(aktif)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <button type="button" className="btn-outline" disabled={!raporDitampilkan.length} onClick={unduhCsvRapor}>
                  <Download className="h-4 w-4" aria-hidden />
                  CSV
                </button>
              </div>
              <div className="flex items-end">
                <button type="button" className="btn-outline" disabled={!raporDitampilkan.length} onClick={() => window.print()}>
                  <Printer className="h-4 w-4" aria-hidden />
                  Cetak / PDF
                </button>
              </div>
            </div>
          </div>

          {filterRapor.santriId && selectedTahunRaporId && (
            <section className="card p-4 print:hidden">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-emerald-700" aria-hidden />
                    <h3 className="font-semibold text-slate-950 dark:text-white">Finalisasi rapor</h3>
                    {finalisasi.data ? <StatusBadge status="FINAL" tone="success" /> : <StatusBadge status="DRAFT" tone="warning" />}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
                    Finalisasi menyimpan snapshot rapor, checksum, dan kode verifikasi QR. Setelah final, nilai santri pada tahun ajaran ini terkunci sampai finalisasi dibatalkan dengan alasan.
                  </p>
                  {finalisasi.data && (
                    <div className="mt-3 grid gap-2 text-xs text-slate-600 dark:text-slate-300 md:grid-cols-3">
                      <Info label="Kode verifikasi" value={finalisasi.data.verification_code} />
                      <Info label="Checksum" value={finalisasi.data.checksum.slice(0, 24)} />
                      <Info label="Finalisasi" value={formatDateTime(finalisasi.data.finalized_at)} />
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!raporDitampilkan.length || Boolean(finalisasi.data) || finalisasiRapor.isPending}
                    onClick={() => finalisasiRapor.mutate()}
                  >
                    <LockKeyhole className="h-4 w-4" aria-hidden />
                    Finalisasi
                  </button>
                  <button
                    type="button"
                    className="btn-outline"
                    disabled={!finalisasi.data || batalkanFinalisasi.isPending}
                    onClick={() => {
                      if (!finalisasi.data) return;
                      const reason = window.prompt('Alasan pembatalan finalisasi rapor:');
                      if (!reason) return;
                      batalkanFinalisasi.mutate({ id: finalisasi.data.id, reason });
                    }}
                  >
                    <RotateCcw className="h-4 w-4" aria-hidden />
                    Batalkan
                  </button>
                </div>
              </div>
            </section>
          )}

          <section className="card overflow-hidden p-0 print:border-0 print:shadow-none">
            <div className="border-b border-slate-200 bg-white p-6 text-center dark:border-slate-800 dark:bg-slate-900 print:border-slate-300">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 print:text-slate-700">
                Laporan Hasil Belajar Santri
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white print:text-slate-950">ePesantren.id</h2>
              <p className="mt-1 text-sm text-slate-500 print:text-slate-600">
                Dokumen akademik, diniyah, dan pembinaan santri
              </p>
            </div>
            <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-6 text-sm dark:border-slate-800 dark:bg-slate-900/60 print:grid-cols-3 print:bg-white">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nama santri</p>
                <p className="mt-1 font-semibold text-slate-950 dark:text-white print:text-slate-950">{santriTerpilih?.nama_lengkap ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">NIS</p>
                <p className="mt-1 font-semibold text-slate-950 dark:text-white print:text-slate-950">{santriTerpilih?.nis ?? '-'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tahun ajaran</p>
                <p className="mt-1 font-semibold text-slate-950 dark:text-white print:text-slate-950">
                  {tahunRapor?.name ?? (selectedTahunRaporId || '-')}
                </p>
              </div>
            </div>
            {!filterRapor.santriId || !selectedTahunRaporId ? (
              <div className="p-6 text-sm text-slate-500">Pilih santri dan tahun ajaran untuk menampilkan rapor.</div>
            ) : rapor.isLoading ? (
              <div className="p-6 text-sm text-slate-500">Memuat rapor...</div>
            ) : rapor.isError ? (
              <div className="p-6 text-sm text-rose-600">{toMessage(rapor.error, (_key, fallback) => fallback ?? 'Gagal memuat rapor.')}</div>
            ) : !raporDitampilkan.length ? (
              <div className="p-6 text-sm text-slate-500">Belum ada nilai untuk santri dan tahun ajaran ini.</div>
            ) : (
              <>
                <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-3 dark:border-slate-800">
                  <Summary label="Mata pelajaran" value={String(ringkasanRapor.jumlahMapel)} />
                  <Summary label="Rata-rata" value={ringkasanRapor.rataRata === null ? '-' : ringkasanRapor.rataRata.toFixed(2)} />
                  <Summary label="Predikat dominan" value={ringkasanRapor.predikatDominan ?? '-'} />
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/70">
                    <tr>
                      <th className="px-4 py-3 text-left">Mata Pelajaran</th>
                      <th className="px-4 py-3 text-left">Komponen</th>
                      <th className="px-4 py-3 text-right">Nilai Akhir</th>
                      <th className="px-4 py-3 text-center">Huruf</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                    {raporDitampilkan.map((row) => (
                      <tr key={row.mata_pelajaran}>
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.mata_pelajaran}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {row.komponen.map((komponen) => `${komponen.nama}: ${komponen.nilai} (${komponen.bobot_persen}%)`).join(', ')}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">{row.nilai_akhir ?? '-'}</td>
                        <td className="px-4 py-3 text-center">
                          <StatusBadge status={row.huruf_mutu ?? '-'} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>
                </div>
              </>
            )}
            {raporDitampilkan.length ? (
              <div className="grid gap-8 border-t border-slate-100 bg-white p-6 text-center text-sm dark:border-slate-800 dark:bg-slate-950 print:grid-cols-3">
                <div>
                  <p className="text-slate-600">Mengetahui,</p>
                  <p className="font-semibold text-slate-950 dark:text-white print:text-slate-950">Wali Kelas</p>
                  <div className="mx-auto mt-14 w-40 border-t border-slate-300 pt-2 text-slate-500">Nama terang</div>
                </div>
                <div>
                  <p className="text-slate-600">Diterima,</p>
                  <p className="font-semibold text-slate-950 dark:text-white print:text-slate-950">Orang Tua/Wali</p>
                  <div className="mx-auto mt-14 w-40 border-t border-slate-300 pt-2 text-slate-500">Nama terang</div>
                </div>
                <div>
                  <p className="text-slate-600">Disahkan,</p>
                  <p className="font-semibold text-slate-950 dark:text-white print:text-slate-950">Kepala Satuan Pendidikan</p>
                  <div className="mx-auto mt-14 w-40 border-t border-slate-300 pt-2 text-slate-500">Nama terang</div>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      )}
    </>
  );
}

function Input({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      <input type={type} className="field-input" value={value} onChange={(e) => onChange(e.target.value)} />
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

function TabButton({
  active,
  title,
  description,
  onClick,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`min-h-16 rounded-lg px-4 py-3 text-left transition ${
        active
          ? 'bg-emerald-700 text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-900 dark:hover:text-white'
      }`}
      onClick={onClick}
    >
      <span className="block text-sm font-semibold">{title}</span>
      <span className={`mt-1 block text-xs ${active ? 'text-emerald-50' : 'text-slate-500'}`}>{description}</span>
    </button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
      <p className="font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-all font-mono text-[11px] text-slate-900 dark:text-slate-100">{value}</p>
    </div>
  );
}

function hitungRingkasanRapor(rows: RaporRow[]) {
  const nilai = rows.map((row) => row.nilai_akhir).filter((value): value is number => value !== null);
  const rataRata = nilai.length ? nilai.reduce((total, value) => total + value, 0) / nilai.length : null;
  const sebaran = new Map<string, number>();
  for (const row of rows) {
    if (!row.huruf_mutu) continue;
    sebaran.set(row.huruf_mutu, (sebaran.get(row.huruf_mutu) ?? 0) + 1);
  }
  const predikatDominan = [...sebaran.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { jumlahMapel: rows.length, rataRata, predikatDominan };
}

function formatCsv(value: unknown) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
}
