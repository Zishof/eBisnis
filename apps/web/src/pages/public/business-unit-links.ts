const BUSINESS_UNIT_DOMAIN_BY_LABEL: Record<string, string> = {
  Demo: 'demo.ebisnis.id',
  Barbershop: 'barbershop.ebisnis.id',
  Salon: 'salon.ebisnis.id',
  'Cuci Mobil': 'cucimobil.ebisnis.id',
  'Cuci Motor': 'cucimotor.ebisnis.id',
  Laundry: 'laundy.ebisnis.id',
  'Rental Kendaraan': 'rentalkendaraan.ebisnis.id',
  'Rental Sepeda': 'rentalsepeda.ebisnis.id',
  'Bengkel Motor': 'bengkelmotor.ebisnis.id',
  'Bengkel Mobil': 'bengkelmobil.ebisnis.id',
  'Bengkel Sepeda': 'bengkelsepeda.ebisnis.id',
  Apotek: 'apotik.emedik.id',
  'Inventory Obat': 'inventory.ebisnis.id',
  Restoran: 'restoran.ebisnis.id',
  Kuliner: 'kuliner.ebisnis.id',
  Kafe: 'cafe.ebisnis.id',
  Fashion: 'fasion.ebisnis.id',
  'Toko Kelontong': 'toko.ebisnis.id',
  Warteg: 'warteg.ebisnis.id',
  'Fitness & Spa': 'fitnes.ebisnis.id',
  Fitnes: 'fitnes.ebisnis.id',
  Spa: 'spa.ebisnis.id',
  'Pertanian Olahan': 'olahanpertanian.ebisnis.id',
  'Toko Pertanian': 'tokopertanian.ebisnis.id',
  'Jasa Umum': 'jasa.ebisnis.id',
  Katering: 'katering.ebisnis.id',
  'Online Shop': 'onlineshop.ebisnis.id',
  'Kosmetik & Skincare': 'kosmetik.ebisnis.id',
  Minimarket: 'minimarket.ebisnis.id',
  Kerajinan: 'kerajinan.ebisnis.id',
  'Rental Alat': 'rentalalat.ebisnis.id',
  'Event Organizer': 'eventorganizer.ebisnis.id',
  'Toko Bangunan': 'tokobangunan.ebisnis.id',
  Percetakan: 'percetakan.ebisnis.id',
  Optik: 'optik.ebisnis.id',
  'Klinik Kecil': 'klinik.emedik.id',
  'Toko Elektronik': 'tokoelektronik.ebisnis.id',
  'Jasa Kebersihan': 'jasakebersihan.ebisnis.id',
  Agribisnis: 'agribisnis.ebisnis.id',
  'Fotokopi dan Print': 'fotokopi.ebisnis.id',
  'Frozen Food': 'frozenfood.ebisnis.id',
  'Toko ATK': 'tokoatk.ebisnis.id',
  'Toko HP dan Aksesoris': 'tokohp.ebisnis.id',
  'Pet Shop': 'petshop.ebisnis.id',
  'Cuci Sepatu': 'cucisepatu.ebisnis.id',
  'Depot Air Minum': 'depotair.ebisnis.id',
  'Travel dan Tour': 'travel.ebisnis.id',
  'Homestay dan Penginapan': 'homestay.ebisnis.id',
  'Kursus dan Bimbel': 'kursus.ebisnis.id',
  'Daycare dan PAUD': 'daycare.ebisnis.id',
  'Bakery dan Toko Roti': 'bakery.ebisnis.id',
  'Toko Alat Kesehatan': 'alatkesehatan.ebisnis.id',
  'Toko Buku': 'tokobuku.ebisnis.id',
  'Florist dan Toko Bunga': 'florist.ebisnis.id',
  'Konveksi dan Jahit': 'konveksi.ebisnis.id',
  'Furniture dan Mebel': 'furniture.ebisnis.id',
  'Toko Mainan': 'tokomainan.ebisnis.id',
  'Baby Shop': 'babyshop.ebisnis.id',
  'Studio Foto dan Fotografi': 'fotografi.ebisnis.id',
  'Wedding Organizer': 'weddingorganizer.ebisnis.id',
  'Toko Emas dan Perhiasan': 'tokoemas.ebisnis.id',
};

export const DOMAIN_CONTOH_USAHA = BUSINESS_UNIT_DOMAIN_BY_LABEL;

const BUSINESS_UNIT_LABEL_BY_HOST = new Map(
  Object.entries(BUSINESS_UNIT_DOMAIN_BY_LABEL).map(([label, host]) => [host, label]),
);

function cleanHost(hostname: string): string {
  return hostname.toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

export function businessUnitDomainForLabel(label: string): string | undefined {
  return BUSINESS_UNIT_DOMAIN_BY_LABEL[label];
}

export function tautanWebsiteContohUsaha(item: { label: string; href: string }): string {
  const domain = businessUnitDomainForLabel(item.label);
  return domain ? `https://${domain}` : item.href;
}

export function businessUnitLabelFromHost(hostname: string = window.location.hostname): string | null {
  const host = cleanHost(hostname);
  const exact = BUSINESS_UNIT_LABEL_BY_HOST.get(host);
  if (exact) return exact;

  for (const [label, unitHost] of Object.entries(BUSINESS_UNIT_DOMAIN_BY_LABEL)) {
    const [unitSlug, ...rest] = unitHost.split('.');
    const baseDomain = rest.join('.');
    if (baseDomain && host.endsWith(`-${unitSlug}.${baseDomain}`)) return label;
  }

  return null;
}

export function isBusinessUnitHost(hostname: string = window.location.hostname): boolean {
  return businessUnitLabelFromHost(hostname) !== null;
}

export function businessTenantLabelFromHost(hostname: string = window.location.hostname): string | null {
  const host = cleanHost(hostname);
  const exactLabel = BUSINESS_UNIT_LABEL_BY_HOST.get(host);
  if (exactLabel) return exactLabel;

  for (const unitHost of Object.values(BUSINESS_UNIT_DOMAIN_BY_LABEL)) {
    const [unitSlug, ...rest] = unitHost.split('.');
    const baseDomain = rest.join('.');
    const suffix = `-${unitSlug}.${baseDomain}`;
    if (baseDomain && host.endsWith(suffix)) {
      const tenantSlug = host.slice(0, -suffix.length);
      return titleizeTenantSlug(tenantSlug);
    }
  }

  return null;
}

function titleizeTenantSlug(slug: string): string {
  const known: Record<string, string> = {
    cmnmedika: 'Caruban Medika Nusantara',
  };

  return (
    known[slug] ??
    slug
      .split(/[-.]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}
