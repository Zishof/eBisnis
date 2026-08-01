/**
 * Proposal penawaran ePesantren.
 *
 * Isinya diambil dari `konten-pesantren.ts`, sumber yang sama dengan Presentasi,
 * Draft PKS, dan Surat Penawaran. Menuliskannya ulang di sini berarti suatu hari
 * proposal menyebut delapan pilar sementara presentasi menyebut tujuh — dan
 * selisih itu ditemukan pondok, bukan oleh kita.
 *
 * Satu bab sengaja ada dan tidak lazim pada dokumen jualan: **apa yang belum
 * ada**. Paparan menggambarkan tujuan akhir; proposal yang tidak membedakannya
 * dari keadaan hari ini menjanjikan hal yang ditemukan pondok pada minggu
 * pertama — bukan saat menandatangani.
 */

import { Bab, Daftar, DokumenLayout, MEREK_SANTRI } from '../../pages/public/DokumenLayout';
import {
  DI_LUAR_BIAYA,
  HARGA_PER_SANTRI,
  KESIAPAN_BERTAHAP,
  KESIAPAN_SEKARANG,
  KETENTUAN_HARGA,
  KEUNGGULAN,
  MASALAH,
  PENYEDIA,
  PILAR,
  SIFAT_SOLUSI,
  TAHAPAN,
} from './konten-pesantren';

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

export function ProposalPesantrenPage() {
  return (
    <DokumenLayout
      merek={MEREK_SANTRI}
      kategori="Proposal Kerja Sama"
      judul="Digitalisasi Terpadu Pondok Pesantren"
      ringkas={
        'Usulan penerapan ePesantren melalui santri.info: satu sistem untuk pendidikan, ' +
        'kesantrian, keuangan syariah, unit usaha, dan tata kelola pondok.'
      }
      meta={[
        { label: 'Penyedia', nilai: PENYEDIA.nama },
        { label: 'Portal', nilai: PENYEDIA.portal },
        { label: 'Harga dasar', nilai: `${rupiah(HARGA_PER_SANTRI)} / santri / bulan` },
      ]}
    >
      <Bab nomor="1." judul="Latar Belakang" merek={MEREK_SANTRI}>
        <p>
          Pondok pesantren kini mengelola ribuan santri, banyak unit, dan beragam kegiatan
          sekaligus. Tanpa sistem terpadu, pengelolaan menjadi berat, lambat, dan rawan
          selisih. Enam hal berikut yang paling sering kami temui:
        </p>
        <Daftar
          butir={MASALAH.map((m) => (
            <>
              <strong>{m.judul}.</strong> {m.isi}
            </>
          ))}
        />
      </Bab>

      <Bab nomor="2." judul="Usulan Solusi" merek={MEREK_SANTRI}>
        <p>
          Seluruh kebutuhan pondok dibangun di atas satu fondasi teknologi yang sama. Cukup
          satu kali masuk, seluruh unit terhubung, dan setiap data hanya dicatat sekali —
          konsisten dari hulu ke hilir.
        </p>
        <Daftar
          butir={SIFAT_SOLUSI.map((s) => (
            <>
              <strong>{s.judul}.</strong> {s.isi}
            </>
          ))}
        />
      </Bab>

      <Bab nomor="3." judul="Ruang Lingkup" merek={MEREK_SANTRI}>
        <p>
          Delapan pilar berikut mencakup hampir seluruh aktivitas pesantren. Pondok tidak
          harus memakai semuanya sejak awal; yang dipakai dapat ditambah kapan saja tanpa
          berganti sistem dan tanpa kehilangan data.
        </p>
        {PILAR.map((p) => (
          <div key={p.nomor} className="mt-4 break-inside-avoid">
            <h3 className="font-semibold text-slate-900 dark:text-white print:text-black">
              3.{p.nomor} {p.nama}
            </h3>
            <p className="mt-1 text-sm">{p.ringkas}</p>
            <Daftar
              butir={p.butir.map((b) => (
                <>
                  <strong>{b.judul}.</strong> {b.isi}
                </>
              ))}
            />
          </div>
        ))}
      </Bab>

      <Bab nomor="4." judul="Yang Sudah Dapat Dipakai dan Yang Bertahap" merek={MEREK_SANTRI}>
        <p>
          Bab ini sengaja ada. Ruang lingkup di atas menggambarkan tujuan akhir; berikut
          keadaan hari ini, supaya tidak ada yang ditemukan belakangan.
        </p>
        <h3 className="mt-3 font-semibold text-slate-900 dark:text-white print:text-black">
          4.1 Siap dipakai sejak awal
        </h3>
        <Daftar butir={[...KESIAPAN_SEKARANG]} />
        <h3 className="mt-4 font-semibold text-slate-900 dark:text-white print:text-black">
          4.2 Diserahkan bertahap sesuai jadwal yang disepakati
        </h3>
        <Daftar butir={[...KESIAPAN_BERTAHAP]} />
        <p className="mt-3 text-sm">
          Urutan dan tenggat butir 4.2 dituangkan pada lampiran perjanjian kerja sama, bukan
          pada proposal ini.
        </p>
      </Bab>

      <Bab nomor="5." judul="Tahapan Penerapan" merek={MEREK_SANTRI}>
        <ol className="ms-5 list-decimal space-y-1.5">
          {TAHAPAN.map((t) => (
            <li key={t.nomor}>
              <strong>{t.nama}.</strong> {t.isi}
            </li>
          ))}
        </ol>
        <p className="mt-3">
          Setiap kebutuhan dan kendala ditangani lewat sistem tiket — lengkap dengan nomor,
          riwayat, penanggung jawab, dan skala prioritas yang disepakati bersama.
        </p>
      </Bab>

      <Bab nomor="6." judul="Biaya" merek={MEREK_SANTRI}>
        <p className="text-lg font-bold text-slate-900 dark:text-white print:text-black">
          {rupiah(HARGA_PER_SANTRI)} per santri aktif per bulan
        </p>
        <Daftar butir={[...KETENTUAN_HARGA]} />
        <h3 className="mt-4 font-semibold text-slate-900 dark:text-white print:text-black">
          6.1 Di luar biaya di atas
        </h3>
        <Daftar butir={[...DI_LUAR_BIAYA]} />
      </Bab>

      <Bab nomor="7." judul="Mengapa Kami" merek={MEREK_SANTRI}>
        <Daftar
          butir={KEUNGGULAN.map((k) => (
            <>
              <strong>{k.judul}.</strong> {k.isi}
            </>
          ))}
        />
      </Bab>

      <Bab nomor="8." judul="Kepemilikan Data" merek={MEREK_SANTRI}>
        <p>
          Seluruh data santri, keuangan, dan kepegawaian adalah milik pondok. Bila kerja
          sama berakhir, data diserahkan dalam bentuk yang dapat dibuka sendiri — bukan
          ditahan sebagai alasan agar pondok bertahan.
        </p>
        <p>
          Setiap perubahan tercatat: siapa yang mengubah, apa yang diubah, dan kapan. Data
          satu pondok tidak dapat dibaca pondok lain.
        </p>
      </Bab>

      <Bab nomor="9." judul="Penutup" merek={MEREK_SANTRI}>
        <p>
          {PENYEDIA.nama} siap mendampingi pondok pesantren Bapak/Ibu mewujudkan tata kelola
          yang modern, terpadu, dan amanah — dari perencanaan hingga operasional
          berkelanjutan.
        </p>
        <p className="mt-3">
          {PENYEDIA.alamat}
          <br />
          {PENYEDIA.surel} · {PENYEDIA.telepon} · Faks. {PENYEDIA.faks}
        </p>
      </Bab>
    </DokumenLayout>
  );
}
