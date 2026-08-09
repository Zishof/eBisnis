# Product, entitlement, dan schema

- Portal `MITRAINAP`; vertical `HOSPITALITY`; product `MITRAINAP_HOSPITALITY`.
- Reuse `subscription_product`, plan/version/module/feature/price, entitlement snapshot, tenant schema registry, dan migration loader.
- 34 module code pada §8.2 master menjadi manifest versioned; dependencies dimulai `FOUNDATION → PROPERTY → ROOM_INVENTORY → RESERVATION`, lalu capability lain.
- Scope entitlement awal: tenant-wide untuk foundation/site; property untuk operasi hotel; outlet/register untuk POS; user/device bila mobile/kiosk membutuhkan.
- Provisioning idempotent: validate eligibility → reserve schema/domain → apply platform migration → tenant migration → seed role/menu/help/sample sesuai profile → health check → activate.
- Deprovision tidak drop schema/data. Status ditahan/suspended dan mengikuti retention/export policy.
