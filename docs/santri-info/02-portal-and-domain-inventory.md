# EP-0.3 — Inventaris Portal dan Domain

## Portal terdaftar

| Kode | Host publik | Host aplikasi | Vertical |
| --- | --- | --- | --- |
| `EBISNIS` | ebisnis.id, www | app.ebisnis.id | CORE_ERP |
| `ENTERPRISE_EDUCATION` | enterprise-education.id, www | app.enterprise-education.id | ENTERPRISE_EDUCATION |
| `SANTRI_INFO` | santri.info, www | app.santri.info | ENTERPRISE_EDUCATION |
| `EMEDIK` | emedik.id, www | app.emedik.id | HEALTH |
| `EKOPERASI` | ekoperasi.id, www | app.ekoperasi.id | COOPERATIVE |
| `INFO_DESA` | info-desa.id, www | app.info-desa.id | VILLAGE_GOVERNMENT |

Penerbit identitas satu untuk seluruh ekosistem: `auth.ebisnis.id`, diikat uji.

## Tiga tabel host yang berbeda

| Tabel | Menjawab | Status |
| --- | --- | --- |
| `platform.platform_portal_domain` | Host mana melayani merek mana | DONE |
| `platform.vertical_site_domain` | Host mana milik penyewa mana | DONE, beserta `verifiedAt` dan `verifyToken` |
| `platform.website_domain` | Host mana milik situs CMS mana | DONE, tetapi **tanpa penyewa** — lihat dokumen 09 |

Tiga tabel untuk tiga pertanyaan berbeda adalah keputusan yang benar. Yang belum
benar: ketiganya belum saling terhubung — `website_domain` tidak tahu apa-apa
tentang penyewa.

## §9.2 — subdomain terpesan

Diminta 18 label. Yang ada di `infrastructure/portal/portal-host.ts` baru 12:

```text
ADA    : www app auth api admin console support status docs assets cdn mail
KURANG : static media login register demo sandbox
```

Status `PARTIAL`. Perbaikannya kecil, tetapi harus disertai pemutakhiran salinan
sisi peramban dan ujinya sekaligus — keduanya sudah diikat uji yang membaca
berkas API.

## §9.4 — model domain

Diminta sembilan model (`DomainVerification`, `DomainDnsChallenge`,
`DomainTlsCertificate`, dan seterusnya). Yang ada baru dua kolom pada
`vertical_site_domain`.

Status `PARTIAL`. Cukup untuk subdomain di bawah `santri.info` yang memang milik
kita; **tidak cukup** untuk domain milik pondok sendiri.

## §9.6 — DNS dan TLS

`docs/deployment/santri-info.md` sudah memuat DNS wildcard dan tantangan DNS-01.
Belum ada yang menyentuh Cloudflare. Status `PARTIAL`.
