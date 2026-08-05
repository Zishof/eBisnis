# Route Map

| Layar | Route target | Mode |
| --- | --- | --- |
| 01-03 | `/app/master/suppliers` | `panel=detail|list` |
| 04-06 | `/app/master/customers` | `panel=detail|list` |
| 07 | `/app/master/salespeople` | master sales |
| 08 | `/app/inventory/stock` | saldo dan lot |
| 09-10 | `/app/inventory/stock-opnames` | workspace/report |
| 11-19 | `/app/inventory/pricing` | analisis, buku harga, report |
| 20 | `/app/purchasing/invoices` | transaksi pembelian |
| 21-27 | `/app/purchasing/payables` | open item, payment, aging |
| 28-29 | `/app/purchasing/reports` | invoice/register |
| 30 | `/app/sales/invoices` | transaksi penjualan |
| 31-38 | `/app/sales/receivables` | open item, receipt, aging |
| 39-40 | `/app/sales/note-custody` | serah-terima nota/report |
| 41-42 | `/app/sales/receivable-reports` | tabs/snapshot |
| 43-44 | `/app/finance/journals` | jurnal dan COA |
| 45-48 | `/app/finance/profit-loss` | hub, detail, preview |

Route lama `/app/inventory-control` tetap menjadi alias kompatibilitas dan tidak
boleh memutus bookmark pengguna.
