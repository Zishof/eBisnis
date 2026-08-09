# Role, permission, data scope, dan SoD

Prefix permission adalah `HOSPITALITY.*`; menu/role seed mengikuti katalog vertical existing dengan prefix unik `HOSPITALITY_`.

Role families: platform; corporate/property leadership; reservation/revenue/distribution; front office/guest service; housekeeping/engineering; F&B/POS/MICE; finance/back office; long-stay/owner; external/self-service. Scope minimum: PLATFORM, TENANT/ORGANIZATION, PORTFOLIO, BRAND, LEGAL_ENTITY, PROPERTY, OUTLET, DEPARTMENT, ASSIGNED, SELF.

Field mask wajib untuk identitas, kontak, dokumen, payment token/reference, incident/DNR, owner financial, dan audit/security. SoD minimum: reservation prepare/approve override, cashier adjustment approval, refund approval, night-audit final roll, rate publish, room OOO/OOS approval, guest merge, DNR access, channel credential management, dan owner settlement.

Authorization diuji positif/negatif per role × action × scope × field-mask. Controller tidak boleh mengandalkan menu visibility sebagai kontrol akses.
