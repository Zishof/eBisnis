import { Bab, Daftar, DokumenLayout, type MerekDokumen } from '../../pages/public/DokumenLayout';

export const MEREK_EDUCATION: MerekDokumen = {
  nama: 'Enterprise Education',
  beranda: '/',
  aksenTeks: 'text-cyan-700 dark:text-cyan-300 print:text-cyan-700',
  aksenGaris: 'border-cyan-600',
  aksenTombol:
    'inline-flex items-center gap-1.5 rounded-lg bg-cyan-700 px-4 py-2 font-semibold text-white hover:bg-cyan-800',
};

const META = [
  { label: 'Domain', nilai: 'enterprise-education.id' },
  { label: 'Ruang lingkup', nilai: 'Sekolah, madrasah, pesantren, kampus' },
  { label: 'Model', nilai: 'SaaS multi-tenant' },
];

export function EducationProposalPage() {
  return (
    <DokumenLayout
      kategori="Proposal Penawaran"
      judul="Proposal Enterprise Education"
      ringkas="Usulan penerapan platform pendidikan terpadu untuk menghubungkan akademik, kesiswaan, keuangan, portal wali, dan website lembaga."
      meta={META}
      merek={MEREK_EDUCATION}
    >
      <Bab nomor="01" judul="Kebutuhan Lembaga" merek={MEREK_EDUCATION}>
        <p>
          Sekolah, madrasah, pesantren, kampus, dan yayasan memiliki ritme yang berbeda, tetapi semuanya membutuhkan data peserta didik yang rapi, alur layanan yang cepat, laporan yang dapat dipercaya, dan kanal komunikasi yang jelas untuk wali.
        </p>
      </Bab>
      <Bab nomor="02" judul="Ruang Lingkup" merek={MEREK_EDUCATION}>
        <Daftar
          butir={[
            'PPDB/PSB online, verifikasi berkas, jadwal wawancara, dan status pendaftar.',
            'Master siswa/santri, wali, guru, kelas, rombongan belajar, asrama, dan unit pendidikan.',
            'Jadwal, presensi, nilai, rapor, catatan pembinaan, prestasi, pelanggaran, dan komunikasi wali.',
            'Tagihan, pembayaran, dompet siswa/santri, kantin/koperasi, laporan, dan audit transaksi.',
            'Website publik lembaga, berita, gallery, program unggulan, dan dokumen kerja sama.',
          ]}
        />
      </Bab>
      <Bab nomor="03" judul="Tahapan Penerapan" merek={MEREK_EDUCATION}>
        <Daftar
          butir={[
            'Audit data awal dan pemetaan proses yang paling sering dipakai harian.',
            'Setup tenant, domain, role, hak akses, dan data inti.',
            'Migrasi bertahap dari Excel atau sistem lama.',
            'Pelatihan operator, wali kelas, bendahara, dan pimpinan.',
            'Go-live bertahap dengan monitoring dan perbaikan cepat.',
          ]}
        />
      </Bab>
    </DokumenLayout>
  );
}

export function EducationPenawaranPage() {
  return (
    <DokumenLayout
      kategori="Surat Penawaran"
      judul="Surat Penawaran Enterprise Education"
      ringkas="Ringkasan layanan dan ruang lingkup implementasi untuk pembahasan resmi dengan pengurus, yayasan, atau pimpinan lembaga pendidikan."
      meta={META}
      merek={MEREK_EDUCATION}
    >
      <Bab nomor="01" judul="Layanan yang Ditawarkan" merek={MEREK_EDUCATION}>
        <p>
          Enterprise Education menyediakan aplikasi operasional pendidikan berbasis web untuk administrasi, akademik, kesiswaan, keuangan, portal wali, dan website publik lembaga.
        </p>
      </Bab>
      <Bab nomor="02" judul="Komponen Biaya" merek={MEREK_EDUCATION}>
        <Daftar
          butir={[
            'Biaya berlangganan berdasarkan jumlah peserta didik aktif dan modul yang dipakai.',
            'Biaya setup awal untuk konfigurasi tenant, domain, role, dan data referensi.',
            'Biaya migrasi atau integrasi khusus bila lembaga memiliki sistem lama yang perlu disambungkan.',
          ]}
        />
      </Bab>
      <Bab nomor="03" judul="Catatan Implementasi" merek={MEREK_EDUCATION}>
        <p>
          Modul dapat diaktifkan bertahap. Rekomendasi awal adalah memulai dari data peserta didik, tagihan, PPDB/PSB, presensi, dan portal wali sebelum memperluas ke modul lanjutan.
        </p>
      </Bab>
    </DokumenLayout>
  );
}

export function EducationPksPage() {
  return (
    <DokumenLayout
      kategori="Draft PKS"
      judul="Draft Perjanjian Kerja Sama Enterprise Education"
      ringkas="Rancangan pokok kerja sama untuk penerapan, operasional, perlindungan data, dukungan, dan evaluasi layanan pendidikan digital."
      meta={META}
      merek={MEREK_EDUCATION}
    >
      <Bab nomor="01" judul="Ruang Lingkup Kerja Sama" merek={MEREK_EDUCATION}>
        <p>
          Para pihak bekerja sama dalam penyediaan, konfigurasi, pelatihan, dan pendampingan sistem informasi pendidikan sesuai modul yang disepakati.
        </p>
      </Bab>
      <Bab nomor="02" judul="Perlindungan Data" merek={MEREK_EDUCATION}>
        <Daftar
          butir={[
            'Data peserta didik, wali, guru, nilai, presensi, dan pembayaran dikelola sebagai data terbatas.',
            'Akses pengguna mengikuti role, hak akses menu, dan jejak audit.',
            'Data demo harus ditandai jelas dan tidak boleh bercampur dengan data produksi.',
          ]}
        />
      </Bab>
      <Bab nomor="03" judul="Dukungan dan Evaluasi" merek={MEREK_EDUCATION}>
        <p>
          Evaluasi dilakukan berkala terhadap performa sistem, kebutuhan pelatihan, kualitas data, dan modul yang perlu diaktifkan pada fase berikutnya.
        </p>
      </Bab>
    </DokumenLayout>
  );
}

export function EducationPresentationPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <section className="mx-auto grid min-h-screen max-w-7xl content-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:px-8">
        <div>
          <p className="inline-flex rounded-full bg-cyan-400 px-3 py-1 text-xs font-black uppercase text-slate-950">
            Presentasi pimpinan lembaga
          </p>
          <h1 className="mt-5 text-4xl font-black leading-tight sm:text-6xl">Enterprise Education</h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-300">
            Satu platform untuk membuat data pendidikan lebih tertib: penerimaan, akademik, asrama, pembinaan, keuangan, website publik, dan portal wali.
          </p>
        </div>
        <div className="grid gap-4">
          {[
            ['Masalah', 'Data tersebar di Excel, grup pesan, loket, dan catatan manual.'],
            ['Solusi', 'Satu database lembaga dengan role, audit, dan workflow lintas unit.'],
            ['Go-live', 'Mulai dari modul harian yang paling sering dipakai, lalu bertahap.'],
          ].map(([title, text]) => (
            <article key={title} className="rounded-lg border border-white/10 bg-white/10 p-5">
              <h2 className="text-xl font-black">{title}</h2>
              <p className="mt-2 leading-7 text-slate-300">{text}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
