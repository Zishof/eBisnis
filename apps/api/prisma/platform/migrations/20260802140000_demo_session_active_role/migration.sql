-- Mempersempit sesi demo ke satu peran, per portal (mis. santri.info -> EPESANTREN_ADMIN).
--
-- Tanpa ini, sesi demo selalu menggabungkan SELURUH peran yang dipegang
-- subjek demo pada schema-nya -- termasuk OWNER (`allModules: true`), yang
-- membuat demo ePesantren ikut menampilkan menu Kasir/POS, Marketplace, dan
-- Koperasi yang tersemai pada schema demo bersama. Kolomnya nullable: `null`
-- berarti tidak dipersempit, perilaku lama, tetap dipakai bagi demo umum
-- eBisnis.id yang portalnya tidak menyatakan `demoDefaultRole`.

ALTER TABLE "platform"."demo_session"
  ADD COLUMN "active_role_id" UUID,
  ADD COLUMN "active_role_code" VARCHAR(64);
