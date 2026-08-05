import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Plus, Printer, RefreshCw, Save } from 'lucide-react';
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

interface TahunAjaranRow {
  id: string;
  code: string;
  name: string;
  tanggal_mulai: string;
  tanggal_selesai: string;
  status: string;
}

interface RombonganRow {
  id: string;
  tingkat: string;
  nama: string;
}

interface RaporRow {
  mata_pelajaran: string;
  komponen: Array<{ nama: string; nilai: number; bobot_persen: number }>;
  nilai_akhir: number | null;
  huruf_mutu: string | null;
}

interface GradebookRow {
  santri_id: string;
  nis: string;
  nama_lengkap: string;
  nilai: Record<string, string | null>;
}

interface GradebookPayload {
  komponen: KomponenRow[];
  rows: GradebookRow[];
}

export function PesantrenNilaiPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'mapel' | 'input' | 'kelas' | 'rapor'>('mapel');
  const [mapelId, setMapelId] = useState('');
  const [tahunAjaranId, setTahunAjaranId] = useState('');
  const [formMapel, setFormMapel] = useState({ code: '', nama: '', kelompok: '', jenjang: '' });
  const [formKomponen, setFormKomponen] = useState({ kode: '', nama: '', bobotPersen: '0' });
  const [formNilai, setFormNilai] = useState({ santriId: '', komponenId: '', nilaiAngka: '', catatan: '' });
  const [filterRapor, setFilterRapor] = useState({ santriId: '', tahunAjaranId: '' });
  const [filterKelas, setFilterKelas] = useState({ rombonganId: '', mataPelajaranId: '', tahunAjaranId: '' });
  const [nilaiKelas, setNilaiKelas] = useState<Record<string, Record<string, string>>>({});

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
    queryKey: ['pesantren-nilai-rombongan', filterKelas.tahunAjaranId],
    queryFn: () => {
      const params = new URLSearchParams({ halaman: '1', ukuranHalaman: '100' });
      if (filterKelas.tahunAjaranId) params.set('tahunAjaranId', filterKelas.tahunAjaranId);
      return api.get<{ items: RombonganRow[]; total: number }>(`/pesantren/rombongan?${params.toString()}`);
    },
  });

  const gradebook = useQuery({
    queryKey: ['pesantren-nilai-gradebook', filterKelas],
    enabled: Boolean(filterKelas.rombonganId && filterKelas.mataPelajaranId && filterKelas.tahunAjaranId),
    queryFn: () => {
      const params = new URLSearchParams({
        rombonganId: filterKelas.rombonganId,
        mataPelajaranId: filterKelas.mataPelajaranId,
        tahunAjaranId: filterKelas.tahunAjaranId,
      });
      return api.get<GradebookPayload>(`/pesantren/nilai/gradebook?${params.toString()}`);
    },
  });

  useEffect(() => {
    const payload = gradebook.data;
    if (payload) {
      setNilaiKelas(
        Object.fromEntries(
          payload.rows.map((row) => [
            row.santri_id,
            Object.fromEntries(payload.komponen.map((item) => [item.id, row.nilai[item.id] ?? ''])),
          ]),
        ),
      );
    }
  }, [gradebook.data]);

  const rapor = useQuery({
    queryKey: ['pesantren-nilai-rapor', filterRapor.santriId, filterRapor.tahunAjaranId],
    enabled: Boolean(filterRapor.santriId && filterRapor.tahunAjaranId),
    queryFn: () => api.get<RaporRow[]>(`/pesantren/nilai/rapor/${filterRapor.santriId}/${filterRapor.tahunAjaranId}`),
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
        tahunAjaranId,
        nilaiAngka: Number(formNilai.nilaiAngka),
        catatan: formNilai.catatan.trim() || undefined,
      }),
    onSuccess: () => {
      toast.push('Nilai santri tersimpan.', 'success');
      setFormNilai({ santriId: '', komponenId: formNilai.komponenId, nilaiAngka: '', catatan: '' });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan nilai.'), 'error'),
  });

  const simpanNilaiKelas = useMutation({
    mutationFn: () => {
      const nilai = (gradebook.data?.rows ?? []).flatMap((row) =>
        (gradebook.data?.komponen ?? []).map((komponenItem) => {
          const raw = nilaiKelas[row.santri_id]?.[komponenItem.id]?.trim() ?? '';
          return {
            santriId: row.santri_id,
            komponenId: komponenItem.id,
            nilaiAngka: raw === '' ? null : Number(raw),
          };
        }),
      );
      return api.post<{ tersimpan: number; dilewati: number }>('/pesantren/nilai/massal', {
        tahunAjaranId: filterKelas.tahunAjaranId,
        nilai,
      });
    },
    onSuccess: (payload) => {
      toast.push(`${payload.tersimpan} nilai tersimpan, ${payload.dilewati} kosong dilewati.`, 'success');
      void gradebook.refetch();
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan nilai kelas.'), 'error'),
  });

  const columns: Array<GridColumn<MataPelajaranRow>> = [
    { key: 'code', header: 'Kode' },
    { key: 'nama', header: 'Mata Pelajaran' },
    { key: 'kelompok', header: 'Kelompok', render: (row) => row.kelompok ?? '-' },
    { key: 'jenjang', header: 'Jenjang', render: (row) => row.jenjang ? <StatusBadge status={row.jenjang} /> : '-' },
  ];

  const tahunAktif = tahunAjaran.data?.find((item) => item.status === 'ACTIVE') ?? tahunAjaran.data?.[0];
  const tahunInput = tahunAjaran.data?.find((item) => item.id === tahunAjaranId);
  const tahunRapor = tahunAjaran.data?.find((item) => item.id === filterRapor.tahunAjaranId);
  const santriRapor = (santri.data?.items ?? []).find((item) => item.id === filterRapor.santriId);
  const ringkasanRapor = hitungRingkasanRapor(rapor.data ?? []);

  const pilihTahunInput = (value: string) => setTahunAjaranId(value);
  const pilihTahunRapor = (value: string) => setFilterRapor({ ...filterRapor, tahunAjaranId: value });
  const pakaiTahunAktif = () => {
    if (!tahunAktif) return;
    setTahunAjaranId(tahunAktif.id);
    setFilterRapor((sebelumnya) => ({ ...sebelumnya, tahunAjaranId: tahunAktif.id }));
    setFilterKelas((sebelumnya) => ({ ...sebelumnya, tahunAjaranId: tahunAktif.id }));
  };

  const unduhCsvNilaiKelas = () => {
    if (!gradebook.data?.rows.length) return;
    const columns = ['NIS', 'Nama', ...gradebook.data.komponen.map((item) => `${item.kode} - ${item.nama}`)];
    const rows = gradebook.data.rows.map((row) => [
      row.nis,
      row.nama_lengkap,
      ...gradebook.data!.komponen.map((item) => nilaiKelas[row.santri_id]?.[item.id] ?? ''),
    ]);
    unduhCsv(`nilai-kelas-${new Date().toISOString().slice(0, 10)}.csv`, [columns, ...rows]);
  };

  const unduhCsvRapor = () => {
    if (!rapor.data?.length || !santriRapor) return;
    const rows = [
      ['Santri', santriRapor.nama_lengkap],
      ['NIS', santriRapor.nis],
      ['Tahun Ajaran', tahunRapor?.name ?? filterRapor.tahunAjaranId],
      [],
      ['Mata Pelajaran', 'Komponen', 'Nilai Akhir', 'Huruf'],
      ...rapor.data.map((row) => [
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
    a.download = `rapor-${santriRapor.nis || santriRapor.id}-${tahunRapor?.code ?? 'tahun-ajaran'}.csv`;
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

      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'mapel' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('mapel')}>Mata Pelajaran</button>
        <button type="button" className={tab === 'input' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('input')}>Input Nilai</button>
        <button type="button" className={tab === 'kelas' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('kelas')}>Nilai Kelas</button>
        <button type="button" className={tab === 'rapor' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('rapor')}>Rapor</button>
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
                <select className="field-input" value={tahunAjaranId} onChange={(e) => pilihTahunInput(e.target.value)}>
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
              <button type="button" className="btn-primary" disabled={!tahunAjaranId || !formNilai.santriId || !formNilai.komponenId || !formNilai.nilaiAngka || simpanNilai.isPending} onClick={() => simpanNilai.mutate()}>
                <Save className="h-4 w-4" aria-hidden />
                Simpan Nilai
              </button>
            </div>
            {tahunInput && (
              <p className="mt-3 text-xs text-slate-500">
                Nilai akan dicatat untuk {tahunInput.name}, periode {tahunInput.tanggal_mulai} sampai {tahunInput.tanggal_selesai}.
              </p>
            )}
          </div>
        </div>
      ) : tab === 'kelas' ? (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(180px,1fr)_minmax(180px,1fr)_minmax(180px,1fr)_auto_auto]">
              <Field label="Tahun ajaran">
                <select
                  className="field-input"
                  value={filterKelas.tahunAjaranId}
                  onChange={(e) => setFilterKelas({ ...filterKelas, tahunAjaranId: e.target.value, rombonganId: '' })}
                >
                  <option value="">Pilih tahun ajaran</option>
                  {(tahunAjaran.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>{item.name} {item.status === 'ACTIVE' ? '(aktif)' : ''}</option>
                  ))}
                </select>
              </Field>
              <Field label="Rombongan">
                <select className="field-input" value={filterKelas.rombonganId} onChange={(e) => setFilterKelas({ ...filterKelas, rombonganId: e.target.value })}>
                  <option value="">Pilih rombongan</option>
                  {(rombongan.data?.items ?? []).map((item) => <option key={item.id} value={item.id}>{item.tingkat} - {item.nama}</option>)}
                </select>
              </Field>
              <Field label="Mata pelajaran">
                <select className="field-input" value={filterKelas.mataPelajaranId} onChange={(e) => setFilterKelas({ ...filterKelas, mataPelajaranId: e.target.value })}>
                  <option value="">Pilih mata pelajaran</option>
                  {(mapel.data ?? []).map((item) => <option key={item.id} value={item.id}>{item.code} - {item.nama}</option>)}
                </select>
              </Field>
              <div className="flex items-end">
                <button type="button" className="btn-outline" disabled={!gradebook.data?.rows.length} onClick={unduhCsvNilaiKelas}>
                  <Download className="h-4 w-4" aria-hidden />
                  CSV
                </button>
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  className="btn-primary"
                  disabled={!gradebook.data?.rows.length || simpanNilaiKelas.isPending}
                  onClick={() => simpanNilaiKelas.mutate()}
                >
                  <Save className="h-4 w-4" aria-hidden />
                  Simpan
                </button>
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-sky-50 px-4 py-3 dark:border-slate-800 dark:from-emerald-950/30 dark:to-sky-950/20">
              <h2 className="section-title">Gradebook Rombongan</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Isi nilai satu kelas sekaligus. Di layar kecil, tabel bisa digeser horizontal agar kolom tetap terbaca.
              </p>
            </div>
            {!filterKelas.rombonganId || !filterKelas.mataPelajaranId || !filterKelas.tahunAjaranId ? (
              <div className="p-6 text-sm text-slate-500">Pilih tahun ajaran, rombongan, dan mata pelajaran.</div>
            ) : gradebook.isLoading ? (
              <div className="p-6 text-sm text-slate-500">Memuat gradebook...</div>
            ) : gradebook.isError ? (
              <div className="p-6 text-sm text-rose-600">{toMessage(gradebook.error, (_key, fallback) => fallback ?? 'Gagal memuat gradebook.')}</div>
            ) : !gradebook.data?.rows.length ? (
              <div className="p-6 text-sm text-slate-500">Belum ada anggota aktif pada rombongan ini.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:bg-slate-900/70">
                    <tr>
                      <th className="sticky left-0 z-10 min-w-56 bg-slate-50 px-4 py-3 text-left dark:bg-slate-900">Santri</th>
                      {(gradebook.data?.komponen ?? []).map((item) => (
                        <th key={item.id} className="min-w-32 px-3 py-3 text-center">
                          {item.kode}
                          <span className="block text-[10px] normal-case tracking-normal text-slate-400">{item.bobot_persen}%</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
                    {(gradebook.data?.rows ?? []).map((row) => (
                      <tr key={row.santri_id}>
                        <td className="sticky left-0 z-10 bg-white px-4 py-3 dark:bg-slate-950">
                          <p className="font-semibold text-slate-900 dark:text-white">{row.nama_lengkap}</p>
                          <p className="text-xs text-slate-500">{row.nis}</p>
                        </td>
                        {(gradebook.data?.komponen ?? []).map((item) => (
                          <td key={item.id} className="px-3 py-2">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              className="field-input h-10 min-w-24 text-center"
                              value={nilaiKelas[row.santri_id]?.[item.id] ?? ''}
                              onChange={(e) => {
                                const value = e.target.value;
                                setNilaiKelas((current) => ({
                                  ...current,
                                  [row.santri_id]: { ...(current[row.santri_id] ?? {}), [item.id]: value },
                                }));
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                <select className="field-input" value={filterRapor.tahunAjaranId} onChange={(e) => pilihTahunRapor(e.target.value)}>
                  <option value="">Pilih tahun ajaran</option>
                  {(tahunAjaran.data ?? []).map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} {item.status === 'ACTIVE' ? '(aktif)' : ''}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="flex items-end">
                <button type="button" className="btn-outline" disabled={!rapor.data?.length} onClick={unduhCsvRapor}>
                  <Download className="h-4 w-4" aria-hidden />
                  CSV
                </button>
              </div>
              <div className="flex items-end">
                <button type="button" className="btn-outline" disabled={!rapor.data?.length} onClick={() => window.print()}>
                  <Printer className="h-4 w-4" aria-hidden />
                  Cetak / PDF
                </button>
              </div>
            </div>
          </div>

          <section className="card overflow-hidden p-0 print:border-0 print:shadow-none">
            <div className="border-b border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 print:border-slate-300">
              <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Rapor Santri</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">
                {santriRapor?.nama_lengkap ?? 'Pilih santri'}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {santriRapor ? `NIS: ${santriRapor.nis}` : 'Pilih santri dan tahun ajaran untuk menampilkan rapor.'}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Tahun ajaran: {tahunRapor?.name ?? (filterRapor.tahunAjaranId || '-')}
              </p>
            </div>
            {!filterRapor.santriId || !filterRapor.tahunAjaranId ? (
              <div className="p-6 text-sm text-slate-500">Pilih santri dan tahun ajaran untuk menampilkan rapor.</div>
            ) : rapor.isLoading ? (
              <div className="p-6 text-sm text-slate-500">Memuat rapor...</div>
            ) : rapor.isError ? (
              <div className="p-6 text-sm text-rose-600">{toMessage(rapor.error, (_key, fallback) => fallback ?? 'Gagal memuat rapor.')}</div>
            ) : !rapor.data?.length ? (
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
                    {rapor.data.map((row) => (
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
                <div className="grid gap-6 border-t border-slate-100 p-6 text-sm sm:grid-cols-3 dark:border-slate-800">
                  <Signature label="Wali Kelas" />
                  <Signature label="Orang Tua/Wali" />
                  <Signature label="Kepala Madrasah" />
                </div>
              </>
            )}
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

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{value}</p>
    </div>
  );
}

function Signature({ label }: { label: string }) {
  return (
    <div className="pt-8 text-center">
      <div className="mx-auto h-16 w-44 border-b border-slate-300" />
      <p className="mt-2 font-semibold text-slate-700 dark:text-slate-300">{label}</p>
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

function unduhCsv(filename: string, rows: unknown[][]) {
  const csv = rows.map((row) => row.map(formatCsv).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
