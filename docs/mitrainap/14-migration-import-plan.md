# Migration dan import plan

1. Tambah platform migration baru untuk registry/product/domain metadata bila diperlukan; jangan edit 28 migration applied.
2. Tambah tenant migration modular berprefix Hospitality dan entry manifest; setiap phase vertical slice membawa model, constraint, permission seed, dan rollback-operational note.
3. Rehearsal pada schema tenant baru lalu upgrade salinan schema existing; bandingkan row/count/checksum/invariant.
4. Import staging: upload → parse → normalize → validate → dry-run → approval → commit batch → reconciliation. Tidak ada import langsung ke tabel final dari browser.
5. Sumber legacy dipetakan ke external ID; duplicate/ambiguous/error masuk exception queue. Money/date/time zone dan room inventory direkonsiliasi eksplisit.
6. Backup sebelum deploy, migration guard, Prisma status/deploy, tenant migration, seed verify, health check, dan rollback code. Rollback schema menggunakan forward repair/restore terkontrol, bukan drop/reset.
