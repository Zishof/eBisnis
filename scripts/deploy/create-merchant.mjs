#!/usr/bin/env node
/**
 * Membuat akun pedagang (tenant) lewat alur pendaftaran publik yang sebenarnya.
 *
 * Memakai endpoint yang sama dengan tombol "Daftar" pada website, sehingga
 * keberhasilannya sekaligus membuktikan pendaftaran dan provisioning schema
 * berjalan.
 *
 * Contoh:
 *   node scripts/deploy/create-merchant.mjs \
 *     --api https://ebisnis.id \
 *     --username tokoberkah \
 *     --name "Toko Berkah" \
 *     --email pemilik@tokoberkah.example \
 *     --password 'KataSandi#2026'
 *
 * Bila --password tidak diberikan, server yang membuatkan kata sandi sementara
 * dan mengembalikannya SATU KALI pada keluaran perintah ini.
 *
 * Ketentuan kata sandi: minimal 10 karakter, memuat huruf kecil, huruf besar,
 * angka, dan satu simbol.
 *
 * Ketentuan username: ^[a-z][a-z0-9_]{2,47}$ — menjadi nama schema tenant,
 * bersifat permanen, dan tidak dapat diubah setelah dibuat.
 */

const args = process.argv.slice(2);
function arg(name, fallback = undefined) {
  const i = args.indexOf(`--${name}`);
  if (i !== -1 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return fallback;
}

const api = (arg('api', process.env.EBISNIS_API_URL ?? 'http://127.0.0.1:3000')).replace(/\/+$/, '');
const username = arg('username');
const name = arg('name', 'Toko Contoh');
const email = arg('email', username ? `${username}@contoh.example` : undefined);
const password = arg('password', process.env.EBISNIS_MERCHANT_PASSWORD);

if (!username) {
  console.error('Wajib: --username <nama_pengguna>');
  console.error('Jalankan dengan --help untuk melihat contoh.');
  process.exit(1);
}
if (!/^[a-z][a-z0-9_]{2,47}$/.test(username)) {
  console.error(`Username "${username}" tidak sah.`);
  console.error('Pola yang berlaku: ^[a-z][a-z0-9_]{2,47}$ (huruf kecil, angka, garis bawah).');
  process.exit(1);
}

async function post(path, body) {
  const res = await fetch(`${api}/api/v1${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* respons bukan JSON */
  }
  return { status: res.status, json };
}

const check = await post('/public/usernames/check', { desiredUsername: username });
if (check.status !== 200 && check.status !== 201) {
  console.error(`Pemeriksaan username gagal (HTTP ${check.status}).`);
  console.error(JSON.stringify(check.json, null, 2));
  process.exit(1);
}
if (check.json?.data?.available === false) {
  console.error(`Username "${username}" sudah dipakai atau termasuk nama yang dicadangkan.`);
  process.exit(1);
}

const payload = {
  businessName: name,
  businessType: arg('type', 'Perdagangan Umum'),
  country: 'Indonesia',
  province: arg('province', 'DKI Jakarta'),
  cityRegency: arg('city', 'Jakarta Selatan'),
  district: arg('district', 'Kebayoran Baru'),
  address: arg('address', 'Alamat belum diisi'),
  contactPerson: arg('contact', name),
  contactPhone: arg('phone', '081200000000'),
  businessPhone: arg('phone', '081200000000'),
  email,
  desiredUsername: username,
  acceptTerms: true,
  acceptPrivacy: true,
  ...(password
    ? { generatePassword: false, password, passwordConfirmation: password }
    : { generatePassword: true }),
};

const result = await post('/public/registrations', payload);

if (result.status !== 201) {
  console.error(`Pendaftaran gagal (HTTP ${result.status}).`);
  console.error(JSON.stringify(result.json, null, 2));
  process.exit(1);
}

const d = result.json?.data ?? {};
console.log('');
console.log('  Akun pedagang dibuat.');
console.log('');
console.log(`    Nama usaha    : ${name}`);
console.log(`    Username      : ${username}`);
console.log(`    Email         : ${email}`);
console.log(`    Status        : ${d.status}`);
console.log(`    Schema ERP    : ${d.schemaName}`);
console.log(`    Schema audit  : ${d.auditSchemaName}`);
console.log(`    Kata sandi    : ${password ?? d.temporaryPassword}`);
console.log(`    Wajib ganti   : ${d.mustChangePassword}`);
console.log('');
// Alamat web berbeda dari alamat API saat pengembangan (Vite pada 5173,
// NestJS pada 3000). Pada produksi keduanya satu origin karena Apache
// mem-proxy /api.
const web = arg('web', /:3000$/.test(api) ? api.replace(/:3000$/, ':5173') : api);
console.log(`    Masuk lewat   : ${web}/masuk`);
console.log('');

if (!password) {
  console.log('  Kata sandi di atas ditampilkan SATU KALI dan tidak disimpan dalam');
  console.log('  bentuk teks biasa. Catat sekarang.');
  console.log('');
}
