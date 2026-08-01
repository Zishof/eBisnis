/**
 * Halaman utama santri.info — portal ePesantren.
 *
 * ## Untuk siapa halaman ini ditulis
 *
 * Pengasuh dan pengurus pondok, bukan orang teknologi. Karena itu tidak ada
 * istilah "multi-tenant", "SaaS", atau "modul terintegrasi" pada teks yang
 * dibaca pengunjung. Yang dijelaskan adalah apa yang berubah pada pekerjaan
 * sehari-hari mereka.
 *
 * ## Angka yang disebut di sini
 *
 * Harga ditulis Rp 2.000 per santri per bulan, ditagihkan per pondok, dan
 * **dapat berubah sesuai kesepakatan**. Kalimat terakhir itu bukan basa-basi
 * hukum: harga sebenarnya hidup di katalog harga berversi pada control plane,
 * dan kontrak tiap pondok dapat menimpanya. Angka di halaman ini adalah
 * penawaran bawaan, bukan sumber kebenaran penagihan.
 */

import { Link } from 'react-router-dom';
import { ManfaatPeranSection } from './ManfaatPeranSection';
import { SalamPembukaSection } from './SalamPembukaSection';

const MODUL_INTI = [
  {
    judul: 'Santri dan Asrama',
    isi: 'Biodata lengkap, penempatan kamar dan asrama, riwayat kesehatan, serta catatan perkembangan tiap santri.',
  },
  {
    judul: 'Diniyah dan Sekolah Pondok',
    isi: 'Kurikulum diniyah, halaqah, kajian kitab, marhalah, dan rapor diniyah yang terpisah dari rapor formal.',
  },
  {
    judul: 'Tahfiz dan Pengajian',
    isi: 'Setoran dan muraja’ah hafalan, capaian juz, penilaian tajwid, dan laporan yang dapat dibaca wali.',
  },
  {
    judul: 'Perizinan Keluar–Masuk',
    isi: 'Pengajuan izin, persetujuan berjenjang, catatan kepulangan dan kedatangan, serta pemberitahuan kepada wali.',
  },
  {
    judul: 'Presensi',
    isi: 'QR, kartu RFID, pengenalan wajah, atau titik lokasi — dipilih sesuai yang sudah dipakai pondok.',
  },
  {
    judul: 'Tagihan dan Pembayaran',
    isi: 'Tagihan massal, cicilan, pemantauan tunggakan, dan konfirmasi yang masuk sendiri tanpa dicocokkan manual.',
  },
  {
    judul: 'Uang Saku Nontunai',
    isi: 'Dompet santri untuk kantin dan koperasi, dengan batas belanja harian yang diatur wali.',
  },
  {
    judul: 'Kantin dan Koperasi',
    isi: 'Kasir untuk tiap gerai, stok yang terpantau, dan penjualan yang langsung masuk pembukuan.',
  },
  {
    judul: 'BMT dan Keuangan Syariah',
    isi: 'Simpanan dan pembiayaan berakad syariah, bagi hasil, serta pencatatan ZIS.',
  },
  {
    judul: 'Keuangan dan Akuntansi',
    isi: 'Anggaran, kas besar dan kas kecil, jurnal yang terbentuk sendiri, sampai laporan dan tutup buku.',
  },
  {
    judul: 'Kepegawaian dan Penggajian',
    isi: 'Data ustaz dan pegawai, kehadiran, honor mengajar, tunjangan, potongan, dan slip gaji digital.',
  },
  {
    judul: 'Persuratan dan Arsip',
    isi: 'Surat masuk dan keluar, penomoran yang tidak mungkin ganda, disposisi berjenjang, dan arsip yang dapat dicari.',
  },
];

const LANGKAH = [
  {
    no: '1',
    judul: 'Pendaftaran',
    isi: 'Pondok mendaftar dari halaman ini. Yang diperlukan hanya nama pondok, penanggung jawab, dan perkiraan jumlah santri.',
  },
  {
    no: '2',
    judul: 'Alamat pondok disiapkan',
    isi: 'Pondok memperoleh alamatnya sendiri, misalnya ponpes-demo.santri.info. Bila pondok sudah punya domain sendiri, alamat itu yang dipakai.',
  },
  {
    no: '3',
    judul: 'Data dipindahkan',
    isi: 'Data santri, biaya, dan pegawai yang sudah ada dipindahkan dari berkas Excel atau sistem lama. Tidak diketik ulang.',
  },
  {
    no: '4',
    judul: 'Pelatihan',
    isi: 'Pengurus dan operator dilatih daring tanpa biaya. Pelatihan tatap muka tanpa biaya jasa instruktur.',
  },
  {
    no: '5',
    judul: 'Mulai dipakai bertahap',
    isi: 'Dimulai dari data santri dan tagihan — dua hal yang paling cepat terasa. Modul lain menyusul tanpa berganti sistem.',
  },
  {
    no: '6',
    judul: 'Pendampingan',
    isi: 'Pertanyaan dan kendala masuk lewat tiket dengan prioritas, bukan lewat pesan pribadi yang mudah hilang.',
  },
];

export function SantriInfoHomePage() {
  return (
    <div className="bg-white text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/*
        Salam dan muqaddimah mendahului segalanya.

        Bukan hiasan: pada majelis mana pun, yang datang disapa lebih dahulu
        sebelum maksudnya disampaikan. Halaman yang langsung menjual tanpa
        menyapa terbaca sebagai brosur, bukan sebagai ajakan bekerja sama.
      */}
      <SalamPembukaSection />

      {/* --- Pembuka --------------------------------------------------- */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 to-white px-4 py-16 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-4xl text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            santri.info
          </p>
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Satu sistem untuk seluruh urusan pondok pesantren
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            Santri, asrama, diniyah, tahfiz, perizinan, tagihan, kantin, koperasi,
            kepegawaian, dan keuangan — dicatat sekali, dipakai bersama. Bukan
            belasan aplikasi yang datanya harus disalin ulang.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              to="/daftar-pesantren"
              className="rounded-lg bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800"
            >
              Daftarkan pondok
            </Link>
            <Link
              to="/kontak"
              className="rounded-lg border border-slate-300 px-6 py-3 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              Bicara dengan kami
            </Link>
          </div>
        </div>
      </section>

      {/* --- Masalah yang diselesaikan ---------------------------------- */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold">Mengapa ini dibuat</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Sebagian besar pondok sudah memakai komputer — tetapi terpisah-pisah.
            Data santri di satu berkas, tagihan di berkas lain, absensi di buku,
            kantin di catatan tersendiri. Satu santri pindah kamar, dan
            perubahannya harus ditulis di empat tempat. Yang terlewat satu tempat
            menjadi selisih yang baru ketahuan berbulan-bulan kemudian.
          </p>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            santri.info menyatukannya. Data dicatat sekali; tagihan, presensi,
            rapor, dan laporan membacanya dari tempat yang sama. Wali santri
            melihat perkembangan anaknya tanpa perlu bertanya lewat pesan
            beruntun.
          </p>
        </div>
      </section>

      {/* --- Modul ------------------------------------------------------ */}
      <section className="border-y border-slate-200 bg-slate-50 px-4 py-14 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold">Apa saja yang tercakup</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">
            Pondok tidak harus memakai semuanya sejak awal. Yang dipakai dapat
            ditambah kapan saja, tanpa berganti sistem dan tanpa kehilangan data.
          </p>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {MODUL_INTI.map((m) => (
              <div
                key={m.judul}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950"
              >
                <h3 className="font-semibold">{m.judul}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{m.isi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Manfaat bagi setiap bagian --------------------------------- */}
      <ManfaatPeranSection />

      {/* --- Situs pondok ----------------------------------------------- */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="text-2xl font-bold">Setiap pondok punya situsnya sendiri</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Begitu pondok terdaftar, ia memperoleh alamatnya sendiri:
          </p>

          <div className="mt-5 space-y-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
                ponpes-demo.santri.info
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Alamat bawaan, siap dipakai segera setelah pendaftaran. Tidak ada
                biaya tambahan dan tidak perlu membeli domain.
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900">
              <p className="font-mono text-sm text-emerald-700 dark:text-emerald-400">
                ponpes-demo.com
              </p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                Pondok yang sudah punya domain sendiri dapat memakainya. Alamatnya
                diarahkan ke sini setelah kepemilikannya dibuktikan — pemeriksaan
                itu ada supaya alamat pondok tidak dapat didaftarkan orang lain.
              </p>
            </div>
          </div>

          <h3 className="mt-10 text-lg font-semibold">Situsnya diatur pondok sendiri</h3>
          <ul className="mt-4 space-y-3 text-slate-600 dark:text-slate-300">
            <li className="flex gap-3">
              <span aria-hidden className="text-emerald-700 dark:text-emerald-400">•</span>
              <span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  Berita dan pengumuman ditulis sendiri.
                </strong>{' '}
                Pengurus menulis, menyunting, dan menerbitkannya langsung dari
                dalam aplikasi. Tidak perlu menghubungi siapa pun, dan tidak perlu
                menunggu.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-emerald-700 dark:text-emerald-400">•</span>
              <span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  Halaman disusun sendiri.
                </strong>{' '}
                Profil pondok, sejarah, program pendidikan, galeri, dan alur
                pendaftaran santri baru.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-emerald-700 dark:text-emerald-400">•</span>
              <span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  Tampilannya memakai identitas pondok.
                </strong>{' '}
                Logo, nama, dan warna pondok — bukan merek platform.
              </span>
            </li>
            <li className="flex gap-3">
              <span aria-hidden className="text-emerald-700 dark:text-emerald-400">•</span>
              <span>
                <strong className="font-semibold text-slate-900 dark:text-slate-100">
                  Pendaftaran santri baru langsung terhubung.
                </strong>{' '}
                Pendaftar dari situs masuk ke data pondok, bukan ke kotak surel
                yang harus disalin ulang.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* --- Langkah ---------------------------------------------------- */}
      <section className="border-y border-slate-200 bg-slate-50 px-4 py-14 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-5xl">
          <h2 className="text-2xl font-bold">Dari mendaftar sampai dipakai</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {LANGKAH.map((l) => (
              <div
                key={l.no}
                className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-950"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-700 font-bold text-white">
                  {l.no}
                </div>
                <h3 className="mt-3 font-semibold">{l.judul}</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{l.isi}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --- Biaya ------------------------------------------------------ */}
      <section className="px-4 py-14">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold">Biaya</h2>

          <div className="mt-6 rounded-2xl border-2 border-emerald-700 bg-white p-8 text-center dark:bg-slate-950">
            <p className="text-4xl font-bold text-emerald-700 dark:text-emerald-400">
              Rp 2.000
            </p>
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              per santri, per bulan
            </p>
            <p className="mt-4 border-t border-slate-200 pt-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
              Ditagihkan <strong>satu tagihan per pondok</strong>, bukan per
              santri satu per satu.
            </p>
          </div>

          <div className="mt-8 space-y-4 text-slate-600 dark:text-slate-300">
            <p>
              <strong className="text-slate-900 dark:text-slate-100">
                Yang sudah termasuk:
              </strong>{' '}
              seluruh modul yang diaktifkan, pembaruan sistem, penyimpanan data,
              alamat situs pondok, dukungan lewat tiket, dan pelatihan daring.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-slate-100">
                Yang dihitung:
              </strong>{' '}
              santri yang berstatus aktif pada bulan berjalan. Santri yang sudah
              lulus atau keluar tidak dihitung, dan data contoh tidak pernah
              ditagihkan.
            </p>
            <p>
              <strong className="text-slate-900 dark:text-slate-100">
                Dapat berubah sesuai kesepakatan.
              </strong>{' '}
              Angka di atas adalah penawaran bawaan. Pondok besar, yayasan dengan
              beberapa unit, atau kebutuhan khusus dibicarakan tersendiri dan
              dituangkan pada perjanjian.
            </p>
            <p>
              Perangkat keras — mesin kasir kantin, pemindai kartu, anjungan
              mandiri — terpisah dan tidak wajib.
            </p>
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/kontak"
              className="inline-block rounded-lg bg-emerald-700 px-6 py-3 font-semibold text-white hover:bg-emerald-800"
            >
              Minta penawaran untuk pondok kami
            </Link>
          </div>
        </div>
      </section>

      {/* --- Data milik pondok ------------------------------------------ */}
      <section className="border-t border-slate-200 bg-slate-50 px-4 py-14 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-2xl font-bold">Datanya milik pondok</h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Seluruh data santri, keuangan, dan kepegawaian adalah milik pondok.
            Bila kerja sama berakhir, data diserahkan dalam bentuk yang dapat
            dibuka sendiri — bukan ditahan sebagai alasan agar pondok bertahan.
          </p>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Setiap perubahan tercatat: siapa yang mengubah, apa yang diubah, dan
            kapan. Data satu pondok tidak dapat dibaca pondok lain.
          </p>
        </div>
      </section>
    </div>
  );
}
