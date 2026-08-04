/**
 * Host publik produk Inventory eBisnis.
 *
 * Mendukung `demo-inventory.ebisnis.id` untuk sandbox bersama dan pola
 * `<tenant>-inventory.ebisnis.id` / `<tenant>.inventory.ebisnis.id` untuk
 * calon tenant yang ingin alamat produk inventory sendiri.
 */

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function isInventoryHost(hostname: string = window.location.hostname): boolean {
  const host = cleanHost(hostname);
  return (
    host === 'demo-inventory.ebisnis.id' ||
    host.endsWith('-inventory.ebisnis.id') ||
    host.endsWith('.inventory.ebisnis.id')
  );
}

export function inventoryRootRedirectFor(
  hostname: string = window.location.hostname,
  pathname = '/',
): string | null {
  if (!isInventoryHost(hostname)) return null;
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/' || path === '/a' || path === '/ebisnis/a' ? '/inventory' : null;
}

export function inventoryTenantLabelFromHost(hostname: string = window.location.hostname): string {
  const host = cleanHost(hostname);
  if (host === 'demo-inventory.ebisnis.id') return 'Demo Inventory Obat';

  const tenantSlug = host.endsWith('.inventory.ebisnis.id')
    ? host.replace(/\.inventory\.ebisnis\.id$/, '')
    : host.replace(/-inventory\.ebisnis\.id$/, '');

  return tenantSlug
    .split(/[-.]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
