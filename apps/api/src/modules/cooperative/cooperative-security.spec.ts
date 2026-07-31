/**
 * Pemeriksaan keamanan atas modul koperasi — dengan membaca berkasnya sendiri.
 *
 * ## Mengapa memeriksa teks berkas, bukan perilakunya
 *
 * Sebagian larangan keamanan tidak dapat diuji lewat perilaku, sebab yang
 * dilarang adalah keadaan yang **belum pernah terjadi** dan yang justru ingin
 * dicegah agar tidak pernah terjadi. Tidak ada cara memanggil sebuah fungsi
 * untuk membuktikan bahwa tidak ada satu pun tempat di modul ini yang
 * mengambil nama skema dari badan permintaan — kecuali dengan memeriksa
 * seluruh tempatnya.
 *
 * Cara ini terbukti berguna. Pada K-7 penjaga serupa dipasang pada adapter POS,
 * lalu diuji dengan sengaja menyisipkan `INSERT INTO pos_sale` ke dalamnya —
 * dua pengujian gagal dan menyebut berkas serta tabelnya. Penjaga yang tidak
 * pernah dibuktikan menangkap apa pun tidak berbeda dari komentar.
 *
 * ## Batasnya, disebutkan apa adanya
 *
 * Pemeriksaan teks dapat dielakkan siapa pun yang berniat mengelakkannya —
 * rangkaian karakter dapat disusun saat program berjalan. Yang dijaga di sini
 * bukan penyerang melainkan **kekeliruan**: penambahan yang wajar, terburu,
 * dan tampak tidak berbahaya, yang dilakukan seseorang yang tidak mengetahui
 * pertimbangan yang mendasari larangannya.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const AKAR = join(__dirname);

function berkasModul(dir = AKAR, hasil: string[] = []): string[] {
  for (const nama of readdirSync(dir)) {
    const jalur = join(dir, nama);
    if (statSync(jalur).isDirectory()) {
      berkasModul(jalur, hasil);
      continue;
    }
    if (!nama.endsWith('.ts')) continue;
    if (nama.endsWith('.spec.ts')) continue; // berkas ini sendiri memuat pola terlarang
    hasil.push(jalur);
  }
  return hasil;
}

const BERKAS = berkasModul();
const ISI = new Map(BERKAS.map((f) => [f, readFileSync(f, 'utf8')]));

/** Melaporkan berkas mana yang melanggar, bukan sekadar "ada yang melanggar". */
function cari(pola: RegExp): Array<{ berkas: string; baris: number; teks: string }> {
  const temuan: Array<{ berkas: string; baris: number; teks: string }> = [];
  for (const [jalur, isi] of ISI) {
    const baris = isi.split('\n');
    for (let i = 0; i < baris.length; i += 1) {
      // Komentar tidak dihitung — larangannya tentang kode, dan sebagian
      // komentar justru menjelaskan larangannya.
      const bersih = baris[i].replace(/^\s*(\/\/|\*|\/\*).*$/, '');
      if (pola.test(bersih)) {
        temuan.push({ berkas: jalur.slice(AKAR.length + 1), baris: i + 1, teks: baris[i].trim() });
      }
    }
  }
  return temuan;
}

describe('modul koperasi dapat dibaca', () => {
  it('menemukan berkas untuk diperiksa', () => {
    // Bila jumlahnya nol, seluruh pengujian di bawah lulus tanpa memeriksa apa
    // pun — kegagalan diam yang justru paling berbahaya pada penjaga semacam ini.
    expect(BERKAS.length).toBeGreaterThan(15);
  });
});

describe('nama skema tidak pernah datang dari permintaan', () => {
  it('tidak ada yang mengambil schema dari badan, query, atau header', () => {
    /*
     * Aturan tetap: nama schema hanya boleh berasal dari
     * platform.tenant_schema_registry. Melanggarnya berarti siapa pun dapat
     * mencoba nama skema demi nama sampai menemukan yang ada — dan begitu
     * ditemukan, ia sudah berada di dalam skema penyewa lain.
     */
    expect(
      cari(/\b(body|query|params|headers)\s*(\.|\[['"])\s*schema/i),
    ).toEqual([]);
  });

  it('tidak ada @Body/@Query/@Param bernama schema', () => {
    expect(cari(/@(Body|Query|Param)\(\s*['"]schema/i)).toEqual([]);
  });

  it('tidak ada schemaName yang dirakit dari nilai permintaan', () => {
    expect(cari(/schemaName\s*=\s*(dto|req|request)\./i)).toEqual([]);
  });

  it('tidak ada fallback ke public', () => {
    // `public` tidak boleh pernah menjadi cadangan search_path: bila resolusi
    // penyewa gagal, yang benar adalah menolak, bukan menjatuhkan diri ke
    // skema yang isinya milik semua orang.
    expect(cari(/(schema|search_path)[^\n]*\?\?\s*['"]public['"]/i)).toEqual([]);
    expect(cari(/search_path[^\n]*,\s*public/i)).toEqual([]);
  });
});

describe('portal tidak pernah menerima memberId dari permintaan', () => {
  it('tidak ada @Body/@Query/@Param bernama memberId', () => {
    /*
     * Endpoint yang menerima ?memberId= dapat diubah angkanya oleh siapa pun
     * yang sudah masuk. Portal dibuka kepada ratusan orang.
     */
    expect(cari(/@(Body|Query|Param)\(\s*['"]memberId/i)).toEqual([]);
  });

  it('tidak ada dto.memberId di mana pun', () => {
    expect(cari(/\bdto\.memberId\b/)).toEqual([]);
  });

  it('layanan portal menurunkan memberId dari sesi', () => {
    const layanan = ISI.get(join(AKAR, 'cooperative-portal.service.ts'));
    expect(layanan).toBeDefined();
    expect(layanan).toContain('user_subject_id');
    expect(layanan).toContain('memberDiriSendiri');
  });

  it('setiap metode portal yang membaca daftar menegakkan cakupan', () => {
    /*
     * Setiap `SELECT ... WHERE member_id = $1` harus disusul pemanggilan
     * `tegakkan`. Menyaring pada kueri saja tidak cukup: kueri berikutnya yang
     * ditambahkan seseorang mungkin lupa menyaringnya, dan tidak ada yang
     * mengingatkan.
     */
    const layanan = ISI.get(join(AKAR, 'cooperative-portal.service.ts'))!;
    const jumlahTegakkan = (layanan.match(/this\.tegakkan\(/g) ?? []).length;
    expect(jumlahTegakkan).toBeGreaterThanOrEqual(10);
  });
});

describe('kata sandi dan PIN tidak pernah polos', () => {
  it('tidak ada kolom PIN atau kata sandi polos yang ditulis', () => {
    expect(cari(/\b(pin|password)\s*=\s*\$\d/i)).toEqual([]);
    expect(cari(/INSERT[^\n]*\b(pin|password)\b\s*\)/i)).toEqual([]);
  });

  it('tidak ada perbandingan PIN dengan operator biasa', () => {
    // Perbandingan langsung berarti PIN-nya tersimpan polos.
    expect(cari(/\bpin\s*===?\s*(dto|body|input)\./i)).toEqual([]);
  });

  it('tidak ada algoritme hash lemah', () => {
    expect(cari(/createHash\(\s*['"](md5|sha1)['"]/i)).toEqual([]);
  });

  it('pin_hash tidak pernah muncul di daftar SELECT portal', () => {
    const layanan = ISI.get(join(AKAR, 'cooperative-portal.service.ts'))!;
    expect(/SELECT[^;]*pin_hash/i.test(layanan)).toBe(false);
  });
});

describe('tidak ada penilaian ekspresi bebas', () => {
  it('tidak memakai eval maupun konstruktor Function', () => {
    /*
     * Rumus SHU, tarif jasa, dan aturan harga adalah tempat yang paling
     * menggoda untuk "sekadar mengevaluasi rumusnya". Sekali itu ada, isinya
     * datang dari basis data — dan siapa pun yang dapat menulis ke sana dapat
     * menjalankan kode.
     */
    expect(cari(/\beval\s*\(/)).toEqual([]);
    expect(cari(/new\s+Function\s*\(/)).toEqual([]);
  });

  it('tidak merakit SQL dari nilai yang datang dari luar', () => {
    // Interpolasi `${schema}` sengaja diizinkan — nilainya berasal dari sesi
    // yang sudah diperiksa. Yang dilarang adalah nilai bernama dto/body/input.
    expect(cari(/query\([^)]*\$\{\s*(dto|body|input|req)\b/)).toEqual([]);
  });
});

describe('tidak ada penghapusan keras', () => {
  it('tidak ada DELETE atas tabel koperasi di dalam layanan', () => {
    /*
     * Tidak ada catatan koperasi yang boleh dihapus. Yang ada hanyalah
     * perubahan status. Satu-satunya penghapusan yang sah adalah pembersihan
     * data contoh, dan itu berada pada skrip terpisah dengan penyaring
     * tersendiri.
     */
    const temuan = cari(/DELETE\s+FROM\s+["'`]?\$?\{?\w*\}?["'`]?\.?cooperative_/i);
    expect(temuan).toEqual([]);
  });

  it('tidak ada TRUNCATE maupun DROP', () => {
    expect(cari(/\b(TRUNCATE|DROP\s+(TABLE|SCHEMA))\b/i)).toEqual([]);
  });
});

describe('tidak ada perbuatan finansial otomatis', () => {
  it('tidak ada penjadwal yang memicu pembayaran atau posting', () => {
    /*
     * AI maupun penjadwal tidak boleh melakukan pembayaran, posting jurnal,
     * persetujuan, penghapusan, atau perubahan hak akses. Larangan ini paling
     * mudah dilanggar lewat pekerjaan berkala yang "hanya merapikan".
     */
    expect(cari(/@Cron\(/)).toEqual([]);
    expect(cari(/setInterval\s*\(/)).toEqual([]);
  });

  it('tidak ada fungsi bernama auto-approve atau sejenisnya', () => {
    expect(cari(/\b(autoApprove|autoPost|autoDisburse|autoPay)\b/i)).toEqual([]);
  });
});

describe('adapter POS tetap hanya membaca', () => {
  it('tidak menulis ke satu pun tabel POS', () => {
    const adapter = ISI.get(join(AKAR, 'adapters', 'pos.adapter.ts'));
    expect(adapter).toBeDefined();
    for (const perintah of ['INSERT INTO', 'UPDATE ', 'DELETE FROM']) {
      const pola = new RegExp(`${perintah}[^\\n]*pos_`, 'i');
      expect({ perintah, ada: pola.test(adapter!) }).toEqual({ perintah, ada: false });
    }
  });
});

describe('data sensitif tidak masuk ke catatan', () => {
  it('tidak ada console.log di dalam modul', () => {
    // Catatan konsol tidak melewati penyamar. Prompt dan baris koperasi memuat
    // saldo, nama, dan nomor identitas anggota.
    expect(cari(/console\.(log|info|debug|warn|error)\s*\(/)).toEqual([]);
  });

  it('jejak portal tidak menyimpan isi data yang dibaca', () => {
    const layanan = ISI.get(join(AKAR, 'cooperative-portal.service.ts'))!;
    const sisipJejak = layanan.match(
      /INSERT INTO[^;]*cooperative_portal_activity[\s\S]*?VALUES[^;]*/i,
    );
    expect(sisipJejak).toBeTruthy();
    for (const kolom of ['payload', 'response', 'content', 'data']) {
      expect({ kolom, ada: sisipJejak![0].includes(kolom) }).toEqual({ kolom, ada: false });
    }
  });
});

describe('batas namespace koperasi', () => {
  it('tidak mengimpor dari modul vertikal lain', () => {
    /*
     * Panduan koordinasi §3-§4. Modul koperasi boleh memakai infrastruktur
     * bersama dan adapter yang dibuatnya sendiri; ia tidak boleh menjangkau
     * ke dalam modul vertikal lain.
     */
    expect(cari(/from\s+['"]\.\.\/(medical|village|emedik|infodesa)/)).toEqual([]);
  });

  it('hanya mengimpor POS lewat tipe, bukan lewat layanannya', () => {
    // Ketergantungan pada layanan POS akan membuat perubahan pada mesin POS
    // yang sedang dikerjakan sesi lain merambat ke sini.
    expect(cari(/import\s+\{[^}]*Service[^}]*\}\s+from\s+['"][^'"]*\/pos\//)).toEqual([]);
  });
});
