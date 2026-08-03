/**
 * Tarif: peraturan dan versi tarif.
 *
 * ## Peraturan yang dicabut tetap ditampilkan
 *
 * `revoked_at` dan `revokes_reference` membentuk rantai: peraturan baru
 * mencabut yang lama. Layar yang hanya menampilkan yang berlaku membuat
 * pertanyaan "tarif mana yang dipakai pada layanan bulan Maret" tidak dapat
 * dijawab — dan itu pertanyaan yang muncul setiap kali klaim lama ditolak.
 *
 * ## Versi yang belum disetujui tidak dapat aktif
 *
 * `imported_at` → `approved_at` → `is_active` adalah tiga keadaan yang berbeda,
 * dan layar ini menampilkan ketiganya terpisah. Versi yang terimpor tetapi
 * belum disetujui berisi angka yang belum diperiksa siapa pun; menampilkannya
 * sebagai "ada" tanpa membedakannya dari yang aktif akan membuat orang
 * memakainya.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Scale } from 'lucide-react';
import { Code, EmptyState, ErrorState, LoadingState, PageHeader } from '../../components/ui';
import { useErrorMessage } from '../../app/auth-context';
import { healthApi } from './health-api';

const tanggal = (t: string | null) => (t ? t.slice(0, 10) : '—');

export function TariffPage() {
  const toMessage = useErrorMessage();
  const [tampilkanDicabut, setTampilkanDicabut] = useState(true);

  const peraturan = useQuery({
    queryKey: ['health', 'tariff-regulations'],
    queryFn: () => healthApi.tariffRegulations(),
  });

  const versi = useQuery({
    queryKey: ['health', 'tariff-versions'],
    queryFn: () => healthApi.tariffVersions(),
  });

  const daftarPeraturan = (peraturan.data ?? []).filter(
    (p) => tampilkanDicabut || !p.revoked_at,
  );
  const versiAktif = (versi.data ?? []).filter((v) => v.is_active);
  const belumDisetujui = (versi.data ?? []).filter((v) => !v.approved_at && !v.retired_at);

  return (
    <>
      <PageHeader
        title="Tarif"
        description="Peraturan yang dicabut tetap ditampilkan — tarif mana yang berlaku bulan lalu adalah pertanyaan yang muncul setiap kali klaim lama ditolak."
        breadcrumbs={[{ label: 'Beranda', href: '/app' }, { label: 'Tarif' }]}
      />

      <div className="card mb-4 flex flex-wrap items-center gap-6 px-4 py-4">
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">Versi aktif</p>
          <p className="text-2xl font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {versiAktif.length}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase text-slate-500 dark:text-slate-400">
            Terimpor, belum disetujui
          </p>
          <p
            className={`text-2xl font-semibold tabular-nums ${
              belumDisetujui.length > 0 ? 'text-amber-700 dark:text-amber-400' : 'text-slate-400'
            }`}
          >
            {belumDisetujui.length}
          </p>
        </div>
        <p className="max-w-md text-xs text-slate-500 dark:text-slate-400">
          Versi yang terimpor tetapi belum disetujui berisi angka yang belum diperiksa siapa pun.
          Ia sengaja dihitung terpisah dari yang aktif.
        </p>
      </div>

      <h2 className="mb-2 inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
        <FileText className="h-4 w-4" aria-hidden />
        Versi tarif
      </h2>

      {versi.isLoading && <LoadingState label="Memuat versi tarif…" />}
      {versi.isError && (
        <ErrorState
          message={toMessage(versi.error, (k, f) => f ?? k)}
          onRetry={() => void versi.refetch()}
        />
      )}
      {versi.data?.length === 0 && (
        <EmptyState
          title="Belum ada versi tarif"
          description="Tarif diimpor sebagai versi berangka, bukan diketik satu per satu — supaya angka bulan lalu tetap dapat dijelaskan dengan peraturan bulan lalu."
        />
      )}

      {versi.data && versi.data.length > 0 && (
        <div className="card mb-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Kode</th>
                <th className="px-3 py-2 text-start font-medium">Nama</th>
                <th className="px-3 py-2 text-start font-medium">Peraturan</th>
                <th className="px-3 py-2 text-end font-medium">Baris</th>
                <th className="px-3 py-2 text-start font-medium">Keadaan</th>
              </tr>
            </thead>
            <tbody>
              {versi.data.map((v) => (
                <tr key={v.id} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                  <td className="px-3 py-2">
                    <Code>{v.code}</Code>
                  </td>
                  <td className="px-3 py-2">{v.name}</td>
                  <td className="px-3 py-2">
                    {v.regulation_reference ? <Code>{v.regulation_reference}</Code> : '—'}
                  </td>
                  <td
                    className={`px-3 py-2 text-end tabular-nums ${
                      v.row_count === 0 ? 'text-amber-700 dark:text-amber-400' : ''
                    }`}
                  >
                    {v.row_count}
                  </td>
                  {/*
                    Tiga keadaan yang BERBEDA, ditampilkan terpisah: terimpor,
                    disetujui, aktif. Meringkasnya menjadi satu lencana membuat
                    versi yang angkanya belum diperiksa siapa pun tampak sama
                    dengan versi yang sudah dipakai menagih.
                  */}
                  <td className="px-3 py-2">
                    <span className="flex flex-wrap gap-1">
                      {v.is_active && (
                        <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                          aktif
                        </span>
                      )}
                      {v.approved_at ? (
                        <span className="badge bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                          disetujui {tanggal(v.approved_at)}
                        </span>
                      ) : (
                        <span className="badge bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          belum disetujui
                        </span>
                      )}
                      {v.retired_at && (
                        <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          ditarik
                        </span>
                      )}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="inline-flex items-center gap-2 font-medium text-slate-900 dark:text-slate-100">
          <Scale className="h-4 w-4" aria-hidden />
          Peraturan tarif
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={tampilkanDicabut}
            onChange={(e) => setTampilkanDicabut(e.target.checked)}
          />
          Tampilkan yang sudah dicabut
        </label>
      </div>

      {peraturan.data?.length === 0 && <EmptyState title="Belum ada peraturan tarif tercatat" />}

      {daftarPeraturan.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 dark:border-slate-800">
              <tr className="text-xs uppercase text-slate-500 dark:text-slate-400">
                <th className="px-3 py-2 text-start font-medium">Rujukan</th>
                <th className="px-3 py-2 text-start font-medium">Judul</th>
                <th className="px-3 py-2 text-start font-medium">Lingkup</th>
                <th className="px-3 py-2 text-start font-medium">Berlaku</th>
                <th className="px-3 py-2 text-start font-medium">Keadaan</th>
              </tr>
            </thead>
            <tbody>
              {daftarPeraturan.map((p) => (
                <tr
                  key={p.id}
                  className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${
                    p.revoked_at ? 'opacity-60' : ''
                  }`}
                >
                  <td className="px-3 py-2">
                    <Code>{p.reference}</Code>
                  </td>
                  <td className="px-3 py-2">{p.title}</td>
                  <td className="px-3 py-2">{p.scope ?? '—'}</td>
                  <td className="px-3 py-2">{tanggal(p.effective_from)}</td>
                  <td className="px-3 py-2">
                    {p.revoked_at ? (
                      <span className="text-slate-500 dark:text-slate-400">
                        dicabut {tanggal(p.revoked_at)}
                        {p.revokes_reference && (
                          <>
                            {' '}
                            oleh <Code>{p.revokes_reference}</Code>
                          </>
                        )}
                      </span>
                    ) : (
                      <span className="badge bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                        berlaku
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
            Yang dicabut tidak dihapus. Klaim atas layanan bulan lalu dinilai dengan peraturan
            bulan lalu, dan peraturan yang hilang membuat penolakannya tidak dapat dibantah.
          </p>
        </div>
      )}
    </>
  );
}
