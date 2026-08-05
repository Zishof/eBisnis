/**
 * FAQ mitrainap.id.
 *
 * Jawaban harga SENGAJA tidak menyebut angka -- BRD menetapkan
 * `PRICE_CONFIGURATION_REQUIRED`, belum ada keputusan komersial nyata untuk
 * MitraInap. Mengarang angka di sini akan jadi janji yang tidak dapat
 * dipenuhi lewat sales.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';

interface Faq {
  pertanyaan: string;
  jawaban: string;
}

const DAFTAR_FAQ: Faq[] = [
  {
    pertanyaan: 'Berapa biaya berlangganan MitraInap.id?',
    jawaban:
      'Skema harga MitraInap belum ditetapkan secara komersial. Hubungi kami untuk mendiskusikan kebutuhan properti Anda -- jumlah kamar, modul yang diperlukan, dan skala operasional -- sehingga penawaran yang diberikan sesuai, bukan angka baku yang belum tentu cocok.',
  },
  {
    pertanyaan: 'Apakah semua modul sudah bisa dipakai sekarang?',
    jawaban:
      'Belum. MitraInap dibangun bertahap, modul demi modul, dengan pengujian nyata pada setiap tahap. Lihat halaman Solusi untuk cakupan modul yang direncanakan dan tahapnya.',
  },
  {
    pertanyaan: 'Apakah MitraInap terhubung dengan OTA (Traveloka, Agoda, Booking.com)?',
    jawaban:
      'Integrasi channel manager direncanakan sebagai adaptor terbuka -- dibangun sebagai antarmuka lebih dulu, dihubungkan ke penyedia sungguhan setelah kontrak/kredensial tersedia. Belum ada koneksi OTA langsung yang aktif hari ini.',
  },
  {
    pertanyaan: 'Apakah data pembayaran tamu disimpan MitraInap?',
    jawaban:
      'MitraInap tidak pernah menyimpan nomor kartu atau CVV penuh. Pemrosesan pembayaran mengikuti standar keamanan pembayaran yang berlaku, konsisten dengan seluruh platform eBisnis.id.',
  },
  {
    pertanyaan: 'Apakah properti saya bisa punya website/subdomain sendiri?',
    jawaban:
      'Ya, ini bagian dari rencana arsitektur (subdomain per properti di bawah mitrainap.id, serta domain kustom terverifikasi). Fitur provisioning situs properti menyusul setelah fondasi properti dan penyewa selesai dibangun.',
  },
  {
    pertanyaan: 'Bagaimana cara mencoba MitraInap?',
    jawaban:
      'Sampaikan kebutuhan Anda lewat halaman Hubungi Kami. Sesi demo terjadwal akan diatur begitu modul yang relevan untuk kebutuhan Anda sudah siap diujicobakan.',
  },
];

export function MitrainapFaqPage() {
  const [terbuka, setTerbuka] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl dark:text-white">
        Pertanyaan yang sering diajukan
      </h1>
      <p className="mt-3 text-slate-600 dark:text-slate-400">
        Tidak menemukan jawabannya? <Link to="/kontak" className="text-violet-700 hover:underline dark:text-violet-400">Hubungi kami langsung</Link>.
      </p>

      <div className="mt-8 divide-y divide-slate-200 border-y border-slate-200 dark:divide-slate-800 dark:border-slate-800">
        {DAFTAR_FAQ.map((faq, i) => {
          const buka = terbuka === i;
          return (
            <div key={faq.pertanyaan}>
              <button
                type="button"
                className="flex w-full items-center justify-between gap-4 py-4 text-start"
                aria-expanded={buka}
                onClick={() => setTerbuka(buka ? null : i)}
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-white">{faq.pertanyaan}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-500 transition-transform ${buka ? 'rotate-180' : ''}`}
                  aria-hidden
                />
              </button>
              {buka && (
                <p className="pb-4 text-sm text-slate-600 dark:text-slate-400">{faq.jawaban}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
