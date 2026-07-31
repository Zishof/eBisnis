/**
 * Bukti jalur penjualan luring, dijalankan terhadap peladen dan basis data
 * sungguhan.
 *
 * Uji satuan sudah menjaga aturannya; naskah ini menjawab pertanyaan berbeda:
 * **apakah aturan itu benar-benar berlaku ketika transaksinya melewati HTTP,
 * penjaga izin, transaksi basis data, dan pemotongan stok?**
 *
 * Yang dibuktikan:
 *
 * 1. Saklar mati berarti tertutup — bukan sekadar tidak ditampilkan.
 * 2. Jatah nomor struk dipesan dari urutan yang sama dengan nomor daring,
 *    sehingga penjualan daring berikutnya melompati rentang jatah.
 * 3. Transaksi luring yang cocok dibukukan dengan nomor yang sudah tercetak.
 * 4. Pengiriman ulang tidak membuat penjualan kedua.
 * 5. Selisih harga DITAHAN, tidak dibukukan diam-diam dan tidak ditolak.
 * 6. Nomor di luar jatah ditahan.
 *
 * Menyalakan saklarnya sendiri, lalu MENGEMBALIKANNYA seperti semula — termasuk
 * bila naskah ini gagal di tengah jalan. Meninggalkan saklar penjualan luring
 * menyala pada basis data bersama adalah tepat yang tidak boleh terjadi.
 *
 * Pemakaian:
 *   node scripts/prove-pos-offline.mjs            (peladen di 3100)
 *   API_URL=http://localhost:3101 node scripts/prove-pos-offline.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import 'dotenv/config';

const API = process.env.API_URL ?? 'http://localhost:3100';
const BERKAS = fileURLToPath(new URL('../../web/.playwright/pos-fixture.json', import.meta.url));

let lulus = 0;
let gagal = 0;

function cek(nama, syarat, keterangan = '') {
  if (syarat) {
    lulus += 1;
    console.log(`  OK   ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
  } else {
    gagal += 1;
    console.log(`  GAGAL ${nama}${keterangan ? ` — ${keterangan}` : ''}`);
  }
}

async function panggil(token, jalur, opsi = {}) {
  const r = await fetch(`${API}/api/v1${jalur}`, {
    ...opsi,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(opsi.headers ?? {}),
    },
  });
  const teks = await r.text();
  let isi;
  try {
    isi = JSON.parse(teks);
  } catch {
    isi = { raw: teks };
  }
  return { status: r.status, ok: r.ok, data: isi?.data, error: isi?.error };
}

async function main() {
  if (!existsSync(BERKAS)) {
    console.log('Fixture POS tidak ada. Jalankan: node scripts/e2e-pos-fixture.mjs setup');
    process.exit(1);
  }
  const f = JSON.parse(readFileSync(BERKAS, 'utf8'));
  const schema = f.schema;

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();

  // Nilai saklar sebelum naskah ini menyentuhnya, untuk dikembalikan nanti.
  const sebelum = await db.query(
    `SELECT value_json FROM "${schema}".app_setting WHERE code = 'POS_OFFLINE_SALE_ENABLED'`,
  );
  const saklarAwal = sebelum.rows[0]?.value_json ?? { value: false };

  /*
   * Urutan nomor struk.
   *
   * Jatah luring hanya dapat dipesan dari `number_sequence`, dan itu memang
   * disengaja: nomor yang dipesan harus berasal dari urutan yang sama dengan
   * nomor daring supaya keduanya tidak mungkin bertabrakan. Tenant yang belum
   * memilikinya memakai penomoran cadangan berbasis tanggal — yang dihitung
   * dari banyaknya penjualan hari itu, sehingga tidak dapat dipesan di muka.
   *
   * Naskah ini membuatnya bila belum ada, lalu MENGHAPUSNYA lagi. Meninggalkannya
   * akan mengubah bentuk nomor struk tenant demo secara permanen, dan bukti yang
   * mengubah data yang dibuktikannya bukan bukti.
   */
  const urutanAda = await db.query(
    `SELECT id FROM "${schema}".number_sequence
      WHERE document_type = 'POS_RECEIPT' AND deleted_at IS NULL`,
  );
  let urutanDibuat = null;
  if (!urutanAda.rows.length) {
    const buat = await db.query(
      `INSERT INTO "${schema}".number_sequence
         (code, name, document_type, prefix, padding, next_number, is_system)
       VALUES ('POS_RECEIPT_BUKTI', 'Nomor struk (bukti luring)', 'POS_RECEIPT', 'BKT-', 6, 1000, FALSE)
       RETURNING id`,
    );
    urutanDibuat = buat.rows[0].id;
    console.log(`(urutan POS_RECEIPT sementara dibuat untuk bukti ini: ${urutanDibuat})`);
  }

  const pulihkan = async () => {
    await db.query(
      `UPDATE "${schema}".app_setting SET value_json = $1::jsonb, updated_at = now()
        WHERE code = 'POS_OFFLINE_SALE_ENABLED'`,
      [JSON.stringify(saklarAwal)],
    );
  };

  try {
    const masuk = await panggil(null, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: f.username, password: f.password }),
    });
    if (!masuk.ok) throw new Error(`Login gagal: ${JSON.stringify(masuk.error)}`);
    const token = masuk.data.accessToken;

    console.log('\n1. Saklar mati berarti tertutup');
    await pulihkan();
    const tertutup = await panggil(token, '/pos/offline/receipt-blocks', {
      method: 'POST',
      body: JSON.stringify({ terminalId: f.terminalId }),
    });
    cek(
      'jatah ditolak saat saklar mati',
      tertutup.status === 403,
      `status ${tertutup.status}`,
    );
    cek(
      'penolakannya menyebutkan apa yang harus dilakukan',
      /POS_OFFLINE_SALE_ENABLED/.test(tertutup.error?.message ?? ''),
      (tertutup.error?.message ?? '').slice(0, 70),
    );

    console.log('\n2. Jatah nomor struk dipesan dari urutan yang sama');
    await db.query(
      `UPDATE "${schema}".app_setting SET value_json = '{"value": true}'::jsonb
        WHERE code = 'POS_OFFLINE_SALE_ENABLED'`,
    );

    const urutSebelum = await db.query(
      `SELECT next_number::text FROM "${schema}".number_sequence
        WHERE document_type = 'POS_RECEIPT' AND is_active = TRUE AND deleted_at IS NULL
        ORDER BY scope_id NULLS LAST LIMIT 1`,
    );

    const jatah = await panggil(token, '/pos/offline/receipt-blocks', {
      method: 'POST',
      body: JSON.stringify({ terminalId: f.terminalId }),
    });
    cek('jatah diberikan', jatah.ok, jatah.ok ? `${jatah.data.fromNumber}–${jatah.data.toNumber}` : JSON.stringify(jatah.error));
    if (!jatah.ok) throw new Error('Jatah gagal; sisa pemeriksaan tidak berarti.');

    const urutSesudah = await db.query(
      `SELECT next_number::text FROM "${schema}".number_sequence
        WHERE document_type = 'POS_RECEIPT' AND is_active = TRUE AND deleted_at IS NULL
        ORDER BY scope_id NULLS LAST LIMIT 1`,
    );
    if (urutSebelum.rows.length) {
      cek(
        'urutan nomor dimajukan MELEWATI seluruh rentang',
        Number(urutSesudah.rows[0].next_number) === jatah.data.toNumber + 1,
        `${urutSebelum.rows[0].next_number} → ${urutSesudah.rows[0].next_number}`,
      );
    } else {
      console.log('  (outlet ini memakai penomoran cadangan; pemeriksaan urutan dilewati)');
    }

    cek(
      'satu jatah aktif per register',
      (
        await db.query(
          `SELECT count(*)::int n FROM "${schema}".pos_receipt_block
            WHERE terminal_id = $1 AND status = 'ACTIVE'`,
          [f.terminalId],
        )
      ).rows[0].n === 1,
    );

    console.log('\n3. Transaksi luring yang cocok dibukukan');
    const konteks = await panggil(token, '/pos/context');
    const shiftId = konteks.data?.openShift?.shiftId;
    if (!shiftId) {
      console.log('  (tidak ada shift terbuka; buka shift lebih dahulu lewat uji Playwright)');
      throw new Error('Shift terbuka diperlukan untuk membuktikan penerimaan.');
    }

    const kuotasi = await panggil(token, '/pos/price/quote', {
      method: 'POST',
      body: JSON.stringify({
        outletId: f.outletId,
        productId: f.productId,
        quantity: 1,
      }),
    });
    const hargaSah = kuotasi.ok ? String(kuotasi.data.lineTotal ?? '') : '';

    const nomor = `${jatah.data.prefix}${String(jatah.data.fromNumber).padStart(jatah.data.padding, '0')}`;
    const offlineId = `bukti-${randomUUID()}`;
    const kirim = (over = {}) => ({
      offlineId,
      outletId: f.outletId,
      terminalId: f.terminalId,
      shiftId,
      businessDate: konteks.data.businessDate,
      receiptNumber: nomor,
      occurredAt: new Date().toISOString(),
      currencyCode: 'IDR',
      subtotal: hargaSah,
      taxTotal: '0',
      grandTotal: hargaSah,
      changeTotal: '0',
      catalogSyncedAt: new Date().toISOString(),
      localHash: 'a'.repeat(64),
      lines: [
        {
          productId: f.productId,
          quantity: 1,
          unitPrice: hargaSah,
          lineSubtotal: hargaSah,
          taxAmount: '0',
          lineTotal: hargaSah,
        },
      ],
      payments: [{ paymentMethodId: null, amount: hargaSah }],
      ...over,
    });

    const metode = await panggil(token, '/pos/payment-methods');
    const tunai = (metode.data ?? []).find((m) => m.methodType === 'CASH') ?? metode.data?.[0];

    const badan = kirim({ payments: [{ paymentMethodId: tunai.id, amount: hargaSah }] });
    const terima = await panggil(token, '/pos/offline/sales', {
      method: 'POST',
      body: JSON.stringify(badan),
    });
    cek(
      'transaksi luring dibukukan',
      terima.ok && terima.data?.status === 'BOOKED',
      terima.ok ? `${terima.data.status} ${terima.data.receiptNumber ?? ''}` : JSON.stringify(terima.error).slice(0, 140),
    );
    cek(
      'nomor struk yang dipakai adalah nomor yang SUDAH tercetak',
      terima.data?.receiptNumber === nomor,
      `${terima.data?.receiptNumber} vs ${nomor}`,
    );

    const tersimpan = await db.query(
      `SELECT offline_id, receipt_number, offline_received_at IS NOT NULL AS ditandai,
              sync_status, status
         FROM "${schema}".pos_sale WHERE offline_id = $1`,
      [offlineId],
    );
    cek('penjualan tercatat di basis data', tersimpan.rowCount === 1);
    cek(
      'ditandai berasal dari luring',
      tersimpan.rows[0]?.ditandai === true && tersimpan.rows[0]?.sync_status === 'SYNCED',
      `sync_status=${tersimpan.rows[0]?.sync_status}`,
    );

    console.log('\n4. Pengiriman ulang tidak membuat penjualan kedua');
    const ulang = await panggil(token, '/pos/offline/sales', {
      method: 'POST',
      body: JSON.stringify(badan),
    });
    cek('pengiriman ulang dikenali', ulang.data?.status === 'DUPLICATE', String(ulang.data?.status));
    cek(
      'tetap satu penjualan di basis data',
      (
        await db.query(`SELECT count(*)::int n FROM "${schema}".pos_sale WHERE offline_id = $1`, [
          offlineId,
        ])
      ).rows[0].n === 1,
    );

    console.log('\n5. Selisih harga DITAHAN, bukan dibukukan dan bukan ditolak');
    const nomor2 = `${jatah.data.prefix}${String(jatah.data.fromNumber + 1).padStart(jatah.data.padding, '0')}`;
    const salahHarga = kirim({
      offlineId: `bukti-${randomUUID()}`,
      receiptNumber: nomor2,
      // Harga sengaja dinaikkan; peladen akan menghitung angka lain.
      subtotal: String(Number(hargaSah) + 5000),
      grandTotal: String(Number(hargaSah) + 5000),
      lines: [
        {
          productId: f.productId,
          quantity: 1,
          unitPrice: String(Number(hargaSah) + 5000),
          lineSubtotal: String(Number(hargaSah) + 5000),
          taxAmount: '0',
          lineTotal: String(Number(hargaSah) + 5000),
        },
      ],
      payments: [{ paymentMethodId: tunai.id, amount: String(Number(hargaSah) + 5000) }],
    });
    const ditahan = await panggil(token, '/pos/offline/sales', {
      method: 'POST',
      body: JSON.stringify(salahHarga),
    });
    cek(
      'ditahan, bukan ditolak',
      ditahan.ok && ditahan.data?.status === 'QUARANTINED',
      `${ditahan.data?.status} / ${ditahan.data?.reasonCode}`,
    );
    cek(
      'alasannya menyebut KEDUA angka',
      String(ditahan.data?.reason ?? '').includes(String(Number(hargaSah) + 5000)) &&
        String(ditahan.data?.reason ?? '').includes(hargaSah),
      String(ditahan.data?.reason ?? '').slice(0, 90),
    );
    cek(
      'tidak ada penjualan yang terbentuk darinya',
      (
        await db.query(`SELECT count(*)::int n FROM "${schema}".pos_sale WHERE offline_id = $1`, [
          salahHarga.offlineId,
        ])
      ).rows[0].n === 0,
    );
    cek(
      'muatannya tersimpan utuh di karantina',
      (
        await db.query(
          `SELECT jsonb_array_length(payload->'lines')::int n FROM "${schema}".pos_offline_quarantine
            WHERE offline_id = $1`,
          [salahHarga.offlineId],
        )
      ).rows[0]?.n === 1,
    );

    console.log('\n6. Nomor di luar jatah ditahan');
    const luarJatah = kirim({
      offlineId: `bukti-${randomUUID()}`,
      receiptNumber: `${jatah.data.prefix}999999`,
      payments: [{ paymentMethodId: tunai.id, amount: hargaSah }],
    });
    const ditolakNomor = await panggil(token, '/pos/offline/sales', {
      method: 'POST',
      body: JSON.stringify(luarJatah),
    });
    cek(
      'nomor di luar jatah ditahan',
      ditolakNomor.data?.reasonCode === 'RECEIPT_OUT_OF_BLOCK',
      String(ditolakNomor.data?.reasonCode),
    );

    console.log('\n7. Karantina dapat dibaca');
    const daftar = await panggil(token, '/pos/offline/quarantine?limit=10');
    cek('daftar karantina terbaca', daftar.ok && Array.isArray(daftar.data), `${daftar.data?.length ?? 0} baris`);
  } finally {
    await pulihkan();
    const akhir = await db.query(
      `SELECT value_json FROM "${schema}".app_setting WHERE code = 'POS_OFFLINE_SALE_ENABLED'`,
    );
    console.log(
      `\nSaklar dikembalikan: ${JSON.stringify(akhir.rows[0]?.value_json)} (semula ${JSON.stringify(saklarAwal)})`,
    );

    if (urutanDibuat) {
      // Jatah yang menunjuk urutan ini ikut dilepaskan; membiarkannya aktif
      // berarti register demo memegang jatah dari urutan yang sudah tidak ada.
      await db.query(
        `UPDATE "${schema}".pos_receipt_block SET status = 'RELEASED', released_at = now()
          WHERE status = 'ACTIVE'`,
      );
      await db.query(`DELETE FROM "${schema}".number_sequence WHERE id = $1`, [urutanDibuat]);
      console.log('Urutan POS_RECEIPT sementara dihapus, jatah aktif dilepaskan.');
    }
    await db.end();
  }

  console.log(`\n${lulus} lulus, ${gagal} gagal.`);
  process.exit(gagal ? 1 : 0);
}

main().catch((e) => {
  console.error('\nGAGAL:', e.message);
  process.exit(1);
});
