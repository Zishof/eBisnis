/**
 * Metadata SEO halaman publik pondok -- deskripsi, Open Graph, Twitter Card,
 * canonical, dan data terstruktur JSON-LD (schema.org `EducationalOrganization`).
 *
 * ## Kenapa perlu, padahal `document.title` sudah ditangani terpisah
 *
 * `document.title` saja tidak cukup untuk mesin pencari mengindeks pondok
 * dengan benar sebagai ENTITAS SENDIRI (bukan sekadar halaman eBisnis.id) --
 * `<meta name="description">`, Open Graph, dan JSON-LD sama pentingnya: yang
 * pertama menentukan cuplikan yang tampil di hasil pencarian Google, yang
 * kedua/ketiga membantu Google memahami "ini sekolah/pondok bernama X di
 * alamat Y" untuk kemungkinan rich result (Knowledge Panel, dsb).
 *
 * ## Batasan yang JUJUR harus diketahui: SPA ini TIDAK di-server-render
 *
 * Hook ini mengubah `<head>` lewat JavaScript SETELAH halaman dimuat di
 * peramban. Googlebot modern MENJALANKAN JavaScript sebelum mengindeks,
 * jadi ini efektif untuk pencarian Google/Bing. TAPI banyak bot pratinjau
 * tautan (WhatsApp, Facebook, Twitter/X) HANYA membaca HTML mentah dari
 * server TANPA menjalankan JavaScript sama sekali -- bagi bot-bot itu,
 * tautan pondok akan tetap menampilkan judul/deskripsi eBisnis.id generik
 * dari `index.html`, bukan judul pondok yang sebenarnya. Memperbaiki itu
 * butuh rendering sisi server (SSR) atau suntikan meta tag di edge/reverse
 * proxy berdasarkan Host -- di luar cakupan perubahan client-side ini.
 */

import { useEffect } from 'react';

interface DataSeoPondok {
  nama: string | null;
  deskripsi: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  alamat: string | null;
  telepon: string | null;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string | null) {
  const selector = `meta[${attr}="${key}"]`;
  let tag = document.querySelector<HTMLMetaElement>(selector);

  if (!content) {
    // Jangan hapus tag bawaan index.html (mis. og:type) -- hanya tag yang
    // dibuat hook ini sendiri (ditandai data-pondok-seo) yang boleh dibuang
    // saat kontennya kosong.
    if (tag?.dataset.pondokSeo) tag.remove();
    return null;
  }

  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    tag.dataset.pondokSeo = 'true';
    document.head.appendChild(tag);
  }
  const sebelumnya = tag.getAttribute('content');
  const dibuatOlehHook = tag.dataset.pondokSeo === 'true';
  tag.setAttribute('content', content);
  return { tag, sebelumnya, dibuatOlehHook };
}

export function usePondokSeo(data: DataSeoPondok | undefined) {
  const nama = data?.nama ?? null;
  const deskripsi = data?.deskripsi ?? null;
  const logoUrl = data?.logoUrl ?? null;
  const heroImageUrl = data?.heroImageUrl ?? null;
  const alamat = data?.alamat ?? null;
  const telepon = data?.telepon ?? null;

  useEffect(() => {
    if (!nama) return;

    const judulOg = `Pondok Pesantren ${nama}`;
    const gambarOg = heroImageUrl ?? logoUrl;
    const url = window.location.origin + '/';

    const pemulihan: Array<() => void> = [];
    const pasang = (attr: 'name' | 'property', key: string, content: string | null) => {
      const hasil = upsertMeta(attr, key, content);
      if (hasil) {
        pemulihan.push(() => {
          if (hasil.dibuatOlehHook) {
            hasil.tag.remove();
          } else if (hasil.sebelumnya !== null) {
            hasil.tag.setAttribute('content', hasil.sebelumnya);
          }
        });
      }
    };

    pasang('name', 'description', deskripsi);
    pasang('property', 'og:title', judulOg);
    pasang('property', 'og:description', deskripsi);
    pasang('property', 'og:url', url);
    pasang('property', 'og:image', gambarOg);
    pasang('name', 'twitter:card', gambarOg ? 'summary_large_image' : 'summary');
    pasang('name', 'twitter:title', judulOg);
    pasang('name', 'twitter:description', deskripsi);
    pasang('name', 'twitter:image', gambarOg);

    // Canonical -- tiap subdomain pondok adalah alamat kanonisnya sendiri.
    let canonical = document.querySelector<HTMLLinkElement>("link[rel='canonical']");
    let canonicalDibuat = false;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
      canonicalDibuat = true;
    }
    const hrefSebelumnya = canonical.getAttribute('href');
    canonical.setAttribute('href', url);

    // JSON-LD: schema.org EducationalOrganization, membantu Google memahami
    // entitas pondok ini (nama, alamat, logo) untuk kemungkinan rich result.
    const jsonLd = document.createElement('script');
    jsonLd.type = 'application/ld+json';
    jsonLd.dataset.pondokSeo = 'true';
    jsonLd.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'EducationalOrganization',
      name: judulOg,
      ...(deskripsi && { description: deskripsi }),
      ...(logoUrl && { logo: logoUrl }),
      ...(gambarOg && { image: gambarOg }),
      url,
      ...(alamat && { address: { '@type': 'PostalAddress', streetAddress: alamat } }),
      ...(telepon && { telephone: telepon }),
    });
    document.head.appendChild(jsonLd);

    return () => {
      pemulihan.forEach((fn) => fn());
      if (canonicalDibuat) {
        canonical?.remove();
      } else if (hrefSebelumnya !== null) {
        canonical?.setAttribute('href', hrefSebelumnya);
      }
      jsonLd.remove();
    };
  }, [nama, deskripsi, logoUrl, heroImageUrl, alamat, telepon]);
}
