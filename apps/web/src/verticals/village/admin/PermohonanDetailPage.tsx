/**
 * Layar loket: memproses satu permohonan surat.
 *
 * ## Tombol yang tampil adalah tombol yang BOLEH ditekan
 *
 * `nextStates` datang dari peladen, dihitung dari mesin status yang sama yang
 * akan menolak permintaannya. Layar tidak menebak sendiri.
 *
 * Perbedaannya terasa di loket: petugas yang menekan tombol lalu menerima
 * penolakan tidak menyimpulkan "langkah ini memang belum boleh" — ia
 * menyimpulkan sistemnya rusak, lalu menelepon orang, sementara warga yang
 * ditanya menunggu berdiri.
 *
 * ## Alasan diminta ketika memang wajib, dan hanya ketika wajib
 *
 * Transisi yang **merugikan atau menunda warga** wajib beralasan: ditolak,
 * dikembalikan karena berkas kurang, dibatalkan. Warga yang permohonannya
 * ditolak tanpa keterangan akan datang lagi menanyakan hal yang sama, dan
 * petugas berikutnya tidak tahu apa yang harus dijawab.
 *
 * Yang tidak merugikan tidak diminta beralasan. Kotak alasan yang selalu muncul
 * akan diisi "ok" dalam seminggu.
 */

import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  CircleAlert,
  FileCheck2,
  FileText,
  Printer,
  ShieldAlert,
  UserCheck,
  X,
} from 'lucide-react';
import {
  Code,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusBadge,
  useToast,
} from '../../../components/ui';
import { formatDate, formatDateTime, formatMoney } from '../../../lib/api';
import { usePesanGalat } from './useVillageAdmin';
import { nadaStatus } from './kolom';
import {
  LABEL_STATUS,
  kurangnyaApa,
  useCatatBerkas,
  useHapusBerkas,
  usePutuskan,
  useRincianPermohonan,
  useSerahkan,
  useTeruskan,
  useTerbitkan,
  useVerifikasi,
  type Persyaratan,
  type RincianPermohonan,
  type StatusPermohonan,
} from './usePermohonan';

export function PermohonanDetailPage() {
  const { id = '' } = useParams();
  const toMessage = usePesanGalat();
  const rincian = useRincianPermohonan(id);

  if (rincian.isLoading) return <LoadingState />;
  if (rincian.isError) {
    return <ErrorState message={toMessage(rincian.error)} onRetry={() => rincian.refetch()} />;
  }

  return <Isi d={rincian.data!} id={id} />;
}

function Isi({ d, id }: { d: RincianPermohonan; id: string }) {
  const toast = useToast();
  const toMessage = usePesanGalat();
  const r = d.request;
  const status = r.status as StatusPermohonan;

  const catatBerkas = useCatatBerkas(id);
  const hapusBerkas = useHapusBerkas(id);
  const verifikasi = useVerifikasi(id);
  const teruskan = useTeruskan(id);
  const putuskan = usePutuskan(id);
  const terbitkan = useTerbitkan(id);
  const serahkan = useSerahkan(id);

  const sibuk =
    catatBerkas.isPending ||
    hapusBerkas.isPending ||
    verifikasi.isPending ||
    teruskan.isPending ||
    putuskan.isPending ||
    terbitkan.isPending ||
    serahkan.isPending;

  const jalankan = async (fn: () => Promise<unknown>, pesan: string) => {
    try {
      await fn();
      toast.push(pesan, 'success');
    } catch (e) {
      toast.push(toMessage(e), 'error');
    }
  };

  const kurang = kurangnyaApa(d.requirements);
  const bolehVerifikasi = d.nextStates.some((s) => s.to === 'DIVERIFIKASI' && s.allowed);
  const bolehTeruskan = d.nextStates.some((s) => s.to === 'MENUNGGU_PERSETUJUAN' && s.allowed);
  const bolehTerbitkan = d.nextStates.some((s) => s.to === 'DITERBITKAN' && s.allowed);
  const bolehSerahkan = d.nextStates.some((s) => s.to === 'DISERAHKAN' && s.allowed);
  const sedangDiputuskan = status === 'MENUNGGU_PERSETUJUAN' && Boolean(d.workflow);

  return (
    <div>
      <PageHeader
        title={`${String(r.service_name)} — ${String(r.applicant_name)}`}
        breadcrumbs={[
          { label: 'Permohonan', href: '/app/info-desa/layanan/permohonan' },
          { label: String(r.request_number) },
        ]}
        actions={
          <>
            {/*
              Nomor dan status ditaruh di sini, bukan pada `description` yang
              bertipe teks. Menyelipkan JSX ke sana dengan `as unknown as string`
              akan membuat komponennya berbohong tentang tipenya, dan yang
              berikutnya memakainya akan menyalin kebohongan yang sama.
            */}
            <Code>{String(r.request_number)}</Code>
            <StatusBadge status={LABEL_STATUS[status] ?? status} tone={nadaStatus(status)} />
            <Link to="/app/info-desa/layanan/permohonan" className="btn-outline px-3 py-1.5 text-xs">
              <ArrowLeft size={14} aria-hidden className="me-1.5 inline" />
              Kembali ke daftar
            </Link>
          </>
        }
      />

      {/*
        Peringatan pemisahan tugas. Muncul HANYA bila memang berlaku, dan
        menggantikan seluruh tombol — bukan sekadar mendampinginya. Peringatan
        yang berdampingan dengan tombol yang masih dapat ditekan bukan
        pembatasan, melainkan saran.
      */}
      {!d.processableByMe && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Permohonan ini <strong>Anda sendiri</strong> yang mengajukan. Anda boleh
            mengajukannya, tetapi tidak boleh memverifikasi maupun menyetujuinya sendiri —
            mintalah petugas lain yang memprosesnya.
          </span>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* --- Kolom kiri: identitas dan berkas --- */}
        <div className="space-y-4 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Pemohon</h2>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Ruas label="Nama">{String(r.applicant_name)}</Ruas>
              {/*
                NIK dan telepon tampil DI SINI, tidak pada daftar. Rincian dibuka
                satu per satu untuk melayani satu orang, dan petugas memerlukan
                keduanya untuk mencocokkan kartu identitas yang sedang
                dipegangnya. Yang tidak boleh adalah menampilkannya
                berbaris-baris pada layar yang terbaca dari antrean.
              */}
              <Ruas label="NIK">{r.applicant_nik ? <Code>{String(r.applicant_nik)}</Code> : '—'}</Ruas>
              <Ruas label="Telepon">{(r.applicant_phone as string) ?? '—'}</Ruas>
              <Ruas label="Keperluan">{(r.purpose as string) ?? '—'}</Ruas>
              <Ruas label="Diajukan">{formatDateTime(r.submitted_at as string | null)}</Ruas>
              <Ruas label="Janji selesai">
                {r.due_date ? (
                  <TenggatWaktu tanggal={String(r.due_date)} selesai={Boolean(r.finished_at)} />
                ) : (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    belum berjalan — dimulai saat berkas lengkap
                  </span>
                )}
              </Ruas>
              <Ruas label="Biaya">{formatMoney(r.fee_amount as string)}</Ruas>
            </dl>
          </section>

          <BagianBerkas
            syarat={d.requirements}
            aktif={d.processableByMe && !d.finalState && !sibuk}
            onTandai={(kode) =>
              jalankan(
                () => catatBerkas.mutateAsync({ requirementCode: kode }),
                'Berkas ditandai diterima.',
              )
            }
            onBatal={(kode) => jalankan(() => hapusBerkas.mutateAsync(kode), 'Tanda berkas dibatalkan.')}
          />

          {d.workflow && <BagianAlur alur={d.workflow} />}

          <BagianRiwayat riwayat={d.history} />
        </div>

        {/* --- Kolom kanan: tindakan --- */}
        <div className="space-y-4">
          {(r.return_reason as string) && status === 'BERKAS_KURANG' && (
            <Catatan nada="amber" ikon={<CircleAlert size={16} />}>
              <strong>Dikembalikan:</strong> {String(r.return_reason)}
            </Catatan>
          )}
          {(r.reject_reason as string) && status === 'DITOLAK' && (
            <Catatan nada="rose" ikon={<X size={16} />}>
              <strong>Ditolak:</strong> {String(r.reject_reason)}
            </Catatan>
          )}

          {d.finalState ? (
            <section className="card p-5">
              <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Selesai</h2>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Permohonan berstatus <strong>{LABEL_STATUS[status]}</strong> dan tidak dapat diubah
                lagi. Bila warga mengajukan hal yang sama, buatkan permohonan baru — jangan mengubah
                yang ini, sebab riwayatnya adalah bukti apa yang terjadi.
              </p>
            </section>
          ) : !d.processableByMe ? null : (
            <section className="card p-5">
              <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
                Langkah berikutnya
              </h2>

              <div className="space-y-3">
                {bolehVerifikasi && (
                  <div>
                    <button
                      type="button"
                      className="btn-primary w-full justify-center px-3 py-2 text-sm"
                      disabled={sibuk}
                      onClick={() =>
                        jalankan(() => verifikasi.mutateAsync(undefined), 'Berkas diperiksa.')
                      }
                    >
                      <FileCheck2 size={15} aria-hidden className="me-1.5" />
                      Periksa kelengkapan berkas
                    </button>
                    {/*
                      Akibatnya disebutkan SEBELUM tombolnya ditekan. Verifikasi
                      yang menemukan berkas kurang mengembalikan permohonan ke
                      warga, dan petugas perlu tahu itu sebelum menekannya —
                      bukan sesudah warganya pulang.
                    */}
                    <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                      {kurang.length > 0 ? (
                        <>
                          <strong>{kurang.length} syarat wajib belum ditandai.</strong> Menekan ini
                          sekarang akan mengembalikan permohonan kepada warga.
                        </>
                      ) : (
                        'Seluruh syarat wajib sudah ditandai. Janji penyelesaian mulai berjalan dari sini.'
                      )}
                    </p>
                  </div>
                )}

                {bolehTeruskan && (
                  <button
                    type="button"
                    className="btn-primary w-full justify-center px-3 py-2 text-sm"
                    disabled={sibuk}
                    onClick={() =>
                      jalankan(() => teruskan.mutateAsync(undefined), 'Diteruskan untuk persetujuan.')
                    }
                  >
                    Teruskan untuk persetujuan
                  </button>
                )}

                {sedangDiputuskan && (
                  <KotakPutusan
                    sibuk={sibuk}
                    onPutus={(aksi, alasan) =>
                      jalankan(
                        () => putuskan.mutateAsync({ action: aksi, reason: alasan }),
                        aksi === 'APPROVE'
                          ? 'Persetujuan dicatat.'
                          : aksi === 'REJECT'
                            ? 'Penolakan dicatat.'
                            : 'Permintaan perbaikan dicatat.',
                      )
                    }
                  />
                )}

                {bolehTerbitkan && (
                  <button
                    type="button"
                    className="btn-primary w-full justify-center px-3 py-2 text-sm"
                    disabled={sibuk}
                    onClick={() => jalankan(() => terbitkan.mutateAsync({}), 'Surat diterbitkan.')}
                  >
                    <FileText size={15} aria-hidden className="me-1.5" />
                    Terbitkan surat
                  </button>
                )}

                {bolehSerahkan && (
                  <KotakPenyerahan
                    sibuk={sibuk}
                    onSerah={(v) => jalankan(() => serahkan.mutateAsync(v), 'Penyerahan dicatat.')}
                  />
                )}
              </div>
            </section>
          )}

          {Boolean(r.letter_id) && (
            <section className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
                <Printer size={15} aria-hidden />
                Surat
              </h2>
              <dl className="space-y-2 text-sm">
                <Ruas label="Nomor">
                  <Code>{String(r.letter_number)}</Code>
                </Ruas>
                <Ruas label="Tanggal">{formatDate(r.letter_date as string | null)}</Ruas>
                <Ruas label="Dicetak">{`${Number(r.print_count ?? 0)} kali`}</Ruas>
              </dl>
              {Boolean(r.is_revoked) && (
                <p className="mt-3 text-xs text-rose-700 dark:text-rose-400">
                  Surat ini sudah dicabut. Salinan yang beredar tidak lagi berlaku.
                </p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Bagian ------------------------------------------------------------------

function BagianBerkas({
  syarat,
  aktif,
  onTandai,
  onBatal,
}: {
  syarat: Persyaratan[];
  aktif: boolean;
  onTandai: (kode: string) => void;
  onBatal: (kode: string) => void;
}) {
  if (!syarat.length) {
    return (
      <section className="card p-5">
        <h2 className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">Persyaratan</h2>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Layanan ini tidak memiliki persyaratan berkas. Verifikasi akan langsung menyatakan
          lengkap.
        </p>
      </section>
    );
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-sm font-semibold text-slate-900 dark:text-white">Persyaratan</h2>
      <p className="mb-4 text-xs text-slate-500 dark:text-slate-400">
        Tandai berkas yang benar-benar sudah Anda terima. Yang ditandai tanpa berkasnya ada di meja
        akan menjadi surat yang terbit atas syarat yang tidak pernah diserahkan.
      </p>

      <ul className="space-y-2">
        {syarat.map((s) => {
          const ada = Boolean(s.document_id);
          return (
            <li
              key={s.code}
              className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 dark:border-slate-800"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                    {s.name}
                  </span>
                  {s.is_mandatory ? (
                    <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      wajib
                    </span>
                  ) : (
                    <span className="text-xs text-slate-500 dark:text-slate-400">opsional</span>
                  )}
                </div>
                {s.description && (
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{s.description}</p>
                )}
                {ada && (
                  <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">
                    Diterima {formatDateTime(s.verified_at)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 gap-1.5">
                {ada ? (
                  <button
                    type="button"
                    className="btn-outline px-2.5 py-1 text-xs"
                    disabled={!aktif}
                    onClick={() => onBatal(s.code)}
                  >
                    Batalkan
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-outline px-2.5 py-1 text-xs"
                    disabled={!aktif}
                    onClick={() => onTandai(s.code)}
                  >
                    <Check size={13} aria-hidden className="me-1 inline" />
                    Sudah diterima
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function BagianAlur({
  alur,
}: {
  alur: NonNullable<RincianPermohonan['workflow']>;
}) {
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
        Jenjang persetujuan
      </h2>
      <ol className="space-y-3">
        {alur.steps.map((s) => (
          <li key={s.sequence} className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                s.status === 'SELESAI'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : s.status === 'DITOLAK'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : s.status === 'MENUNGGU'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              {s.sequence}
            </span>
            <div className="min-w-0">
              <div className="text-sm text-slate-900 dark:text-slate-100">{s.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {s.roleCode}
                {s.actedAt && ` · ${formatDateTime(s.actedAt)}`}
              </div>
              {s.reason && (
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">{s.reason}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function BagianRiwayat({ riwayat }: { riwayat: RincianPermohonan['history'] }) {
  if (!riwayat.length) return null;
  return (
    <section className="card p-5">
      <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">Riwayat</h2>
      <ol className="space-y-3 border-s border-slate-200 ps-4 dark:border-slate-800">
        {riwayat.map((h, i) => (
          <li key={`${h.occurred_at}-${i}`} className="relative">
            <span className="absolute -start-[21px] top-1.5 h-2 w-2 rounded-full bg-slate-300 dark:bg-slate-600" />
            <div className="text-sm text-slate-900 dark:text-slate-100">
              {h.from_status ? `${LABEL_STATUS[h.from_status as StatusPermohonan] ?? h.from_status} → ` : ''}
              {LABEL_STATUS[h.to_status as StatusPermohonan] ?? h.to_status}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {formatDateTime(h.occurred_at)}
              {/*
                Catatan internal ditandai. Petugas perlu tahu mana yang dibaca
                warga pada aplikasi dan anjungan, sebab yang ia tulis di sana
                akan terbaca orang yang sedang kecewa.
              */}
              {!h.visible_to_citizen && ' · catatan internal'}
            </div>
            {h.reason && (
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{h.reason}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

// --- Kotak tindakan ----------------------------------------------------------

function KotakPutusan({
  sibuk,
  onPutus,
}: {
  sibuk: boolean;
  onPutus: (aksi: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES', alasan?: string) => void;
}) {
  const [alasan, setAlasan] = useState('');
  const cukup = alasan.trim().length >= 10;

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <button
        type="button"
        className="btn-primary w-full justify-center px-3 py-2 text-sm"
        disabled={sibuk}
        onClick={() => onPutus('APPROVE')}
      >
        <Check size={15} aria-hidden className="me-1.5" />
        Setujui
      </button>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Alasan — wajib untuk menolak atau meminta perbaikan
        </span>
        <textarea
          className="field-input text-sm"
          rows={3}
          value={alasan}
          onChange={(e) => setAlasan(e.target.value)}
          placeholder="Tuliskan agar warga mengerti apa yang harus ia lakukan."
        />
      </label>
      {/*
        Alasannya ditulis untuk WARGA, bukan untuk arsip. Kalimat "tidak
        memenuhi syarat" memenuhi kewajiban mengisi kolom tanpa memberi tahu
        apa pun, dan warga akan datang lagi menanyakan hal yang sama.
      */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Yang Anda tulis dibaca warga pada aplikasi dan anjungan. Sebutkan apa yang kurang dan apa
        yang harus ia bawa — bukan sekadar &quot;tidak memenuhi syarat&quot;.
      </p>

      <div className="flex gap-2">
        <button
          type="button"
          className="btn-outline flex-1 justify-center px-3 py-2 text-sm"
          disabled={sibuk || !cukup}
          onClick={() => onPutus('REQUEST_CHANGES', alasan.trim())}
        >
          Minta perbaikan
        </button>
        <button
          type="button"
          className="btn-outline flex-1 justify-center px-3 py-2 text-sm text-rose-700 dark:text-rose-400"
          disabled={sibuk || !cukup}
          onClick={() => onPutus('REJECT', alasan.trim())}
        >
          <X size={15} aria-hidden className="me-1.5" />
          Tolak
        </button>
      </div>
      {!cukup && alasan.length > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          Alasannya masih terlalu pendek untuk dapat dimengerti warga.
        </p>
      )}
    </div>
  );
}

function KotakPenyerahan({
  sibuk,
  onSerah,
}: {
  sibuk: boolean;
  onSerah: (v: { receivedBy: string; relation?: string; note?: string }) => void;
}) {
  const [nama, setNama] = useState('');
  const [hubungan, setHubungan] = useState('');

  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <h3 className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-slate-100">
        <UserCheck size={15} aria-hidden />
        Serahkan surat
      </h3>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Nama penerima
        </span>
        <input
          className="field-input py-1.5 text-sm"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
          Hubungan dengan pemohon (bila bukan pemohonnya sendiri)
        </span>
        <input
          className="field-input py-1.5 text-sm"
          value={hubungan}
          onChange={(e) => setHubungan(e.target.value)}
          placeholder="anak kandung, ketua RT, …"
        />
      </label>

      <button
        type="button"
        className="btn-primary w-full justify-center px-3 py-2 text-sm"
        disabled={sibuk || nama.trim().length < 3}
        onClick={() => onSerah({ receivedBy: nama.trim(), relation: hubungan.trim() || undefined })}
      >
        Catat penyerahan
      </button>

      {/*
        Penerima boleh bukan pemohonnya. Memaksa pemohon datang sendiri berarti
        lansia dan orang sakit tidak akan pernah menerima suratnya.
      */}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Penerima boleh bukan pemohonnya. Yang penting tercatat siapa yang benar-benar membawa surat
        itu keluar dari kantor.
      </p>
    </div>
  );
}

// --- Potongan kecil ----------------------------------------------------------

function Ruas({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-slate-900 dark:text-slate-100">{children}</dd>
    </div>
  );
}

/** Tenggat yang sudah lewat ditandai, bukan sekadar ditampilkan tanggalnya. */
function TenggatWaktu({ tanggal, selesai }: { tanggal: string; selesai: boolean }) {
  const lewat = !selesai && new Date(tanggal) < new Date(new Date().toDateString());
  return (
    <span className={lewat ? 'text-rose-700 dark:text-rose-400' : undefined}>
      {formatDate(tanggal)}
      {lewat && ' · lewat janji'}
    </span>
  );
}

function Catatan({
  nada,
  ikon,
  children,
}: {
  nada: 'amber' | 'rose';
  ikon: React.ReactNode;
  children: React.ReactNode;
}) {
  const kelas =
    nada === 'amber'
      ? 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200'
      : 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-200';
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${kelas}`}>
      <span className="mt-0.5 shrink-0">{ikon}</span>
      <div>{children}</div>
    </div>
  );
}
