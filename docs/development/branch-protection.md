# Proteksi Branch `main`

## Kondisi

Branch protection dan repository ruleset GitHub **tidak tersedia** pada
repository ini. Keduanya memerlukan GitHub Pro untuk repository privat:

```text
PUT  /repos/Zishof/eBisnis/branches/main/protection  -> 403
POST /repos/Zishof/eBisnis/rulesets                  -> 403
"Upgrade to GitHub Pro or make this repository public to enable this feature."
```

Menjadikan repository publik agar fitur ini aktif **tidak dilakukan**: itu
menukar proteksi branch dengan membuka seluruh source, yang jelas merugikan.

## Mitigasi yang diterapkan

### 1. Hook `pre-push` lokal

`.githooks/pre-push` menolak dua hal pada `refs/heads/main`:

- push yang bukan fast-forward (menimpa riwayat yang sudah ada di remote);
- penghapusan branch.

Aktifkan sekali per clone:

```bash
git config core.hooksPath .githooks
```

Diuji pada tiga kasus: fast-forward normal lolos, force-push ditolak,
penghapusan branch ditolak.

### 2. Status check lewat GitHub Actions

`ci.yml`, `security.yml`, dan `migration-check.yml` berjalan pada setiap push
dan pull request. Tanpa branch protection, hasilnya **tidak memblokir merge**
secara otomatis — hasil itu harus dibaca sebelum menggabungkan.

## Batasan yang harus disadari

Hook Git berjalan di mesin lokal, sehingga:

- hanya berlaku pada clone yang menjalankan `git config core.hooksPath .githooks`;
- dapat dilewati dengan `git push --no-verify`;
- tidak berlaku bagi push dari mesin lain, CI, atau antarmuka web GitHub.

Ini **bukan** pengganti setara branch protection. Ia mempersulit kesalahan yang
tidak disengaja, bukan mencegah tindakan yang disengaja.

## Bila GitHub Pro tersedia

Aktifkan, dengan konfigurasi minimal berikut:

```text
require status checks         : CI / "Lint, test, build"
block force push              : ya
block deletion                : ya
require conversation resolution: ya
require pull request          : untuk perubahan besar dan migration
```

Perintah yang sudah disiapkan:

```bash
gh api -X PUT repos/Zishof/eBisnis/branches/main/protection \
  -H "Accept: application/vnd.github+json" \
  -f 'required_status_checks[strict]=false' \
  -f 'required_status_checks[contexts][]=Lint, test, build' \
  -F 'enforce_admins=false' \
  -F 'required_pull_request_reviews=null' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false' \
  -F 'required_conversation_resolution=true'
```

## Keputusan pengembang tunggal

Repository ini dikerjakan satu pengembang, sehingga perubahan kecil boleh masuk
`main` langsung setelah quality gate lulus. Yang tetap berlaku tanpa
pengecualian:

1. `git push --force` ke `main` dilarang;
2. setiap perubahan tetap menjadi commit terpisah dengan Conventional Commits;
3. migration besar dan perubahan yang menyentuh banyak modul memakai pull
   request agar diff-nya dapat ditinjau utuh;
4. rilis hanya dibuat setelah CI hijau.
