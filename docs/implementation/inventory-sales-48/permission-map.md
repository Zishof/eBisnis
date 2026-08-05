# Permission Map

| Domain | Resource | Actions utama |
| --- | --- | --- |
| Master | `SUPPLIER`, `CUSTOMER`, `SALESPERSON` | `READ`, `CREATE`, `UPDATE`, `DEACTIVATE`, `EXPORT`, `PRINT`, `AUDIT_READ` |
| Inventory | `STOCK`, `STOCK_OPNAME` | `READ`, `COUNT`, `FREEZE`, `APPROVE`, `POST`, `CANCEL`, `EXPORT`, `PRINT` |
| Pricing | `PRICE_BOOK` | `READ`, `CREATE`, `UPDATE`, `SUBMIT`, `APPROVE`, `REJECT`, `DEACTIVATE`, `EXPORT` |
| Purchasing | `PURCHASE_INVOICE`, `AP_PAYMENT` | `READ`, `CREATE`, `POST`, `REVERSE`, `EXPORT`, `PRINT` |
| Sales | `SALES_INVOICE`, `AR_RECEIPT`, `NOTE_CUSTODY` | `READ`, `CREATE`, `POST`, `REVERSE`, `HANDOVER`, `RETURN`, `CLOSE`, `EXPORT`, `PRINT` |
| Finance | `JOURNAL`, `ACCOUNT`, `FISCAL_PERIOD`, `PROFIT_LOSS` | `READ`, `CREATE`, `POST`, `REVERSE`, `CLOSE`, `REOPEN`, `EXPORT`, `PRINT` |
| Sync | `DEVICE`, `CONFLICT` | `READ`, `REGISTER`, `PULL`, `RESOLVE` |

Backend menegakkan izin; frontend hanya mencerminkan hasil evaluasi dan selalu
menampilkan alasan saat tindakan disabled. Nomor rekening, margin, HPP, laba,
serta data investor tunduk pada field-level authorization dan data scope.
