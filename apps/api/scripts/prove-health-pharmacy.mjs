/**
 * Bukti H-4: obat, dari resep sampai masuk ke tubuh pasien.
 *
 * Lewat HTTP, memakai hak akses sungguhan, pada basis data sungguhan.
 *
 * Yang dibuktikan bukan bahwa alurnya berjalan — itu bagian yang mudah —
 * melainkan bahwa yang seharusnya DITOLAK memang ditolak:
 *
 * - meresepkan obat yang pasiennya alergi berat, tanpa alasan tertulis;
 * - menelaah resep yang ditulis sendiri;
 * - menyerahkan obat dari lot yang sudah kedaluwarsa;
 * - menyerahkan lebih banyak daripada yang diresepkan;
 * - menyerahkan obat terkendali yang belum ditelaah apoteker;
 * - memeriksa ganda oleh orang yang menyerahkan sendiri;
 * - memberikan obat kepada pasien yang salah;
 * - melewatkan pemberian obat tanpa menyebut sebabnya.
 *
 * Dan satu hal yang harus TETAP berjalan meski terulang: penyerahan yang
 * dikirim dua kali tidak boleh mengurangi stok dua kali.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import * as argon2 from 'argon2';
import pg from 'pg';

const BASE = process.env.API_BASE ?? 'http://localhost:3200/api/v1';
const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const bacaEnv = (k) => env.match(new RegExp(`^${k}=(.*)$`, 'm'))?.[1]?.trim()?.replace(/^"|"$/g, '');
const SCHEMA = process.env.HEALTH_SCHEMA ?? 'demo';

const client = new pg.Client({ connectionString: bacaEnv('DATABASE_URL') });
const lines = [];
const log = (t) => {
  lines.push(t);
  console.log(t);
};

let failures = 0;
function check(label, ok, detail = '') {
  if (!ok) failures += 1;
  log(`  ${ok ? 'LULUS' : 'GAGAL'}  ${label}${ok || !detail ? '' : `  (${detail})`}`);
}

const tag = randomBytes(4).toString('hex');
const q = async (sql, params = []) => (await client.query(sql, params)).rows;

async function api(path, opts = {}, token = null, extra = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...extra,
    },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, data: body?.data ?? body };
}

const RAWAT = { 'x-purpose-of-use': 'TREATMENT' };
const pesan = (r) => String(r.body?.error?.message ?? r.body?.message ?? '');

/** Membuat satu pengguna beserta perannya sendiri. Mengembalikan token dan subjectId. */
async function buatPengguna(tenantId, nama, hakPerMenu) {
  const username = `bukti_rx_${nama}_${tag}`;
  const password = `Bukti-${randomBytes(12).toString('base64url')}!9`;
  const hash = await argon2.hash(password, { type: argon2.argon2id });
  const platformUserId = randomUUID();

  await q(
    `INSERT INTO platform.platform_user
       (id, username, normalized_username, email, display_name, password_hash,
        status, must_change_password, is_platform_staff, created_at, updated_at)
     VALUES ($1,$2::varchar,lower($2::varchar),$3,$4,$5,'ACTIVE',FALSE,FALSE,now(),now())`,
    [platformUserId, username, `${username}@contoh.invalid`, nama, hash],
  );
  await q(
    `INSERT INTO platform.tenant_membership
       (id, tenant_id, platform_user_id, is_owner, status, created_at, updated_at)
     VALUES (gen_random_uuid(),$1,$2,FALSE,'ACTIVE',now(),now())`,
    [tenantId, platformUserId],
  );
  const subjectId = (
    await q(
      `INSERT INTO "${SCHEMA}".user_subject
         (platform_user_id, code, name, username_snapshot, is_owner, status)
       VALUES ($1,$2::varchar,$3,$2::varchar,FALSE,'ACTIVE') RETURNING id`,
      [platformUserId, username, nama],
    )
  )[0].id;

  const roleId = (
    await q(
      `INSERT INTO "${SCHEMA}".role (code, name, description, is_system)
       VALUES ($1,$2,'Peran naskah bukti H-4',FALSE) RETURNING id`,
      [`BUKTI_RX_${nama.toUpperCase()}_${tag.toUpperCase()}`, `Bukti ${nama}`],
    )
  )[0].id;

  const menus = new Map(
    (await q(`SELECT id, code FROM "${SCHEMA}".menu WHERE deleted_at IS NULL`)).map((m) => [m.code, m.id]),
  );
  const aksi = new Map(
    (await q(`SELECT id, code FROM "${SCHEMA}".permission_action`)).map((a) => [a.code, a.id]),
  );

  for (const [menuCode, aksiCodes] of Object.entries(hakPerMenu)) {
    const menuId = menus.get(menuCode);
    if (!menuId) continue;
    for (const aksiCode of aksiCodes) {
      const aksiId = aksi.get(aksiCode);
      if (!aksiId) continue;
      await q(
        `INSERT INTO "${SCHEMA}".role_menu_permission (role_id, menu_id, permission_action_id, effect)
         VALUES ($1,$2,$3,'ALLOW') ON CONFLICT DO NOTHING`,
        [roleId, menuId, aksiId],
      );
    }
  }

  await q(
    `INSERT INTO "${SCHEMA}".user_role_assignment (user_subject_id, role_id, valid_from)
     VALUES ($1,$2,CURRENT_DATE)`,
    [subjectId, roleId],
  );

  const masuk = await api('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  const token = masuk.data?.accessToken;
  if (!token) throw new Error(`login ${nama} gagal: ${JSON.stringify(masuk.body).slice(0, 300)}`);
  return { token, subjectId, platformUserId, roleId, username };
}

await client.connect();
const bersihkan = [];

try {
  log('='.repeat(78));
  log('BUKTI H-4 — OBAT, DARI RESEP SAMPAI MASUK KE TUBUH PASIEN');
  log(`Waktu   : ${new Date().toISOString()}`);
  log(`Schema  : ${SCHEMA}`);
  log('='.repeat(78));

  const tenantId = (
    await q(`SELECT tenant_id AS id FROM platform.tenant_schema_registry WHERE schema_name = $1`, [SCHEMA])
  )[0]?.id;
  if (!tenantId) throw new Error(`Tenant ${SCHEMA} tidak ada`);

  // --- Persiapan: tiga orang, bukan satu -----------------------------------
  //
  // Seluruh pemeriksaan pemisahan wewenang menjadi tidak berarti bila
  // naskahnya dijalankan satu pengguna saja: yang meresepkan akan selalu sama
  // dengan yang menelaah, dan setiap penolakan akan terbaca benar tanpa
  // membuktikan apa pun.
  const BACA = ['READ'];
  const dokter = await buatPengguna(tenantId, 'dokter', {
    HEALTH: BACA,
    HEALTH_PATIENT: ['READ', 'CREATE', 'UPDATE'],
    HEALTH_PRESCRIPTION: ['READ', 'CREATE'],
    HEALTH_DRUG_MASTER: BACA,
    HEALTH_FACILITY: BACA,
  });
  const apoteker = await buatPengguna(tenantId, 'apoteker', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_PRESCRIPTION: ['READ', 'REVIEW'],
    HEALTH_DISPENSING: ['READ', 'CREATE'],
    HEALTH_DRUG_MASTER: BACA,
  });
  const perawat = await buatPengguna(tenantId, 'perawat', {
    HEALTH: BACA,
    HEALTH_PATIENT: BACA,
    HEALTH_PRESCRIPTION: BACA,
    HEALTH_ADMINISTRATION: ['READ', 'CREATE', 'ADMINISTER'],
    HEALTH_DRUG_MASTER: BACA,
  });
  log('');
  log('Tiga pengguna dibuat: dokter, apoteker, perawat — masing-masing dengan');
  log('hak akses yang berbeda, supaya pemisahan wewenang benar-benar teruji.');

  // --- Persiapan: fasilitas, pasien, obat, dan stok ------------------------
  const typeId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility_type (code, name, category, supports_pharmacy)
       VALUES ($1,'Klinik Bukti Farmasi','CLINIC',TRUE) RETURNING id`,
      [`BKRX-${tag}`],
    )
  )[0].id;
  const facilityId = (
    await q(
      `INSERT INTO "${SCHEMA}".health_facility (facility_type_id, code, name, timezone)
       VALUES ($1,$2,'Klinik Bukti Farmasi','Asia/Jakarta') RETURNING id`,
      [typeId, `RX-${tag}`],
    )
  )[0].id;

  const patientId = (
    await q(
      `INSERT INTO "${SCHEMA}".patient (enterprise_patient_id, full_name, birth_date, gender)
       VALUES ($2,$1,'1985-03-15','FEMALE') RETURNING id`,
      [`Siti Bukti Farmasi ${tag}`, `EPI-RX-${tag}`],
    )
  )[0].id;

  // Alergi BERAT terhadap amoksisilin. Inilah yang harus memblokir.
  await q(
    `INSERT INTO "${SCHEMA}".patient_allergy
       (patient_id, allergen_type, allergen_name, severity, certainty, reaction)
     VALUES ($1,'DRUG','Amoksisilin','SEVERE','CONFIRMED','Sesak napas dan bengkak wajah')`,
    [patientId],
  );

  // Master data persediaan seadanya — cukup untuk membuktikan pengurangan stok.
  const uomId = (
    await q(`SELECT id FROM "${SCHEMA}".uom WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`)
  )[0]?.id;
  const categoryId = (
    await q(`SELECT id FROM "${SCHEMA}".product_category WHERE deleted_at IS NULL ORDER BY created_at LIMIT 1`)
  )[0]?.id;
  if (!uomId || !categoryId) throw new Error('Skema belum punya uom / product_category');

  const warehouseId = (
    await q(
      `INSERT INTO "${SCHEMA}".warehouse (code, name) VALUES ($1,'Gudang Farmasi Bukti') RETURNING id`,
      [`WH-RX-${tag}`],
    )
  )[0].id;

  async function buatObat({ kode, nama, zat, golongan, terkendali, siaga, maxSingle, maxDaily }) {
    const productId = (
      await q(
        `INSERT INTO "${SCHEMA}".product (category_id, base_uom_id, code, name, sku, tracking_type, standard_cost)
         VALUES ($1,$2,$3,$4,$3,'LOT',1000) RETURNING id`,
        [categoryId, uomId, `${kode}-${tag}`, nama],
      )
    )[0].id;
    const drugId = (
      await q(
        `INSERT INTO "${SCHEMA}".rx_drug_master
           (product_id, code, generic_name, active_ingredient, dosage_form, drug_class,
            is_controlled, is_high_alert, max_single_dose, max_daily_dose, dose_unit, route)
         VALUES ($1,$2,$3,$4,'TABLET',$5,$6,$7,$8,$9,'mg','ORAL') RETURNING id`,
        [productId, `${kode}-${tag}`, nama, zat, golongan, terkendali, siaga, maxSingle, maxDaily],
      )
    )[0].id;
    return { productId, drugId };
  }

  async function isiStok(productId, { lotNumber, expiry, qty }) {
    const lotId = (
      await q(
        `INSERT INTO "${SCHEMA}".inventory_lot (product_id, code, name, lot_number, expiry_date)
         VALUES ($1,$2,$2,$2,$3) RETURNING id`,
        [productId, lotNumber, expiry],
      )
    )[0].id;
    await q(
      `INSERT INTO "${SCHEMA}".stock_balance
         (warehouse_id, product_id, lot_id, on_hand_qty, available_qty)
       VALUES ($1,$2,$3,$4,$4)`,
      [warehouseId, productId, lotId, qty],
    );
    return lotId;
  }

  const amok = await buatObat({
    kode: 'AMOX500', nama: 'Amoksisilin 500 mg', zat: 'Amoksisilin',
    golongan: 'PRESCRIPTION', terkendali: false, siaga: false, maxSingle: 1000, maxDaily: 3000,
  });
  const para = await buatObat({
    kode: 'PARA500', nama: 'Parasetamol 500 mg', zat: 'Parasetamol',
    golongan: 'OTC', terkendali: false, siaga: false, maxSingle: 1000, maxDaily: 4000,
  });
  const morf = await buatObat({
    kode: 'MORF10', nama: 'Morfin 10 mg', zat: 'Morfin',
    golongan: 'NARCOTIC', terkendali: true, siaga: true, maxSingle: 20, maxDaily: 60,
  });

  const lotBaik = await isiStok(para.productId, {
    lotNumber: `LOT-BAIK-${tag}`, expiry: '2028-12-31', qty: 100,
  });
  const lotKedaluwarsa = await isiStok(para.productId, {
    lotNumber: `LOT-LAMA-${tag}`, expiry: '2025-01-31', qty: 500,
  });
  await isiStok(morf.productId, { lotNumber: `LOT-MOR-${tag}`, expiry: '2028-06-30', qty: 30 });

  log('');
  log('Stok Parasetamol: 100 unit pada lot yang baik, 500 unit pada lot yang');
  log('SUDAH KEDALUWARSA. Lot kedaluwarsa sengaja dibuat jauh lebih besar dan');
  log('kedaluwarsanya lebih dekat — FEFO polos akan memilihnya lebih dahulu.');

  // --- 1. Peringatan sebelum resep jadi ------------------------------------
  log('');
  log('1. Peringatan muncul SEBELUM resepnya disimpan');
  const cek = await api(
    '/health/pharmacy/check',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId, drugId: amok.drugId, doseValue: 500, doseUnit: 'mg', frequencyPerDay: 3,
      }),
    },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('pemeriksaan calon resep berhasil', cek.status === 200 || cek.status === 201, `status ${cek.status}`);
  check('alergi berat terdeteksi', (cek.data?.alerts ?? []).some((a) => a.type === 'ALLERGY'));
  check('dan ia MEMBLOKIR', cek.data?.blocked === true);

  const cekAman = await api(
    '/health/pharmacy/check',
    {
      method: 'POST',
      body: JSON.stringify({ patientId, drugId: para.drugId, doseValue: 500, doseUnit: 'mg' }),
    },
    dokter.token,
    { ...RAWAT, 'x-facility-id': facilityId },
  );
  check('obat yang tidak berbahaya TIDAK memicu peringatan', (cekAman.data?.alerts ?? []).length === 0);
  check('dan tidak diblokir', cekAman.data?.blocked === false);

  // --- 2. Alergi berat menahan peresepan -----------------------------------
  log('');
  log('2. Alergi berat menahan peresepan sampai ada alasan tertulis');
  const resepAlergi = await api(
    '/health/pharmacy/prescriptions',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId, facilityId,
        lines: [{ drugId: amok.drugId, doseValue: 500, doseUnit: 'mg', route: 'ORAL',
                  frequencyCode: '3x1', frequencyPerDay: 3, quantity: 15 }],
      }),
    },
    dokter.token,
    RAWAT,
  );
  check('meresepkan obat yang pasiennya alergi berat DITOLAK', resepAlergi.status === 422,
    `status ${resepAlergi.status}`);
  check('penolakannya menyebut nomor barisnya', pesan(resepAlergi).includes('Baris 1'));

  const resepDenganAlasan = await api(
    '/health/pharmacy/prescriptions',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId, facilityId,
        lines: [{ drugId: amok.drugId, doseValue: 500, doseUnit: 'mg', route: 'ORAL',
                  frequencyCode: '3x1', frequencyPerDay: 3, quantity: 15,
                  overrideReason: 'Reaksi lampau ringan, sudah dikonfirmasi ulang kepada pasien.' }],
      }),
    },
    dokter.token,
    RAWAT,
  );
  check('dengan alasan tertulis, resepnya diterima', resepDenganAlasan.status === 201,
    `status ${resepDenganAlasan.status}`);

  const alasanTersimpan = await q(
    `SELECT override_alerts FROM "${SCHEMA}".rx_prescription_line
      WHERE prescription_id = $1`,
    [resepDenganAlasan.data?.id],
  );
  check('alasannya tersimpan bersama peringatannya',
    Boolean(alasanTersimpan[0]?.override_alerts?.overrideReason));
  check('dan peringatan yang dilewati ikut tersimpan',
    (alasanTersimpan[0]?.override_alerts?.alerts ?? []).length > 0);

  // --- 3. Peresep tidak menelaah resepnya sendiri --------------------------
  log('');
  log('3. Pemisahan wewenang: peresep tidak menelaah resepnya sendiri');
  const resepUtama = await api(
    '/health/pharmacy/prescriptions',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId, facilityId,
        lines: [{ drugId: para.drugId, doseValue: 500, doseUnit: 'mg', route: 'ORAL',
                  frequencyCode: '3x1', frequencyPerDay: 3, quantity: 10 }],
      }),
    },
    dokter.token,
    RAWAT,
  );
  check('resep parasetamol dibuat', resepUtama.status === 201, `status ${resepUtama.status}`);
  const resepId = resepUtama.data?.id;

  const telaahSendiri = await api(
    `/health/pharmacy/prescriptions/${resepId}/review`,
    { method: 'POST', body: JSON.stringify({ approve: true }) },
    dokter.token,
    RAWAT,
  );
  check('dokter tidak berwenang menelaah sama sekali', telaahSendiri.status === 403,
    `status ${telaahSendiri.status}`);

  const telaahApoteker = await api(
    `/health/pharmacy/prescriptions/${resepId}/review`,
    { method: 'POST', body: JSON.stringify({ approve: true }) },
    apoteker.token,
    RAWAT,
  );
  check('apoteker menelaah dan menyetujui', telaahApoteker.status === 200 || telaahApoteker.status === 201,
    `status ${telaahApoteker.status}`);

  const tolakTanpaAlasan = await api(
    `/health/pharmacy/prescriptions/${resepId}/review`,
    { method: 'POST', body: JSON.stringify({ approve: false }) },
    apoteker.token,
    RAWAT,
  );
  check('penolakan telaah tanpa alasan ditolak', tolakTanpaAlasan.status === 422,
    `status ${tolakTanpaAlasan.status}`);

  // --- 4. Penyerahan: kedaluwarsa dan batas jumlah -------------------------
  log('');
  log('4. Penyerahan obat');
  const lineId = (
    await q(`SELECT id FROM "${SCHEMA}".rx_prescription_line WHERE prescription_id = $1`, [resepId])
  )[0].id;

  const serahKedaluwarsa = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineId, quantity: 10, warehouseId,
        lotId: lotKedaluwarsa, idempotencyKey: `bukti-exp-${tag}`,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('menyerahkan dari lot KEDALUWARSA ditolak', serahKedaluwarsa.status === 422,
    `status ${serahKedaluwarsa.status}`);
  check('penolakannya menyebut kedaluwarsa', pesan(serahKedaluwarsa).toLowerCase().includes('kedaluwarsa'));

  const serahKebanyakan = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineId, quantity: 99, warehouseId,
        idempotencyKey: `bukti-over-${tag}`,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('menyerahkan lebih banyak daripada yang diresepkan ditolak', serahKebanyakan.status === 422,
    `status ${serahKebanyakan.status}`);

  const sebelum = Number(
    (await q(
      `SELECT COALESCE(sum(available_qty),0) AS n FROM "${SCHEMA}".stock_balance
        WHERE warehouse_id = $1 AND product_id = $2`,
      [warehouseId, para.productId],
    ))[0].n,
  );

  const kunciSerah = `bukti-ok-${tag}`;
  const serah = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineId, quantity: 10, warehouseId,
        unitCost: 1000, idempotencyKey: kunciSerah,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('penyerahan yang sah berhasil', serah.status === 200 || serah.status === 201,
    `status ${serah.status} ${pesan(serah)}`);

  const lotDipakai = await q(
    `SELECT l.expiry_date::text AS expiry FROM "${SCHEMA}".stock_movement m
       JOIN "${SCHEMA}".inventory_lot l ON l.id = m.lot_id
      WHERE m.idempotency_key = $1`,
    [kunciSerah],
  );
  check('lot yang dipakai BUKAN yang kedaluwarsa',
    lotDipakai.every((r) => r.expiry > new Date().toISOString().slice(0, 10)),
    JSON.stringify(lotDipakai));

  // --- 5. Idempotensi ------------------------------------------------------
  log('');
  log('5. Penyerahan yang terkirim dua kali tidak mengurangi stok dua kali');
  const ulang = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineId, quantity: 10, warehouseId,
        unitCost: 1000, idempotencyKey: kunciSerah,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('permintaan yang terulang dikembalikan apa adanya', ulang.data?.replayed === true,
    `status ${ulang.status}`);

  const sesudah = Number(
    (await q(
      `SELECT COALESCE(sum(available_qty),0) AS n FROM "${SCHEMA}".stock_balance
        WHERE warehouse_id = $1 AND product_id = $2`,
      [warehouseId, para.productId],
    ))[0].n,
  );
  check('stok berkurang tepat 10, bukan 20', sebelum - sesudah === 10, `${sebelum} → ${sesudah}`);

  const jumlahDiserahkan = Number(
    (await q(`SELECT dispensed_qty FROM "${SCHEMA}".rx_prescription_line WHERE id = $1`, [lineId]))[0]
      .dispensed_qty,
  );
  check('jumlah yang tercatat diserahkan tetap 10', jumlahDiserahkan === 10, String(jumlahDiserahkan));

  // --- 6. Obat terkendali --------------------------------------------------
  log('');
  log('6. Obat terkendali menuntut telaah dan pemeriksaan ganda');
  const resepMorfin = await api(
    '/health/pharmacy/prescriptions',
    {
      method: 'POST',
      body: JSON.stringify({
        patientId, facilityId,
        lines: [{ drugId: morf.drugId, doseValue: 10, doseUnit: 'mg', route: 'ORAL',
                  frequencyCode: '2x1', frequencyPerDay: 2, quantity: 6 }],
      }),
    },
    dokter.token,
    RAWAT,
  );
  const lineMorfin = (
    await q(`SELECT id FROM "${SCHEMA}".rx_prescription_line WHERE prescription_id = $1`,
      [resepMorfin.data?.id])
  )[0].id;

  const serahBelumTelaah = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineMorfin, quantity: 6, warehouseId,
        idempotencyKey: `bukti-mor1-${tag}`,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('obat terkendali yang BELUM ditelaah tidak dapat diserahkan', serahBelumTelaah.status === 422,
    `status ${serahBelumTelaah.status}`);
  check('penolakannya menyebut telaah', pesan(serahBelumTelaah).includes('telaah'));

  await api(
    `/health/pharmacy/prescriptions/${resepMorfin.data?.id}/review`,
    { method: 'POST', body: JSON.stringify({ approve: true }) },
    apoteker.token,
    RAWAT,
  );

  const serahTanpaPemeriksaGanda = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineMorfin, quantity: 6, warehouseId,
        idempotencyKey: `bukti-mor2-${tag}`,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('obat terkendali tanpa pemeriksa kedua ditolak', serahTanpaPemeriksaGanda.status === 422,
    `status ${serahTanpaPemeriksaGanda.status}`);

  const serahPeriksaDiriSendiri = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineMorfin, quantity: 6, warehouseId,
        doubleCheckedBy: apoteker.subjectId, idempotencyKey: `bukti-mor3-${tag}`,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('pemeriksaan ganda oleh penyerahnya sendiri ditolak', serahPeriksaDiriSendiri.status === 403,
    `status ${serahPeriksaDiriSendiri.status}`);

  const serahMorfin = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineMorfin, quantity: 6, warehouseId,
        doubleCheckedBy: perawat.subjectId, idempotencyKey: `bukti-mor4-${tag}`,
      }),
    },
    apoteker.token,
    RAWAT,
  );
  check('dengan pemeriksa kedua yang berbeda, penyerahannya berhasil',
    serahMorfin.status === 200 || serahMorfin.status === 201,
    `status ${serahMorfin.status} ${pesan(serahMorfin)}`);

  // --- 7. Enam benar -------------------------------------------------------
  log('');
  log('7. Enam benar pada pemberian obat');
  const admId = (
    await q(
      `INSERT INTO "${SCHEMA}".rx_administration
         (prescription_line_id, patient_id, drug_id, scheduled_at, dose_value, dose_unit, route)
       VALUES ($1,$2,$3, now(), 500, 'mg', 'ORAL') RETURNING id`,
      [lineId, patientId, para.drugId],
    )
  )[0].id;

  const pasienSalah = await api(
    '/health/pharmacy/administrations',
    {
      method: 'POST',
      body: JSON.stringify({
        administrationId: admId, scanPatientId: randomUUID(), scanDrugId: para.drugId,
        doseValue: 500, route: 'ORAL',
      }),
    },
    perawat.token,
    RAWAT,
  );
  check('memberikan kepada pasien yang SALAH ditolak', pasienSalah.status === 422,
    `status ${pasienSalah.status}`);

  const nyarisCedera = await q(
    `SELECT incident_type, severity, reached_patient FROM "${SCHEMA}".rx_incident
      WHERE administration_id = $1`,
    [admId],
  );
  check('kegagalannya tercatat sebagai kejadian nyaris cedera', nyarisCedera.length > 0);
  check('jenisnya WRONG_PATIENT', nyarisCedera[0]?.incident_type === 'WRONG_PATIENT',
    nyarisCedera[0]?.incident_type);
  check('dan tercatat TIDAK sampai ke pasien', nyarisCedera[0]?.reached_patient === false);

  const tanpaPindai = await api(
    '/health/pharmacy/administrations',
    {
      method: 'POST',
      body: JSON.stringify({ administrationId: admId, doseValue: 500, route: 'ORAL' }),
    },
    perawat.token,
    RAWAT,
  );
  check('TANPA memindai pasien juga ditolak, bukan dilewati', tanpaPindai.status === 422,
    `status ${tanpaPindai.status}`);

  const dosisSalah = await api(
    '/health/pharmacy/administrations',
    {
      method: 'POST',
      body: JSON.stringify({
        administrationId: admId, scanPatientId: patientId, scanDrugId: para.drugId,
        doseValue: 250, route: 'ORAL',
      }),
    },
    perawat.token,
    RAWAT,
  );
  check('dosis yang berbeda dari resep ditolak', dosisSalah.status === 422, `status ${dosisSalah.status}`);

  const benar = await api(
    '/health/pharmacy/administrations',
    {
      method: 'POST',
      body: JSON.stringify({
        administrationId: admId, scanPatientId: patientId, scanDrugId: para.drugId,
        doseValue: 500, route: 'oral',
      }),
    },
    perawat.token,
    RAWAT,
  );
  check('enam benar terpenuhi, pemberiannya tercatat',
    benar.status === 200 || benar.status === 201, `status ${benar.status} ${pesan(benar)}`);

  const ulangBerikan = await api(
    '/health/pharmacy/administrations',
    {
      method: 'POST',
      body: JSON.stringify({
        administrationId: admId, scanPatientId: patientId, scanDrugId: para.drugId,
        doseValue: 500, route: 'ORAL',
      }),
    },
    perawat.token,
    RAWAT,
  );
  check('pemberian yang sama tidak dapat dicatat dua kali', ulangBerikan.status === 409,
    `status ${ulangBerikan.status}`);

  // --- 8. Melewatkan pemberian --------------------------------------------
  log('');
  log('8. Obat yang dilewati wajib menyebut sebabnya');
  const admId2 = (
    await q(
      `INSERT INTO "${SCHEMA}".rx_administration
         (prescription_line_id, patient_id, drug_id, scheduled_at, dose_value, dose_unit, route)
       VALUES ($1,$2,$3, now(), 500, 'mg', 'ORAL') RETURNING id`,
      [lineId, patientId, para.drugId],
    )
  )[0].id;

  const lewatiKosong = await api(
    '/health/pharmacy/administrations/skip',
    {
      method: 'POST',
      body: JSON.stringify({ administrationId: admId2, status: 'OMITTED', reason: '   ' }),
    },
    perawat.token,
    RAWAT,
  );
  check('melewatkan tanpa alasan ditolak', lewatiKosong.status === 400 || lewatiKosong.status === 422,
    `status ${lewatiKosong.status}`);

  const lewati = await api(
    '/health/pharmacy/administrations/skip',
    {
      method: 'POST',
      body: JSON.stringify({
        administrationId: admId2, status: 'REFUSED', reason: 'Pasien menolak',
        note: 'Pasien menyatakan mual setelah dosis sebelumnya.',
      }),
    },
    perawat.token,
    RAWAT,
  );
  check('dengan alasan, pelewatannya tercatat', lewati.status === 200 || lewati.status === 201,
    `status ${lewati.status} ${pesan(lewati)}`);

  // --- 9. Jejak akses ------------------------------------------------------
  log('');
  log('9. Setiap sentuhan rekam medis meninggalkan jejak');
  const jejak = await q(
    `SELECT count(*)::int AS n FROM "${SCHEMA}".health_access_log WHERE patient_id = $1`,
    [patientId],
  );
  check('jejak pembacaan rekam medis tercatat', jejak[0].n > 0, `${jejak[0].n} baris`);

  const tanpaTujuan = await api(
    '/health/pharmacy/dispensings',
    {
      method: 'POST',
      body: JSON.stringify({
        prescriptionLineId: lineId, quantity: 1, warehouseId, idempotencyKey: `bukti-notuj-${tag}`,
      }),
    },
    apoteker.token,
  );
  check('menyentuh rekam medis tanpa tujuan penggunaan ditolak', tanpaTujuan.status === 400,
    `status ${tanpaTujuan.status}`);

  // --- Kesimpulan ----------------------------------------------------------
  log('');
  log('='.repeat(78));
  log(failures === 0 ? 'SELURUH PEMERIKSAAN LULUS' : `${failures} PEMERIKSAAN GAGAL`);
  log('='.repeat(78));

  bersihkan.push(dokter, apoteker, perawat);
} catch (e) {
  log('');
  log(`GALAT: ${e.message}`);
  failures += 1;
} finally {
  const berkas = new URL('../../../docs/emedik/bukti-h4-farmasi.txt', import.meta.url);
  writeFileSync(berkas, `${lines.join('\n')}\n`, 'utf8');
  await client.end();
  process.exit(failures === 0 ? 0 : 1);
}
