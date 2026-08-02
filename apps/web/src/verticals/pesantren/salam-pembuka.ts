/**
 * Salam dan muqaddimah pembuka halaman santri.info.
 *
 * ## Mengapa berkas tersendiri
 *
 * Teks Arab tidak boleh ikut tersapu penyuntingan biasa. Salah satu huruf atau
 * satu harakat yang bergeser mengubah bacaannya, dan yang membacanya adalah
 * orang yang mengenali kesalahan itu seketika. Dikumpulkan di sini supaya
 * perubahannya selalu terlihat sebagai perubahan pada teks Arab, bukan
 * terselip di tengah tata letak.
 *
 * ## Tentang penulisan
 *
 * Ditulis lengkap dengan harakat, dalam bentuk yang lazim dibaca pembuka
 * pengajian dan pidato dakwah. Tidak disingkat dan tidak ditranslasi mesin.
 *
 * Setiap teks Arab wajib ditandai `lang="ar"` dan `dir="rtl"` saat digambar.
 * Tanpa itu, tanda baca berpindah ke sisi yang salah dan pembaca layar
 * melafalkannya sebagai bahasa Indonesia.
 */

export interface BarisArab {
  /** Teks Arab lengkap dengan harakat. */
  arab: string;
  /** Alih aksara Latin, untuk yang belum lancar membaca Arab. */
  latin: string;
  /** Arti dalam bahasa Indonesia. */
  arti: string;
}

export const BASMALAH: BarisArab = {
  arab: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
  latin: 'Bismillāhir-raḥmānir-raḥīm',
  arti: 'Dengan menyebut nama Allah Yang Maha Pengasih lagi Maha Penyayang.',
};

export const SALAM: BarisArab = {
  arab: 'السَّلَامُ عَلَيْكُمْ وَرَحْمَةُ اللَّهِ وَبَرَكَاتُهُ',
  latin: 'Assalāmu‘alaikum waraḥmatullāhi wabarakātuh',
  arti: 'Semoga keselamatan, rahmat Allah, dan keberkahan-Nya terlimpah kepada Anda.',
};

export const HAMDALAH: BarisArab = {
  arab:
    'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ، وَالصَّلَاةُ وَالسَّلَامُ عَلَىٰ أَشْرَفِ ' +
    'الْأَنْبِيَاءِ وَالْمُرْسَلِينَ، سَيِّدِنَا مُحَمَّدٍ وَعَلَىٰ آلِهِ وَصَحْبِهِ ' +
    'أَجْمَعِينَ، أَمَّا بَعْدُ',
  latin:
    'Alḥamdulillāhi rabbil-‘ālamīn, waṣ-ṣalātu was-salāmu ‘alā asyrafil-anbiyā’i ' +
    'wal-mursalīn, sayyidinā Muḥammadin wa ‘alā ālihi wa ṣaḥbihi ajma‘īn, ammā ba‘du',
  arti:
    'Segala puji bagi Allah, Tuhan semesta alam. Selawat dan salam semoga tercurah ' +
    'kepada makhluk termulia, junjungan kita Nabi Muhammad, beserta keluarga dan ' +
    'seluruh sahabatnya. Adapun setelah itu…',
};

/**
 * Muqaddimah — disusun seperti pembuka pidato dakwah.
 *
 * Alurnya mengikuti kebiasaan mimbar: menyapa yang hadir, menyebut keadaan,
 * menyampaikan maksud, lalu menutup dengan harapan dan doa.
 */
export const MUQADDIMAH_PARAGRAF: string[] = [
  'Segala puji bagi Allah yang telah menjadikan pondok pesantren sebagai benteng ' +
    'ilmu dan akhlak di negeri ini. Dari serambi-serambi surau yang sederhana, ' +
    'lahir generasi yang menjaga Al-Qur’an, memakmurkan masjid, dan mengabdi ' +
    'kepada masyarakat. Selawat dan salam senantiasa tercurah kepada Baginda ' +
    'Nabi Muhammad ﷺ, guru pertama dan teladan utama bagi setiap pendidik.',

  'Para pengasuh, asatidz, pengurus, dan wali santri yang kami muliakan. ' +
    'Pondok pesantren hari ini tidak lagi mengurus puluhan santri, melainkan ' +
    'ratusan bahkan ribuan. Bersamanya bertambah pula asrama yang harus diawasi, ' +
    'kelas yang harus dijadwalkan, hafalan yang harus disimak, izin yang harus ' +
    'diputuskan, dan amanah harta yang harus dipertanggungjawabkan. Semua itu ' +
    'masih dicatat di buku besar, di berkas yang tersebar, dan di ingatan ' +
    'beberapa orang yang sangat sibuk.',

  'Kita semua tahu, niat yang baik tidak selalu cukup menjaga amanah. Selisih ' +
    'catatan yang tidak disengaja dapat menimbulkan prasangka; kabar yang ' +
    'terlambat sampai dapat meresahkan wali; dan laporan yang sulit disusun ' +
    'dapat menunda keputusan yang sebenarnya mendesak. Padahal Allah telah ' +
    'memerintahkan pencatatan bahkan untuk urusan utang-piutang antara dua ' +
    'orang — apalagi urusan sebesar pondok pesantren.',

  'Dari kegelisahan itulah santri.info dihadirkan. Bukan untuk mengganti peran ' +
    'kiai dan asatidz, bukan pula untuk menggeser tradisi yang sudah baik. Ia ' +
    'hanya menata yang selama ini tercecer: satu kali dicatat, dipakai bersama, ' +
    'dan setiap perubahan meninggalkan jejak yang dapat ditelusuri. Dengan begitu ' +
    'waktu para asatidz kembali kepada mengajar dan membina, bukan kepada ' +
    'menyalin ulang.',

  'Semoga ikhtiar sederhana ini menjadi wasilah kemudahan bagi pondok pesantren ' +
    'dalam menunaikan amanahnya, dan menjadi amal yang bermanfaat bagi para ' +
    'santri, para wali, serta umat. Āmīn yā rabbal-‘ālamīn.',
];

/** Penutup pendek, dipakai di ujung muqaddimah. */
export const DOA_PENUTUP: BarisArab = {
  arab: 'وَاللَّهُ الْمُوَفِّقُ إِلَىٰ أَقْوَمِ الطَّرِيقِ',
  latin: 'Wallāhul-muwaffiqu ilā aqwamiṭ-ṭarīq',
  arti: 'Allah-lah yang memberi taufik menuju jalan yang paling lurus.',
};
