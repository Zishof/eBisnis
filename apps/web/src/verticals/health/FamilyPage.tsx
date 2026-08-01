/**
 * Folder keluarga Puskesmas.
 *
 * ## Mengapa Puskesmas bekerja pada keluarga, bukan pada individu
 *
 * Anak yang gizinya buruk hampir selalu punya saudara yang gizinya juga buruk —
 * sebabnya ada di rumah, bukan pada anaknya. Kunjungan yang hanya menyasar satu
 * anak akan melewati yang lain, dan yang terlewat baru muncul pada penimbangan
 * berikutnya.
 *
 * Karena itu layar ini menampilkan **seluruh anggota beserta status gizi
 * terakhirnya sekaligus**, bukan satu per satu. Yang perlu terlihat adalah
 * polanya: tiga dari empat anak pada satu folder bergizi kurang bukan kebetulan
 * tiga kali, melainkan satu keadaan rumah tangga.
 *
 * ## Anggota yang sudah terdaftar di folder lain
 *
 * Peladen melaporkannya (`alreadyElsewhere`) **tanpa menggagalkan pembuatan
 * foldernya**, dan layar ini menampilkannya apa adanya. Keluarga sungguhan
 * pindah, bercerai, dan menitipkan anak; folder yang menolak dibuat karena satu
 * anggotanya terdaftar di tempat lain akan membuat petugas mengarang nama.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FolderPlus, Home, Info, Users } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader, useToast } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import {
  healthApi,
  umurDari,
  LABEL_HUBUNGAN_KELUARGA,
  RUPA_GIZI,
  type AnggotaKeluarga,
} from './health-api';
import { PurposeSelector, usePurpose } from './PurposeGate';

function Lencana({ status }: { status: string | null }) {
  if (!status) return <span className="text-slate-400">—</span>;
  const rupa = RUPA_GIZI[status];
  if (!rupa) return <Code>{status}</Code>;
  return <span className={`badge ${rupa.kelas}`}>{rupa.label}</span>;
}

/**
 * Berapa anggota folder yang keadaan gizinya menuntut tindakan.
 *
 * Dihitung dan ditampilkan sebagai satu angka: yang membaca "3 dari 4 anak
 * perlu perhatian" bertanya soal rumahnya, sedangkan yang membaca empat baris
 * terpisah menilai empat anak.
 */
function jumlahMendesak(anggota: AnggotaKeluarga[]): number {
  return anggota.filter((a) =>
    [a.waz_status, a.haz_status, a.whz_status].some((s) => s && RUPA_GIZI[s]?.mendesak),
  ).length;
}

export function FamilyPage() {
  const { ctx } = usePurpose();
  const toast = useToast();
  const toMessage = useErrorMessage();
  const queryClient = useQueryClient();

  const [folderId, setFolderId] = useState('');
  const [dibuka, setDibuka] = useState<string | null>(null);
  const [buatBaru, setBuatBaru] = useState(false);
  const [baru, setBaru] = useState({
    familyCardNumber: '',
    addressText: '',
    rt: '',
    rw: '',
    village: '',
    posyanduName: '',
  });
  const [terdaftarLain, setTerdaftarLain] = useState<string[]>([]);

  const fasilitas = useQuery({
    queryKey: ['health', 'facilities'],
    queryFn: () => healthApi.facilities(),
  });
  const facilityId = fasilitas.data?.[0]?.id ?? null;

  const isi = useQuery({
    queryKey: ['health', 'family-folder', dibuka],
    queryFn: () => healthApi.familyFolder(dibuka as string, ctx),
    enabled: Boolean(dibuka),
  });

  const buat = useMutation({
    mutationFn: (body: Record<string, unknown>) => healthApi.createFamilyFolder(body, ctx),
    onSuccess: (hasil) => {
      toast.push(`Folder ${hasil.folderNumber} dibuat.`, 'success');
      setTerdaftarLain(hasil.alreadyElsewhere ?? []);
      setBuatBaru(false);
      setDibuka(hasil.id);
      setBaru({
        familyCardNumber: '',
        addressText: '',
        rt: '',
        rw: '',
        village: '',
        posyanduName: '',
      });
      void queryClient.invalidateQueries({ queryKey: ['health', 'family-folder'] });
    },
    onError: (e) => toast.push(toMessage(e, (k, f) => f ?? k), 'error'),
  });

  const anggota = isi.data?.members ?? [];
  const mendesak = jumlahMendesak(anggota);

  return (
    <>
      <PageHeader
        title="Folder Keluarga"
        description="Puskesmas bekerja pada keluarga, bukan pada individu yang kebetulan datang."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Folder Keluarga' }]}
        actions={
          <button type="button" className="btn-primary" onClick={() => setBuatBaru((v) => !v)}>
            <FolderPlus className="h-4 w-4" aria-hidden />
            Folder baru
          </button>
        }
      />

      <PurposeSelector />

      {buatBaru && (
        <div className="card mb-4 space-y-3 px-4 py-4">
          <h2 className="font-medium text-slate-900 dark:text-slate-100">Folder keluarga baru</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="kk">
                Nomor Kartu Keluarga
              </label>
              <input
                id="kk"
                className="field-input"
                value={baru.familyCardNumber}
                onChange={(e) => setBaru({ ...baru, familyCardNumber: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="desa">
                Desa / kelurahan
              </label>
              <input
                id="desa"
                className="field-input"
                value={baru.village}
                onChange={(e) => setBaru({ ...baru, village: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="rt">
                RT
              </label>
              <input
                id="rt"
                className="field-input"
                value={baru.rt}
                onChange={(e) => setBaru({ ...baru, rt: e.target.value })}
              />
            </div>
            <div>
              <label className="field-label" htmlFor="rw">
                RW
              </label>
              <input
                id="rw"
                className="field-input"
                value={baru.rw}
                onChange={(e) => setBaru({ ...baru, rw: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="alamat">
                Alamat
              </label>
              <textarea
                id="alamat"
                className="field-input min-h-[4rem]"
                value={baru.addressText}
                onChange={(e) => setBaru({ ...baru, addressText: e.target.value })}
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Alamat yang dapat ditemukan kader, bukan alamat KTP. Keduanya sering berbeda, dan
                yang menentukan kunjungan rumah adalah yang pertama.
              </p>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label" htmlFor="posyandu-folder">
                Posyandu
              </label>
              <input
                id="posyandu-folder"
                className="field-input"
                value={baru.posyanduName}
                onChange={(e) => setBaru({ ...baru, posyanduName: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={buat.isPending || !facilityId}
              onClick={() =>
                buat.mutate({
                  facilityId,
                  familyCardNumber: baru.familyCardNumber || undefined,
                  addressText: baru.addressText || undefined,
                  rt: baru.rt || undefined,
                  rw: baru.rw || undefined,
                  village: baru.village || undefined,
                  posyanduName: baru.posyanduName || undefined,
                })
              }
            >
              Buat folder
            </button>
            <button type="button" className="btn-ghost" onClick={() => setBuatBaru(false)}>
              Batal
            </button>
          </div>
        </div>
      )}

      {terdaftarLain.length > 0 && (
        <div className="card mb-4 flex items-start gap-2 px-4 py-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
          <div>
            <p className="text-slate-800 dark:text-slate-200">
              {terdaftarLain.length} anggota sudah terdaftar pada folder lain:{' '}
              {terdaftarLain.join(', ')}.
            </p>
            <p className="mt-1 text-slate-500 dark:text-slate-400">
              Foldernya tetap dibuat. Keluarga sungguhan pindah, bercerai, dan menitipkan anak —
              folder yang menolak dibuat karena satu anggotanya terdaftar di tempat lain akan
              membuat petugas mengarang nama.
            </p>
          </div>
        </div>
      )}

      <div className="card mb-4 px-4 py-4">
        <label className="field-label" htmlFor="buka-folder">
          Buka folder
        </label>
        <div className="flex gap-2">
          <input
            id="buka-folder"
            className="field-input"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && folderId.trim()) setDibuka(folderId.trim());
            }}
            placeholder="Nomor folder (UUID)"
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={!folderId.trim()}
            onClick={() => setDibuka(folderId.trim())}
          >
            <Users className="h-4 w-4" aria-hidden />
            Buka
          </button>
        </div>
      </div>

      {isi.isLoading && <LoadingState label="Memuat anggota keluarga…" />}
      {isi.isError && <ErrorState message={toMessage(isi.error, (k, f) => f ?? k)} onRetry={() => void isi.refetch()} />}

      {isi.data && anggota.length === 0 && (
        <EmptyState
          title="Folder ini belum punya anggota"
          description="Tambahkan anggota lewat pendaftaran pasien, lalu kaitkan ke folder ini."
        />
      )}

      {anggota.length > 0 && (
        <>
          {mendesak >= 2 && (
            <div className="card mb-3 flex items-start gap-2 border-2 border-amber-300 px-4 py-3 text-sm dark:border-amber-800">
              <Home className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <p className="text-amber-900 dark:text-amber-200">
                <strong>
                  {mendesak} dari {anggota.length} anggota
                </strong>{' '}
                keadaan gizinya menuntut perhatian. Lebih dari satu pada satu folder jarang
                kebetulan — sebabnya biasanya ada di rumah, dan kunjungan rumah menemukannya lebih
                cepat daripada penimbangan berikutnya.
              </p>
            </div>
          )}

          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800">
                <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2 text-start font-medium">Nama</th>
                  <th className="px-3 py-2 text-start font-medium">Hubungan</th>
                  <th className="px-3 py-2 text-start font-medium">Umur</th>
                  <th className="px-3 py-2 text-start font-medium">BB/U</th>
                  <th className="px-3 py-2 text-start font-medium">TB/U</th>
                  <th className="px-3 py-2 text-start font-medium">BB/TB</th>
                  <th className="px-3 py-2 text-start font-medium">Diukur</th>
                </tr>
              </thead>
              <tbody>
                {anggota.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="px-3 py-2 font-medium">{a.full_name}</td>
                    <td className="px-3 py-2">
                      {LABEL_HUBUNGAN_KELUARGA[a.relationship] ?? a.relationship}
                    </td>
                    <td className="px-3 py-2">{umurDari(a.birth_date)}</td>
                    <td className="px-3 py-2">
                      <Lencana status={a.waz_status} />
                    </td>
                    <td className="px-3 py-2">
                      <Lencana status={a.haz_status} />
                    </td>
                    <td className="px-3 py-2">
                      <Lencana status={a.whz_status} />
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {a.last_measured_at?.slice(0, 10) ?? '—'}
                      {(a.weight_flat_count ?? 0) >= 2 && (
                        <span className="ms-2 badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          BB tetap {a.weight_flat_count}×
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
