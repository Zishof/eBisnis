/**
 * Aturan penerjemahan host menjadi penyewa, untuk situs publik vertikal.
 *
 * Menjawab [IR-005](../../../../../docs/integration-requests/cooperative/005-resolusi-tenant-situs-publik.md).
 *
 * ## Persoalan yang diselesaikan
 *
 * Situs koperasi, klinik, dan desa harus dapat dibuka pengunjung yang belum
 * masuk. Pengunjung tanpa sesi tidak membawa konteks ruang kerja, sehingga
 * sesuatu harus menentukan skema mana yang dibaca.
 *
 * Sesi eKoperasi menolak menyelesaikannya sendiri, dan penolakan itu benar:
 * satu-satunya jalan yang tersedia adalah menerima nama skema dari alamat —
 *
 *     GET /api/v1/cooperative/public/:schema/:slug
 *
 * — dan alamat semacam itu dapat dicoba nama demi nama oleh siapa pun di
 * internet sampai menemukan skema yang ada. Begitu ditemukan, pemanggilnya
 * sudah berada di dalam skema penyewa lain.
 *
 * ## Yang menggantikannya
 *
 * Host permintaan diterjemahkan menjadi penyewa lewat tabel terdaftar di
 * control plane. Host **tidak pernah dipercaya apa adanya** — ia dicocokkan,
 * dan host yang tidak cocok menghasilkan 404 tanpa pilihan cadangan apa pun.
 *
 * Berkas ini memuat bagian yang dapat diuji tanpa basis data: penormalan host,
 * penolakan bentuk yang berbahaya, dan aturan kelayakan sebuah pencocokan.
 */

export interface Verdict {
  allowed: boolean;
  message?: string;
  code?: string;
}

/** Panjang maksimum sebuah nama host menurut DNS. */
export const MAX_HOST_LENGTH = 253;

/**
 * Menormalkan nilai header `Host`.
 *
 * Mengembalikan `null` bila bentuknya tidak dapat dipercaya sama sekali.
 * Mengembalikan null lebih baik daripada membersihkan sebisanya: nilai yang
 * "hampir benar" pada pemetaan keamanan adalah nilai yang salah.
 */
export function normalkanHost(raw: string | null | undefined): string | null {
  if (!raw) return null;

  let host = raw.trim().toLowerCase();
  if (host.length === 0 || host.length > MAX_HOST_LENGTH + 8) return null;

  /*
   * Header Host boleh membawa porta. Porta tidak menentukan penyewa —
   * `koperasi.ekoperasi.id` dan `koperasi.ekoperasi.id:8443` adalah situs yang
   * sama — jadi dibuang setelah dipastikan bentuknya memang porta.
   */
  const kurungTutup = host.lastIndexOf(']');
  const titikDua = host.lastIndexOf(':');
  if (titikDua > kurungTutup) {
    const porta = host.slice(titikDua + 1);
    if (!/^\d{1,5}$/.test(porta)) return null;
    host = host.slice(0, titikDua);
  }

  // Titik di ujung sah menurut DNS (akar absolut), tetapi tidak pernah dipakai
  // sebagai kunci penyimpanan — dibuang supaya satu situs punya satu kunci.
  if (host.endsWith('.')) host = host.slice(0, -1);

  if (host.length === 0 || host.length > MAX_HOST_LENGTH) return null;

  /*
   * Hanya huruf, angka, tanda hubung, dan titik. Segala yang lain ditolak,
   * termasuk aksara yang tampak seperti huruf biasa.
   *
   * Nama internasional harus sudah dalam bentuk punycode saat sampai di sini.
   * Menerima aksara Unicode apa adanya membuka jalan ke host yang tampak sama
   * bagi manusia tetapi berbeda bagi mesin — dan pemetaan host ke penyewa
   * adalah tempat yang paling merugikan bila hal itu terjadi.
   */
  if (!/^[a-z0-9.-]+$/.test(host)) return null;

  // Label kosong (`a..b`), titik di awal, atau tanda hubung di ujung label
  // menandakan nilai yang dirakit keliru — bukan host yang sah.
  const label = host.split('.');
  if (label.some((l) => l.length === 0 || l.length > 63)) return null;
  if (label.some((l) => l.startsWith('-') || l.endsWith('-'))) return null;

  return host;
}

/** Host yang tidak boleh dipakai memetakan penyewa, betapa pun terdaftarnya. */
export const HOST_TERLARANG = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal',
  '169.254.169.254',
]);

/**
 * Bolehkah host ini dipakai mencari penyewa?
 *
 * Pemeriksaan sebelum menyentuh basis data. Yang ditolak di sini tidak pernah
 * menjadi kueri, sehingga tidak ada yang dapat disimpulkan dari lama jawabannya.
 */
export function bolehDipakaiMencari(host: string | null): Verdict {
  if (!host) {
    return { allowed: false, code: 'HOST_INVALID', message: 'Situs tidak ditemukan.' };
  }

  if (HOST_TERLARANG.has(host)) {
    /*
     * `localhost` dan alamat metadata awan tidak boleh pernah menjadi kunci
     * penyewa. Bila salah satunya sempat terdaftar — karena kekeliruan
     * pengembangan yang terbawa ke produksi — permintaan dari dalam mesin
     * sendiri akan memperoleh konteks penyewa sungguhan.
     */
    return { allowed: false, code: 'HOST_RESERVED', message: 'Situs tidak ditemukan.' };
  }

  // Alamat IP tidak pernah menjadi alamat situs penyewa. Ia menandakan
  // permintaan yang menembus pengarah, dan itu bukan pengunjung biasa.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    return { allowed: false, code: 'HOST_IS_IP', message: 'Situs tidak ditemukan.' };
  }

  if (!host.includes('.')) {
    return { allowed: false, code: 'HOST_NO_DOT', message: 'Situs tidak ditemukan.' };
  }

  return { allowed: true };
}

export interface BarisDomain {
  host: string;
  tenantId: string;
  vertical: string;
  status: string;
  verifiedAt: string | null;
}

export interface BarisRegistry {
  tenantId: string;
  schemaName: string;
  status: string;
}

/**
 * Bolehkah pencocokan ini dipakai?
 *
 * Seluruh penolakan berbunyi sama — "Situs tidak ditemukan." Pengunjung yang
 * mencoba menebak tidak boleh dapat membedakan "host tidak terdaftar" dari
 * "host terdaftar tetapi penyewanya nonaktif"; perbedaan itu sendiri sudah
 * merupakan keterangan.
 */
export function bolehMemakaiPencocokan(
  domain: BarisDomain | null,
  registry: BarisRegistry | null,
): Verdict {
  const tidakDitemukan = (code: string): Verdict => ({
    allowed: false,
    code,
    message: 'Situs tidak ditemukan.',
  });

  if (!domain) return tidakDitemukan('DOMAIN_NOT_REGISTERED');
  if (domain.status !== 'ACTIVE') return tidakDitemukan('DOMAIN_NOT_ACTIVE');

  /*
   * Domain wajib sudah terbukti dimiliki penyewanya. Tanpa ini, siapa pun
   * dapat mendaftarkan host milik orang lain dan memperoleh permintaan yang
   * ditujukan ke sana — beserta konteks penyewanya.
   */
  if (!domain.verifiedAt) return tidakDitemukan('DOMAIN_NOT_VERIFIED');

  if (!registry) return tidakDitemukan('TENANT_NOT_PROVISIONED');
  if (registry.tenantId !== domain.tenantId) return tidakDitemukan('TENANT_MISMATCH');
  if (!STATUS_REGISTRY_SIAP.has(registry.status)) return tidakDitemukan('TENANT_NOT_READY');

  /*
   * Penjaga terakhir, dan yang paling penting: nama skema yang datang dari
   * registry tetap diperiksa bentuknya. Nilai ini akan disisipkan ke dalam
   * SQL sebagai pengenal, dan pengenal tidak dapat diparameterkan.
   */
  if (!/^[a-z][a-z0-9_]{2,63}$/.test(registry.schemaName)) {
    return tidakDitemukan('SCHEMA_NAME_INVALID');
  }

  /*
   * Dan nama yang bentuknya sah pun bisa tetap terlarang.
   *
   * `public` memenuhi pola di atas sepenuhnya, tetapi ia justru nama yang
   * paling berbahaya: aturan tetap proyek ini melarang `public` menjadi skema
   * penyewa maupun cadangan `search_path`. Satu baris registry yang keliru —
   * atau satu penyisipan yang tidak terduga — akan mengarahkan permintaan dari
   * internet ke skema yang isinya milik semua orang.
   */
  if (SKEMA_TERLARANG.has(registry.schemaName)) {
    return tidakDitemukan('SCHEMA_NAME_RESERVED');
  }

  return { allowed: true };
}

/**
 * Status registry yang boleh melayani permintaan publik.
 *
 * Hanya `READY`. `MIGRATING` sengaja tidak termasuk: melayani pengunjung dari
 * skema yang sedang bermigrasi berarti membaca tabel yang mungkin baru separuh
 * berubah, dan hasilnya adalah halaman yang salah tanpa satu pun galat.
 * `RESERVED`, `PROVISIONING`, `SUSPENDED`, dan `FAILED` jelas belum atau tidak
 * lagi layak.
 */
export const STATUS_REGISTRY_SIAP = new Set(['READY']);

/** Nama skema yang tidak boleh pernah menjadi skema penyewa. */
export const SKEMA_TERLARANG = new Set([
  'public',
  'platform',
  'information_schema',
  'pg_catalog',
  'pg_toast',
  'pg_temp',
]);

/**
 * Bolehkah vertikal ini dilayani pada host tersebut?
 *
 * Sebuah host terdaftar untuk satu vertikal. Situs koperasi tidak boleh
 * melayani permintaan klinik hanya karena penyewanya sama — keduanya punya
 * pembaca, isi, dan aturan cakupan data yang berbeda.
 */
export function bolehMelayaniVertikal(domain: BarisDomain, vertical: string): Verdict {
  if (domain.vertical !== vertical) {
    return {
      allowed: false,
      code: 'VERTICAL_MISMATCH',
      message: 'Situs tidak ditemukan.',
    };
  }
  return { allowed: true };
}

/**
 * Menyiapkan host untuk disimpan sebagai kunci.
 *
 * Sengaja memakai penormal yang sama dengan jalur pembacaan. Penyimpanan dan
 * pembacaan yang memakai penormal berbeda menghasilkan baris yang tersimpan
 * tetapi tidak pernah ditemukan — dan gejalanya hanyalah situs yang "tidak
 * bekerja", tanpa galat apa pun.
 */
export function kunciSimpanan(raw: string): string | null {
  const host = normalkanHost(raw);
  if (!host) return null;
  return bolehDipakaiMencari(host).allowed ? host : null;
}
