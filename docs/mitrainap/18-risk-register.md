# Risk register

| ID | Risiko | Dampak | Mitigasi/owner | Status |
|---|---|---|---|---|
| R-01 | scope 24 fase sangat besar | delivery/quality | vertical slice, ledger, gate per fase / engineering | open |
| R-02 | overbooking race | revenue/guest | ledger constraint, transaction, concurrency tests / reservation | open |
| R-03 | duplicate money/posting | financial | idempotency, immutable reversal, reconciliation / finance | open |
| R-04 | cross-tenant/property leak | critical privacy | scoped context/repository and negative test / security | open |
| R-05 | provider docs/secrets absent | integration blocked | ports/fakes/DLQ; no invented endpoint / integration | accepted-blocker |
| R-06 | commercial pricing undecided | false quotation | `PRICE_CONFIGURATION_REQUIRED` / product | accepted-blocker |
| R-07 | root pnpm wrapper mismatch | CI/local reproducibility | pin invocation/settings without lock rewrite / platform | open-existing |
| R-08 | Web bundle 1.87 MB | performance | route-level lazy chunks/budget / Web | open-existing |
| R-09 | mobile stock-tree E2E failures | regression risk | repair separately, keep Hospitality tests isolated / Web | open-existing |
| R-10 | Flutter POS symlink blocked | test coverage | enable Developer Mode on runner / release | environment-blocked |
| R-11 | second Flutter app has no tests | regression | add tests when reused / mobile | open-existing |
| R-12 | GitHub CLI unauthenticated | push/CI visibility | attempt git push; report exact result / release | open |
| R-13 | local DB PostgreSQL 16 vs documented 17 | parity | CI/prod rehearsal on supported target / DBA | open |
| R-14 | visual references contain demo numbers/actions | fake completion | API-backed states and acceptance tests / UX | controlled |
