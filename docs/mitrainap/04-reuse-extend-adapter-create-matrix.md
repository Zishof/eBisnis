# Matriks REUSE / EXTEND / ADAPTER / CREATE

| Capability | Keputusan | Alasan/batas |
|---|---|---|
| SSO, session, user, tenant, membership, active role | REUSE | satu identity plane |
| Portal registry/theme/navigation/CMS/SEO | EXTEND | tambah brand/host/content, bukan engine kedua |
| Domain resolver/schema registry/provisioning | EXTEND | tambah vertical, slug, seed, migration |
| Product/package/entitlement/pricing/billing | EXTEND | harga tetap `PRICE_CONFIGURATION_REQUIRED` |
| Payment, POS, accounting, inventory, procurement, HR, asset | ADAPTER | Hospitality menerbitkan contract/event; shared module mengeksekusi |
| Property, room, guest, reservation, rate, folio, night audit | CREATE | bounded context baru di namespace Hospitality |
| OTA/GDS, digital key, IoT, reputation | ADAPTER | provider-neutral; live call blocked tanpa contract/credential |
| Notification, workflow, surat, ticket, AI, observability | REUSE/EXTEND | use case Hospitality di gateway yang sama |
| Staff mobile/offline | EXTEND | reuse pola Flutter/PWA; data store dan sync contract Hospitality baru |
