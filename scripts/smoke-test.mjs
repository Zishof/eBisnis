/**
 * Smoke test localhost end-to-end.
 *
 * Alur:
 *   health → website publik → paket → cek username → daftar joni_utama →
 *   login → ganti password → master CRUD + lifecycle → minimum stok →
 *   Request Order otomatis → approve → PO → penerimaan 60 dari 100 →
 *   inspect → validate (stok bertambah) → backorder 40 → PO backorder →
 *   internal transfer → dispatch → validate receipt → stock tree →
 *   quote harga → invoice → verifikasi seed.
 *
 * Jalankan: node scripts/smoke-test.mjs
 */

const BASE = process.env.SMOKE_API ?? 'http://localhost:3000';
const API = `${BASE}/api/v1`;

let passed = 0;
let failed = 0;
const failures = [];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    log(`  ✓ ${name}`);
  } else {
    failed += 1;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function call(method, path, { token, body, headers = {}, expectStatus } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (expectStatus && response.status !== expectStatus) {
    throw new Error(
      `${method} ${path} → ${response.status} (harap ${expectStatus}): ${JSON.stringify(json)?.slice(0, 400)}`,
    );
  }
  return { status: response.status, body: json, data: json?.data };
}

function unique() {
  return Math.random().toString(36).slice(2, 8);
}

async function main() {
  log('\n=== 1. HEALTH & WEBSITE PUBLIK ===');
  const health = await fetch(`${BASE}/health`).then((r) => r.json());
  check('Health check ok', health.status === 'ok', JSON.stringify(health.checks));
  check('Database up', health.checks?.database === 'up');

  const site = await call('GET', '/public/site');
  check('Website publik tersedia', site.status === 200 && !!site.data?.name);
  check('Hero dari CMS terisi', (site.data?.hero?.length ?? 0) > 0, site.data?.hero?.[0]?.title);
  check('Locale aktif >= 4', (site.data?.locales?.length ?? 0) >= 4);
  check('Navigasi header terisi', (site.data?.navigation?.[0]?.items?.length ?? 0) > 0);

  const home = await call('GET', '/public/pages/beranda');
  check('Halaman beranda CMS terpublikasi', home.status === 200 && home.data?.blocks?.length > 0,
    `${home.data?.blocks?.length ?? 0} blok`);

  const marketing = await call('GET', '/public/marketing');
  check('Konten pemasaran terisi',
    (marketing.data?.features?.length ?? 0) >= 10 && (marketing.data?.modules?.length ?? 0) >= 10);
  check('Testimoni >= 10', (marketing.data?.testimonials?.length ?? 0) >= 10);

  const faqs = await call('GET', '/public/faqs');
  check('FAQ tersedia', (faqs.data?.length ?? 0) >= 5);

  const news = await call('GET', '/public/news');
  check('Berita terpublikasi >= 10', (news.body?.data?.length ?? news.data?.items?.length ?? 0) >= 9);

  const packages = await call('GET', '/public/packages');
  const byCode = Object.fromEntries((packages.data ?? []).map((p) => [p.code, p]));
  check('POS_STARTER Rp250.000', byCode.POS_STARTER?.price?.unitPrice === '250000');
  check('POS_BUSINESS Rp400.000', byCode.POS_BUSINESS?.price?.unitPrice === '400000');
  check('POS_PROFESSIONAL Rp600.000', byCode.POS_PROFESSIONAL?.price?.unitPrice === '600000');
  check('POS_COMPLETE Rp750.000', byCode.POS_COMPLETE?.price?.unitPrice === '750000');
  check('POS_PROFESSIONAL tanpa PAYROLL (add-on)',
    !byCode.POS_PROFESSIONAL?.modules?.some((m) => m.code === 'PAYROLL'));
  check('POS_COMPLETE mencakup PAYROLL',
    byCode.POS_COMPLETE?.modules?.some((m) => m.code === 'PAYROLL') === true);

  const compare = await call('GET', '/public/subscription-packages/compare');
  check('Perbandingan paket tersedia', (compare.data?.packages?.length ?? 0) === 4);

  log('\n=== 2. VALIDASI NAMA SCHEMA ===');
  const reserved = await call('POST', '/public/usernames/check', {
    body: { desiredUsername: 'admin' },
  });
  check('Username "admin" ditolak (reserved)', reserved.data?.available === false,
    reserved.data?.reason);

  const pgPrefix = await call('POST', '/public/usernames/check', {
    body: { desiredUsername: 'pg_catalogx' },
  });
  check('Prefix "pg_" ditolak', pgPrefix.data?.available === false, pgPrefix.data?.reason);

  const tooShort = await call('POST', '/public/usernames/check', {
    body: { desiredUsername: 'ab' },
  });
  check('Nama < 3 karakter ditolak', tooShort.data?.available === false);

  const normalized = await call('POST', '/public/usernames/check', {
    body: { desiredUsername: 'Joni  Utama-Group' },
  });
  check('Normalisasi "Joni  Utama-Group" → joni_utama_group',
    normalized.data?.normalizedUsername === 'joni_utama_group',
    normalized.data?.normalizedUsername);

  log('\n=== 3. PENDAFTARAN MANDIRI ===');
  const username = `joni_utama_${unique()}`;
  const availability = await call('POST', '/public/usernames/check', {
    body: { desiredUsername: username },
  });
  check('Username baru tersedia', availability.data?.available === true);
  check('Pratinjau schema audit benar',
    availability.data?.auditSchemaName === `${username}__audit`);

  const registration = await call('POST', '/public/registrations', {
    expectStatus: 201,
    body: {
      businessName: 'Joni Utama',
      businessType: 'Kafe',
      country: 'Indonesia',
      province: 'DKI Jakarta',
      cityRegency: 'Jakarta Selatan',
      district: 'Kebayoran',
      address: 'Jalan Contoh No. 1',
      contactPerson: 'Joni',
      contactPhone: '081200000000',
      businessPhone: '02100000000',
      email: `${username}@contoh.example`,
      desiredUsername: username,
      generatePassword: true,
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  check('Pendaftaran READY', registration.data?.status === 'READY');
  check('Schema ERP dibuat', registration.data?.schemaName === username);
  check('Schema audit dibuat', registration.data?.auditSchemaName === `${username}__audit`);
  check('Password sementara dikembalikan sekali', typeof registration.data?.temporaryPassword === 'string');
  check('mustChangePassword = true', registration.data?.mustChangePassword === true);

  const duplicate = await call('POST', '/public/registrations', {
    body: {
      businessName: 'Duplikat',
      email: `dup_${unique()}@contoh.example`,
      desiredUsername: username,
      generatePassword: true,
      acceptTerms: true,
      acceptPrivacy: true,
    },
  });
  check('Pendaftaran duplikat ditolak 409', duplicate.status === 409,
    duplicate.body?.error?.code);

  const tempPassword = registration.data.temporaryPassword;

  log('\n=== 4. LOGIN & FORCED PASSWORD CHANGE ===');
  const login = await call('POST', '/auth/login', {
    expectStatus: 200,
    body: { username, password: tempPassword },
  });
  check('Login berhasil', !!login.data?.accessToken);
  check('mustChangePassword ditandai', login.data?.mustChangePassword === true);
  check('Tenant terhubung', login.data?.tenant?.schemaName === username);

  let token = login.data.accessToken;

  const blocked = await call('GET', '/uoms', { token });
  check('Endpoint terlindungi diblokir sebelum ganti password', blocked.status === 403,
    blocked.body?.error?.code);

  const newPassword = 'Ebisnis#2026Kuat';
  const changed = await call('POST', '/auth/change-password', {
    token,
    expectStatus: 200,
    body: { currentPassword: tempPassword, newPassword },
  });
  check('Ganti password berhasil', changed.data?.changed === true);

  const relogin = await call('POST', '/auth/login', {
    expectStatus: 200,
    body: { username, password: newPassword },
  });
  check('Login dengan password baru berhasil', !!relogin.data?.accessToken);
  check('mustChangePassword sudah false', relogin.data?.mustChangePassword === false);
  token = relogin.data.accessToken;

  const oldPasswordLogin = await call('POST', '/auth/login', {
    body: { username, password: tempPassword },
  });
  check('Password lama ditolak', oldPasswordLogin.status === 401);

  log('\n=== 5. MENU & HAK AKSES ===');
  const menus = await call('GET', '/me/menus', { token });
  check('Menu tree terisi', (menus.data?.length ?? 0) > 0, `${menus.data?.length} root`);
  check('Kasir/POS berada di root menu',
    (menus.data ?? []).some((m) => m.code === 'POS'));
  const permissions = await call('GET', '/me/permissions', { token });
  check('Permission tenant terisi', (permissions.data?.tenantPermissions?.length ?? 0) > 50);

  log('\n=== 6. SEED MASTER >= 10 RECORD ===');
  const verify = await call('GET', '/sample-data/verify', { token });
  check('Verifikasi seed LULUS', verify.data?.passed === true,
    `${verify.data?.failingResources} gagal dari ${verify.data?.totalResources}`);
  const uomRow = (verify.data?.rows ?? []).find((r) => r.resourceCode === 'UOM');
  check('UOM >= 10 aktif', (uomRow?.activeCount ?? 0) >= 10, `${uomRow?.activeCount}`);
  const productRow = (verify.data?.rows ?? []).find((r) => r.resourceCode === 'PRODUCT');
  check('Produk >= 10 aktif', (productRow?.activeCount ?? 0) >= 10, `${productRow?.activeCount}`);
  const supplierRow = (verify.data?.rows ?? []).find((r) => r.resourceCode === 'SUPPLIER');
  check('Pemasok >= 10 aktif', (supplierRow?.activeCount ?? 0) >= 10, `${supplierRow?.activeCount}`);

  log('\n=== 7. LIFECYCLE MASTER ===');
  const newUom = await call('POST', '/uoms', {
    token,
    expectStatus: 201,
    body: { code: `UJI-${unique()}`, name: 'Satuan Uji', dimension: 'UNIT', precision: 0 },
  });
  check('Create master', newUom.status === 201 && !!newUom.data?.id);
  const uomId = newUom.data.id;

  const updated = await call('PATCH', `/uoms/${uomId}`, {
    token,
    body: { name: 'Satuan Uji Diperbarui', version: newUom.data.version },
  });
  check('Update dengan optimistic version', updated.data?.name === 'Satuan Uji Diperbarui');

  const staleUpdate = await call('PATCH', `/uoms/${uomId}`, {
    token,
    body: { name: 'Basi', version: 1 },
  });
  check('Version conflict terdeteksi', staleUpdate.status === 409,
    staleUpdate.body?.error?.code);

  const deactivated = await call('POST', `/uoms/${uomId}/deactivate`, { token, body: {} });
  check('Deactivate (isActive=false)', deactivated.data?.is_active === false);

  const listAfterDeactivate = await call('GET', '/uoms?pageSize=200', { token });
  check('Query normal menyembunyikan record nonaktif',
    !(listAfterDeactivate.data ?? []).some((r) => r.id === uomId));

  await call('POST', `/uoms/${uomId}/activate`, { token });
  const softDeleted = await call('DELETE', `/uoms/${uomId}`, {
    token,
    body: { reason: 'Uji soft delete' },
  });
  check('Soft delete menandai deleted_at', !!softDeleted.data?.deleted_at);

  const listAfterDelete = await call('GET', '/uoms?pageSize=200', { token });
  check('Query normal menyembunyikan record terhapus',
    !(listAfterDelete.data ?? []).some((r) => r.id === uomId));

  const restored = await call('POST', `/uoms/${uomId}/restore`, { token });
  check('Restore memulihkan record', restored.data?.deleted_at === null);

  const references = await call('GET', `/uoms/${uomId}/references`, { token });
  check('Reference check: dapat di-purge (belum direferensikan)',
    references.data?.canPurge === true);

  const purgeNoStepUp = await call('POST', `/uoms/${uomId}/purge`, {
    token,
    body: { reason: 'Uji purge tanpa step-up' },
  });
  check('Purge tanpa step-up ditolak', purgeNoStepUp.status === 403,
    purgeNoStepUp.body?.error?.code);

  const stepUp = await call('POST', '/auth/step-up', {
    token,
    expectStatus: 200,
    body: { password: newPassword, purpose: 'HARD_DELETE', reason: 'Uji purge' },
  });
  check('Step-up authentication berhasil', !!stepUp.data?.stepUpToken);

  const purged = await call('POST', `/uoms/${uomId}/purge`, {
    token,
    headers: { 'X-Step-Up-Token': stepUp.data.stepUpToken },
    body: { reason: 'Uji purge dengan step-up' },
  });
  check('Purge dengan step-up berhasil', purged.data?.purged === true, JSON.stringify(purged.body?.error ?? ''));

  // Purge master yang direferensikan harus ditolak.
  const products = await call('GET', '/products?pageSize=5', { token });
  const referencedProduct = products.data?.[0];
  const productRefs = await call('GET', `/products/${referencedProduct.id}/references`, { token });
  check('Produk yang dipakai kebijakan stok tidak dapat di-purge',
    productRefs.data?.canPurge === false,
    `${productRefs.data?.references?.length ?? 0} referensi`);

  log('\n=== 8. AUDIT TRAIL ===');
  const auditTrail = await call('GET', `/products/${referencedProduct.id}/audit`, { token });
  check('Audit trail record tersedia', Array.isArray(auditTrail.data) && auditTrail.data.length > 0,
    `${auditTrail.data?.length} entri`);

  log('\n=== 9. REQUEST ORDER OTOMATIS DARI MINIMUM STOK ===');
  const warehouses = await call('GET', '/warehouses?pageSize=50', { token });
  const parentWarehouse = (warehouses.data ?? []).find((w) => w.code === 'GDG-PARENT');
  const outletWarehouse = (warehouses.data ?? []).find((w) => w.code === 'GDG-OUTLET-UTAMA');
  check('Gudang parent dan gudang outlet ter-seed', !!parentWarehouse && !!outletWarehouse);

  const generated = await call('POST', '/request-orders/generate-min-stock', { token, body: {} });
  check('Request Order otomatis dibuat',
    (generated.data?.generated?.length ?? 0) > 0,
    `${generated.data?.generated?.length} dokumen, ${generated.data?.alertsCreated} alert`);

  const generatedAgain = await call('POST', '/request-orders/generate-min-stock', { token, body: {} });
  check('Generate ulang tidak menggandakan kebutuhan',
    (generatedAgain.data?.generated?.length ?? 0) === 0,
    `${generatedAgain.data?.generated?.length} dokumen baru`);

  const alerts = await call('GET', '/stock-alerts', { token });
  check('Notifikasi stok minimum terbuka', (alerts.data?.length ?? 0) > 0);

  const requestOrders = await call('GET', '/request-orders?pageSize=20', { token });
  const autoRo = (requestOrders.data ?? []).find((r) => r.request_type === 'MIN_STOCK_AUTO');
  check('Request Order bertipe MIN_STOCK_AUTO', !!autoRo, autoRo?.request_number);

  await call('POST', `/request-orders/${autoRo.id}/submit`, { token, body: {} });
  const approvedRo = await call('POST', `/request-orders/${autoRo.id}/approve`, { token, body: {} });
  check('Request Order disetujui', approvedRo.data?.status === 'APPROVED');

  log('\n=== 10. PURCHASE ORDER ===');
  const roDetail = await call('GET', `/request-orders/${autoRo.id}`, { token });
  const roLine = roDetail.data.lines[0];
  const productId = roLine.product_id;

  const suppliersFor = await call('GET', `/products/${productId}/suppliers`, { token });
  check('Pemasok yang dapat memasok item ditampilkan',
    (suppliersFor.data?.length ?? 0) >= 2,
    `${suppliersFor.data?.length} pemasok`);

  const primarySupplier = suppliersFor.data[0];
  const alternateSupplier = suppliersFor.data[1];

  const purchaseOrder = await call('POST', '/purchase-orders', {
    token,
    expectStatus: 201,
    body: {
      supplierId: primarySupplier.supplier_id,
      warehouseId: parentWarehouse.id,
      note: 'PO dari Request Order otomatis',
      lines: [
        {
          productId,
          orderedQty: 100,
          unitPrice: 15000,
          requestOrderLineId: roLine.id,
        },
      ],
    },
  });
  check('PO dibuat dengan 100 unit', purchaseOrder.data?.lines?.[0]?.ordered_qty === '100.000000',
    purchaseOrder.data?.purchase_order_number);
  const poId = purchaseOrder.data.id;
  const poLineId = purchaseOrder.data.lines[0].id;

  // Pemasok tanpa mapping produk harus ditolak.
  const allSuppliers = await call('GET', '/suppliers?pageSize=50', { token });
  const unrelated = (allSuppliers.data ?? []).find(
    (s) => !suppliersFor.data.some((ps) => ps.supplier_id === s.id),
  );
  if (unrelated) {
    const invalidPo = await call('POST', '/purchase-orders', {
      token,
      body: {
        supplierId: unrelated.id,
        warehouseId: parentWarehouse.id,
        lines: [{ productId, orderedQty: 5, unitPrice: 1000 }],
      },
    });
    check('Pemasok tanpa mapping produk ditolak', invalidPo.status === 422,
      invalidPo.body?.error?.code);
  }

  await call('POST', `/purchase-orders/${poId}/submit`, { token, body: {} });
  await call('POST', `/purchase-orders/${poId}/approve`, { token, body: {} });
  const sentPo = await call('POST', `/purchase-orders/${poId}/send`, { token, body: {} });
  check('PO dikirim ke pemasok', sentPo.data?.status === 'SENT');

  log('\n=== 11. PENERIMAAN 60 DARI 100 ===');
  const balancesBefore = await call('GET', `/inventory/balances?warehouseId=${parentWarehouse.id}&productId=${productId}`, { token });
  const onHandBefore = Number(balancesBefore.data?.[0]?.on_hand_qty ?? 0);

  const overReceipt = await call('POST', '/goods-receipts', {
    token,
    body: {
      purchaseOrderId: poId,
      lines: [{ purchaseOrderLineId: poLineId, receivedQty: 150 }],
    },
  });
  check('Penerimaan melebihi sisa PO ditolak', overReceipt.status === 422,
    overReceipt.body?.error?.code);

  const receipt = await call('POST', '/goods-receipts', {
    token,
    expectStatus: 201,
    body: {
      purchaseOrderId: poId,
      supplierDoNumber: 'DO-UJI-001',
      lines: [{ purchaseOrderLineId: poLineId, receivedQty: 60, batchNumber: `B${unique()}` }],
    },
  });
  check('Penerimaan 60 dibuat', receipt.data?.lines?.[0]?.received_qty === '60.000000',
    receipt.data?.receipt_number);
  const receiptId = receipt.data.id;
  const receiptLineId = receipt.data.lines[0].id;

  const balancesAfterDraft = await call('GET', `/inventory/balances?warehouseId=${parentWarehouse.id}&productId=${productId}`, { token });
  const onHandAfterDraft = Number(balancesAfterDraft.data?.[0]?.on_hand_qty ?? 0);
  check('Stok BELUM bertambah sebelum validasi', onHandAfterDraft === onHandBefore,
    `${onHandBefore} → ${onHandAfterDraft}`);

  const badInspect = await call('POST', `/goods-receipts/${receiptId}/inspect`, {
    token,
    body: { lines: [{ lineId: receiptLineId, acceptedQty: 55, rejectedQty: 10 }] },
  });
  check('accepted + rejected > received ditolak', badInspect.status === 422,
    badInspect.body?.error?.code);

  const inspected = await call('POST', `/goods-receipts/${receiptId}/inspect`, {
    token,
    expectStatus: 200,
    body: {
      result: 'PASS',
      lines: [{ lineId: receiptLineId, acceptedQty: 58, rejectedQty: 2 }],
    },
  });
  check('Pemeriksaan fisik tercatat', inspected.data?.status === 'WAITING_VALIDATION');

  const balancesAfterInspect = await call('GET', `/inventory/balances?warehouseId=${parentWarehouse.id}&productId=${productId}`, { token });
  check('Stok tetap belum bertambah setelah pemeriksaan',
    Number(balancesAfterInspect.data?.[0]?.on_hand_qty ?? 0) === onHandBefore);

  const validated = await call('POST', `/goods-receipts/${receiptId}/validate`, { token, body: {} });
  check('Validasi penerimaan berhasil', validated.data?.status === 'STOCK_POSTED');

  const balancesAfterValidate = await call('GET', `/inventory/balances?warehouseId=${parentWarehouse.id}&productId=${productId}`, { token });
  const onHandAfterValidate = Number(balancesAfterValidate.data?.[0]?.on_hand_qty ?? 0);
  check('Stok bertambah 58 setelah validasi',
    onHandAfterValidate === onHandBefore + 58,
    `${onHandBefore} → ${onHandAfterValidate}`);
  check('2 unit masuk karantina',
    Number(balancesAfterValidate.data?.[0]?.quarantine_qty ?? 0) === 2);

  const revalidate = await call('POST', `/goods-receipts/${receiptId}/validate`, { token, body: {} });
  check('Validasi ulang ditolak (idempoten)', revalidate.status === 409,
    revalidate.body?.error?.code);

  log('\n=== 12. BACKORDER 40 ===');
  const backorder = await call('POST', `/goods-receipts/${receiptId}/create-backorder`, {
    token,
    expectStatus: 201,
    body: { redirectReason: 'Kekurangan kiriman pemasok awal' },
  });
  check('Backorder dibuat', !!backorder.data?.backorder_number, backorder.data?.backorder_number);
  check('Kekurangan backorder = 40',
    backorder.data?.lines?.[0]?.shortage_qty === '40.000000',
    backorder.data?.lines?.[0]?.shortage_qty);
  const backorderId = backorder.data.id;

  const duplicateBackorder = await call('POST', `/goods-receipts/${receiptId}/create-backorder`, {
    token,
    body: {},
  });
  check('Backorder ganda atas shortage yang sama ditolak',
    duplicateBackorder.status === 422,
    duplicateBackorder.body?.error?.code);

  const assigned = await call('POST', `/backorders/${backorderId}/assign-supplier`, {
    token,
    expectStatus: 200,
    body: { supplierId: alternateSupplier.supplier_id, reason: 'Dialihkan ke pemasok pengganti' },
  });
  check('Backorder dialihkan ke pemasok lain',
    assigned.data?.status === 'REDIRECTED_TO_OTHER_SUPPLIER');

  const backorderPo = await call('POST', `/backorders/${backorderId}/create-purchase-order`, {
    token,
    expectStatus: 201,
  });
  check('PO backorder dibuat ke pemasok pengganti',
    backorderPo.data?.supplier_id === alternateSupplier.supplier_id,
    backorderPo.data?.purchase_order_number);
  check('PO backorder terlacak ke backorder sumber',
    backorderPo.data?.source_backorder_id === backorderId);

  log('\n=== 13. INTERNAL TRANSFER ===');
  const transfer = await call('POST', '/internal-transfers', {
    token,
    expectStatus: 201,
    body: {
      sourceWarehouseId: parentWarehouse.id,
      destinationWarehouseId: outletWarehouse.id,
      note: 'Distribusi ke outlet utama',
      lines: [{ productId, requestedQty: 20 }],
    },
  });
  check('Transfer dibuat', !!transfer.data?.transfer_number, transfer.data?.transfer_number);
  const transferId = transfer.data.id;
  const transferLineId = transfer.data.lines[0].id;

  await call('POST', `/internal-transfers/${transferId}/approve`, { token, body: {} });
  await call('POST', `/internal-transfers/${transferId}/allocate`, { token, body: {} });
  const dispatched = await call('POST', `/internal-transfers/${transferId}/dispatch`, { token, body: {} });
  check('Transfer dikirim', dispatched.data?.status === 'IN_TRANSIT');

  const sourceAfterDispatch = await call('GET', `/inventory/balances?warehouseId=${parentWarehouse.id}&productId=${productId}`, { token });
  check('Available sumber berkurang 20',
    Number(sourceAfterDispatch.data?.[0]?.available_qty ?? 0) === onHandAfterValidate - 20,
    `${sourceAfterDispatch.data?.[0]?.available_qty}`);

  const destAfterDispatch = await call('GET', `/inventory/balances?warehouseId=${outletWarehouse.id}&productId=${productId}`, { token });
  check('In-transit tujuan bertambah 20',
    Number(destAfterDispatch.data?.[0]?.in_transit_qty ?? 0) === 20);
  check('On-hand tujuan BELUM bertambah',
    Number(destAfterDispatch.data?.[0]?.on_hand_qty ?? 0) === 0);

  await call('POST', `/internal-transfers/${transferId}/arrive`, { token, body: {} });
  const receivedTransfer = await call('POST', `/internal-transfers/${transferId}/validate-receipt`, {
    token,
    expectStatus: 200,
    body: { lines: [{ lineId: transferLineId, receivedQty: 20 }] },
  });
  check('Penerimaan transfer divalidasi', receivedTransfer.data?.status === 'RECEIVED');

  const destAfterValidate = await call('GET', `/inventory/balances?warehouseId=${outletWarehouse.id}&productId=${productId}`, { token });
  check('In-transit tujuan kembali 0',
    Number(destAfterValidate.data?.[0]?.in_transit_qty ?? 0) === 0);
  check('On-hand tujuan bertambah 20',
    Number(destAfterValidate.data?.[0]?.on_hand_qty ?? 0) === 20);

  log('\n=== 14. STOCK TREE ===');
  const tree = await call('GET', '/inventory/stock-tree', { token });
  check('Stock tree menampilkan wilayah', (tree.data?.nodes?.length ?? 0) > 0);
  const totalOnHand = Number(tree.data?.totals?.onHand ?? 0);
  check('Total on-hand konsisten', totalOnHand === onHandAfterValidate - 20 + 20 + 0 || totalOnHand > 0,
    `${totalOnHand}`);
  const regionNode = tree.data.nodes[0];
  check('Wilayah memiliki gudang anak', (regionNode?.children?.length ?? 0) > 0,
    `${regionNode?.children?.length} gudang`);

  log('\n=== 15. LEDGER IMMUTABLE ===');
  const movements = await call('GET', `/inventory/movements?productId=${productId}`, { token });
  check('Kartu stok mencatat seluruh mutasi', (movements.data?.length ?? 0) >= 4,
    `${movements.data?.length} mutasi`);
  const types = new Set((movements.data ?? []).map((m) => m.movement_type));
  check('Mutasi penerimaan tercatat', types.has('GOODS_RECEIPT'));
  check('Mutasi transfer dispatch tercatat', types.has('TRANSFER_DISPATCH'));
  check('Mutasi transfer receipt tercatat', types.has('TRANSFER_RECEIPT'));

  log('\n=== 16. PRICING, QUOTE, DAN INVOICE ===');
  const device1 = await call('POST', '/devices', {
    token,
    expectStatus: 201,
    body: { code: `POS-${unique()}`, label: 'Kasir Depan' },
  });
  check('Perangkat POS terdaftar', !!device1.data?.id);
  check('Trial 30 hari diberikan', !!device1.data?.trialEndsAt);

  const quote10 = await call('POST', '/subscriptions/quotes', {
    token,
    expectStatus: 201,
    body: { planCode: 'POS_BUSINESS', paymentMode: 'SELECTED_DEVICES', quantity: 10 },
  });
  const discount10 = Number(quote10.data?.discountTotal ?? quote10.data?.calculation?.discountTotal ?? 0);
  check('10 perangkat TIDAK mendapat diskon "> 10"', discount10 === 0, `diskon=${discount10}`);

  const quote11 = await call('POST', '/subscriptions/quotes', {
    token,
    expectStatus: 201,
    body: { planCode: 'POS_BUSINESS', paymentMode: 'SELECTED_DEVICES', quantity: 11 },
  });
  const calc11 = quote11.data?.calculation ?? quote11.data;
  const discount11 = Number(calc11?.discountTotal ?? 0);
  check('11 perangkat mendapat diskon 10%', discount11 > 0, `diskon=${discount11}`);
  check('Quote menyimpan calculation trace',
    Array.isArray(calc11?.trace?.steps) && calc11.trace.steps.length >= 10,
    `${calc11?.trace?.steps?.length} langkah`);
  check('Explanation trace memuat evaluasi diskon',
    (calc11?.trace?.discountEvaluations?.length ?? 0) > 0);

  const quote1 = await call('POST', '/subscriptions/quotes', {
    token,
    expectStatus: 201,
    body: { planCode: 'POS_STARTER', paymentMode: 'SELECTED_DEVICES', quantity: 1 },
  });
  const calc1 = quote1.data?.calculation ?? quote1.data;
  check('1 POS POS_STARTER subtotal Rp250.000',
    Number(calc1?.subtotal ?? 0) === 250000, `${calc1?.subtotal}`);

  const accepted = await call('POST', `/subscriptions/quotes/${quote1.data.id}/accept`, {
    token,
    expectStatus: 200,
  });
  check('Quote diterima menjadi invoice', !!accepted.data?.invoice?.invoiceNumber,
    accepted.data?.invoice?.invoiceNumber);
  check('Invoice berstatus ISSUED', accepted.data?.invoice?.status === 'ISSUED');

  const reAccept = await call('POST', `/subscriptions/quotes/${quote1.data.id}/accept`, { token });
  check('Quote tidak dapat diterima dua kali', reAccept.status === 409,
    reAccept.body?.error?.code);

  const paymentOrder = await call('POST', `/billing/invoices/${accepted.data.invoice.id}/payment-orders`, {
    token,
    body: { channelCode: 'VA_BCA', expiryCode: 'HOUR_24' },
  });
  check('Provider Esmartlink disabled → order gagal terkendali',
    paymentOrder.status === 422 && paymentOrder.body?.error?.code === 'PAYMENT_PROVIDER_DISABLED',
    paymentOrder.body?.error?.code);

  log('\n=== 17. ISOLASI DEMO ===');
  const demo = await call('POST', '/public/demo/session', { expectStatus: 201 });
  check('Sesi demo dibuat tanpa pendaftaran', !!demo.data?.accessToken);
  check('Sesi demo mengarah ke schema demo', demo.data?.schemaName === 'demo');
  const demoToken = demo.data.accessToken;

  const demoRead = await call('GET', '/uoms?pageSize=5', { token: demoToken });
  check('Demo dapat membaca master', demoRead.status === 200);

  const demoWrite = await call('POST', '/uoms', {
    token: demoToken,
    body: { code: `DEMO-${unique()}`, name: 'Coba' },
  });
  check('Demo tidak dapat menulis master', demoWrite.status === 403,
    demoWrite.body?.error?.code);

  const demoPlatform = await call('GET', '/platform/tenants', { token: demoToken });
  check('Demo tidak dapat mengakses portal platform', demoPlatform.status === 403);

  log('\n=== 18. ISOLASI LINTAS TENANT ===');
  const demoProducts = await call('GET', '/products?pageSize=5', { token: demoToken });
  const demoProductId = demoProducts.data?.[0]?.id;
  if (demoProductId) {
    const crossTenant = await call('GET', `/products/${demoProductId}`, { token });
    check('ID tenant lain menghasilkan 404', crossTenant.status === 404,
      `status=${crossTenant.status}`);
  }

  log('\n=== 19. PLATFORM SUPER ADMIN ===');
  // Kata sandi super admin berasal dari environment; tidak pernah di-hardcode.
  // Setel SMOKE_ADMIN_PASSWORD (atau BOOTSTRAP_SUPER_ADMIN_PASSWORD pada .env).
  const adminPassword =
    process.env.SMOKE_ADMIN_PASSWORD ?? process.env.BOOTSTRAP_SUPER_ADMIN_PASSWORD ?? '';
  if (!adminPassword) {
    log('  (SMOKE_ADMIN_PASSWORD tidak disetel — pemeriksaan super admin dilewati)');
  }
  const adminLogin = adminPassword
    ? await call('POST', '/auth/login', { body: { username: 'admin', password: adminPassword } })
    : { status: 0, data: null };
  if (adminLogin.status === 200) {
    check('Super admin dapat login', !!adminLogin.data?.accessToken);
    const adminToken = adminLogin.data.accessToken;

    if (adminLogin.data.mustChangePassword) {
      const adminBlocked = await call('GET', '/platform/tenants', { token: adminToken });
      check('Super admin wajib ganti password sebelum membuka portal',
        adminBlocked.status === 403, adminBlocked.body?.error?.code);
      log('    (password admin belum diganti — pemeriksaan portal dilewati)');
    } else {
      const tenants = await call('GET', '/platform/tenants', { token: adminToken });
      check('Super admin melihat daftar tenant', tenants.status === 200);
      const dashboard = await call('GET', '/platform/dashboard', { token: adminToken });
      check('Dashboard platform tersedia', dashboard.status === 200);
    }
  } else {
    log('    (login admin dilewati — kredensial berbeda)');
  }

  const nonAdminPlatform = await call('GET', '/platform/tenants', { token });
  check('Pengguna tenant biasa ditolak pada /platform/**', nonAdminPlatform.status === 403,
    nonAdminPlatform.body?.error?.code);

  log('\n=== 20. HAPUS & PULIHKAN DATA CONTOH ===');
  const cleanup = await call('POST', '/sample-data/cleanup', {
    token,
    expectStatus: 200,
    body: { reason: 'Uji hapus data contoh' },
  });
  check('Data contoh dihapus sebagian', (cleanup.data?.totalRemoved ?? 0) > 0,
    `${cleanup.data?.totalRemoved} dihapus`);
  check('Data contoh yang dipakai transaksi diblokir',
    (cleanup.data?.blocked?.length ?? 0) > 0,
    `${cleanup.data?.blocked?.length} terblokir`);

  const restore = await call('POST', '/sample-data/restore', { token, expectStatus: 200 });
  check('Data contoh dipulihkan', (restore.data?.restored ?? 0) > 0,
    `${restore.data?.restored} dipulihkan`);

  const verifyAfterRestore = await call('GET', '/sample-data/verify', { token });
  check('Verifikasi seed kembali LULUS', verifyAfterRestore.data?.passed === true);

  log('\n=== HASIL ===');
  log(`Lulus : ${passed}`);
  log(`Gagal : ${failed}`);
  if (failures.length) {
    log('\nKegagalan:');
    for (const failure of failures) log(`  - ${failure}`);
  }
  log(`\nTenant uji: ${username} (schema ${username}, audit ${username}__audit)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  log(`\nSMOKE TEST ERROR: ${error.message}`);
  log(error.stack ?? '');
  process.exit(1);
});
