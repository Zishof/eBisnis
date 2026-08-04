export const EDUCATION_DOMAIN = 'enterprise-education.id';

function normalisasiHost(host = window.location.hostname) {
  return host
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');
}

export function isEducationPublicHost(host = window.location.hostname) {
  const h = normalisasiHost(host);
  return h === EDUCATION_DOMAIN || h === `www.${EDUCATION_DOMAIN}`;
}

export function educationPublicBrandFor(host = window.location.hostname) {
  if (!isEducationPublicHost(host)) return null;

  return {
    logoText: 'eE',
    name: 'Enterprise Education',
    homeUrl: `https://${EDUCATION_DOMAIN}`,
    description:
      'Satu platform pendidikan untuk sekolah, madrasah, pesantren, kampus, unit usaha, wali, dan layanan digital lembaga.',
    registerCtaLabel: 'Konsultasi',
    headerItems: [
      { labelKey: 'education.solution', label: 'Solusi', url: '/#solusi', sortOrder: 1 },
      { labelKey: 'education.workflow', label: 'Alur', url: '/#alur', sortOrder: 2 },
      { labelKey: 'education.media', label: 'Media', url: '/#media', sortOrder: 3 },
      { labelKey: 'education.documents', label: 'Dokumen', url: '/#dokumen', sortOrder: 4 },
      { labelKey: 'education.demo', label: 'Demo', url: '/masuk', sortOrder: 5 },
    ],
    footer: [
      {
        code: 'EDUCATION',
        title: 'Pendidikan',
        items: [
          { label: 'Sekolah dan madrasah', url: '/#solusi' },
          { label: 'Pesantren', url: 'https://santri.info' },
          { label: 'PPDB/PSB', url: '/#alur' },
        ],
      },
      {
        code: 'DOCUMENTS',
        title: 'Dokumen',
        items: [
          { label: 'Proposal Penawaran', url: '/proposal' },
          { label: 'Surat Penawaran', url: '/penawaran' },
          { label: 'Presentasi', url: '/presentasi' },
          { label: 'Draft PKS', url: '/pks' },
        ],
      },
    ],
  };
}
