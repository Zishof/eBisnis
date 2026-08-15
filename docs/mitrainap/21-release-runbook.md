# Runbook release MitraInap v14

1. Pastikan branch target fast-forward dan worktree server bersih.
2. Jalankan `sudo bash /opt/ebisnis/app/deploy/update.sh <tag-or-commit>`; skrip membuat backup sebelum migration, memverifikasi migration immutable/additive, menjalankan gate MitraInap, full test/build, migration platform+tenant, restart dan health check.
3. Verifikasi host `mitrainap.id`, `demo.mitrainap.id`, login tenant, front-office, folio, night audit, POS room-charge, serta dashboard observability.
4. Provider digital-key, IoT, channel, reputation dan payment hanya diaktifkan setelah contract version, credential reference, allowlist dan health test diset.
5. Rollback aplikasi: jalankan `update.sh` dengan commit sebelumnya yang dicetak pada akhir deploy. Database tidak otomatis dipulihkan karena migration additive.
6. Restore database hanya untuk insiden data material dan setelah approval: gunakan dump yang dicetak skrip, restore ke database isolasi dahulu, verifikasi checksum/tenant count, baru lakukan cutover terkontrol.

Tidak ada force-push, reset/drop database, edit migration applied, atau penimpaan `.env` dalam prosedur ini.

## Gate keputusan go-live

Status `LOCAL_GATE_PASS` bukan izin otomatis menyalakan produksi. Release manager hanya memberi keputusan GO bila seluruh bukti berikut terlampir pada tiket perubahan:

1. seluruh persona pada `20-uat-persona-matrix.md` ditandatangani operator staging;
2. uji viewport keyboard/screen-reader pada desktop dan perangkat mobile nyata lulus;
3. load test search/booking/check-in/folio/night-audit memenuhi SLO yang disepakati;
4. dump pra-migration berhasil direstore ke database isolasi dan checksum/tenant count cocok;
5. health, synthetic booking, observability, alert delivery, serta rollback aplikasi diuji;
6. DNS apex/wildcard/custom domain dan sertifikat TLS aktif dengan auto-renew;
7. setiap provider live mempunyai contract version, secret reference, allowlist, sandbox proof, dan owner;
8. PIC cutover, rollback commander, komunikasi pengguna, maintenance window, dan hypercare tersedia.

Jika salah satu gate belum memiliki bukti, keputusan adalah **NO-GO** atau aktivasi terbatas tanpa provider terkait. Status `BLOCKED_PROVIDER_INPUT` adalah mode aman dan tidak boleh diubah menjadi sukses palsu.
