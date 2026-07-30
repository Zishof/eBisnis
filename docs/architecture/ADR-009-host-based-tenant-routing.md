# ADR-009 — Routing tenant berbasis host melalui registry, bukan dari hostname

- Status: Diterima (fase V6-0, sebelum implementasi V6-3)
- Tanggal: 2026-07-30

## Konteks

Versi 6 mengizinkan setiap tenant memiliki website sendiri pada
`<slug>.ebisnis.id` maupun custom domain seperti `www.brandjoni.com`. Server yang
sama harus menyajikan konten tenant yang benar berdasarkan header `Host`.

Ini menciptakan jalur baru untuk menentukan schema tenant — dan jalur itu berasal
dari **input yang dikendalikan penyerang**, karena `Host` adalah header HTTP biasa.
[ADR-001](ADR-001-schema-per-tenant.md) sudah menetapkan bahwa nama schema hanya
boleh berasal dari `platform.tenant_schema_registry`.

## Keputusan

Hostname **tidak pernah** menjadi nama schema, slug, atau username. Hostname hanya
menjadi **kunci pencarian** pada registry domain global.

```text
Host header
  -> normalisasi IDNA/punycode, lowercase, buang port
  -> tolak bila tidak lolos validasi hostname
  -> cari pada platform.tenant_website_domain  (registry GLOBAL, unik lintas tenant)
  -> domain.status = ACTIVE  DAN  domain.verified = true ?   bila tidak -> 404 platform
  -> tenant.status = ACTIVE ?                                bila tidak -> 404 platform
  -> ambil tenantId + websiteId dari baris registry
  -> ambil schemaName dari platform.tenant_schema_registry   <-- SATU-SATUNYA sumber schema
  -> layani konten tenant
```

Registry domain berada di **control plane**, bukan schema tenant. Alasannya:
keunikan domain harus global. Jika `TenantWebsiteDomain` hidup di schema tenant,
dua tenant dapat mendaftarkan `www.brandjoni.com` secara bersamaan dan tidak ada
yang mendeteksinya.

## Aturan keamanan yang tidak dapat dinegosiasikan

| Aturan | Alasan |
| --- | --- |
| Unknown host **tidak pernah** jatuh ke tenant mana pun | fallback ke "tenant pertama" membocorkan data antar-tenant |
| Tidak ada `LIMIT 1` tanpa filter status | domain yang dicabut tetap akan cocok |
| `X-Forwarded-Host` hanya dipercaya dari trusted proxy terdaftar | tanpa itu, siapa pun dapat menyatakan dirinya host mana pun |
| Cache key = hostname ternormalisasi **+ mappingVersion** | tanpa `mappingVersion`, perubahan mapping menyajikan tenant lama dari cache |
| Domain dihapus memiliki cooling period | mencegah domain takeover oleh tenant lain |
| Sertifikat dan private key tidak disimpan plaintext di database aplikasi | kebocoran database menjadi kebocoran TLS |
| Wildcard domain memerlukan verifikasi khusus | wildcard mencakup subdomain yang belum terverifikasi |

## Siklus hidup domain

```text
DRAFT -> PENDING_VERIFICATION -> VERIFIED -> CERTIFICATE_PENDING -> ACTIVE
                             \-> FAILED
ACTIVE -> SUSPENDED
ACTIVE -> REMOVING -> REMOVED   (dengan cooling period sebelum dapat diklaim ulang)
```

Hanya status `ACTIVE` yang menyajikan konten privat.

## Pemisahan CMS platform dan CMS tenant

Versi 5 sudah memiliki 35 model CMS untuk website eBisnis.id sendiri. Versi 6
menambahkan CMS milik tenant. Keduanya **tidak digabung**:

| Aspek | CMS platform | CMS tenant |
| --- | --- | --- |
| Lokasi data | schema `platform` | schema `<tenant>` |
| Isi | website ebisnis.id | website tenant/brand/outlet |
| Permission | `PLATFORM.CMS.*` | permission tenant |
| Domain | `ebisnis.id` | `<slug>.ebisnis.id` + custom |

Komponen page builder dan design system **boleh** dipakai ulang; data dan
permission-nya terisolasi. Menggabungkan datanya akan membuat editor tenant
berpotensi mengubah website platform.

## Mode pengembangan lokal

`tenant-slug.localhost` dengan mock DNS verifier dan mock certificate provider.
Sistem **tidak boleh** melaporkan TLS publik berhasil pada localhost — status
sertifikat pada mode development ditandai `MOCK`, bukan `ACTIVE`.

## Rujukan

- BRD V6 bab 25 (WEB-001 … WEB-012), bab 29.1
- Master Prompt V6 Lampiran V6-C
- [ADR-001 — Schema per tenant](ADR-001-schema-per-tenant.md)
