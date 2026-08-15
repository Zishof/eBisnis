# Shared port dan adapter

| Port Hospitality | Implementasi shared/adapter |
|---|---|
| `InventoryPort` / `ProcurementPort` | inventory dan purchasing existing |
| `AccountingEventPort` | accounting event catalog/posting rules existing |
| `PaymentOrchestrationPort` | payment/provider abstraction existing |
| `PosChargePort` | POS existing; room charge sebagai external payment/settlement contract |
| `NotificationPort` | notification adapters existing |
| `WorkflowTaskPort` | task/workflow/surat/ticket existing |
| `IdentityTenantPort` | auth, request context, tenant client, permission guard |
| `CmsSitePort` | CMS/website/domain existing |
| `AiGatewayPort` | AI gateway/RAG/policy/audit existing |
| `ChannelDistributionPort` | contract baru; fake adapter dahulu, live provider blocked |
| `DigitalKeyPort`, `IoTPort`, `ReputationPort` | contract baru; tanpa asumsi vendor |

Dependency mengarah dari domain Hospitality ke interface/port; adapter boleh mengimpor shared module. Controller tidak memanggil provider atau membuat jurnal debit/kredit langsung.
