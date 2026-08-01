# 006 · Pemulihan Sesi Melewati Dedupe Refresh, dan Mencabut Sesinya Sendiri

**Diajukan:** sesi eMedik · 1 Agustus 2026
**Untuk:** sesi Core/Integrator
**Berkas:** `apps/web/src/app/auth-context.tsx`, `apps/web/src/lib/api.ts`
**Tingkat:** sedang — hanya mengenai mode pengembangan, tetapi mengenainya
**setiap kali** halaman dimuat ulang

---

## 1. Ringkasan

`api.ts` sudah punya penjaga terhadap refresh berbarengan, lengkap dengan
komentar yang menyebutkan sebabnya:

```ts
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  ...
  // Hindari beberapa refresh bersamaan — token rotation menolak pemakaian ganda.
  refreshPromise ??= (async () => { ... })();
```

Penjaga itu benar dan penulisnya tahu persis apa yang dijaganya.

**Tetapi pemulihan sesi tidak melewatinya.** `auth-context.tsx` memanggil
titik akhirnya langsung:

```ts
useEffect(() => {
  void (async () => {
    if (!getRefreshToken()) { setLoading(false); return; }
    const refreshed = await api.post('/auth/refresh',
      { refreshToken: getRefreshToken() },
      { skipRefresh: true },      // <-- melewati dedupe, bukan memakainya
    );
```

React `StrictMode` menjalankan efek **dua kali** pada pengembangan. Dua
panggilan itu memakai token yang sama:

```
panggilan 1 → 200, token dirotasi
panggilan 2 → 401, token lama dipakai ulang → SELURUH FAMILY DICABUT
```

Pencabutan itu perilaku keamanan yang **benar** — pemakaian ulang refresh token
memang harus mencabut seluruh keluarganya. Yang keliru adalah aplikasinya
sendiri yang memicunya.

## 2. Akibatnya

Pada mode pengembangan, **pemulihan sesi tidak pernah berhasil**. Setiap muat
ulang halaman mengembalikan pengembang ke layar masuk, dan token yang tersimpan
sudah telanjur dicabut sehingga mencobanya lagi pun sia-sia.

Ini bukan kejengkelan kecil. Ia membuat setiap pemeriksaan layar menuntut masuk
ulang, dan pemeriksaan layar adalah satu-satunya cara menemukan sebagian cacat
— lihat bagian 4.

Pada produksi `StrictMode` tidak menggandakan efek, jadi gejalanya tidak muncul.
Itu justru membuatnya bertahan lama: yang mengalaminya hanya pengembang, dan
setiap pengembang mengira lingkungannya sendiri yang bermasalah.

## 3. Yang diminta

Pakai penjaga yang sudah ada, alih-alih melewatinya:

```ts
const berhasil = await refreshAccessToken();   // sudah ter-dedupe
if (berhasil) await loadSession();
```

Bila `refreshAccessToken` perlu diekspor untuk itu, ekspornya jauh lebih murah
daripada penjaga kedua.

### Yang TIDAK diminta

**Jangan melonggarkan pencabutan family pada pemakaian ulang refresh token.**
Itu pertahanan yang benar terhadap pencurian token, dan gejala di sini
disebabkan pemanggilnya, bukan olehnya. Melonggarkannya akan menukar cacat yang
merepotkan pengembang dengan lubang yang merugikan pengguna.

## 4. Mengapa ini diajukan sekarang

Ia ditemukan saat membangun layar Puskesmas (fase W-1), dan penemuan itu
menyertai penemuan lain yang lebih penting: **halaman Cakupan melempar
TypeError dan kosong sama sekali**, sebab kliennya membaca `percentage` dan
`shortfall`, sedangkan peladen mengirim `coverage`, `gap`, dan `message`.

Seluruh uji komponennya lulus — sebab perlengkapan datanya ditulis tangan
dengan andaian yang sama kelirunya. Perlengkapan yang keliru dan kode yang
keliru saling menyetujui.

Yang menemukannya hanya **membuka halamannya pada peladen sungguhan**. Dan
itulah yang dipersulit cacat pemulihan sesi ini: setiap pemeriksaan semacam itu
menuntut masuk ulang.

Cacat yang menyembunyikan cacat lain layak diperbaiki lebih dahulu daripada
tingkat keparahannya sendiri menyarankan.
