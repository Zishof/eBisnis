# Gap model data

Model minimum yang belum ada dikelompokkan agar migration tetap incremental:

1. Foundation: portfolio, brand, legal entity link, property, building, floor, zone, room type, room/unit/bed/space, facility, outlet, service point, business date.
2. Guest/CRM: guest profile, identifier, contact, address, preference, consent, relationship, company/agent link, duplicate/merge, privacy request, restricted incident/DNR.
3. Inventory/reservation: stay-date inventory ledger, block/OOO/OOS, allotment, quote/snapshot, reservation, room stay, guest stay, special request, package/add-on, lifecycle history.
4. Rate/distribution: rate plan/version, restriction, derived rule, channel account/mapping, ARI job, delivery/reconciliation/dead-letter.
5. Operations: assignment/check-in/out/room move; housekeeping task/inspection/discrepancy; linen/laundry/minibar/lost-found; maintenance work order/PM/closure.
6. Money/night audit: folio/window/charge/routing, deposit/payment reference, cashier/shift, city ledger, night-audit run/step/exception/snapshot.
7. Extended: group/block/rooming list, MICE/function space/BEO, guest service/ancillary, long-stay/utility/owner contract/statement.

Semua tabel tenant wajib membawa ID stabil, version/optimistic-lock saat relevan, timestamps, actor/audit reference, property scope, dan constraint database untuk invariant kritis. Money memakai Decimal; posting tidak diubah/hapus, hanya reversal. Migration baru bersifat additive dan file applied tidak diedit.
