/**
 * Draf Perjanjian Kerja Sama, siap cetak dan siap dibahas tim legal.
 *
 * Ini DRAF. Setiap bagian yang perlu diisi ditampilkan sebagai isian kosong
 * bertitik-titik, persis seperti naskah perjanjian di atas kertas — bukan diisi
 * otomatis dengan data penyewa. Perjanjian yang terisi otomatis mudah
 * ditandatangani tanpa dibaca, dan itu bukan hasil yang kami inginkan bagi
 * kedua belah pihak.
 */

import { Bab, Daftar, DokumenLayout, Isian } from './DokumenLayout';
import {
  BIAYA_IMPLEMENTASI,
  KATEGORI_DUKUNGAN,
  KELOMPOK_KEMAMPUAN,
  LABEL_TAHAP,
  PAKET_PUSAT,
  RUPIAH,
  TARIF_POS,
  TERMASUK_POS,
} from '../../content/solusi';
import { emedikPublicBrandFor } from './emedik-host';

export function PksPage() {
  const emedikBrand = emedikPublicBrandFor();
  const namaProduk = emedikBrand?.name ?? 'eBisnis.id';
  const judul = emedikBrand
    ? emedikBrand.kind === 'apotik'
      ? 'Perjanjian Kerja Sama Pengadaan dan Implementasi Sistem Apotik & Kefarmasian Terpadu'
      : 'Perjanjian Kerja Sama Pengadaan dan Implementasi Sistem Operasional Fasilitas Kesehatan'
    : 'Perjanjian Kerja Sama Pengadaan dan Implementasi Sistem Gudang, Point of Sale (POS) & Ritel Terpadu';
  const ringkas = emedikBrand
    ? 'Draf ini memuat ruang lingkup implementasi, hak dan kewajiban para pihak, skema pembiayaan, dukungan layanan, perlindungan data kesehatan, serta mekanisme pelaksanaan kerja sama.'
    : 'Draf ini memuat ruang lingkup implementasi, hak dan kewajiban para pihak, skema pembiayaan, dukungan layanan, perlindungan data, serta mekanisme pelaksanaan kerja sama. Naskahnya masih dapat disesuaikan berdasarkan pembahasan teknis, legal, dan keuangan sebelum ditandatangani.';

  return (
    <DokumenLayout
      kategori="Dokumen kerja sama strategis — DRAF"
      judul={judul}
      ringkas={ringkas}
      meta={[
        { label: 'Nomor perjanjian', nilai: '…………………………' },
        { label: 'Pihak pertama', nilai: '…………………………' },
        { label: 'Pihak kedua', nilai: namaProduk },
      ]}
    >
      <section className="rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm dark:border-amber-700 dark:bg-amber-950/30 print:bg-white">
        <p className="font-semibold text-amber-900 dark:text-amber-100 print:text-black">
          Catatan penyelarasan
        </p>
        <p className="mt-1 text-amber-900 dark:text-amber-100 print:text-black">
          Draf ini bukan dokumen final dan belum mengikat. Penyesuaian dapat dituangkan dalam
          bentuk finalisasi naskah, berita acara, lampiran teknis, atau adendum sesuai kesepakatan
          para pihak. Kami menganjurkan draf ini dibaca tim legal Anda sebelum dibahas bersama.
        </p>
      </section>

      <section className="mt-6 leading-relaxed text-slate-700 dark:text-slate-200 print:text-black">
        <p>
          Pada hari ini, <Isian label="hari" lebar="w-24" />, tanggal{' '}
          <Isian label="tanggal" lebar="w-40" />, bertempat di{' '}
          <Isian label="tempat" lebar="w-48" />, kami yang bertanda tangan di bawah ini:
        </p>
        <p className="mt-3">
          <strong>1.</strong> <Isian label="nama" lebar="w-56" />, selaku{' '}
          <Isian label="jabatan" lebar="w-44" />, yang bertindak untuk dan atas nama{' '}
          <Isian label="nama institusi/badan usaha" lebar="w-64" />, berkedudukan di{' '}
          <Isian label="alamat" lebar="w-64" />. Untuk selanjutnya disebut{' '}
          <strong>PIHAK PERTAMA</strong>.
        </p>
        <p className="mt-3">
          <strong>2.</strong> <Isian label="nama" lebar="w-56" />, selaku
          representatif/konsultan dari <strong>{namaProduk}</strong>, berkedudukan di{' '}
          <Isian label="alamat" lebar="w-56" /> (kontak: <Isian label="kontak" lebar="w-44" />).
          Untuk selanjutnya disebut <strong>PIHAK KEDUA</strong>.
        </p>
        <p className="mt-3">
          PIHAK PERTAMA dan PIHAK KEDUA secara bersama-sama disebut{' '}
          <strong>&ldquo;PARA PIHAK&rdquo;</strong>, dan terlebih dahulu menerangkan:
        </p>
        <Daftar
          butir={[
            'Bahwa PIHAK PERTAMA adalah institusi pendidikan yang memiliki unit usaha koperasi, kantin, dan/atau gudang, atau badan usaha ritel/dagang independen, yang membutuhkan sistem informasi manajemen gudang, kasir, dan rantai pasok yang terintegrasi.',
            'Bahwa PIHAK KEDUA adalah penyedia layanan teknologi informasi yang memiliki kompetensi, hak cipta, dan kewenangan atas perangkat lunak Sistem Gudang, Point of Sale & Ritel Terpadu.',
            'Bahwa PARA PIHAK memandang digitalisasi tata kelola gudang dan ritel sebagai kebutuhan strategis untuk meningkatkan akurasi stok, transparansi transaksi, kecepatan pelayanan, dan efektivitas pengambilan keputusan.',
            'Bahwa kerja sama ini tidak hanya berorientasi pada pengadaan aplikasi, tetapi mencakup pendampingan perubahan proses kerja dan penguatan kapasitas staf.',
            'Bahwa PARA PIHAK berkomitmen menjalankan kerja sama secara profesional, akuntabel, dan saling menguntungkan.',
          ]}
        />
        <p className="mt-3">
          Berdasarkan hal-hal tersebut, PARA PIHAK sepakat mengikatkan diri dengan ketentuan pada
          pasal-pasal berikut:
        </p>
      </section>

      <Bab nomor="PASAL 1" judul="Definisi">
        <Daftar
          butir={[
            <>
              <strong>Sistem / Perangkat Lunak</strong> adalah perangkat lunak berbasis web
              {namaProduk}, yaitu Sistem yang disediakan untuk ruang lingkup kerja sama ini dan
              dikembangkan oleh PIHAK KEDUA.
            </>,
            <>
              <strong>Implementasi</strong> adalah kegiatan instalasi, konfigurasi, migrasi data,
              serta pelatihan penggunaan Sistem kepada sumber daya manusia PIHAK PERTAMA (kasir,
              petugas gudang, staf pengadaan, akuntan, admin).
            </>,
            <>
              <strong>Transaksi Penjualan (POS)</strong> adalah transaksi penjualan barang/jasa
              yang dicatat oleh kasir dan dihitung otomatis oleh Sistem sebagai dasar tagihan.
            </>,
            <>
              <strong>Stok/Persediaan</strong> adalah catatan kuantitas barang pada gudang pusat
              maupun cabang, beserta jejak audit atas setiap perubahannya.
            </>,
            <>
              <strong>Lampiran Teknis</strong> adalah dokumen pendukung yang memuat rincian modul,
              konfigurasi, tahapan implementasi, kebutuhan data, atau jadwal pelaksanaan, yang
              menjadi satu kesatuan dengan Perjanjian ini.
            </>,
          ]}
        />
      </Bab>

      <Bab nomor="PASAL 2" judul="Ruang Lingkup Pekerjaan & Fitur Sistem">
        <p>
          PIHAK KEDUA menyediakan, menginstalasi, dan memelihara Sistem bagi PIHAK PERTAMA.
          Ruang lingkup fungsionalitas beserta status kesiapannya pada saat draf ini disusun:
        </p>
        {KELOMPOK_KEMAMPUAN.map((k, i) => (
          <div key={k.kode} className="break-inside-avoid">
            <p className="mt-3 font-semibold">
              2.{i + 1}. {k.judul}
            </p>
            <ul className="ms-5 list-disc space-y-1">
              {k.butir.map((b) => (
                <li key={b.judul}>
                  <strong>{b.judul}</strong>{' '}
                  <span className={`badge ${LABEL_TAHAP[b.tahap].kelas} align-middle`}>
                    {LABEL_TAHAP[b.tahap].teks}
                  </span>{' '}
                  — {b.isi}
                </li>
              ))}
            </ul>
          </div>
        ))}
        <p className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50 print:bg-white">
          <strong>Butir bertanda &ldquo;sedang dibangun&rdquo; dan &ldquo;rencana&rdquo;</strong>{' '}
          termasuk dalam ruang lingkup kerja sama ini, namun diimplementasikan secara bertahap
          sesuai kesiapan dan prioritas PIHAK PERTAMA, tanpa mengganggu operasional yang sedang
          berjalan. Jadwal penyelesaian tiap tahap diatur lebih lanjut dalam Lampiran Teknis.
          PARA PIHAK sepakat bahwa pembedaan status ini dinyatakan secara terbuka di muka agar
          tidak ada fungsionalitas yang dianggap tersedia padahal belum.
        </p>
        <p className="mt-3 font-semibold">2.{KELOMPOK_KEMAMPUAN.length + 1}. Output implementasi</p>
        <Daftar
          butir={[
            'Lingkungan sistem: instalasi, setup server (cloud atau on-premise), konfigurasi awal, hak akses, dan pengaturan parameter outlet/gudang.',
            'Migrasi data awal: pendampingan penyiapan data master (produk, harga, stok awal, pemasok) dan impor data sesuai format yang disepakati.',
            'Pelatihan pengguna: transfer pengetahuan kepada kasir, petugas gudang, dan staf pengadaan agar Sistem dapat digunakan secara mandiri.',
          ]}
        />
      </Bab>

      <Bab nomor="PASAL 3" judul="Hak dan Kewajiban Para Pihak">
        <p className="font-semibold">1. PIHAK PERTAMA</p>
        <Daftar
          butir={[
            'Berhak menerima layanan Sistem sesuai ruang lingkup pada Pasal 2.',
            'Berhak menerima bimbingan teknis daring secara gratis dan dukungan pemeliharaan.',
            'Berkewajiban menyediakan data master awal yang valid untuk keperluan migrasi.',
            'Berkewajiban melaksanakan kewajiban pembayaran sebagaimana Pasal 4.',
            'Berkewajiban menunjuk penanggung jawab proyek dan/atau tim pelaksana internal untuk mendukung koordinasi selama implementasi.',
            'Berkewajiban menggunakan Sistem sesuai prosedur, menjaga kerahasiaan akun pengguna, serta memastikan data yang diberikan adalah data yang sah.',
          ]}
        />
        <p className="mt-3 font-semibold">2. PIHAK KEDUA</p>
        <Daftar
          butir={[
            'Berhak menerima pembayaran atas penyediaan layanan sesuai skema yang disepakati.',
            'Berkewajiban melakukan instalasi, setup infrastruktur, dan kustomisasi Sistem.',
            'Berkewajiban menjaga kerahasiaan seluruh basis data PIHAK PERTAMA dan menanggulangi apabila terdapat kutu (bug) pada Sistem.',
            'Berkewajiban memberikan arahan teknis, dokumentasi, dan pendampingan yang wajar agar adopsi Sistem berjalan efektif.',
            'Berkewajiban melakukan pemeliharaan, penyempurnaan, dan pembaruan Sistem secara proporsional sepanjang berada dalam ruang lingkup kerja sama.',
          ]}
        />
      </Bab>

      <Bab nomor="PASAL 4" judul="Skema Pembiayaan dan Pembayaran">
        <p>
          <strong>4.1. Struktur biaya berlangganan.</strong> Biaya berlangganan bulanan terdiri
          atas penjumlahan: (a) biaya terminal kasir (POS) per outlet sebagaimana sub-klausul
          4.1.1; dan (b) biaya Paket Modul Pusat per perusahaan sebagaimana sub-klausul 4.1.2,
          dalam hal PIHAK PERTAMA memilih mengaktifkan salah satu paket. Kedua komponen
          dijumlahkan menjadi 1 (satu) tagihan bulanan.
        </p>

        <p className="mt-3 font-semibold">4.1.1. Biaya terminal kasir (POS) per outlet</p>
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
                  {RUPIAH.format(t.pertama)} /bulan/outlet
                </td>
                <td className="p-2 text-end tabular-nums">
                  {t.mulai && 'mulai '}
                  {RUPIAH.format(t.tambahan)} /bulan/unit
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm">
          Yang dimaksud &ldquo;POS Pertama&rdquo; adalah 1 (satu) unit terminal kasir utama pada
          setiap outlet; &ldquo;POS Tambahan&rdquo; adalah unit kedua dan seterusnya pada outlet
          yang sama. Biaya POS Pertama telah mencakup, tanpa biaya tambahan:{' '}
          {TERMASUK_POS.join(', ')}. Biaya tersebut tidak mencakup pengadaan perangkat keras
          (tablet, printer kasir, pemindai barcode, laci kasir) maupun biaya jaringan internet,
          yang menjadi beban PIHAK PERTAMA.
        </p>

        <p className="mt-3 font-semibold">4.1.2. Biaya Paket Modul Pusat</p>
        <p className="text-sm">
          Dikenakan per perusahaan (bukan per outlet) dan bersifat opsional, sesuai kebutuhan
          konsolidasi yang dikehendaki PIHAK PERTAMA.
        </p>
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            {PAKET_PUSAT.map((p) => (
              <tr key={p.kode} className="border-b border-slate-200 align-top dark:border-slate-700">
                <td className="p-2 font-medium">{p.nama}</td>
                <td className="p-2">{p.isi.join(', ')}.</td>
                <td className="p-2 text-end tabular-nums">
                  {p.harga === 0 ? 'Rp 0' : `${RUPIAH.format(p.harga)} /bulan`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 font-semibold">4.1.3. Biaya implementasi awal</p>
        <p className="text-sm">Dibayarkan satu kali di muka:</p>
        <Daftar
          butir={BIAYA_IMPLEMENTASI.map((b) => (
            <>
              {b.lingkup}: <strong>{b.nilai}</strong>
            </>
          ))}
        />
        <p className="text-sm">
          PARA PIHAK sepakat bahwa biaya implementasi awal dapat dibebaskan sepenuhnya apabila
          disepakati kontrak berjangka 2 (dua) tahun dengan pembayaran tahunan di muka.
        </p>

        <p className="mt-3 font-semibold">4.1.4. Opsi bagi hasil per transaksi (alternatif)</p>
        <p className="text-sm">
          Sebagai alternatif bagi PIHAK PERTAMA yang menghendaki kerja sama tanpa biaya
          implementasi di muka, PARA PIHAK dapat menyepakati skema bagi hasil sebesar Rp 50,-
          hingga Rp 100,- untuk setiap transaksi kasir yang tercatat melalui Sistem, dengan
          tagihan bulanan minimum tetap setara biaya langganan POS reguler.
        </p>

        <p className="mt-3">
          <strong>4.2. Keterbukaan negosiasi.</strong> Seluruh nilai nominal, jenjang, dan skema
          pembiayaan pada Pasal ini merupakan skema standar yang tetap terbuka untuk
          dinegosiasikan sesuai skala usaha, jumlah outlet, kebutuhan modul, serta kesepakatan
          akhir PARA PIHAK.
        </p>
        <p className="text-sm">
          Segala pajak yang timbul akibat pelaksanaan Perjanjian ini ditanggung masing-masing
          pihak sesuai regulasi perpajakan Republik Indonesia.
        </p>
      </Bab>

      <Bab nomor="PASAL 5" judul="Pelatihan dan Pendampingan">
        <Daftar
          butir={[
            'PIHAK KEDUA memberikan pelatihan penggunaan Sistem bagi kasir, petugas gudang, staf pengadaan, dan akuntan secara daring tanpa dipungut biaya.',
            'Apabila PIHAK PERTAMA menghendaki pelatihan tatap muka, jasa instruktur tetap tidak dikenakan biaya; PIHAK PERTAMA hanya menanggung transportasi dan akomodasi tim implementator selama bertugas di lokasi.',
          ]}
        />
        <p className="mt-3 font-semibold">5.1. Tahapan implementasi yang direkomendasikan</p>
        <Daftar
          butir={[
            'Kick-off dan penyelarasan kebutuhan: penyamaan ruang lingkup, pembentukan tim pelaksana, penentuan prioritas modul.',
            'Konfigurasi dan migrasi awal: setup lingkungan, master produk/harga/stok awal/pemasok, dan hak akses.',
            'Pelatihan dan uji coba terbatas: simulasi alur transaksi kasir-stok-pengadaan, validasi oleh unit terkait.',
            'Go-live bertahap: aktivasi modul prioritas, pemantauan pemakaian, pendampingan penyelesaian kendala.',
            'Evaluasi dan optimalisasi: penyempurnaan konfigurasi dan rekomendasi pengembangan lanjutan.',
          ]}
        />
      </Bab>

      <Bab nomor="PASAL 6" judul="Jaminan Layanan & Pemeliharaan (SLA)">
        <Daftar
          butir={[
            'PIHAK KEDUA menjamin Sistem yang diimplementasikan berfungsi sesuai spesifikasi.',
            <>
              <strong>Jaminan kelangsungan layanan.</strong> Apabila di kemudian hari terjadi
              pengunduran diri personel, pemutusan kontrak tim teknis, atau perubahan status
              manajemen internal pihak pengembang, Sistem tetap dapat digunakan secara normal
              oleh PIHAK PERTAMA hingga berakhirnya masa kontrak, tanpa penghentian layanan,
              pemblokiran, atau penuntutan biaya tambahan dari pihak mana pun.
            </>,
            'Untuk implementasi berbasis cloud, PIHAK KEDUA menjamin tingkat ketersediaan (uptime) tidak kurang dari 99% per tahun, di luar waktu pemeliharaan terencana.',
          ]}
        />
        <p className="mt-3 font-semibold">6.1. Kategori dukungan layanan</p>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-slate-400">
              <th className="p-2 text-start">Tingkat</th>
              <th className="p-2 text-start">Keadaan</th>
              <th className="p-2 text-start">Penanganan</th>
            </tr>
          </thead>
          <tbody>
            {KATEGORI_DUKUNGAN.map((k) => (
              <tr key={k.tingkat} className="border-b border-slate-200 align-top dark:border-slate-700">
                <td className="p-2 font-medium">{k.tingkat}</td>
                <td className="p-2">{k.keadaan}</td>
                <td className="p-2">{k.penanganan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Bab>

      <Bab nomor="PASAL 7" judul="Kerahasiaan Data & Hak Kekayaan Intelektual">
        <Daftar
          butir={[
            <>
              <strong>Kepemilikan data.</strong> Segala data stok, transaksi kasir, dan finansial
              yang diunggah ke dalam Sistem adalah milik sah PIHAK PERTAMA. PIHAK KEDUA
              berkewajiban menjaga kerahasiaannya dan tidak berhak mengeksploitasinya untuk
              kepentingan komersial lain.
            </>,
            <>
              <strong>Hak kekayaan intelektual.</strong> Segala hak cipta atas desain perangkat
              lunak, kode program, sistem basis data, dan arsitektur algoritma merupakan properti
              intelektual PIHAK KEDUA. PIHAK PERTAMA memegang lisensi hak guna selama masa
              Perjanjian.
            </>,
            <>
              <strong>Perlindungan data.</strong> Setiap akses, pemrosesan, pencadangan, dan
              pemindahan data dilakukan terbatas untuk pelaksanaan Perjanjian ini. PIHAK KEDUA
              tidak diperkenankan menjual, mengalihkan, atau menggunakan data PIHAK PERTAMA untuk
              kepentingan lain tanpa persetujuan tertulis, kecuali diwajibkan peraturan
              perundang-undangan yang berlaku.
            </>,
          ]}
        />
      </Bab>

      <Bab nomor="PASAL 8" judul="Masa Berlaku & Pengakhiran Perjanjian">
        <Daftar
          butir={[
            <>
              Perjanjian ini berlaku sejak ditandatangani untuk jangka waktu{' '}
              <Isian label="jangka waktu" lebar="w-40" /> dan mengikat PARA PIHAK.
            </>,
            'Apabila Perjanjian berakhir atau diputus, PIHAK KEDUA wajib menyerahkan seluruh basis data milik PIHAK PERTAMA dalam format standar (SQL/CSV/Excel) sebelum akses Sistem ditutup secara permanen.',
            'PARA PIHAK dapat menyusun rencana transisi layanan secara tertulis, termasuk jadwal ekspor data, penyelesaian kewajiban pembayaran, dan penutupan akses pengguna.',
          ]}
        />
      </Bab>

      <Bab nomor="PASAL 9" judul="Keadaan Memaksa (Force Majeure)">
        <p>
          PARA PIHAK dibebaskan dari tanggung jawab atas keterlambatan atau kegagalan pemenuhan
          kewajiban apabila disebabkan oleh keadaan memaksa, yang mencakup: bencana alam,
          peperangan, huru-hara, epidemi/pandemi berskala nasional, kebakaran, pemogokan massal,
          serta kebijakan pemerintah yang secara langsung menghalangi pelaksanaan Perjanjian ini.
        </p>
      </Bab>

      <Bab nomor="PASAL 10" judul="Penyelesaian Perselisihan">
        <p>
          Setiap perselisihan diselesaikan secara musyawarah untuk mufakat. Apabila dalam waktu
          30 (tiga puluh) hari tidak tercapai mufakat, PARA PIHAK sepakat menyelesaikannya
          melalui jalur hukum di yurisdiksi Pengadilan Negeri{' '}
          <Isian label="kota" lebar="w-40" />.
        </p>
      </Bab>

      <Bab nomor="PASAL 11" judul="Lain-lain dan Penutup">
        <Daftar
          butir={[
            'Segala perubahan, penambahan modul, atau pengurangan ketentuan hanya sah apabila dibuat tertulis dan ditandatangani PARA PIHAK dalam bentuk adendum.',
            'Perjanjian dibuat dalam rangkap 2 (dua) asli, masing-masing bermeterai cukup (Rp 10.000,-), dan mempunyai kekuatan pembuktian hukum yang sama.',
            'Lampiran teknis, berita acara, dokumen penawaran, atau jadwal implementasi yang disepakati menjadi bagian tidak terpisahkan dari Perjanjian ini.',
            'Ketentuan yang belum diatur secara rinci akan diatur kemudian secara tertulis berdasarkan prinsip musyawarah, kepatutan, dan saling menguntungkan.',
          ]}
        />
        <p className="mt-3">
          Dengan ditandatanganinya Perjanjian ini, PARA PIHAK menyatakan telah membaca, memahami,
          dan menyetujui seluruh ketentuan yang termuat di dalamnya.
        </p>

        <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
          <div>
            <p className="font-semibold">PIHAK PERTAMA</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-black">
              (Materai Rp 10.000 &amp; tanda tangan)
            </p>
            <div className="mt-16 border-t border-slate-400 pt-1">
              Pimpinan / Direktur / Perwakilan Sah
            </div>
          </div>
          <div>
            <p className="font-semibold">PIHAK KEDUA</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 print:text-black">
              (Materai Rp 10.000 &amp; tanda tangan)
            </p>
            <div className="mt-16 border-t border-slate-400 pt-1">Penyedia Sistem / Konsultan</div>
          </div>
        </div>
      </Bab>
    </DokumenLayout>
  );
}
