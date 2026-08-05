import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import * as XLSX from 'xlsx';
import { api, formatDate } from '../../../lib/api';
import {
  DataGrid,
  PageHeader,
  Pagination,
  StatusBadge,
  useToast,
  type GridColumn,
} from '../../../components/ui';
import { CrudActionBar, CrudDashboard } from '../../../components/crud-actions';
import { useErrorMessage } from '../../../app/auth-context';

interface SantriRow extends Record<string, unknown> {
  id: string;
  nis: string;
  nisn: string | null;
  nama_lengkap: string;
  jenis_kelamin: string;
  status: string;
  status_tinggal: string;
  tanggal_masuk: string;
  tanggal_keluar: string | null;
  alasan_keluar: string | null;
}

interface OrangTuaForm {
  nama: string;
  nik: string;
  tahunLahir: string;
  pendidikan: string;
  pekerjaan: string;
  penghasilan: string;
}

interface ReferensiDapodikRow {
  code: string;
  nama: string;
}

interface Pilihan {
  value: string;
  label: string;
}

const JENIS_KELAMIN = ['L', 'P'];
const STATUS_TINGGAL = ['MUKIM', 'NONMUKIM'];
const AGAMA = ['Islam', 'Kristen', 'Katolik', 'Hindu', 'Buddha', 'Khonghucu', 'Lainnya'];
const KEBUTUHAN_KHUSUS = [
  'TIDAK_ADA', 'NETRA', 'RUNGU', 'WICARA', 'GRAHITA', 'DAKSA', 'LARAS', 'GANDA', 'AUTIS', 'LAINNYA',
];
const ALAT_TRANSPORTASI = ['JALAN_KAKI', 'SEPEDA', 'SEPEDA_MOTOR', 'ANGKUTAN_UMUM', 'MOBIL_ANTAR_JEMPUT', 'PERAHU', 'LAINNYA'];
const PENDIDIKAN_TERAKHIR = ['TIDAK_SEKOLAH', 'SD', 'SMP', 'SMA', 'D1_D3', 'S1', 'S2', 'S3'];
const PEKERJAAN_ORANG_TUA = ['TIDAK_BEKERJA', 'PETANI', 'NELAYAN', 'BURUH', 'PEDAGANG', 'WIRASWASTA', 'KARYAWAN_SWASTA', 'PNS_TNI_POLRI', 'GURU', 'LAINNYA'];
const RENTANG_PENGHASILAN = [
  'TIDAK_BERPENGHASILAN', 'KURANG_500RB', '500RB_1JT', '1JT_2JT', '2JT_5JT', '5JT_20JT', 'LEBIH_20JT',
];
const PAGE_SIZE = 25;
const STATUS_AKHIR = ['LULUS', 'KELUAR', 'PINDAH'] as const;

const ORANG_TUA_KOSONG: OrangTuaForm = {
  nama: '', nik: '', tahunLahir: '', pendidikan: '', pekerjaan: '', penghasilan: '',
};

const FORM_KOSONG = {
  nis: '',
  namaLengkap: '',
  jenisKelamin: 'L',
  statusTinggal: 'MUKIM',
  tempatLahir: '',
  tanggalLahir: '',
  alamatAsal: '',
  // -- Identitas setara Dapodik --
  nik: '',
  nisn: '',
  nipd: '',
  agama: '',
  kewarganegaraan: 'WNI',
  kebutuhanKhusus: 'TIDAK_ADA',
  anakKe: '',
  jumlahSaudara: '',
  nomorKk: '',
  // -- Kontak dan transportasi --
  alatTransportasi: '',
  jarakTempatTinggalKm: '',
  telepon: '',
  hp: '',
  email: '',
  // -- Program bantuan --
  penerimaKip: false,
  nomorKip: '',
  penerimaKks: false,
  nomorKks: '',
  // -- Orang tua/wali --
  ayah: { ...ORANG_TUA_KOSONG },
  ibu: { ...ORANG_TUA_KOSONG },
  wali: { ...ORANG_TUA_KOSONG },
};

type FormState = typeof FORM_KOSONG;
type StatusAkhir = (typeof STATUS_AKHIR)[number];

interface StatusForm {
  santri: SantriRow;
  status: StatusAkhir;
  tanggalKeluar: string;
  alasanKeluar: string;
}

/** Payload orang tua/wali -- hanya disertakan bila minimal satu field terisi. */
function payloadOrangTua(data: OrangTuaForm): Record<string, unknown> | undefined {
  const isi = Object.values(data).some((v) => v.trim() !== '');
  if (!isi) return undefined;
  return {
    nama: data.nama || undefined,
    nik: data.nik || undefined,
    tahunLahir: data.tahunLahir ? Number(data.tahunLahir) : undefined,
    pendidikan: data.pendidikan || undefined,
    pekerjaan: data.pekerjaan || undefined,
    penghasilan: data.penghasilan || undefined,
  };
}

function bangunPayload(form: FormState): Record<string, unknown> {
  return {
    nis: form.nis,
    namaLengkap: form.namaLengkap,
    jenisKelamin: form.jenisKelamin,
    statusTinggal: form.statusTinggal,
    tempatLahir: form.tempatLahir || undefined,
    tanggalLahir: form.tanggalLahir || undefined,
    alamatAsal: form.alamatAsal || undefined,
    nik: form.nik || undefined,
    nisn: form.nisn || undefined,
    nipd: form.nipd || undefined,
    agama: form.agama || undefined,
    kewarganegaraan: form.kewarganegaraan || undefined,
    kebutuhanKhusus: form.kebutuhanKhusus || undefined,
    anakKe: form.anakKe ? Number(form.anakKe) : undefined,
    jumlahSaudara: form.jumlahSaudara ? Number(form.jumlahSaudara) : undefined,
    nomorKk: form.nomorKk || undefined,
    alatTransportasi: form.alatTransportasi || undefined,
    jarakTempatTinggalKm: form.jarakTempatTinggalKm ? Number(form.jarakTempatTinggalKm) : undefined,
    telepon: form.telepon || undefined,
    hp: form.hp || undefined,
    email: form.email || undefined,
    penerimaKip: form.penerimaKip,
    nomorKip: form.nomorKip || undefined,
    penerimaKks: form.penerimaKks,
    nomorKks: form.nomorKks || undefined,
    ayah: payloadOrangTua(form.ayah),
    ibu: payloadOrangTua(form.ibu),
    wali: payloadOrangTua(form.wali),
  };
}

function labelReferensi(value: string): string {
  return value.replace(/_/g, ' ');
}

function pilihanReferensi(rows: ReferensiDapodikRow[] | undefined, fallback: string[]): Pilihan[] {
  if (rows?.length) {
    return rows.map((row) => ({ value: row.code, label: row.nama }));
  }
  return fallback.map((value) => ({ value, label: labelReferensi(value) }));
}

/**
 * Data Santri (EP-A) -- List, pendaftaran santri baru, dan perubahan status
 * akhir santri (lulus/keluar/pindah) untuk menutup alur alumni sederhana.
 *
 * Formulir mencakup seluruh atribut setara Dapodik ("Data Rinci Peserta
 * Didik") -- identitas kependudukan, kontak, program bantuan, dan data
 * rinci ayah/ibu/wali -- mengikuti migrasi
 * `20260802T340000__pesantren__dapodik_santri.sql`.
 */
export function PesantrenSantriPage() {
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [cari, setCari] = useState('');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(FORM_KOSONG);
  const [statusForm, setStatusForm] = useState<StatusForm | null>(null);

  const setOrangTua = (jenis: 'ayah' | 'ibu' | 'wali', field: keyof OrangTuaForm, value: string) =>
    setForm((f) => ({ ...f, [jenis]: { ...f[jenis], [field]: value } }));

  const queryKey = ['pesantren-santri', page, cari, status];
  const list = useQuery({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams({ halaman: String(page), ukuranHalaman: String(PAGE_SIZE) });
      if (cari) params.set('cari', cari);
      if (status) params.set('status', status);
      return api.get<{ items: SantriRow[]; total: number }>(`/pesantren/santri?${params.toString()}`);
    },
  });

  const refKebutuhanKhusus = useQuery({
    queryKey: ['pesantren-dapodik-referensi', 'KEBUTUHAN_KHUSUS'],
    queryFn: () => api.get<ReferensiDapodikRow[]>('/pesantren/dapodik/referensi/KEBUTUHAN_KHUSUS'),
    staleTime: 5 * 60 * 1000,
  });
  const refTransportasi = useQuery({
    queryKey: ['pesantren-dapodik-referensi', 'TRANSPORTASI'],
    queryFn: () => api.get<ReferensiDapodikRow[]>('/pesantren/dapodik/referensi/TRANSPORTASI'),
    staleTime: 5 * 60 * 1000,
  });
  const refPendidikan = useQuery({
    queryKey: ['pesantren-dapodik-referensi', 'PENDIDIKAN'],
    queryFn: () => api.get<ReferensiDapodikRow[]>('/pesantren/dapodik/referensi/PENDIDIKAN'),
    staleTime: 5 * 60 * 1000,
  });
  const refPekerjaan = useQuery({
    queryKey: ['pesantren-dapodik-referensi', 'PEKERJAAN'],
    queryFn: () => api.get<ReferensiDapodikRow[]>('/pesantren/dapodik/referensi/PEKERJAAN'),
    staleTime: 5 * 60 * 1000,
  });
  const refPenghasilan = useQuery({
    queryKey: ['pesantren-dapodik-referensi', 'PENGHASILAN'],
    queryFn: () => api.get<ReferensiDapodikRow[]>('/pesantren/dapodik/referensi/PENGHASILAN'),
    staleTime: 5 * 60 * 1000,
  });

  const create = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/pesantren/santri', payload),
    onSuccess: () => {
      toast.push('Santri berhasil dicatat.', 'success');
      setCreating(false);
      setForm(FORM_KOSONG);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-santri'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal menyimpan.'), 'error'),
  });

  const updateStatus = useMutation({
    mutationFn: (payload: StatusForm) => api.post(`/pesantren/santri/${payload.santri.id}/status`, {
      status: payload.status,
      tanggalKeluar: payload.tanggalKeluar,
      alasanKeluar: payload.alasanKeluar.trim() || undefined,
    }),
    onSuccess: () => {
      toast.push('Status santri diperbarui.', 'success');
      setStatusForm(null);
      void queryClient.invalidateQueries({ queryKey: ['pesantren-santri'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Gagal memperbarui status santri.'), 'error'),
  });

  const uploadExcel = useMutation({
    mutationFn: (rows: Array<Record<string, unknown>>) => {
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const content = XLSX.utils.sheet_to_csv(worksheet);
      return api.post<{ created: number; updated: number; skipped: number }>('/pesantren/dapodik/santri/import', {
        format: 'csv',
        content,
        dryRun: false,
      });
    },
    onSuccess: (payload) => {
      toast.push(`Upload selesai: ${payload.created} dibuat, ${payload.updated} diperbarui, ${payload.skipped} dilewati.`, 'success');
      void queryClient.invalidateQueries({ queryKey: ['pesantren-santri'] });
    },
    onError: (error) => toast.push(toMessage(error, (_key, fallback) => fallback ?? 'Upload Excel gagal.'), 'error'),
  });

  const columns: Array<GridColumn<SantriRow>> = [
    { key: 'nis', header: 'NIS' },
    { key: 'nisn', header: 'NISN', render: (row) => row.nisn ?? '-' },
    { key: 'nama_lengkap', header: 'Nama Lengkap' },
    {
      key: 'jenis_kelamin',
      header: 'JK',
      render: (row) => (row.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'),
    },
    { key: 'status_tinggal', header: 'Status Tinggal' },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'tanggal_masuk',
      header: 'Tanggal Masuk',
      render: (row) => formatDate(row.tanggal_masuk),
    },
    {
      key: 'tanggal_keluar',
      header: 'Tanggal Keluar',
      render: (row) => row.tanggal_keluar ? formatDate(row.tanggal_keluar) : '-',
    },
    {
      key: 'aksi',
      header: 'Aksi',
      render: (row) => row.status === 'AKTIF' ? (
        <div className="flex flex-wrap gap-2">
          {STATUS_AKHIR.map((item) => (
            <button
              key={item}
              type="button"
              className="btn-outline px-2 py-1 text-xs"
              onClick={() => setStatusForm({
                santri: row,
                status: item,
                tanggalKeluar: new Date().toISOString().slice(0, 10),
                alasanKeluar: '',
              })}
            >
              {item === 'LULUS' ? 'Lulus' : item === 'KELUAR' ? 'Keluar' : 'Pindah'}
            </button>
          ))}
        </div>
      ) : (
        <span className="text-xs text-slate-500">{row.alasan_keluar || 'Arsip'}</span>
      ),
    },
  ];

  const total = list.data?.total ?? 0;
  const rows = list.data?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const aktif = rows.filter((item) => item.status === 'AKTIF').length;
  const mukim = rows.filter((item) => item.status_tinggal === 'MUKIM').length;
  const nonmukim = rows.filter((item) => item.status_tinggal === 'NONMUKIM').length;
  const pilihanKebutuhanKhusus = pilihanReferensi(refKebutuhanKhusus.data, KEBUTUHAN_KHUSUS);
  const pilihanTransportasi = pilihanReferensi(refTransportasi.data, ALAT_TRANSPORTASI);
  const pilihanPendidikan = pilihanReferensi(refPendidikan.data, PENDIDIKAN_TERAKHIR);
  const pilihanPekerjaan = pilihanReferensi(refPekerjaan.data, PEKERJAAN_ORANG_TUA);
  const pilihanPenghasilan = pilihanReferensi(refPenghasilan.data, RENTANG_PENGHASILAN);

  return (
    <>
      <PageHeader
        title="Data Santri"
        description="Daftar santri dan pencatatan santri baru."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Pesantren' }, { label: 'Data Santri' }]}
        actions={
          <>
            <CrudActionBar
              title="Data Santri"
              rows={rows}
              columns={columns}
              filename="data-santri"
              uploadLabel={uploadExcel.isPending ? 'Mengupload...' : 'Upload Excel'}
              onUploadRows={async (uploadedRows) => {
                await uploadExcel.mutateAsync(uploadedRows);
              }}
            />
            <button type="button" className="btn-primary" onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" aria-hidden />
              Catat Santri Baru
            </button>
          </>
        }
      />

      <CrudDashboard
        metrics={[
          { label: 'Total Data', value: total, tone: 'emerald' },
          { label: 'Aktif di halaman ini', value: aktif, tone: 'sky' },
          { label: 'Mukim', value: mukim, tone: 'amber' },
          { label: 'Nonmukim', value: nonmukim, tone: 'slate' },
        ]}
      />

      <div className="card mb-4 p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="field-label" htmlFor="santri-cari">
              Cari (nama, NIS, atau NISN)
            </label>
            <input
              id="santri-cari"
              className="field-input"
              value={cari}
              onChange={(event) => {
                setCari(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="min-w-[160px]">
            <label className="field-label" htmlFor="santri-status">
              Status
            </label>
            <select
              id="santri-status"
              className="field-input"
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
            >
              <option value="">Semua</option>
              <option value="AKTIF">Aktif</option>
              <option value="LULUS">Lulus</option>
              <option value="KELUAR">Keluar</option>
              <option value="PINDAH">Pindah</option>
            </select>
          </div>
        </div>
      </div>

      <DataGrid
        columns={columns}
        rows={rows}
        loading={list.isLoading}
        error={list.isError ? toMessage(list.error, (_key, fallback) => fallback ?? 'Gagal memuat.') : undefined}
        rowKey={(row) => row.id}
        onRetry={() => void list.refetch()}
        showCrudTools={false}
      />

      <Pagination page={page} totalPages={totalPages} total={total} onChange={setPage} />

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Catat Santri Baru</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Formulir mencakup atribut setara Dapodik. Hanya NIS, nama, jenis kelamin, dan status
              tinggal yang wajib -- sisanya boleh dilengkapi belakangan.
            </p>

            <SeksiForm judul="Identitas Pokok">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="NIS *">
                  <input className="field-input" value={form.nis} onChange={(e) => setForm({ ...form, nis: e.target.value })} />
                </Field>
                <Field label="NISN (10 digit)">
                  <input className="field-input" value={form.nisn} onChange={(e) => setForm({ ...form, nisn: e.target.value })} />
                </Field>
              </div>
              <Field label="Nama Lengkap *">
                <input className="field-input" value={form.namaLengkap} onChange={(e) => setForm({ ...form, namaLengkap: e.target.value })} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Jenis Kelamin *">
                  <select className="field-input" value={form.jenisKelamin} onChange={(e) => setForm({ ...form, jenisKelamin: e.target.value })}>
                    {JENIS_KELAMIN.map((j) => <option key={j} value={j}>{j === 'L' ? 'Laki-laki' : 'Perempuan'}</option>)}
                  </select>
                </Field>
                <Field label="Status Tinggal *">
                  <select className="field-input" value={form.statusTinggal} onChange={(e) => setForm({ ...form, statusTinggal: e.target.value })}>
                    {STATUS_TINGGAL.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tempat Lahir">
                  <input className="field-input" value={form.tempatLahir} onChange={(e) => setForm({ ...form, tempatLahir: e.target.value })} />
                </Field>
                <Field label="Tanggal Lahir">
                  <input type="date" className="field-input" value={form.tanggalLahir} onChange={(e) => setForm({ ...form, tanggalLahir: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="NIK (16 digit)">
                  <input className="field-input" value={form.nik} onChange={(e) => setForm({ ...form, nik: e.target.value })} />
                </Field>
                <Field label="Nomor Kartu Keluarga">
                  <input className="field-input" value={form.nomorKk} onChange={(e) => setForm({ ...form, nomorKk: e.target.value })} />
                </Field>
              </div>
              <Field label="NIPD (nomor induk lokal pondok)">
                <input className="field-input" value={form.nipd} onChange={(e) => setForm({ ...form, nipd: e.target.value })} />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Agama">
                  <select className="field-input" value={form.agama} onChange={(e) => setForm({ ...form, agama: e.target.value })}>
                    <option value="">- Pilih -</option>
                    {AGAMA.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </Field>
                <Field label="Kewarganegaraan">
                  <input className="field-input" value={form.kewarganegaraan} onChange={(e) => setForm({ ...form, kewarganegaraan: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Kebutuhan Khusus">
                  <select className="field-input" value={form.kebutuhanKhusus} onChange={(e) => setForm({ ...form, kebutuhanKhusus: e.target.value })}>
                    {pilihanKebutuhanKhusus.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </Field>
                <Field label="Anak ke-">
                  <input type="number" min="1" className="field-input" value={form.anakKe} onChange={(e) => setForm({ ...form, anakKe: e.target.value })} />
                </Field>
                <Field label="Jumlah Saudara">
                  <input type="number" min="0" className="field-input" value={form.jumlahSaudara} onChange={(e) => setForm({ ...form, jumlahSaudara: e.target.value })} />
                </Field>
              </div>
              <Field label="Alamat Asal">
                <input className="field-input" value={form.alamatAsal} onChange={(e) => setForm({ ...form, alamatAsal: e.target.value })} />
              </Field>
            </SeksiForm>

            <SeksiForm judul="Kontak dan Transportasi">
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Alat Transportasi">
                  <select className="field-input" value={form.alatTransportasi} onChange={(e) => setForm({ ...form, alatTransportasi: e.target.value })}>
                    <option value="">- Pilih -</option>
                    {pilihanTransportasi.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </Field>
                <Field label="Jarak Tempat Tinggal (km)">
                  <input type="number" step="0.1" min="0" className="field-input" value={form.jarakTempatTinggalKm} onChange={(e) => setForm({ ...form, jarakTempatTinggalKm: e.target.value })} />
                </Field>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Telepon">
                  <input className="field-input" value={form.telepon} onChange={(e) => setForm({ ...form, telepon: e.target.value })} />
                </Field>
                <Field label="HP">
                  <input className="field-input" value={form.hp} onChange={(e) => setForm({ ...form, hp: e.target.value })} />
                </Field>
                <Field label="Email">
                  <input type="email" className="field-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                </Field>
              </div>
            </SeksiForm>

            <SeksiForm judul="Program Bantuan">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.penerimaKip} onChange={(e) => setForm({ ...form, penerimaKip: e.target.checked })} />
                  Penerima KIP
                </label>
                <Field label="Nomor KIP">
                  <input className="field-input" value={form.nomorKip} onChange={(e) => setForm({ ...form, nomorKip: e.target.value })} disabled={!form.penerimaKip} />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.penerimaKks} onChange={(e) => setForm({ ...form, penerimaKks: e.target.checked })} />
                  Penerima KKS
                </label>
                <Field label="Nomor KKS">
                  <input className="field-input" value={form.nomorKks} onChange={(e) => setForm({ ...form, nomorKks: e.target.value })} disabled={!form.penerimaKks} />
                </Field>
              </div>
            </SeksiForm>

            <SeksiOrangTua
              judul="Data Ayah Kandung"
              data={form.ayah}
              pilihanPendidikan={pilihanPendidikan}
              pilihanPekerjaan={pilihanPekerjaan}
              pilihanPenghasilan={pilihanPenghasilan}
              onChange={(field, value) => setOrangTua('ayah', field, value)}
            />
            <SeksiOrangTua
              judul="Data Ibu Kandung"
              data={form.ibu}
              pilihanPendidikan={pilihanPendidikan}
              pilihanPekerjaan={pilihanPekerjaan}
              pilihanPenghasilan={pilihanPenghasilan}
              onChange={(field, value) => setOrangTua('ibu', field, value)}
            />
            <SeksiOrangTua
              judul="Data Wali (bila bukan ayah/ibu kandung)"
              data={form.wali}
              pilihanPendidikan={pilihanPendidikan}
              pilihanPekerjaan={pilihanPekerjaan}
              pilihanPenghasilan={pilihanPenghasilan}
              onChange={(field, value) => setOrangTua('wali', field, value)}
            />

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                className="btn-outline"
                onClick={() => {
                  setCreating(false);
                  setForm(FORM_KOSONG);
                }}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn-primary"
                disabled={!form.nis || !form.namaLengkap || create.isPending}
                onClick={() => create.mutate(bangunPayload(form))}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {statusForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="card w-full max-w-lg p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ubah Status Santri</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {statusForm.santri.nama_lengkap} akan dipindahkan dari daftar aktif menjadi arsip {statusForm.status.toLowerCase()}.
            </p>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Field label="Status Baru">
                <select
                  className="field-input"
                  value={statusForm.status}
                  onChange={(event) => setStatusForm({ ...statusForm, status: event.target.value as StatusAkhir })}
                >
                  <option value="LULUS">Lulus</option>
                  <option value="KELUAR">Keluar</option>
                  <option value="PINDAH">Pindah</option>
                </select>
              </Field>
              <Field label="Tanggal Keluar">
                <input
                  type="date"
                  className="field-input"
                  value={statusForm.tanggalKeluar}
                  onChange={(event) => setStatusForm({ ...statusForm, tanggalKeluar: event.target.value })}
                />
              </Field>
            </div>
            <div className="mt-3">
              <Field label="Alasan / Catatan BK">
                <textarea
                  className="field-input min-h-24"
                  value={statusForm.alasanKeluar}
                  onChange={(event) => setStatusForm({ ...statusForm, alasanKeluar: event.target.value })}
                  placeholder="Contoh: lulus tahun ajaran 2025/2026, pindah domisili, atau catatan pembinaan."
                />
              </Field>
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setStatusForm(null)}>Batal</button>
              <button
                type="button"
                className="btn-primary"
                disabled={!statusForm.tanggalKeluar || updateStatus.isPending}
                onClick={() => updateStatus.mutate(statusForm)}
              >
                Simpan Status
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SeksiForm({ judul, children }: { judul: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-slate-200 pt-4 first:mt-4 first:border-t-0 first:pt-0 dark:border-slate-800">
      <h3 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-300">{judul}</h3>
      <div className="space-y-3">{children}</div>
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

function SeksiOrangTua({
  judul,
  data,
  pilihanPendidikan,
  pilihanPekerjaan,
  pilihanPenghasilan,
  onChange,
}: {
  judul: string;
  data: OrangTuaForm;
  pilihanPendidikan: Pilihan[];
  pilihanPekerjaan: Pilihan[];
  pilihanPenghasilan: Pilihan[];
  onChange: (field: keyof OrangTuaForm, value: string) => void;
}) {
  return (
    <SeksiForm judul={judul}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Nama">
          <input className="field-input" value={data.nama} onChange={(e) => onChange('nama', e.target.value)} />
        </Field>
        <Field label="NIK (16 digit)">
          <input className="field-input" value={data.nik} onChange={(e) => onChange('nik', e.target.value)} />
        </Field>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Tahun Lahir">
          <input type="number" className="field-input" value={data.tahunLahir} onChange={(e) => onChange('tahunLahir', e.target.value)} />
        </Field>
        <Field label="Pendidikan">
          <select className="field-input" value={data.pendidikan} onChange={(e) => onChange('pendidikan', e.target.value)}>
            <option value="">- Pilih -</option>
            {pilihanPendidikan.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Field>
        <Field label="Pekerjaan">
          <select className="field-input" value={data.pekerjaan} onChange={(e) => onChange('pekerjaan', e.target.value)}>
            <option value="">- Pilih -</option>
            {pilihanPekerjaan.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Penghasilan">
        <select className="field-input" value={data.penghasilan} onChange={(e) => onChange('penghasilan', e.target.value)}>
          <option value="">- Pilih -</option>
          {pilihanPenghasilan.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </Field>
    </SeksiForm>
  );
}
