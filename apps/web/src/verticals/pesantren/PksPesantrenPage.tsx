/**
 * Draft Perjanjian Kerja Sama ePesantren.
 *
 * ## Kata "Draft" bukan hiasan
 *
 * Halaman ini menghasilkan naskah yang siap dibaca dan dicetak, **bukan**
 * naskah yang siap ditandatangani tanpa ditinjau. Perjanjian yang mengikat
 * pondok dan penyedia harus dibaca ahli hukum kedua belah pihak; halaman web
 * yang mengesankan sebaliknya menimbulkan risiko yang tidak dapat ditarik
 * kembali. Karena itu peringatannya dicetak, bukan hanya tampil di layar.
 *
 * ## Isian yang dikosongkan
 *
 * Nama pondok, alamat, penanda tangan, jangka waktu, dan angka disediakan
 * sebagai kolom isian. Tidak diisikan contoh — angka contoh pada dokumen hukum
 * adalah angka yang suatu hari ikut tertandatangani.
 */

import { Bab, Daftar, DokumenLayout, Isian, MEREK_SANTRI } from '../../pages/public/DokumenLayout';
import { HARGA_PER_SANTRI, KETENTUAN_HARGA, PENYEDIA, TAHAPAN } from './konten-pesantren';

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export function PksPesantrenPage() {
  return (
    <DokumenLayout
      merek={MEREK_SANTRI}
      kategori="Draft Perjanjian Kerja Sama"
      judul="Perjanjian Kerja Sama Penyediaan Sistem Informasi Pondok Pesantren"
      ringkas={
        'Naskah rancangan. Wajib ditinjau penasihat hukum kedua belah pihak sebelum ' +
        'ditandatangani. Seluruh kolom bertitik-titik diisi sesuai kesepakatan.'
      }
      meta={[
        { label: 'Nomor', nilai: '____ / PKS / ____' },
        { label: 'Tanggal', nilai: '____________' },
        { label: 'Penyedia', nilai: PENYEDIA.nama },
      ]}
    >
      <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 text-sm dark:bg-amber-950/40 print:bg-white">
        <p className="font-bold text-amber-900 dark:text-amber-100 print:text-black">
          Naskah rancangan — belum berkekuatan hukum
        </p>
        <p className="mt-1 text-amber-900 dark:text-amber-100 print:text-black">
          Dokumen ini disusun untuk mempercepat pembahasan, bukan untuk menggantikan
          pemeriksaan hukum. Ketentuan mengenai tanggung jawab, ganti rugi, penyelesaian
          sengketa, dan perlindungan data pribadi wajib ditinjau penasihat hukum kedua belah
          pihak sebelum ditandatangani.
        </p>
      </div>

      <Bab nomor="" judul="Para Pihak" merek={MEREK_SANTRI}>
        <p>
          Pada hari ini, <Isian label="hari" lebar="w-28" /> tanggal{' '}
          <Isian label="tanggal" lebar="w-40" />, yang bertanda tangan di bawah ini:
        </p>

        <div className="mt-4 space-y-4">
          <div>
            <p className="font-semibold">PIHAK PERTAMA</p>
            <p>
              Nama: <Isian label="nama" /> <br />
              Jabatan: <Isian label="jabatan" /> <br />
              Bertindak untuk dan atas nama <strong>{PENYEDIA.nama}</strong>, berkedudukan di{' '}
              {PENYEDIA.alamat}.
            </p>
            <p className="mt-1 text-sm">Selanjutnya disebut PENYEDIA.</p>
          </div>

          <div>
            <p className="font-semibold">PIHAK KEDUA</p>
            <p>
              Nama: <Isian label="nama" /> <br />
              Jabatan: <Isian label="jabatan" /> <br />
              Bertindak untuk dan atas nama Pondok Pesantren{' '}
              <Isian label="nama pondok" lebar="w-72" />, berkedudukan di{' '}
              <Isian label="alamat pondok" lebar="w-full" />.
            </p>
            <p className="mt-1 text-sm">Selanjutnya disebut PONDOK.</p>
          </div>
        </div>

        <p className="mt-4">
          PENYEDIA dan PONDOK secara bersama-sama disebut PARA PIHAK, sepakat mengadakan
          perjanjian kerja sama dengan ketentuan sebagai berikut.
        </p>
      </Bab>

      <Bab nomor="Pasal 1" judul="Maksud dan Tujuan" merek={MEREK_SANTRI}>
        <p>
          PENYEDIA menyediakan layanan sistem informasi pondok pesantren melalui portal{' '}
          {PENYEDIA.portal} bagi PONDOK, mencakup pendidikan, kesantrian, keuangan, unit
          usaha, dan tata kelola, sesuai paket dan modul yang disepakati pada Lampiran I.
        </p>
      </Bab>

      <Bab nomor="Pasal 2" judul="Ruang Lingkup dan Tahapan" merek={MEREK_SANTRI}>
        <p>Penerapan dilaksanakan bertahap:</p>
        <ol className="ms-5 list-decimal space-y-1">
          {TAHAPAN.map((t) => (
            <li key={t.nomor}>
              <strong>{t.nama}</strong> — {t.isi}
            </li>
          ))}
        </ol>
        <p className="mt-3">
          Modul yang aktif pada saat penandatanganan, modul yang diserahkan bertahap, beserta
          tenggatnya, dirinci pada <strong>Lampiran I</strong> dan menjadi bagian tidak
          terpisahkan dari perjanjian ini.
        </p>
      </Bab>

      <Bab nomor="Pasal 3" judul="Alamat Situs Pondok" merek={MEREK_SANTRI}>
        <Daftar
          butir={[
            <>
              PONDOK memperoleh alamat{' '}
              <span className="ltr-code">
                <Isian label="slug" lebar="w-44" />.{PENYEDIA.portal}
              </span>{' '}
              tanpa biaya tambahan.
            </>,
            <>
              PONDOK dapat memakai domain miliknya sendiri setelah kepemilikannya dibuktikan
              melalui pemeriksaan yang disediakan PENYEDIA. Biaya pendaftaran dan
              perpanjangan domain tersebut menjadi tanggung jawab PONDOK.
            </>,
            <>
              Isi situs, termasuk berita dan pengumuman, disusun dan diterbitkan PONDOK
              sendiri. PENYEDIA tidak bertanggung jawab atas isi yang diterbitkan PONDOK.
            </>,
            <>
              PENYEDIA berhak menonaktifkan sementara isi yang melanggar peraturan
              perundang-undangan, dengan pemberitahuan tertulis kepada PONDOK.
            </>,
          ]}
        />
      </Bab>

      <Bab nomor="Pasal 4" judul="Biaya dan Cara Pembayaran" merek={MEREK_SANTRI}>
        <p>
          Biaya layanan sebesar <strong>{rupiah(HARGA_PER_SANTRI)}</strong> per santri aktif
          per bulan, atau sebesar <Isian label="nilai kesepakatan" lebar="w-48" /> sesuai
          kesepakatan PARA PIHAK.
        </p>
        <Daftar butir={[...KETENTUAN_HARGA]} />
        <p className="mt-3">
          Penagihan dilakukan setiap <Isian label="periode" lebar="w-32" /> dan dibayarkan
          selambat-lambatnya <Isian label="jumlah" lebar="w-20" /> hari kalender sejak
          tagihan diterima.
        </p>
        <p className="mt-2 text-sm">
          Pembayaran layanan ini terpisah dari pembayaran SPP santri, uang saku, transaksi
          kantin, maupun simpanan koperasi. Keduanya tidak boleh dicampur.
        </p>
      </Bab>

      <Bab nomor="Pasal 5" judul="Jangka Waktu" merek={MEREK_SANTRI}>
        <p>
          Perjanjian berlaku <Isian label="jangka waktu" lebar="w-40" /> terhitung sejak{' '}
          <Isian label="tanggal mulai" lebar="w-40" />, dan diperpanjang otomatis untuk
          jangka waktu yang sama kecuali salah satu pihak menyatakan sebaliknya secara
          tertulis selambat-lambatnya <Isian label="jumlah" lebar="w-20" /> hari sebelum
          berakhir.
        </p>
      </Bab>

      <Bab nomor="Pasal 6" judul="Hak dan Kewajiban" merek={MEREK_SANTRI}>
        <p className="font-semibold">6.1 PENYEDIA berkewajiban:</p>
        <Daftar
          butir={[
            'Menyediakan layanan sesuai Lampiran I dan menjaga ketersediaannya.',
            'Melakukan pencadangan data secara berkala.',
            'Memberikan pelatihan dan pendampingan sesuai kesepakatan.',
            'Menangani gangguan melalui sistem tiket dengan prioritas yang disepakati.',
            'Menjaga kerahasiaan data PONDOK.',
          ]}
        />
        <p className="mt-3 font-semibold">6.2 PONDOK berkewajiban:</p>
        <Daftar
          butir={[
            'Menunjuk penanggung jawab dan operator yang mengikuti pelatihan.',
            'Menyediakan data yang benar dan mutakhir.',
            'Menjaga kerahasiaan nama pengguna dan kata sandi masing-masing petugas.',
            'Membayar biaya layanan tepat waktu.',
            'Menyediakan perangkat dan jaringan di lingkungan pondok.',
          ]}
        />
      </Bab>

      <Bab nomor="Pasal 7" judul="Kepemilikan dan Perlindungan Data" merek={MEREK_SANTRI}>
        <Daftar
          butir={[
            'Seluruh data santri, wali, pegawai, dan keuangan yang dimasukkan PONDOK adalah milik PONDOK.',
            'PENYEDIA memproses data tersebut semata-mata untuk menjalankan layanan ini.',
            'Data satu pondok tidak dapat diakses pondok lain.',
            'Setiap perubahan data tercatat beserta pelaku dan waktunya.',
            <>
              Data santri mencakup data anak dan, pada modul kesehatan, data kesehatan.
              Pemrosesannya tunduk pada peraturan perundang-undangan mengenai pelindungan
              data pribadi.
            </>,
            <>
              Pada saat perjanjian berakhir, PENYEDIA menyerahkan seluruh data PONDOK dalam
              bentuk yang dapat dibuka tanpa perangkat lunak PENYEDIA, selambat-lambatnya{' '}
              <Isian label="jumlah" lebar="w-20" /> hari kalender.
            </>,
          ]}
        />
      </Bab>

      <Bab nomor="Pasal 8" judul="Kerahasiaan" merek={MEREK_SANTRI}>
        <p>
          PARA PIHAK wajib menjaga kerahasiaan seluruh informasi yang diperoleh dari
          pelaksanaan perjanjian ini, dan kewajiban tersebut tetap berlaku setelah perjanjian
          berakhir.
        </p>
      </Bab>

      <Bab nomor="Pasal 9" judul="Pengakhiran" merek={MEREK_SANTRI}>
        <p>
          Perjanjian dapat diakhiri atas kesepakatan PARA PIHAK, atau oleh salah satu pihak
          apabila pihak lain melalaikan kewajibannya dan tidak memperbaikinya dalam{' '}
          <Isian label="jumlah" lebar="w-20" /> hari kalender sejak teguran tertulis.
        </p>
        <p className="mt-2">
          Pengakhiran tidak menghapus kewajiban yang telah timbul sebelumnya, termasuk
          kewajiban pembayaran dan penyerahan data sebagaimana Pasal 7.
        </p>
      </Bab>

      <Bab nomor="Pasal 10" judul="Keadaan Kahar" merek={MEREK_SANTRI}>
        <p>
          PARA PIHAK dibebaskan dari tanggung jawab atas keterlambatan atau kegagalan yang
          disebabkan keadaan di luar kendali yang wajar, dengan pemberitahuan tertulis
          selambat-lambatnya <Isian label="jumlah" lebar="w-20" /> hari sejak kejadian.
        </p>
      </Bab>

      <Bab nomor="Pasal 11" judul="Penyelesaian Perselisihan" merek={MEREK_SANTRI}>
        <p>
          Perselisihan diselesaikan secara musyawarah. Apabila tidak tercapai, PARA PIHAK
          memilih domisili hukum di <Isian label="pengadilan" lebar="w-64" />.
        </p>
      </Bab>

      <Bab nomor="Pasal 12" judul="Lain-lain" merek={MEREK_SANTRI}>
        <p>
          Hal yang belum diatur akan dituangkan dalam adendum yang ditandatangani PARA PIHAK
          dan menjadi bagian tidak terpisahkan dari perjanjian ini.
        </p>
      </Bab>

      <section className="mt-10 break-inside-avoid">
        <div className="grid gap-10 sm:grid-cols-2">
          <div className="text-center">
            <p className="font-semibold">PIHAK PERTAMA</p>
            <p className="text-sm">{PENYEDIA.nama}</p>
            <div className="mt-16 border-t border-slate-400 pt-2">
              <Isian label="nama dan jabatan" lebar="w-full" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-semibold">PIHAK KEDUA</p>
            <p className="text-sm">Pondok Pesantren</p>
            <div className="mt-16 border-t border-slate-400 pt-2">
              <Isian label="nama dan jabatan" lebar="w-full" />
            </div>
          </div>
        </div>
      </section>
    </DokumenLayout>
  );
}
