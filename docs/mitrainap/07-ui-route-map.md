# Peta route UI target

Public: `/`, `/fitur`, `/solusi`, `/harga`, `/demo`, `/kontak`, `/blog`, `/bantuan`; booking tenant: `/booking/search`, `/booking/results`, `/booking/room/:id`, `/booking/guest`, `/booking/payment`, `/booking/confirmation/:code`, `/manage-booking`.

Authenticated workspace berada di `/app/hospitality/*`: today, calendar/tape chart, reservation, guests, front-office, room-rack, housekeeping, maintenance, rates/revenue, channels, folio/cashier, night-audit, POS adapter, group/MICE, services, long-stay/owner, reports, site/CMS, settings/integrations.

Implementasi harus berada di `apps/web/src/verticals/hospitality/**`, lazy-loaded, memakai shared app shell/context switcher/table/form/drawer/dialog/toast/error/loading/offline primitives. Breakpoint acceptance minimum 320, 375, 768, 1024, 1440, dan 1920 px. Gambar referensi adalah arah visual; status/data/aksi wajib berasal dari API dan permission aktual, bukan mock permanen.
