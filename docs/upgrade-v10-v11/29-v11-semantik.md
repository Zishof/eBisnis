# V11-3b — Pencarian Semantik dan Hibrida

Status: **SIAP, MENUNGGU SATU TINDAKAN OPERATOR**
Seluruh lapisan semantik terpasang dan teruji. Ia menyala sendiri begitu sebuah
model embedding tersedia pada penyedia.

---

## 1. Koreksi diagnosis

Catatan V11 sebelumnya menyimpulkan bahwa penghalang embedding adalah **bendera
`--embeddings` pada server Ollama**. Kesimpulan itu **keliru**, dan koreksinya
penting karena menentukan tindakan yang berbeda.

Dasarnya adalah pesan galat ini:

```
{"error":"This server does not support embeddings. Start it with `--embeddings`"}
```

Pemeriksaan yang lebih dalam menyanggahnya. Ollama melaporkan kemampuan tiap
model lewat `/api/show`:

| Model | `capabilities` |
|---|---|
| `qwen2.5:1.5b-instruct-q4_K_M` | `["completion","tools"]` |
| `qwen2.5:3b-instruct-q4_K_M` | `["completion","tools"]` |
| `ecampus-translator:latest` | `["completion","tools"]` |

**Tidak satu pun memuat `embedding`.** Pesan `--embeddings` berasal dari
llama.cpp di balik Ollama dan menyesatkan — menambahkan bendera itu tidak
mengubah apa pun, karena yang kurang adalah modelnya.

### Yang perlu dilakukan operator

```bash
ollama pull bge-m3
```

`bge-m3` dipilih sebagai saran utama karena **multibahasa dan menangani bahasa
Indonesia dengan baik** — seluruh korpus di sini berbahasa Indonesia.
`nomic-embed-text` disebut sebagai alternatif yang lebih kecil, tetapi mutunya
untuk bahasa Indonesia lebih rendah.

Setelah itu, `POST /platform/ai/models/probe` akan mendeteksinya, dan pencarian
berpindah ke hibrida **tanpa perubahan kode maupun konfigurasi**.

### Mengapa saya tidak menjalankannya sendiri

Mengunduh model ke server bersama adalah perubahan infrastruktur yang memengaruhi
seluruh pemakai server itu, dan permintaannya ditolak lapisan izin. Itu penolakan
yang tepat — dan lebih baik daripada saya mengubah server orang lain berdasarkan
diagnosis yang, seperti terbukti di atas, sempat salah.

---

## 2. Penyimpanan vektor tanpa pgvector

`pgvector` **tidak tersedia** pada server basis data ini — bukan sekadar belum
dipasang:

```sql
SELECT name FROM pg_available_extensions WHERE name = 'vector';  -- kosong
```

Memasangnya menuntut menambahkan paket pada sistem operasi server basis data,
dan itu bukan wewenang aplikasi.

Yang dipakai: `FLOAT8[]` beserta fungsi `cosine_similarity` dalam plpgsql.
Bekerja hari ini tanpa ekstensi apa pun.

### Yang hilang, dan kapan itu terasa

Tanpa `pgvector` tidak ada indeks pendekatan (HNSW/IVFFlat), sehingga pencarian
memindai seluruh baris. Pemindaian penuh atas beberapa ribu potongan berlangsung
dalam puluhan milidetik; ia mulai terasa pada **sekitar 20.000 potongan per
tenant**.

Angka itu ditulis pada migrationnya supaya keputusan memasang `pgvector` kelak
dapat ditinjau dengan **ukuran, bukan firasat**. Bentuk kolomnya sengaja mudah
dipindahkan: `float8[]` menjadi `vector(n)` dengan satu `ALTER TABLE ... USING`.

### NULL, bukan nol

`cosine_similarity` mengembalikan **NULL** — bukan 0 — ketika:

- dimensinya berbeda (berarti vektornya dari model lain), atau
- salah satu vektornya nol (tidak punya arah, sudutnya tak terdefinisi).

Nol berarti "tidak mirip sama sekali", dan itu pernyataan yang **berbeda** dari
"tidak dapat dibandingkan". Memakai nol akan membuat potongan yang embeddingnya
dari model lain tampak sebagai potongan yang benar-benar tidak relevan —
sehingga penyebabnya tidak pernah terlihat, dan indeks yang tercampur model
bertahan diam-diam.

Sebagai akibatnya, potongan dari model lain **tidak pernah** muncul pada hasil
pencarian: bukan karena disaring, melainkan karena NULL tidak lolos perbandingan
ambang. Dibuktikan pada bagian 6 skrip bukti.

---

## 3. Hibrida, bukan salah satu

Pencarian leksikal unggul pada yang **persis**: nomor surat, kode barang, nama
orang. Pencarian semantik unggul pada yang **searti**: "surat izin tidak masuk"
menemukan dokumen yang menulis "permohonan cuti".

Memilih salah satu berarti kehilangan yang lain. Seseorang yang mencari
`SK-042/VII/2026` dengan pencarian semantik saja mungkin tidak menemukannya —
nomor surat tidak punya makna yang dapat didekati.

### Penggabungan memakai peringkat, bukan skor

`ts_rank` dan kosinus berada pada skala yang sama sekali berbeda: `ts_rank`
tidak terbatas dan bergantung panjang dokumen, sedangkan kosinus selalu −1
sampai 1. Menjumlahkan atau merata-ratakannya berarti membandingkan hal yang
tidak sebanding, dan hasilnya didominasi skala yang kebetulan lebih besar.

**Reciprocal Rank Fusion** hanya memakai urutan. Ia tidak peduli seberapa besar
skornya — hanya siapa yang lebih dulu. Karena itu ia bekerja tanpa menormalkan
apa pun, dan tetap benar bila model embeddingnya kelak diganti.

Diuji dengan skor yang sengaja timpang (999999 vs 0.0001): hasilnya sama persis
dengan skor seimbang, karena hanya urutannya yang dipakai.

Bobot: leksikal `1.0`, semantik `0.9`. Leksikal sedikit lebih berat karena pada
data ERP, yang dicari orang sering berupa nomor dan kode yang justru tidak punya
makna untuk didekati.

### Ambang kemiripan

Pencarian semantik memakai ambang bawaan `0.35`. Tanpa ambang, ia **selalu**
mengembalikan hasil sebanyak limit — termasuk untuk pertanyaan yang tidak ada
jawabannya sama sekali. Bukti yang tidak relevan lebih buruk daripada tidak ada
bukti, karena model akan tetap berusaha memakainya.

---

## 4. Cara pencarian ditentukan kenyataan, bukan konfigurasi

`activeRetriever()` menyimpulkan sendiri:

| Keadaan | Pencari | Yang dilaporkan |
|---|---|---|
| Tidak ada model embedding | `LEXICAL` | Sebab + saran `ollama pull` |
| Ada model, belum ada vektor | `LEXICAL` | Saran menjalankan `POST /ai/knowledge/embed` |
| Ada model, ada vektor | `HYBRID` | Jumlah potongan bervektor |

Tidak ada saklar konfigurasi yang menyatakan "semantik". Konfigurasi seperti itu
akan menyatakan semantik padahal tidak ada modelnya, dan pencariannya gagal
diam-diam.

Jenis pencari **dilaporkan pada setiap jawaban**, beserta penjelasan cara
gagalnya masing-masing. Pengguna yang tidak menemukan sesuatu berhak tahu apakah
pencariannya berbasis kata atau makna — keduanya gagal dengan cara berbeda, dan
cara memperbaiki pertanyaannya juga berbeda.

---

## 5. Pembuatan vektor bertahap

`POST /ai/knowledge/embed` mengerjakan sebagian, lalu melaporkan sisanya.
Potongan yang sudah bervektor **dengan model yang sama** dilewati, sehingga
pemanggilan kedua hanya mengerjakan sisanya.

Pekerjaan yang harus selesai sekali jalan akan selalu gagal pada korpus yang
cukup besar. Satu potongan yang gagal tidak menghentikan sisanya — indeks yang
sebagian terisi tetap berguna; indeks yang batal seluruhnya tidak.

Embedding dibuat **berurutan**, bukan bersamaan: penyedia melayani seluruh tenant
dari satu mesin, dan mengirim lima puluh permintaan sekaligus akan membuat
pemakai lain menunggu.

Judul ikut disertakan ke dalam teks yang di-embed — ia sering memuat kata kunci
yang tidak muncul pada isinya.

---

## 6. Kegagalan semantik tidak menggagalkan pencarian

Pada `searchHybrid`, sisi semantik yang gagal dicatat lalu diabaikan; hasil
leksikal tetap dikembalikan. Bukti yang kurang lengkap tetap lebih berguna
daripada galat.

---

## 7. Bukti

Skrip: `apps/api/scripts/prove-v11b-semantic.mjs`
Keluaran: `docs/upgrade-v10-v11/bukti-v11b-semantic.txt`

**Skrip ini lulus pada kedua keadaan** — dengan maupun tanpa model embedding.
Bukti yang hanya lulus pada keadaan sempurna tidak membuktikan apa-apa tentang
keadaan sebenarnya.

Enam bagian, seluruhnya lulus pada keadaan sekarang (tanpa model embedding):

1. Tiga kolom vektor ada dan bertipe `ARRAY`; `pgvector` memang tidak tersedia.
2. `cosine_similarity` benar: identik = 1, tegak lurus = 0, dimensi berbeda =
   **NULL**, vektor nol = **NULL**.
3. Keadaan dilaporkan tepat — termasuk bahwa sarannya menyebut `ollama pull` dan
   **menyanggah petunjuk `--embeddings` yang menyesatkan**.
4. Permintaan vektor tanpa model **ditolak dengan keterangan yang dapat
   ditindaklanjuti**, bukan diam-diam berhasil.
5. Pencarian tetap bekerja; jenis pencarinya dilaporkan pada jawaban.
6. Vektor berdimensi lain menghasilkan NULL — tidak akan pernah tercampur.

Uji unit: `retrieval-fusion.spec.ts` (20 uji). Total **1.038 uji** pada 44 suite.

---

## 8. Yang menunggu

Satu tindakan operator pada server penyedia:

```bash
ollama pull bge-m3
```

Lalu dari aplikasi:

```
POST /platform/ai/models/probe    # mendeteksi kemampuan embedding
POST /ai/knowledge/embed          # membuat vektor, dapat diulang
```

Setelah itu `GET /ai/knowledge/stats` akan melaporkan `retriever: "HYBRID"`, dan
pencarian bukti berpindah sendiri.

Tidak ada perubahan kode maupun konfigurasi yang diperlukan.
