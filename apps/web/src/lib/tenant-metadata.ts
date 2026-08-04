import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { emedikPublicBrandFor, isApotikHost, isEmedikHost } from '../pages/public/emedik-host';
import { isSalonDemoHost } from '../pages/contoh/salon-host';
import { inventoryTenantLabelFromHost, isCmnInventoryHost, isInventoryHost } from '../pages/inventory/inventory-host';

export interface TenantMetadata {
  title: string;
  description: string;
  siteName: string;
  appName: string;
  iconText: string;
  themeColor: string;
  imageUrl: string;
}

const DEFAULT_IMAGE =
  'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?auto=format&fit=crop&w=1200&q=80';
const INVENTORY_IMAGE =
  'https://images.unsplash.com/photo-1587854692152-cbe660dbde88?auto=format&fit=crop&w=1200&q=80';
const SALON_IMAGE =
  'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=1200&q=80';
const APOTIK_IMAGE =
  'https://images.unsplash.com/photo-1576602976047-174e57a47881?auto=format&fit=crop&w=1200&q=80';
const EMEDIK_IMAGE =
  'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?auto=format&fit=crop&w=1200&q=80';

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 3)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function svgIcon(text: string, color: string): string {
  const safeText = text.slice(0, 3).replace(/[<>&"]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="24" fill="${color}"/><text x="64" y="76" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="800" fill="white">${safeText}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  const selector = `meta[${attr}="${key}"]`;
  let tag = document.querySelector<HTMLMetaElement>(selector);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute('content', content);
}

function upsertLink(rel: string, href: string, type?: string) {
  let tag = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!tag) {
    tag = document.createElement('link');
    tag.setAttribute('rel', rel);
    document.head.appendChild(tag);
  }
  tag.setAttribute('href', href);
  if (type) tag.setAttribute('type', type);
}

export function metadataForTenant(hostname = window.location.hostname): TenantMetadata {
  const host = cleanHost(hostname);
  if (isInventoryHost(host)) {
    const tenantName = inventoryTenantLabelFromHost(host);
    const isRoot = host === 'inventory.ebisnis.id' || host === 'nventory.ebisnis.id';
    const isDemo = host === 'demo-inventory.ebisnis.id';
    const isCmn = isCmnInventoryHost(host);
    const title = isRoot
      ? 'eBisnis Inventory — Sales dan Stok Obat Terintegrasi'
      : isCmn
        ? 'Caruban Medika Nusantara — Sales Obat Cirebon'
      : `${tenantName} — Inventory Obat Terintegrasi`;
    const description = isRoot
      ? 'Aplikasi inventory untuk sales lapangan, admin gudang, batch, expiry, piutang, hutang, dan dashboard pemilik.'
      : isCmn
        ? 'Company profile dan katalog display Caruban Medika Nusantara, sales obat untuk Cirebon dan sekitarnya. Pemesanan hanya untuk pelanggan terdaftar melalui aplikasi.'
      : `Inventory obat terintegrasi untuk sales, admin gudang, piutang, batch, expiry, dan dashboard pemilik ${tenantName}.`;
    return {
      title,
      description,
      siteName: tenantName,
      appName: isDemo ? 'Demo Inventory Obat' : tenantName,
      iconText: isRoot ? 'eI' : initials(tenantName),
      themeColor: '#0f766e',
      imageUrl: INVENTORY_IMAGE,
    };
  }

  if (isSalonDemoHost(host)) {
    return {
      title: 'Salon Cantik Demo — Booking, Produk, dan Dashboard Salon',
      description:
        'Demo salon eBisnis dengan booking online, katalog layanan, manajemen kursi, invoice, promo, dan dashboard transaksi.',
      siteName: 'Salon Cantik Demo',
      appName: 'Salon Cantik Demo',
      iconText: 'SC',
      themeColor: '#0f766e',
      imageUrl: SALON_IMAGE,
    };
  }

  const emedikBrand = emedikPublicBrandFor(host);
  if (emedikBrand) {
    const apotik = isApotikHost(host);
    return {
      title: apotik ? 'Apotik eMedik — Farmasi dan POS Apotik' : 'eMedik.id — Sistem Operasional Kesehatan',
      description: emedikBrand.description,
      siteName: emedikBrand.name,
      appName: emedikBrand.name,
      iconText: emedikBrand.logoText,
      themeColor: apotik ? '#0f766e' : '#2563eb',
      imageUrl: apotik ? APOTIK_IMAGE : EMEDIK_IMAGE,
    };
  }

  if (isEmedikHost(host)) {
    return {
      title: 'eMedik.id — Sistem Operasional Kesehatan',
      description:
        'Sistem operasional terpadu untuk rumah sakit, klinik, puskesmas, posyandu, dan apotik.',
      siteName: 'eMedik.id',
      appName: 'eMedik.id',
      iconText: 'eM',
      themeColor: '#2563eb',
      imageUrl: EMEDIK_IMAGE,
    };
  }

  return {
    title: 'eBisnis.id — Platform SaaS POS dan ERP Terintegrasi',
    description:
      'Satu aplikasi untuk kasir, toko, persediaan, pembelian, keuangan, SDM, dan monitoring seluruh bisnis Anda.',
    siteName: 'eBisnis.id',
    appName: 'eBisnis.id',
    iconText: 'eB',
    themeColor: '#0f766e',
    imageUrl: DEFAULT_IMAGE,
  };
}

export function applyTenantMetadata(meta: TenantMetadata, href = window.location.href) {
  document.title = meta.title;

  upsertMeta('name', 'description', meta.description);
  upsertMeta('name', 'application-name', meta.appName);
  upsertMeta('name', 'theme-color', meta.themeColor);
  upsertMeta('property', 'og:title', meta.title);
  upsertMeta('property', 'og:description', meta.description);
  upsertMeta('property', 'og:site_name', meta.siteName);
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:url', href);
  upsertMeta('property', 'og:image', meta.imageUrl);
  upsertMeta('name', 'twitter:card', 'summary_large_image');
  upsertMeta('name', 'twitter:title', meta.title);
  upsertMeta('name', 'twitter:description', meta.description);
  upsertMeta('name', 'twitter:image', meta.imageUrl);

  const icon = svgIcon(meta.iconText, meta.themeColor);
  upsertLink('icon', icon, 'image/svg+xml');
  upsertLink('apple-touch-icon', icon);
  upsertLink('canonical', href);
}

export function useTenantMetadata() {
  const location = useLocation();
  useEffect(() => {
    applyTenantMetadata(metadataForTenant(), window.location.href);
  }, [location.pathname, location.search, location.hash]);
}
