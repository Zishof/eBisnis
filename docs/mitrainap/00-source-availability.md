# MI-0 — Ketersediaan sumber

Audit: 9 Agustus 2026. Branch: `feature/v14-mitrainap-hospitality`; baseline `e45abbd837afa7eb498dff687b79d2331a4c26cd`.

| Sumber | SHA-256 manifest | Status | Label bukti |
|---|---|---|---|
| `BRD_eBisnis_ID_Versi_14_MitraInap_Hospitality_Lengkap.md` | `f0076e9a9a583293e6a277ec0e61e7eed4ddb66c4da1fe402c5d84e5c9bb6c34` | cocok; 2.800 baris | SRC-BRD |
| `STRUKTUR_MENU_ROLE_PERMISSION_MITRAINAP_V14.md` | `7ae903cd0adeede412034939388e21f89bdc6acf5a3fd2451ae086827fa50086` | cocok; 1.032 baris | SRC-RBAC |
| `SPESIFIKASI_UI_UX_RESPONSIVE_MITRAINAP_V14.md` | `2b06eedd4a50d3ec48d1fa6044b48593525d0aa91f538f666ae02300058c51ef` | cocok; 1.686 baris | SRC-UI |
| `PERINTAH_MASTER_CLAUDE_CODE_CODEX_EKSEKUSI_MITRAINAP_ID_HOSPITALITY_V14.md` | `979593f081f1719371da9d0b29bd11b9c885ea82e5befa7244e028e8e757b592` | cocok; 2.063 baris | SRC-MASTER |
| `README_PAKET_MITRAINAP_V14.md` | `ad5fef3c0ac14cb2bc066e77ee6b458ef6aa00aab60dfbbd45ecf2e8042108eb` | cocok; 49 baris | SRC-README |
| `PAKET_MASTER_MITRAINAP_V14_GABUNGAN.md` | `59aa44774ca4b3f195f0d4161535baa0469b051f1e96681bf4040efd4591b791` | cocok; 7.609 baris | SRC-COMBINED |
| 10 PNG referensi UI | tidak dicantumkan manifest | tersedia dan ditinjau sebagai referensi visual, bukan source of truth domain | SRC-VISUAL-01..10 |
| Instruksi pengguna `pasted-text.txt` | di luar manifest | tersedia; menetapkan worktree, namespace, portal, vertical, dan fase | SRC-USER |

Checksum keenam dokumen dalam manifest cocok. Konflik diselesaikan dengan urutan: instruksi pengguna, perintah master, BRD, RBAC, UI/UX, gambar referensi. Harga, endpoint provider, credential, dan klaim kesiapan produksi tidak boleh diinferensikan dari gambar.
