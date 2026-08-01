/**
 * Anjungan Mandiri Desa — layar sentuh di kantor desa.
 *
 * Delapan fungsi dari presentasi: cetak surat mandiri, cek status, ambil
 * antrean, ajukan surat, pengumuman dan info bantuan, lapor, buku tamu, dan
 * absensi ronda — ditambah panduan langkah demi langkah.
 *
 * ## Yang menentukan bentuk halaman ini
 *
 * 1. **Dipakai berdiri, dengan jari, oleh orang yang tidak memilih memakai
 *    sistem ini.** Tombol setinggi 64 piksel ke atas, teks 18 piksel ke atas,
 *    dan tidak ada yang perlu digulir untuk ditemukan.
 * 2. **Sesi berakhir sendiri dan menghapus jejaknya.** Dua menit tanpa
 *    sentuhan; peringatan dua puluh detik sebelumnya supaya warga yang sedang
 *    membaca surat tidak kehilangannya di tengah kalimat. Setiap kembali ke
 *    layar utama mengosongkan seluruh isian.
 * 3. **Tidak ada pencarian warga.** Yang membuka berkas hanyalah kode ambil.
 */

import { useCallback, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  FilePlus,
  HelpCircle,
  Home,
  Megaphone,
  MessageSquareWarning,
  Printer,
  Search,
  Shield,
  Ticket,
} from 'lucide-react';
import {
  formatKode,
  useAbsenRonda,
  useAjukanSurat,
  useAmbilAntrean,
  useBukuTamu,
  useCekStatus,
  useCetakSurat,
  useKioskIdle,
  useLayanan,
  useLayarUtama,
  useLapor,
  usePanduan,
  usePengumuman,
} from './useKiosk';
import { KioskKeypad } from './KioskKeypad';

type Layar =
  | 'UTAMA'
  | 'CETAK_SURAT'
  | 'CEK_STATUS'
  | 'ANTREAN'
  | 'AJUKAN_SURAT'
  | 'PENGUMUMAN'
  | 'LAPOR'
  | 'BUKU_TAMU'
  | 'RONDA'
  | 'PANDUAN';

const IKON: Record<string, LucideIcon> = {
  printer: Printer,
  search: Search,
  ticket: Ticket,
  'file-plus': FilePlus,
  megaphone: Megaphone,
  'message-square-warning': MessageSquareWarning,
  'book-open': BookOpen,
  shield: Shield,
  'help-circle': HelpCircle,
};

function Tombol({
  children,
  onClick,
  nada = 'utama',
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  nada?: 'utama' | 'kedua' | 'bahaya';
  disabled?: boolean;
}) {
  const gaya =
    nada === 'utama'
      ? 'bg-emerald-600 text-white active:bg-emerald-700'
      : nada === 'bahaya'
        ? 'bg-rose-600 text-white active:bg-rose-700'
        : 'border-2 border-slate-300 bg-white text-slate-900 active:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-[4rem] rounded-xl px-8 text-xl font-semibold disabled:opacity-40 ${gaya}`}
    >
      {children}
    </button>
  );
}

function Isian({
  label,
  nilai,
  onUbah,
  petunjuk,
  panjang,
}: {
  label: string;
  nilai: string;
  onUbah: (v: string) => void;
  petunjuk?: string;
  panjang?: number;
}) {
  return (
    <label className="block">
      <span className="text-lg font-medium text-slate-800 dark:text-slate-100">{label}</span>
      {petunjuk ? (
        <span className="mt-0.5 block text-base text-slate-500 dark:text-slate-400">{petunjuk}</span>
      ) : null}
      <input
        value={nilai}
        onChange={(e) => onUbah(e.target.value)}
        maxLength={panjang}
        className="mt-2 min-h-[3.5rem] w-full rounded-lg border-2 border-slate-300 px-4 text-xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />
    </label>
  );
}

export function KioskPage() {
  const [layar, setLayar] = useState<Layar>('UTAMA');
  const [kode, setKode] = useState('');
  const [isian, setIsian] = useState<Record<string, string>>({});
  const [anonim, setAnonim] = useState(false);

  const utama = useLayarUtama();
  const panduan = usePanduan();
  const pengumuman = usePengumuman();
  const layanan = useLayanan();

  const cekStatus = useCekStatus();
  const cetakSurat = useCetakSurat();
  const ambilAntrean = useAmbilAntrean();
  const ajukanSurat = useAjukanSurat();
  const lapor = useLapor();
  const bukuTamu = useBukuTamu();
  const absenRonda = useAbsenRonda();

  /**
   * Kembali ke layar utama SAMBIL mengosongkan seluruh jejak.
   *
   * Bukan sekadar berpindah layar: isian, kode ambil, dan hasil pemanggilan
   * ikut dibuang. Warga berikutnya berdiri di depan layar yang sama kurang dari
   * satu menit kemudian.
   */
  const pulang = useCallback(() => {
    setLayar('UTAMA');
    setKode('');
    setIsian({});
    setAnonim(false);
    cekStatus.reset();
    cetakSurat.reset();
    ambilAntrean.reset();
    ajukanSurat.reset();
    lapor.reset();
    bukuTamu.reset();
    absenRonda.reset();
  }, [cekStatus, cetakSurat, ambilAntrean, ajukanSurat, lapor, bukuTamu, absenRonda]);

  const idle = useKioskIdle(pulang, layar !== 'UTAMA');
  const ubah = (k: string) => (v: string) => setIsian((s) => ({ ...s, [k]: v }));

  // --- Layar utama ----------------------------------------------------------
  if (layar === 'UTAMA') {
    return (
      <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950 sm:p-10">
        <header className="mx-auto mb-10 max-w-5xl text-center">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-50 sm:text-5xl">
            {utama.data?.greeting ?? 'Anjungan Mandiri Desa'}
          </h1>
          <p className="mt-3 text-xl text-slate-600 dark:text-slate-300">
            Sentuh salah satu pilihan di bawah ini
          </p>
        </header>

        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(utama.data?.menu ?? []).map((m) => {
            const Ikon = IKON[m.icon] ?? HelpCircle;
            return (
              <button
                key={m.code}
                type="button"
                onClick={() => setLayar(m.code as Layar)}
                className="flex min-h-[9rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-slate-200 bg-white p-6 text-center active:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:active:bg-slate-800"
              >
                <Ikon size={40} aria-hidden />
                <span className="text-2xl font-bold text-slate-900 dark:text-slate-50">
                  {m.label}
                </span>
                <span className="text-base text-slate-600 dark:text-slate-400">
                  {m.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // --- Kerangka layar bagian dalam ------------------------------------------
  const Kerangka = ({ judul, children }: { judul: string; children: React.ReactNode }) => (
    <div className="min-h-screen bg-slate-50 p-6 dark:bg-slate-950 sm:p-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={pulang}
            className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-xl border-2 border-slate-300 px-6 text-lg font-semibold text-slate-800 active:bg-slate-100 dark:border-slate-600 dark:text-slate-100"
          >
            <ArrowLeft size={22} aria-hidden /> Kembali
          </button>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50 sm:text-3xl">
            {judul}
          </h1>
          <button
            type="button"
            onClick={pulang}
            aria-label="Layar utama"
            className="inline-flex min-h-[3.5rem] min-w-[3.5rem] items-center justify-center rounded-xl border-2 border-slate-300 active:bg-slate-100 dark:border-slate-600"
          >
            <Home size={22} aria-hidden />
          </button>
        </div>

        {/* Peringatan sesi. Tanpa ini, warga yang sedang membaca surat akan
            kehilangannya di tengah kalimat dan mengira anjungannya rusak. */}
        {idle.memperingatkan ? (
          <div className="mb-6 flex items-center gap-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4 text-lg text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            <AlertTriangle size={24} aria-hidden />
            <span>
              Layar kembali ke awal dalam {idle.sisaDetik} detik. Sentuh layar bila masih dipakai.
            </span>
          </div>
        ) : null}

        {children}
      </div>
    </div>
  );

  // --- Cetak surat ----------------------------------------------------------
  if (layar === 'CETAK_SURAT' || layar === 'CEK_STATUS') {
    const cetak = layar === 'CETAK_SURAT';
    const aksi = cetak ? cetakSurat : cekStatus;
    const judul = cetak ? 'Cetak Surat' : 'Cek Status Pengajuan';

    return (
      <Kerangka judul={judul}>
        {aksi.isSuccess ? (
          cetak ? (
            <div className="rounded-2xl border-2 border-emerald-500 bg-white p-8 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-3 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={28} aria-hidden />
                <span className="text-2xl font-bold">Surat siap dicetak</span>
              </div>
              <dl className="mb-6 grid gap-2 text-lg">
                <div className="flex gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Nomor</dt>
                  <dd className="font-semibold">{cetakSurat.data!.letterNumber}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Perihal</dt>
                  <dd className="font-semibold">{cetakSurat.data!.subject}</dd>
                </div>
              </dl>
              <p className="mb-6 text-base text-slate-600 dark:text-slate-400">
                Sisa cetak mandiri: {cetakSurat.data!.printsRemaining}. Untuk salinan berikutnya,
                silakan ke loket.
              </p>
              <div className="flex flex-wrap gap-4">
                <Tombol onClick={() => window.print()}>Cetak Sekarang</Tombol>
                <Tombol nada="kedua" onClick={pulang}>
                  Selesai
                </Tombol>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-slate-200 bg-white p-8 dark:border-slate-700 dark:bg-slate-900">
              <p className="text-lg text-slate-500 dark:text-slate-400">
                {cekStatus.data!.serviceName}
              </p>
              <p className="mt-1 text-3xl font-bold text-slate-900 dark:text-slate-50">
                {cekStatus.data!.statusLabel}
              </p>
              <dl className="mt-6 grid gap-2 text-lg">
                <div className="flex gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Nomor permohonan</dt>
                  <dd className="font-semibold">{cekStatus.data!.requestNumber ?? '—'}</dd>
                </div>
                {cekStatus.data!.dueDate ? (
                  <div className="flex gap-3">
                    <dt className="text-slate-500 dark:text-slate-400">Perkiraan selesai</dt>
                    <dd className="font-semibold">{cekStatus.data!.dueDate}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="mt-8 flex flex-wrap gap-4">
                {cekStatus.data!.canPrintHere ? (
                  <Tombol
                    onClick={() => {
                      setLayar('CETAK_SURAT');
                      cetakSurat.mutate(kode);
                    }}
                  >
                    Cetak Surat Sekarang
                  </Tombol>
                ) : null}
                <Tombol nada="kedua" onClick={pulang}>
                  Selesai
                </Tombol>
              </div>
            </div>
          )
        ) : (
          <>
            <p className="mb-8 text-center text-xl text-slate-700 dark:text-slate-200">
              Ketik kode ambil dari kertas pengajuan Anda
            </p>
            <KioskKeypad nilai={kode} onUbah={setKode} />
            {aksi.isError ? (
              <p className="mt-6 rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-center text-lg text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">
                {(aksi.error as Error).message}
              </p>
            ) : null}
            <div className="mt-8 flex justify-center">
              <Tombol
                onClick={() => (cetak ? cetakSurat.mutate(kode) : cekStatus.mutate(kode))}
                disabled={kode.length !== 8 || aksi.isPending}
              >
                {aksi.isPending ? 'Mencari…' : 'Lanjutkan'}
              </Tombol>
            </div>
          </>
        )}
      </Kerangka>
    );
  }

  // --- Antrean --------------------------------------------------------------
  if (layar === 'ANTREAN') {
    return (
      <Kerangka judul="Ambil Nomor Antrean">
        {ambilAntrean.isSuccess ? (
          <div className="rounded-2xl border-2 border-emerald-500 bg-white p-10 text-center dark:bg-slate-900">
            <p className="text-xl text-slate-600 dark:text-slate-300">Nomor antrean Anda</p>
            <p className="my-4 text-7xl font-bold text-emerald-700 dark:text-emerald-400">
              {ambilAntrean.data!.ticketNumber}
            </p>
            <p className="text-xl text-slate-700 dark:text-slate-200">
              {ambilAntrean.data!.aheadCount} orang di depan Anda
            </p>
            <p className="mt-2 text-lg text-slate-500 dark:text-slate-400">
              Perkiraan menunggu sekitar {ambilAntrean.data!.estimatedWaitMinutes} menit
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Tombol onClick={() => window.print()}>Cetak Nomor</Tombol>
              <Tombol nada="kedua" onClick={pulang}>
                Selesai
              </Tombol>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-6 text-xl text-slate-700 dark:text-slate-200">
              Pilih keperluan Anda
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              {(layanan.data ?? []).map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => ambilAntrean.mutate(l.id)}
                  className="min-h-[5rem] rounded-xl border-2 border-slate-200 bg-white px-6 text-left text-xl font-semibold text-slate-900 active:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
                >
                  {l.name}
                </button>
              ))}
              <button
                type="button"
                onClick={() => ambilAntrean.mutate(undefined)}
                className="min-h-[5rem] rounded-xl border-2 border-slate-200 bg-white px-6 text-left text-xl font-semibold text-slate-900 active:bg-emerald-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50"
              >
                Keperluan lain
              </button>
            </div>
          </>
        )}
      </Kerangka>
    );
  }

  // --- Ajukan surat ---------------------------------------------------------
  if (layar === 'AJUKAN_SURAT') {
    return (
      <Kerangka judul="Ajukan Surat">
        {ajukanSurat.isSuccess ? (
          <div className="rounded-2xl border-2 border-emerald-500 bg-white p-8 text-center dark:bg-slate-900">
            <p className="text-xl text-slate-600 dark:text-slate-300">Simpan kode ambil ini</p>
            <p className="my-4 font-mono text-6xl font-bold tracking-wider text-emerald-700 dark:text-emerald-400">
              {ajukanSurat.data!.display}
            </p>
            <p className="mx-auto max-w-xl text-lg text-slate-700 dark:text-slate-200">
              {ajukanSurat.data!.note}
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Tombol onClick={() => window.print()}>Cetak Kode</Tombol>
              <Tombol nada="kedua" onClick={pulang}>
                Selesai
              </Tombol>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <p className="mb-3 text-lg font-medium text-slate-800 dark:text-slate-100">
                Jenis surat
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {(layanan.data ?? []).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setIsian((s) => ({ ...s, serviceCatalogId: l.id }))}
                    className={`min-h-[4.5rem] rounded-xl border-2 px-5 text-left text-lg font-semibold ${
                      isian.serviceCatalogId === l.id
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                        : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50'
                    }`}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>
            <Isian label="Nama Anda" nilai={isian.applicantName ?? ''} onUbah={ubah('applicantName')} />
            <Isian
              label="Nomor telepon"
              petunjuk="Boleh dikosongkan"
              nilai={isian.applicantPhone ?? ''}
              onUbah={ubah('applicantPhone')}
            />
            {ajukanSurat.isError ? (
              <p className="rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-lg text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">
                {(ajukanSurat.error as Error).message}
              </p>
            ) : null}
            <Tombol
              onClick={() =>
                ajukanSurat.mutate({
                  serviceCatalogId: isian.serviceCatalogId,
                  applicantName: isian.applicantName ?? '',
                  applicantPhone: isian.applicantPhone || undefined,
                })
              }
              disabled={!isian.serviceCatalogId || (isian.applicantName ?? '').length < 2}
            >
              Ajukan
            </Tombol>
          </div>
        )}
      </Kerangka>
    );
  }

  // --- Pengumuman -----------------------------------------------------------
  if (layar === 'PENGUMUMAN') {
    const p = pengumuman.data;
    return (
      <Kerangka judul="Pengumuman & Informasi">
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-50">Berita</h2>
            {!p?.news.length ? (
              <p className="text-lg text-slate-500 dark:text-slate-400">Belum ada berita.</p>
            ) : (
              <ul className="space-y-3">
                {p.news.map((b, i) => (
                  <li key={i} className="rounded-xl border-2 border-slate-200 p-5 dark:border-slate-700">
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                      {b.title}
                    </p>
                    {b.summary ? (
                      <p className="mt-1 text-lg text-slate-600 dark:text-slate-300">{b.summary}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-50">Agenda</h2>
            {!p?.agenda.length ? (
              <p className="text-lg text-slate-500 dark:text-slate-400">Belum ada agenda.</p>
            ) : (
              <ul className="space-y-3">
                {p.agenda.map((a, i) => (
                  <li key={i} className="rounded-xl border-2 border-slate-200 p-5 dark:border-slate-700">
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                      {a.title}
                    </p>
                    <p className="mt-1 text-lg text-slate-600 dark:text-slate-300">
                      {new Date(a.startAt).toLocaleString('id-ID')}
                      {a.location ? ` · ${a.location}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h2 className="mb-3 text-2xl font-bold text-slate-900 dark:text-slate-50">
              Program Bantuan
            </h2>
            {/* Programnya ditampilkan; penerimanya TIDAK. Daftar penerima di
                layar ruang tunggu adalah pengumuman siapa yang miskin di desa
                ini. */}
            {!p?.aidPrograms.length ? (
              <p className="text-lg text-slate-500 dark:text-slate-400">
                Belum ada program bantuan yang dibuka.
              </p>
            ) : (
              <ul className="space-y-3">
                {p.aidPrograms.map((a, i) => (
                  <li key={i} className="rounded-xl border-2 border-slate-200 p-5 dark:border-slate-700">
                    <p className="text-xl font-semibold text-slate-900 dark:text-slate-50">
                      {a.programName}
                    </p>
                    <p className="mt-1 text-lg text-slate-600 dark:text-slate-300">
                      {a.aidCategory}
                      {a.periodStart ? ` · mulai ${a.periodStart}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-base text-slate-500 dark:text-slate-400">
              Untuk menanyakan apakah Anda termasuk penerima, silakan ke loket.
            </p>
          </section>
        </div>
      </Kerangka>
    );
  }

  // --- Lapor ----------------------------------------------------------------
  if (layar === 'LAPOR') {
    return (
      <Kerangka judul="Sampaikan Laporan">
        {lapor.isSuccess ? (
          <div className="rounded-2xl border-2 border-emerald-500 bg-white p-8 text-center dark:bg-slate-900">
            <p className="text-xl text-slate-600 dark:text-slate-300">Nomor tiket laporan Anda</p>
            <p className="my-3 text-4xl font-bold text-emerald-700 dark:text-emerald-400">
              {lapor.data!.complaintNumber}
            </p>
            <p className="text-xl text-slate-600 dark:text-slate-300">Kode untuk memantau</p>
            <p className="my-3 font-mono text-5xl font-bold tracking-wider text-slate-900 dark:text-slate-50">
              {lapor.data!.display}
            </p>
            <p className="mx-auto max-w-xl text-lg text-slate-700 dark:text-slate-200">
              {lapor.data!.note}
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Tombol onClick={() => window.print()}>Cetak</Tombol>
              <Tombol nada="kedua" onClick={pulang}>
                Selesai
              </Tombol>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Isian
              label="Laporan Anda tentang apa?"
              petunjuk="Contoh: Jalan berlubang depan masjid"
              nilai={isian.title ?? ''}
              onUbah={ubah('title')}
            />
            <label className="block">
              <span className="text-lg font-medium text-slate-800 dark:text-slate-100">
                Ceritakan lebih lengkap
              </span>
              <span className="mt-0.5 block text-base text-slate-500 dark:text-slate-400">
                Sebutkan tempatnya sejelas mungkin
              </span>
              <textarea
                value={isian.description ?? ''}
                onChange={(e) => setIsian((s) => ({ ...s, description: e.target.value }))}
                rows={4}
                className="mt-2 w-full rounded-lg border-2 border-slate-300 p-4 text-xl dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            </label>

            <div className="rounded-xl border-2 border-slate-200 p-5 dark:border-slate-700">
              <p className="mb-3 text-lg font-medium text-slate-800 dark:text-slate-100">
                Apakah nama Anda ingin dicantumkan?
              </p>
              <div className="flex flex-wrap gap-4">
                <Tombol nada={anonim ? 'kedua' : 'utama'} onClick={() => setAnonim(false)}>
                  Ya, cantumkan
                </Tombol>
                <Tombol nada={anonim ? 'utama' : 'kedua'} onClick={() => setAnonim(true)}>
                  Tidak, tanpa nama
                </Tombol>
              </div>
              <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
                {anonim
                  ? 'Laporan tetap diproses. Karena tanpa nama, kami tidak dapat mengabari Anda — pantau lewat kode yang akan diberikan.'
                  : 'Kami dapat mengabari perkembangan laporan Anda.'}
              </p>
            </div>

            {!anonim ? (
              <Isian label="Nama Anda" nilai={isian.reporterName ?? ''} onUbah={ubah('reporterName')} />
            ) : null}

            {lapor.isError ? (
              <p className="rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-lg text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">
                {(lapor.error as Error).message}
              </p>
            ) : null}
            <Tombol
              onClick={() =>
                lapor.mutate({
                  title: isian.title ?? '',
                  description: isian.description ?? '',
                  reporterName: anonim ? undefined : isian.reporterName,
                  isAnonymous: anonim,
                })
              }
              disabled={(isian.description ?? '').length < 10}
            >
              Kirim Laporan
            </Tombol>
          </div>
        )}
      </Kerangka>
    );
  }

  // --- Buku tamu ------------------------------------------------------------
  if (layar === 'BUKU_TAMU') {
    const keperluan = [
      ['LAYANAN_SURAT', 'Mengurus surat'],
      ['PENGADUAN', 'Menyampaikan laporan'],
      ['KONSULTASI', 'Konsultasi'],
      ['PEMBAYARAN', 'Pembayaran'],
      ['BERTAMU', 'Bertamu'],
      ['LAINNYA', 'Lainnya'],
    ];
    return (
      <Kerangka judul="Buku Tamu">
        {bukuTamu.isSuccess ? (
          <div className="rounded-2xl border-2 border-emerald-500 bg-white p-10 text-center dark:bg-slate-900">
            <CheckCircle2 size={56} className="mx-auto text-emerald-600" aria-hidden />
            <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {bukuTamu.data!.note}
            </p>
            <div className="mt-8 flex justify-center">
              <Tombol onClick={pulang}>Selesai</Tombol>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Isian label="Nama Anda" nilai={isian.guestName ?? ''} onUbah={ubah('guestName')} />
            <div>
              <p className="mb-3 text-lg font-medium text-slate-800 dark:text-slate-100">
                Keperluan
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {keperluan.map(([kode, label]) => (
                  <button
                    key={kode}
                    type="button"
                    onClick={() => setIsian((s) => ({ ...s, purpose: kode }))}
                    className={`min-h-[4.5rem] rounded-xl border-2 px-5 text-left text-lg font-semibold ${
                      isian.purpose === kode
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100'
                        : 'border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            {/* NIK tidak diminta. Mengumpulkan nomor induk warga pada layar
                terbuka di ruang tunggu berarti menaruhnya di tempat yang paling
                mudah dilihat orang lain. */}
            <p className="text-base text-slate-500 dark:text-slate-400">
              Nomor induk kependudukan tidak diperlukan di sini.
            </p>
            <Tombol
              onClick={() =>
                bukuTamu.mutate({
                  guestName: isian.guestName ?? '',
                  purpose: isian.purpose ?? 'LAINNYA',
                })
              }
              disabled={(isian.guestName ?? '').length < 2 || !isian.purpose}
            >
              Simpan
            </Tombol>
          </div>
        )}
      </Kerangka>
    );
  }

  // --- Absensi ronda --------------------------------------------------------
  if (layar === 'RONDA') {
    return (
      <Kerangka judul="Absensi Ronda">
        {absenRonda.isSuccess ? (
          <div className="rounded-2xl border-2 border-emerald-500 bg-white p-10 text-center dark:bg-slate-900">
            <Shield size={56} className="mx-auto text-emerald-600" aria-hidden />
            <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {absenRonda.data!.note}
            </p>
            <div className="mt-8 flex justify-center">
              <Tombol onClick={pulang}>Selesai</Tombol>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <Isian label="Nama Anda" nilai={isian.memberName ?? ''} onUbah={ubah('memberName')} />
            {absenRonda.isError ? (
              <p className="rounded-xl border-2 border-rose-400 bg-rose-50 p-4 text-lg text-rose-900 dark:border-rose-700 dark:bg-rose-950 dark:text-rose-100">
                {(absenRonda.error as Error).message}
              </p>
            ) : null}
            <Tombol
              onClick={() => absenRonda.mutate({ memberName: isian.memberName ?? '' })}
              disabled={(isian.memberName ?? '').length < 2}
            >
              Catat Kehadiran
            </Tombol>
          </div>
        )}
      </Kerangka>
    );
  }

  // --- Panduan --------------------------------------------------------------
  return (
    <Kerangka judul="Panduan Pemakaian">
      <div className="space-y-8">
        {(panduan.data ?? []).map((p) => (
          <section key={p.kode} className="rounded-xl border-2 border-slate-200 p-6 dark:border-slate-700">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-50">{p.judul}</h2>
            <p className="mt-1 text-lg text-slate-600 dark:text-slate-300">{p.ringkas}</p>
            <ol className="mt-4 space-y-3">
              {p.langkah.map((l) => (
                <li key={l.nomor} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-lg font-bold text-white">
                    {l.nomor}
                  </span>
                  <span>
                    <span className="block text-lg font-semibold text-slate-900 dark:text-slate-50">
                      {l.judul}
                    </span>
                    <span className="block text-lg text-slate-600 dark:text-slate-300">
                      {l.uraian}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </Kerangka>
  );
}

export { formatKode };
