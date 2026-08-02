/**
 * Favicon mengikuti logo pondok saat diakses lewat subdomainnya sendiri.
 *
 * TIDAK melakukan apa pun bila `logoUrl` kosong -- pondok yang belum
 * mengunggah logonya tetap memakai favicon bawaan `index.html`, bukan
 * ikon rusak/kosong. Favicon bawaan itu jugalah yang tetap dipakai di
 * `santri.info` (portal umum) dan `ebisnis.id`, sebab kedua halaman itu
 * tidak pernah memanggil hook ini sama sekali -- bukan karena hook ini
 * memeriksa host, melainkan karena `PondokChrome`/`SitusPondokPage`
 * (satu-satunya pemanggilnya) hanya pernah dirender di subdomain pondok.
 *
 * Ikon LAMA dikembalikan saat halaman dilepas (`return` pembersih), supaya
 * berpindah dari halaman pondok ke halaman lain dalam SPA yang sama
 * (navigasi sisi klien, bukan muat ulang) tidak membawa favicon pondok itu
 * ke halaman yang bukan miliknya.
 */

import { useEffect } from 'react';

export function usePondokFavicon(logoUrl: string | null | undefined) {
  useEffect(() => {
    if (!logoUrl) return;

    const link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) return;

    const sebelumnya = link.getAttribute('href');
    link.setAttribute('href', logoUrl);

    return () => {
      if (sebelumnya !== null) {
        link.setAttribute('href', sebelumnya);
      }
    };
  }, [logoUrl]);
}
