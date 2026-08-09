# Runbook release MitraInap v14

1. Pastikan branch target fast-forward dan worktree server bersih.
2. Jalankan `sudo bash /opt/ebisnis/app/deploy/update.sh <tag-or-commit>`; skrip membuat backup sebelum migration, memverifikasi migration immutable/additive, menjalankan gate MitraInap, full test/build, migration platform+tenant, restart dan health check.
3. Verifikasi host `mitrainap.id`, `demo.mitrainap.id`, login tenant, front-office, folio, night audit, POS room-charge, serta dashboard observability.
4. Provider digital-key, IoT, channel, reputation dan payment hanya diaktifkan setelah contract version, credential reference, allowlist dan health test diset.
5. Rollback aplikasi: jalankan `update.sh` dengan commit sebelumnya yang dicetak pada akhir deploy. Database tidak otomatis dipulihkan karena migration additive.
6. Restore database hanya untuk insiden data material dan setelah approval: gunakan dump yang dicetak skrip, restore ke database isolasi dahulu, verifikasi checksum/tenant count, baru lakukan cutover terkontrol.

Tidak ada force-push, reset/drop database, edit migration applied, atau penimpaan `.env` dalam prosedur ini.
