/**
 * Draf surat penawaran resmi, siap cetak.
 *
 * Ringkas dengan sengaja. Surat penawaran dibaca lebih dahulu daripada proposal
 * — biasanya oleh orang yang belum tentu punya waktu membaca delapan bab — jadi
 * yang perlu tersampaikan hanya: apa yang ditawarkan, berapa biayanya, dan apa
 * langkah berikutnya. Rinciannya diserahkan kepada proposal.
 */

import { Link } from 'react-router-dom';
import { Bab, Daftar, DokumenLayout, Isian } from './DokumenLayout';
import {
  BIAYA_IMPLEMENTASI,
  OPSI_PEMBAYARAN,
  PAKET_PUSAT,
  RUPIAH,
  SIMULASI,
  TARIF_POS,
  TERMASUK_POS,
} from '../../content/solusi';

export function PenawaranPage() {
  const hariIni = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <DokumenLayout
      kategori="Surat penawaran resmi — DRAF"
      judul="Penawaran Implementasi Sistem Gudang, Kasir (POS) & Ritel Terpadu"
      ringkas="Surat ini memuat pokok penawaran beserta biayanya. Rincian modul, metodologi, dan peta jalan tersedia pada dokumen proposal; syarat kerja sama selengkapnya tersedia pada draf perjanjian."
      meta={[
        { label: 'Nomor surat', nilai: '…………………………' },
        { label: 'Tanggal', nilai: hariIni },
        { label: 'Sifat', nilai: 'Penawaran — berlaku 30 hari' },
      ]}
    >
      <section className="leading-relaxed text-slate-700 dark:text-slate-200 print:text-black">
        <p>
          Kepada Yth.
          <br />
          <Isian label="nama penerima" lebar="w-64" />
          <br />
          <Isian label="jabatan" lebar="w-64" />
          <br />
          <Isian label="nama institusi / badan usaha" lebar="w-72" />
          <br />
          di <Isian label="kota" lebar="w-48" />
        </p>

        <p className="mt-4">
          <strong>Perihal: Penawaran Implementasi Sistem Gudang, Kasir (POS) &amp; Ritel Terpadu</strong>
        </p>

        <p className="mt-4">Dengan hormat,</p>
        <p className="mt-2">
          Sehubungan dengan kebutuhan digitalisasi tata kelola gudang, kasir, dan pembukuan pada
          unit usaha Bapak/Ibu, bersama ini kami menyampaikan penawaran implementasi{' '}
          <strong>eBisnis.id</strong> — sistem berbasis web yang menyatukan kasir multi-outlet,
          manajemen gudang berjenjang, perhitungan harga pokok, pembukuan akuntansi, pengadaan
          barang, dan toko online dalam satu sistem yang saling terhubung dan dapat diaudit.
        </p>
      </section>

      <Bab nomor="1." judul="Yang Kami Tawarkan">
        <Daftar
          butir={[
            <>
              <strong>Kasir (POS) multi-outlet</strong> dengan validasi stok di sisi server,
              shift kasir, rekonsiliasi kas, serta pembayaran tunai dan non-tunai.
            </>,
            <>
              <strong>Gudang berjenjang pusat-cabang</strong> dengan buku besar pergerakan stok
              yang setiap barisnya tertelusur ke dokumen sumbernya.
            </>,
            <>
              <strong>Harga pokok penjualan otomatis</strong>, digulung dari komposisi resep —
              bukan angka yang diketik manual.
            </>,
            <>
              <strong>Akuntansi terintegrasi</strong> dengan bagan akun yang dapat dikonfigurasi
              dan peristiwa akuntansi yang terbentuk langsung dari dokumen transaksi.
            </>,
            <>
              <strong>Pengadaan dari permintaan sampai penerimaan barang</strong>, dengan alur
              persetujuan yang dapat disesuaikan struktur organisasi.
            </>,
            <>
              <strong>Toko online berdomain sendiri</strong>, lengkap dengan katalog, keranjang,
              checkout, dan pembayaran daring.
            </>,
            <>
              <strong>Tata kelola dan jejak audit</strong>: hak akses berjenjang, pemisahan
              wewenang, serta catatan audit yang hanya dapat bertambah dan tidak dapat disunting
              siapa pun.
            </>,
            <>
              <strong>Asisten AI</strong> yang berjalan pada server sendiri — data tidak dikirim
              ke layanan pihak ketiga — dan tidak berwenang mengambil tindakan apa pun.
            </>,
            <>
              <strong>Tiga aplikasi pendamping yang sudah dirilis</strong>: POS Kasir Desktop
              (Windows), POS Kasir Android, dan Stok Opname Android, dapat diunduh gratis.
            </>,
          ]}
        />
        <p className="text-sm">
          Rincian setiap butir beserta status kesiapannya — sudah berjalan, sedang dibangun, atau
          masih rencana — tercantum pada{' '}
          <Link to="/proposal" className="text-brand-700 underline dark:text-brand-300">
            dokumen proposal
          </Link>{' '}
          Bab IV. Kami menyebutkannya secara terbuka agar tidak ada yang dianggap tersedia
          padahal belum.
        </p>
      </Bab>

      <Bab nomor="2." judul="Biaya">
        <p>
          <strong>Formula biaya bulanan:</strong> Paket Modul Pusat + biaya POS pertama tiap
          outlet + biaya POS tambahan.
        </p>

        <p className="mt-3 font-semibold">a. Tarif kasir (POS) per terminal</p>
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
                  {RUPIAH.format(t.pertama)}
                </td>
                <td className="p-2 text-end tabular-nums">
                  {t.mulai && 'mulai '}
                  {RUPIAH.format(t.tambahan)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-sm">
          Sudah termasuk: {TERMASUK_POS.join(', ')}. Belum termasuk perangkat keras dan jaringan
          internet di lokasi outlet.
        </p>

        <p className="mt-3 font-semibold">b. Paket Modul Pusat (per perusahaan, bukan per outlet)</p>
        <table className="mt-2 w-full border-collapse text-sm">
          <tbody>
            {PAKET_PUSAT.map((p) => (
              <tr key={p.kode} className="border-b border-slate-200 align-top dark:border-slate-700">
                <td className="p-2 font-medium">{p.nama}</td>
                <td className="p-2">{p.cocok}</td>
                <td className="p-2 text-end tabular-nums">
                  {p.harga === 0 ? 'Rp 0' : `${RUPIAH.format(p.harga)} /bulan`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="mt-3 font-semibold">c. Contoh perhitungan</p>
        <p className="text-sm">Asumsi 2 unit POS per outlet dan paket Full Integrated Suite:</p>
        <Daftar
          butir={SIMULASI.map((s) => (
            <>
              <strong>{s.outlet} outlet:</strong> POS {RUPIAH.format(s.pos)} + modul pusat{' '}
              {RUPIAH.format(s.pusat)} = <strong>{RUPIAH.format(s.total)}</strong> per bulan.
            </>
          ))}
        />

        <p className="mt-3 font-semibold">d. Biaya implementasi awal (sekali bayar)</p>
        <Daftar
          butir={BIAYA_IMPLEMENTASI.map((b) => (
            <>
              {b.lingkup}: <strong>{b.nilai}</strong>
            </>
          ))}
        />

        <p className="mt-3 font-semibold">e. Opsi pembayaran lain</p>
        <Daftar
          butir={OPSI_PEMBAYARAN.map((o) => (
            <>
              <strong>{o.judul}.</strong> {o.isi}
            </>
          ))}
        />

        <p className="mt-3 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-800/50 print:bg-white">
          Seluruh angka di atas merupakan acuan standar dan tetap terbuka untuk dinegosiasikan
          sesuai skala jaringan outlet, kompleksitas kebutuhan, dan kesepakatan akhir.
        </p>
      </Bab>

      <Bab nomor="3." judul="Yang Sudah Termasuk Tanpa Biaya Tambahan">
        <Daftar
          butir={[
            'Pelatihan daring bagi kasir, petugas gudang, staf pengadaan, dan akuntan — gratis.',
            'Pelatihan tatap muka: jasa instruktur gratis; pihak Anda hanya menanggung transportasi dan akomodasi tim di lokasi.',
            'Pembaruan aplikasi pendamping (POS Desktop, POS Android, Stok Opname Android) selama masa kerja sama.',
            'Pendampingan teknis selama implementasi dan saat go-live.',
            'Penyerahan seluruh basis data dalam format standar apabila kerja sama berakhir.',
          ]}
        />
      </Bab>

      <Bab nomor="4." judul="Langkah Berikutnya">
        <p>
          Kami mengusulkan langkah berikut, yang dapat disesuaikan menurut kenyamanan Bapak/Ibu:
        </p>
        <ol className="ms-5 list-decimal space-y-1">
          <li>
            Mencoba sendiri lebih dahulu — pendaftaran mandiri di eBisnis.id menyiapkan ruang
            kerja dalam hitungan menit, dengan atau tanpa data contoh, tanpa biaya.
          </li>
          <li>Sesi presentasi (sekitar 45 menit), daring maupun di tempat Bapak/Ibu.</li>
          <li>Asesmen kebutuhan dan pemetaan alur operasional.</li>
          <li>Pembahasan draf perjanjian kerja sama bersama tim legal masing-masing.</li>
        </ol>
        <p className="mt-3">
          Penawaran ini berlaku 30 (tiga puluh) hari sejak tanggal surat. Demikian kami
          sampaikan, atas perhatian dan kesempatan yang diberikan kami ucapkan terima kasih.
        </p>

        <div className="mt-10 text-sm">
          <p>Hormat kami,</p>
          <p className="mt-1">eBisnis.id</p>
          <div className="mt-16 w-64 border-t border-slate-400 pt-1">
            <Isian label="nama dan jabatan" lebar="w-60" />
          </div>
        </div>
      </Bab>
    </DokumenLayout>
  );
}
