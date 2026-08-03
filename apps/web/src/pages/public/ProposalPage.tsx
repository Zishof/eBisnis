/**
 * Proposal penawaran resmi, siap cetak.
 *
 * Delapan bab, mengikuti susunan dokumen penawaran yang sudah dipakai di
 * lapangan. Seluruh angka diambil dari `content/solusi.ts` — tidak ada nominal
 * yang diketik ulang di sini, supaya proposal tidak pernah menyebut harga yang
 * berbeda dari Beranda.
 */

import { Bab, Daftar, DokumenLayout } from './DokumenLayout';
import {
  APLIKASI_KLIEN,
  BELUM_TERMASUK_POS,
  BIAYA_IMPLEMENTASI,
  INDIKATOR,
  INFRASTRUKTUR,
  KELOMPOK_KEMAMPUAN,
  LABEL_TAHAP,
  MASALAH,
  OPSI_PEMBAYARAN,
  PAKET_PUSAT,
  PEMBANDING,
  PETA_JALAN,
  POLA_PEMANFAATAN,
  RUPIAH,
  SESUDAH,
  SIMULASI,
  TAHAPAN,
  TARIF_POS,
  TERMASUK_POS,
} from '../../content/solusi';
import { emedikPublicBrandFor } from './emedik-host';

export function ProposalPage() {
  const emedikBrand = emedikPublicBrandFor();
  const namaProduk = emedikBrand?.name ?? 'eBisnis.id';
  const judul = emedikBrand
    ? emedikBrand.kind === 'apotik'
      ? 'Proposal Implementasi Sistem Apotik dan Kefarmasian Terpadu'
      : 'Proposal Implementasi Sistem Rumah Sakit, Klinik, Puskesmas, dan Posyandu'
    : 'Proposal Transformasi Digital Operasional Ritel, Gudang & Kasir';
  const ringkas = emedikBrand
    ? `Proposal ini disusun sebagai dasar kerja sama implementasi ${namaProduk}: sistem operasional kesehatan yang menyatukan pelayanan, farmasi, stok, billing, dan pelaporan dalam satu alur kerja terpadu.`
    : 'Proposal ini disusun sebagai dasar kerja sama implementasi eBisnis.id — sistem yang menyatukan kasir (POS) multi-outlet, manajemen gudang berjenjang, perhitungan HPP, pembukuan akuntansi, pengadaan barang, dan toko online dalam satu sistem yang saling terhubung.';
  const kategoriSolusi = emedikBrand
    ? emedikBrand.kind === 'apotik'
      ? 'Sistem Apotik & Kefarmasian Terpadu'
      : 'Sistem Operasional Fasilitas Kesehatan Terpadu'
    : 'Sistem Gudang, POS & Manajemen Ritel Terpadu';
  const hariIni = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <DokumenLayout
      kategori="Dokumen penawaran resmi"
      judul={judul}
      ringkas={ringkas}
      meta={[
        { label: 'Tanggal dokumen', nilai: hariIni },
        { label: 'Kategori solusi', nilai: kategoriSolusi },
        { label: 'Sifat dokumen', nilai: 'Konfidensial — untuk evaluasi kerja sama' },
      ]}
    >
      <Bab nomor="I." judul="Pendahuluan & Latar Belakang">
        <p>
          Unit usaha ritel — mulai dari kantin dan koperasi sekolah/kampus hingga jaringan toko
          dan gudang mandiri — menghadapi tantangan yang sama dalam mengelola stok, transaksi
          kasir, dan pembukuan. Proses yang masih manual atau semi-manual memakan waktu, rentan
          terhadap selisih stok, dan menyulitkan pimpinan memperoleh gambaran keuangan yang
          akurat secara cepat.
        </p>
        <p className="font-medium">Empat masalah yang paling sering kami temui:</p>
        <Daftar
          butir={MASALAH.map((m) => (
            <>
              <strong>{m.judul}.</strong> {m.isi}
            </>
          ))}
        />
        <p className="font-medium">Keadaan yang hendak dicapai:</p>
        <Daftar butir={SESUDAH} />
      </Bab>

      <Bab nomor="II." judul="Visi, Tujuan, dan Manfaat">
        <p>
          <strong>Visi.</strong> Menjadi sistem gudang, POS, dan manajemen ritel terpadu yang
          membantu unit usaha mempercepat layanan sekaligus menjaga akurasi pembukuannya.
        </p>
        <p className="font-medium">Tujuan dan manfaat implementasi:</p>
        <Daftar
          butir={[
            <>
              <strong>Efisiensi menyeluruh.</strong> Transaksi kasir, pergerakan stok, dan
              pembentukan jurnal berjalan otomatis, mengurangi pekerjaan manual yang berulang.
            </>,
            <>
              <strong>Akurasi dan keandalan.</strong> Validasi stok di sisi server mencegah
              dua kasir menjual stok yang sama secara bersamaan.
            </>,
            <>
              <strong>Transparansi.</strong> Setiap pergerakan stok dan setiap baris jurnal
              dapat ditelusuri kembali ke dokumen sumbernya.
            </>,
            <>
              <strong>Dasar keputusan yang benar.</strong> HPP dihitung dari komposisi resep,
              bukan diketik, sehingga margin laba yang dilaporkan lebih dapat dipercaya.
            </>,
            <>
              <strong>Kesiapan bertumbuh.</strong> Arsitektur disiapkan untuk perluasan ke
              distribusi antar-outlet dan kemitraan investor tanpa membongkar yang sudah berjalan.
            </>,
          ]}
        />
      </Bab>

      <Bab nomor="III." judul="Ekosistem & Pola Pemanfaatan">
        {POLA_PEMANFAATAN.map((p) => (
          <p key={p.judul}>
            <strong>{p.judul}.</strong> {p.isi}
          </p>
        ))}
        <p className="font-medium">Fleksibilitas infrastruktur — tiga skema pemasangan:</p>
        <Daftar
          butir={INFRASTRUKTUR.map((i) => (
            <>
              <strong>{i.judul}.</strong> {i.isi}
            </>
          ))}
        />
      </Bab>

      <Bab nomor="IV." judul="Rincian Modul & Fungsionalitas">
        <p>
          Setiap butir di bawah ini diberi keterangan tahap. Kami memilih menyebutkannya apa
          adanya — <em>sudah berjalan</em>, <em>sedang dibangun</em>, atau <em>rencana</em> —
          daripada membiarkan hal itu ditemukan sesudah perjanjian ditandatangani.
        </p>
        {KELOMPOK_KEMAMPUAN.map((k) => (
          <div key={k.kode} className="break-inside-avoid">
            <h3 className="mt-4 font-semibold text-slate-900 dark:text-white print:text-black">
              {k.judul}
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-300 print:text-black">{k.ringkas}</p>
            <ul className="ms-5 mt-2 list-disc space-y-1.5">
              {k.butir.map((b) => (
                <li key={b.judul}>
                  <strong>{b.judul}</strong>{' '}
                  <span className={`badge ${LABEL_TAHAP[b.tahap].kelas} align-middle`}>
                    {LABEL_TAHAP[b.tahap].teks}
                  </span>
                  <br />
                  {b.isi}
                </li>
              ))}
            </ul>
          </div>
        ))}

        <h3 className="mt-5 font-semibold text-slate-900 dark:text-white print:text-black">
          Aplikasi klien yang sudah dirilis
        </h3>
        <p>
          Berbeda dari sebagian modul yang masih dalam pengerjaan, ketiga aplikasi berikut sudah
          selesai dibangun dan dirilis resmi pada saat dokumen ini disusun. Ketiganya memakai
          server yang sama, sehingga data kasir, stok, dan member konsisten di mana pun perangkat
          digunakan — tanpa server tambahan. Distribusinya gratis melalui GitHub Releases.
        </p>
        <Daftar
          butir={APLIKASI_KLIEN.map((a) => (
            <>
              <strong>{a.nama}.</strong> {a.isi}
            </>
          ))}
        />
      </Bab>

      <Bab nomor="V." judul="Peta Jalan Pengembangan">
        <ol className="ms-5 list-decimal space-y-2">
          {PETA_JALAN.map((f) => (
            <li key={f.judul}>
              <strong>{f.judul}</strong>{' '}
              <span className={`badge ${LABEL_TAHAP[f.tahap].kelas} align-middle`}>
                {LABEL_TAHAP[f.tahap].teks}
              </span>
              <br />
              {f.isi}
            </li>
          ))}
        </ol>
        <p className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50 print:bg-white">
          <strong>Mengapa urutan ini penting.</strong> Skema bagi hasil investor pada banyak
          sistem sejenis dihitung langsung dari omzet kotor. Pendekatan kami sengaja berbeda:
          distribusi ke investor baru dibangun setelah angka laba bersih — setelah HPP, biaya
          operasional, penyusutan, dan pajak — benar-benar akurat. Itulah sebabnya fondasi HPP
          dan akuntansi dikerjakan lebih dahulu. Urutan pengerjaan ini sendiri merupakan nilai
          jual: angka yang benar dahulu, baru distribusi bagi hasil dibangun di atasnya.
        </p>
      </Bab>

      <Bab nomor="VI." judul="Metodologi Implementasi & Pendampingan">
        <ol className="ms-5 list-decimal space-y-1.5">
          {TAHAPAN.map((t) => (
            <li key={t.nomor}>
              <strong>{t.judul}.</strong> {t.isi}
            </li>
          ))}
        </ol>
        <p>
          Pelatihan daring diberikan <strong>gratis</strong>. Untuk pelatihan tatap muka, jasa
          instruktur tetap tidak dikenakan biaya; pihak Anda hanya menanggung transportasi dan
          akomodasi tim implementator selama bertugas di lokasi.
        </p>
        <p className="font-medium">Indikator keberhasilan yang dapat dipantau bersama:</p>
        <Daftar
          butir={INDIKATOR.map((i) => (
            <>
              <strong>{i.judul}.</strong> {i.isi}
            </>
          ))}
        />
      </Bab>

      <Bab nomor="VII." judul="Skema Harga">
        <p>
          Skema harga disusun berjenjang agar biaya berlangganan selaras dengan skala usaha.
          Formulanya: <strong>Biaya bulanan = Paket Modul Pusat + biaya POS pertama tiap outlet
          + biaya POS tambahan.</strong> Setiap outlet dikenakan biaya POS pertama untuk terminal
          kasir utamanya; terminal tambahan pada outlet yang sama dikenakan tarif yang lebih
          rendah. Di tingkat perusahaan, satu Paket Modul Pusat dipilih untuk mengonsolidasikan
          seluruh outlet.
        </p>

        <h3 className="mt-4 font-semibold text-slate-900 dark:text-white print:text-black">
          A. Tarif POS per terminal
        </h3>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="p-2 text-start">Jumlah outlet</th>
              <th className="p-2 text-end">POS pertama</th>
              <th className="p-2 text-end">POS tambahan</th>
            </tr>
          </thead>
          <tbody>
            {TARIF_POS.map((t) => (
              <tr key={t.jenjang} className="border-b border-slate-200 dark:border-slate-700">
                <td className="p-2">{t.jenjang}</td>
                <td className="p-2 text-end tabular-nums">
                  {t.mulai && 'mulai '}
                  {RUPIAH.format(t.pertama)} / bulan
                </td>
                <td className="p-2 text-end tabular-nums">
                  {t.mulai && 'mulai '}
                  {RUPIAH.format(t.tambahan)} / bulan
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm">
          Biaya POS pertama sudah mencakup: {TERMASUK_POS.join(', ')}. {BELUM_TERMASUK_POS}
        </p>

        <h3 className="mt-4 font-semibold text-slate-900 dark:text-white print:text-black">
          B. Paket Modul Pusat (per perusahaan)
        </h3>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="p-2 text-start">Paket</th>
              <th className="p-2 text-start">Cakupan</th>
              <th className="p-2 text-end">Biaya / bulan</th>
            </tr>
          </thead>
          <tbody>
            {PAKET_PUSAT.map((p) => (
              <tr key={p.kode} className="border-b border-slate-200 align-top dark:border-slate-700">
                <td className="p-2 font-medium">{p.nama}</td>
                <td className="p-2">{p.isi.join(', ')}.</td>
                <td className="p-2 text-end tabular-nums">
                  {p.harga === 0 ? 'Rp 0' : RUPIAH.format(p.harga)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-4 font-semibold text-slate-900 dark:text-white print:text-black">
          C. Simulasi biaya
        </h3>
        <p className="text-sm">Mengasumsikan rata-rata 2 unit POS per outlet dan Full Integrated Suite.</p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="p-2 text-start">Skala</th>
              <th className="p-2 text-end">POS</th>
              <th className="p-2 text-end">Modul pusat</th>
              <th className="p-2 text-end">Total</th>
            </tr>
          </thead>
          <tbody>
            {SIMULASI.map((s) => (
              <tr key={s.outlet} className="border-b border-slate-200 dark:border-slate-700">
                <td className="p-2">{s.outlet} outlet</td>
                <td className="p-2 text-end tabular-nums">{RUPIAH.format(s.pos)}</td>
                <td className="p-2 text-end tabular-nums">{RUPIAH.format(s.pusat)}</td>
                <td className="p-2 text-end font-semibold tabular-nums">{RUPIAH.format(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h3 className="mt-4 font-semibold text-slate-900 dark:text-white print:text-black">
          D. Biaya implementasi awal & opsi pembayaran lain
        </h3>
        <Daftar
          butir={BIAYA_IMPLEMENTASI.map((b) => (
            <>
              {b.lingkup}: <strong>{b.nilai}</strong>
            </>
          ))}
        />
        <Daftar
          butir={OPSI_PEMBAYARAN.map((o) => (
            <>
              <strong>{o.judul}.</strong> {o.isi}
            </>
          ))}
        />
        <p className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50 print:bg-white">
          <strong>Keterbukaan negosiasi.</strong> Struktur harga di atas merupakan standar acuan
          yang tetap terbuka untuk dinegosiasikan sesuai skala jaringan outlet, kompleksitas
          kebutuhan, dan kesepakatan akhir.
        </p>
      </Bab>

      <Bab nomor="VIII." judul="Perbandingan Pendekatan & Penutup">
        <p>
          Bagian ini disertakan karena Anda kemungkinan besar sedang membandingkan beberapa
          sistem. Kami menuliskan perbedaan pendekatannya secara terbuka, beserta alasan mengapa
          perbedaan itu berarti — bukan sekadar daftar keunggulan.
        </p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="p-2 text-start">Aspek</th>
              <th className="p-2 text-start">Pendekatan umum</th>
              <th className="p-2 text-start">Pilihan kami, dan alasannya</th>
            </tr>
          </thead>
          <tbody>
            {PEMBANDING.map((p) => (
              <tr key={p.aspek} className="border-b border-slate-200 align-top dark:border-slate-700">
                <td className="p-2 font-medium">{p.aspek}</td>
                <td className="p-2">{p.umum}</td>
                <td className="p-2">
                  {p.kami}
                  <br />
                  <span className="text-xs text-slate-500 dark:text-slate-400 print:text-black">
                    {p.mengapa}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-4">
          Kami tidak hanya menawarkan aplikasi, tetapi pendampingan perubahan proses kerja
          operasional. Silakan hubungi kami untuk penjadwalan presentasi, diskusi teknis
          konfigurasi dan migrasi, atau pendalaman kerja sama.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-8 text-center text-sm">
          <div>
            <p>Diajukan oleh</p>
            <div className="mt-16 border-t border-slate-400 pt-1">Tanda tangan dan nama jelas</div>
          </div>
          <div>
            <p>Diterima / ditinjau oleh</p>
            <div className="mt-16 border-t border-slate-400 pt-1">Tanda tangan dan nama jelas</div>
          </div>
        </div>
      </Bab>
    </DokumenLayout>
  );
}
