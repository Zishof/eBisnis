# Threat model

| Ancaman | Kontrol wajib |
|---|---|
| Cross-tenant/property IDOR | trusted tenant/property context, scoped repository, negative tests |
| Host/domain takeover | normalized verified registry, reserved slug, no fallback, TLS state |
| Overbooking/race | transaction, lock/version, stay-date ledger constraint, concurrency tests |
| Duplicate reservation/payment/posting | idempotency key, provider reference uniqueness, replay tests |
| Rate/policy tampering | immutable quote/rate/restriction snapshot and expiry |
| Unauthorized PII/DNR access | RBAC+scope+field mask+purpose/audit; restricted notes |
| Card/credential leakage | no PAN/CVV persistence; token/reference only; encrypted provider secret |
| Fraudulent refund/void/adjustment | SoD, threshold, step-up, immutable reversal trail |
| Night-audit double run | resumable step state, unique business-date posting key, final-roll step-up |
| Offline replay/stale writes | client operation ID, server dedupe, version conflict, visible sync state |
| OTA/key/IoT compromise | provider-neutral adapter, secret vault, signature/retry/DLQ, least privilege |
| CSV/Excel/PDF injection | escaping, authorization at export time, report snapshot/audit |
