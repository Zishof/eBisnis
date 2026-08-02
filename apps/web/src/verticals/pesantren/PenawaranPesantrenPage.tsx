/**
 * Surat penawaran ePesantren.
 *
 * Berbeda dari Proposal: yang ini pendek, berbentuk surat, dan memuat angka.
 * Proposal menjelaskan; surat penawaran menawarkan.
 *
 * ## Simulasi biaya dihitung, bukan ditulis
 *
 * Angka pada tabel simulasi dihitung dari `HARGA_PER_SANTRI`. Menuliskannya
 * sebagai teks berarti suatu hari harganya berubah dan tabelnya tidak — dan
 * yang tertinggal pada surat penawaran adalah angka yang dikirim kepada pondok.
 */

import { Bab, Daftar, DokumenLayout, Isian, MEREK_SANTRI } from '../../pages/public/DokumenLayout';
import {
  DI_LUAR_BIAYA,
  HARGA_PER_SANTRI,
  KESIAPAN_SEKARANG,
  KETENTUAN_HARGA,
  PENYEDIA,
  PILAR,
} from './konten-pesantren';

const rupiah = (n: number) => `Rp ${n.toLocaleString('id-ID')}`;

/** Jumlah santri untuk simulasi. Sengaja bulat dan lazim. */
const SIMULASI_SANTRI = [100, 250, 500, 1000, 2000];

export function PenawaranPesantrenPage() {
  return (
    <DokumenLayout
      merek={MEREK_SANTRI}
      kategori="Surat Penawaran"
      judul="Penawaran Layanan Sistem Informasi Pondok Pesantren"
      ringkas={
        'Penawaran layanan ePesantren melalui portal santri.info, beserta simulasi biaya ' +
        'berdasarkan jumlah santri aktif.'
      }
      meta={[
        { label: 'Nomor', nilai: '____ / PNW / ____' },
        { label: 'Tanggal', nilai: '____________' },
        { label: 'Berlaku', nilai: '30 hari sejak tanggal surat' },
      ]}
    >
      <div className="mb-6">
        <p>
          Kepada Yth.
          <br />
          Pimpinan Pondok Pesantren <Isian label="nama pondok" lebar="w-72" />
          <br />
          di <Isian label="kota" lebar="w-56" />
        </p>
      </div>

      <p>Assalamu&rsquo;alaikum warahmatullahi wabarakatuh.</p>

      <p className="mt-3">
        Bersama surat ini, {PENYEDIA.nama} menyampaikan penawaran layanan sistem informasi
        pondok pesantren melalui portal <strong>{PENYEDIA.portal}</strong>. Layanan ini
        menyatukan pendidikan, kesantrian, keuangan, unit usaha, dan tata kelola pondok dalam
        satu sistem — dicatat sekali, dipakai bersama.
      </p>

      <Bab nomor="1." judul="Yang Ditawarkan" merek={MEREK_SANTRI}>
        <p>Delapan pilar layanan:</p>
        <Daftar
          butir={PILAR.map((p) => (
            <>
              <strong>{p.nama}.</strong> {p.ringkas}
            </>
          ))}
        />
        <p className="mt-3 text-sm">
          Pondok tidak harus memakai seluruhnya sejak awal. Yang dapat langsung dipakai pada
          bulan pertama:
        </p>
        <Daftar butir={[...KESIAPAN_SEKARANG]} />
      </Bab>

      <Bab nomor="2." judul="Harga" merek={MEREK_SANTRI}>
        <p className="text-lg font-bold text-slate-900 dark:text-white print:text-black">
          {rupiah(HARGA_PER_SANTRI)} per santri aktif per bulan
        </p>
        <Daftar butir={[...KETENTUAN_HARGA]} />
      </Bab>

      <Bab nomor="3." judul="Simulasi Biaya" merek={MEREK_SANTRI}>
        <p className="text-sm">
          Perhitungan di bawah memakai harga dasar. Angka sebenarnya mengikuti jumlah santri
          berstatus aktif pada bulan berjalan.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[26rem] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-slate-300 text-start">
                <th className="py-2 text-start">Jumlah santri aktif</th>
                <th className="py-2 text-end">Per bulan</th>
                <th className="py-2 text-end">Per tahun</th>
              </tr>
            </thead>
            <tbody>
              {SIMULASI_SANTRI.map((n) => (
                <tr key={n} className="border-b border-slate-200">
                  <td className="py-2">{n.toLocaleString('id-ID')} santri</td>
                  <td className="py-2 text-end">{rupiah(n * HARGA_PER_SANTRI)}</td>
                  <td className="py-2 text-end">{rupiah(n * HARGA_PER_SANTRI * 12)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm">
          Pondok dengan jumlah santri besar, yayasan dengan beberapa unit, atau kebutuhan
          khusus dibicarakan tersendiri dan dituangkan pada perjanjian kerja sama.
        </p>
      </Bab>

      <Bab nomor="4." judul="Di Luar Penawaran Ini" merek={MEREK_SANTRI}>
        <Daftar butir={[...DI_LUAR_BIAYA]} />
      </Bab>

      <Bab nomor="5." judul="Masa Berlaku dan Langkah Berikutnya" merek={MEREK_SANTRI}>
        <p>
          Penawaran ini berlaku 30 hari sejak tanggal surat. Bila Bapak/Ibu berkenan, langkah
          berikutnya adalah:
        </p>
        <ol className="ms-5 list-decimal space-y-1">
          <li>Pertemuan pemaparan dan pendataan kebutuhan pondok.</li>
          <li>Penyusunan Lampiran I: modul yang aktif dan jadwal penyerahannya.</li>
          <li>Penandatanganan perjanjian kerja sama.</li>
          <li>Penyiapan ruang kerja dan alamat situs pondok.</li>
        </ol>
      </Bab>

      <p className="mt-6">
        Demikian penawaran ini kami sampaikan. Atas perhatian dan kerja samanya, kami
        ucapkan terima kasih.
      </p>

      <p className="mt-3">Wassalamu&rsquo;alaikum warahmatullahi wabarakatuh.</p>

      <section className="mt-10 break-inside-avoid">
        <p className="font-semibold">Hormat kami,</p>
        <p>{PENYEDIA.nama}</p>
        <div className="mt-16 w-72 border-t border-slate-400 pt-2">
          <Isian label="nama dan jabatan" lebar="w-full" />
        </div>
        <p className="mt-4 text-sm">
          {PENYEDIA.alamat}
          <br />
          {PENYEDIA.surel} · {PENYEDIA.telepon} · Faks. {PENYEDIA.faks}
        </p>
      </section>
    </DokumenLayout>
  );
}
