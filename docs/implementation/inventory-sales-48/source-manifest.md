# Source Manifest dan Chain of Custody

Audit sumber diperbarui 2026-08-08 (Asia/Jakarta). Pencarian dilakukan pada repository,
`C:\Users\Admin1\Downloads`, folder paket perintah, dan nama file persis yang diwajibkan master.
File yang tidak ditemukan tidak direkonstruksi atau dikarang.

## Input tersedia dan dibaca

| Path | Bytes | SHA-256 | Status / tujuan |
|---|---:|---|---|
| `C:\Users\Admin1\Downloads\Mapping-48-Layar-Legacy-ke-UI-Baru-eBisnis-POS-Inventory-v3.pdf` | 11.974.012 | `2CADD76BCBD759AEFFE5D101DF9A080139CD228B70A033557256BDB7238935C0` | Dibaca tekstual dan visual 105/105 halaman; mapping visual terbaru 48 layar |
| `C:\Users\Admin1\Downloads\Panduan-Transisi-48-Layar-eBisnis-Inventory-Sales-v2-Paritas-Fungsional.pdf` | 12.910.130 | `23FD37FDBA8C8F7B89330E3A749FFF607701DA28DE56EA2EFDEDADA01767994B` | Dibaca tekstual 420/420 halaman; kontrak detail v2 |
| `C:\Users\Admin1\Downloads\Paket_Perintah_POS_Inventory_eBisnis_Paritas_48_Layar\PERINTAH_MASTER_CODEX_CLAUDE_POS_INVENTORY_PARITAS_48_LAYAR.md` | 233.928 | `183CA8FB4114B866233F0451E4AED1E98F683FCE7C7708F274D80C914CFB2142` | Dibaca penuh, 4.714 baris; kontrak eksekusi utama |
| `...\MATRIKS_EKSEKUSI_POS_INVENTORY_48_LAYAR.md` | 7.934 | `DC7107DB0D8F1C93E64917E50498E5E2A3A630B9E86CF6F3C8C049AF28C64752` | Dibaca penuh; urutan fase/checklist |
| `...\REKOMENDASI_POS_INVENTORY_EBISNIS_2026.md` | 24.912 | `CC78E6A48EF59DF9971C3FF0C4BF4E345D3EFCC533BC64C8398B01BEA0F29E85` | Dibaca penuh; rekomendasi arsitektur |
| `...\README_CARA_MENJALANKAN_POS_INVENTORY.txt` | 2.345 | `2F206B64C3CE1A66550326A7156A99BCE918DE9C2CA5CE2ECD05A6CD890F4CE5` | Dibaca penuh; petunjuk paket |
| `...\MANIFEST_POS_INVENTORY_48_LAYAR.json` | 991 | `77AD6313C230BD86EC1EE62C06D83BCA4464FAF4ACB5400F22C2B673A2958F70` | Dibaca; checksum aktual file manifest berbeda dari self-hash yang tertulis di dalamnya |

Ellipsis pada lima baris paket berarti prefix absolut
`C:\Users\Admin1\Downloads\Paket_Perintah_POS_Inventory_eBisnis_Paritas_48_Layar`.

Ekstraksi teks dan render PDF dibuat hanya di `tmp/pdfs/` yang diabaikan Git. PDF sumber tidak
diubah. Render v3 diperiksa melalui 9 contact sheet yang mencakup semua 105 halaman.

## Input wajib master yang tidak ditemukan (`MISSING_INPUT`)

1. `Panduan-Transisi-48-Layar-eBisnis-Inventory-Sales-v2-Paritas-Fungsional.docx`
2. `Matriks-Paritas-Komponen-48-Layar-v2.csv`
3. `MASTER_PROMPT_CLAUDE_CODEX_REDEVELOPMENT_SALES_INVENTORY.md`
4. `ERD_DAN_MAPPING_DBF_SALES_INVENTORY.md`
5. `ERD_Legacy_DBF_Inventory.mmd`
6. `ERD_Target_Modern_Sales_Inventory.mmd`
7. `ERD_Target_Modern_Sales_Inventory.dbml`
8. `DBF_Legacy_Schema_Inventory.csv`
9. `LAPORAN_ANALISIS_APLIKASI_LEGACY_SALES_INVENTORY.md`
10. `Matriks_Paritas_48_Layar.csv`
11. `Cara penggunaan system inventory buat sales.docx`
12. `5-Inventory--.rar`
13. `BRD_eBisnis_ID_Versi_13_Enterprise_Education_Lengkap.docx` atau versi lebih baru dengan nama itu
14. `PROMPT_CODEX_CLAUDE_V7_GIT_ONLY_MIGRATION_AND_CONTINUOUS_COMMIT.md`

Dari 15 nama wajib master, hanya PDF panduan v2 ditemukan. Mapping v3 dan lima berkas paket adalah
input baru pengguna yang melengkapi tetapi tidak menggantikan bukti DBF/ERD/BRD yang hilang.
Requirement yang bergantung pada file hilang tidak boleh berstatus `DONE`.
