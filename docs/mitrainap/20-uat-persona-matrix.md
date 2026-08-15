# MI-24 — UAT Persona MitraInap v14

Status 9 Agustus 2026: skenario otomatis/API **PASS lokal**; sign-off manusia dan provider eksternal tetap harus dicatat saat staging.

| Persona | Alur wajib | Bukti otomatis | Sign-off staging |
|---|---|---|---|
| Front Desk | arrival → check-in → room move → checkout | frontdesk specs | pending operator |
| Housekeeping | assign offline → clean → inspect/rework | housekeeping specs | pending operator/mobile device |
| Engineering | WO → downtime → verify → release | maintenance specs | pending engineer |
| Cashier/Night Auditor | folio/payment/reversal → shift close → EOD roll | folio/night-audit specs | pending finance |
| POS Outlet | sale → kitchen → room charge → refund | core POS + hospitality adapter specs | pending outlet |
| Sales/MICE | account → group/allotment → event/BEO | MICE specs | pending sales |
| Resident/Owner | contract → utility → statement | longstay specs | pending rental manager |
| Guest/Kiosk | portal/kiosk/request/checkout | experience specs | pending device/provider |
| ERP/Analyst | event delivery/reconcile → report/AI draft | ERP/insight specs | pending accounting |

Kriteria gagal: kebocoran lintas tenant/property; posting duplikat; PAN mentah; transaksi immutable dapat diubah; final business-date roll tanpa step-up; provider live dipanggil tanpa contract; atau rollback aplikasi gagal health-check.
