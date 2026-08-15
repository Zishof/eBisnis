# Peta file konflik tinggi

| File/area | Risiko | Strategi |
|---|---|---|
| `apps/api/src/app.module.ts` | semua module root | satu import/entry Hospitality setelah module stabil |
| `infrastructure/portal/portal.catalog.ts` | urutan/host lintas portal | perubahan kecil + spec katalog |
| `infrastructure/provisioning/vertical-catalogs.ts` | semua vertical | satu katalog Hospitality modular + registry specs |
| Prisma platform schema/migrations | control plane global | file model terpisah dan migration additive |
| tenant migration manifest | urutan/checksum global | generator/validator; append saja |
| `apps/web/src/app/App.tsx` | router monolitik besar | hospitality route module lazy dan entry minimal |
| `AppLayout`/navigation/i18n | semua vertical | registry/adapter, tidak menyalin shell |
| OpenAPI/client generated | output mekanis besar | generate setelah route stabil, commit terpisah bila perlu |
| `deploy/update.sh`/Apache | production shared | ubah hanya MI-24 berdasar runbook/domain nyata |
| Flutter POS shared | release lintas platform | Hospitality via adapter/feature flag; jangan pecah POS kedua |
