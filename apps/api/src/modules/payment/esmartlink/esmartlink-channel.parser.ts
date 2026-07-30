/**
 * Parser konfigurasi channel legacy Esmartlink.
 *
 * Dikarakterisasi dari `docs/input/SmartlinkChannelWindow.java`:
 *   format  : "KODE:BIAYA_ADMIN:LABEL;KODE_LAIN:BIAYA:LABEL"
 *   perilaku: entri tidak lengkap / biaya bukan angka DILEWATI, bukan
 *             menggagalkan seluruh daftar channel;
 *             label kosong fallback ke kode channel.
 */

export interface ParsedLegacyChannel {
  code: string;
  adminFee: number;
  label: string;
}

export interface LegacyChannelParseResult {
  channels: ParsedLegacyChannel[];
  skipped: Array<{ raw: string; reason: string }>;
}

export function parseLegacyChannelEntry(entry: string): ParsedLegacyChannel | null {
  if (entry === null || entry === undefined) return null;
  const trimmed = entry.trim();
  if (!trimmed) return null;

  // StringUtils.split membuang segmen kosong, sehingga "A::B" menjadi ["A","B"].
  const parts = trimmed.split(':').filter((part) => part.length > 0);
  if (parts.length < 2) return null;

  const adminFee = Number.parseFloat(parts[1].trim());
  if (!Number.isFinite(adminFee)) return null;

  const code = parts[0].trim();
  if (!code) return null;

  const label = parts.length > 2 && parts[2].trim() ? parts[2].trim() : code;
  return { code, adminFee, label };
}

export function parseLegacyChannelConfig(config: string | null | undefined): LegacyChannelParseResult {
  const channels: ParsedLegacyChannel[] = [];
  const skipped: Array<{ raw: string; reason: string }> = [];

  if (!config) return { channels, skipped };

  for (const raw of config.split(';')) {
    if (!raw.trim()) continue;
    const parsed = parseLegacyChannelEntry(raw);
    if (parsed) {
      channels.push(parsed);
    } else {
      skipped.push({ raw: raw.trim(), reason: 'ENTRI_TIDAK_VALID' });
    }
  }

  return { channels, skipped };
}

/** Pilihan batas waktu pembayaran legacy dipetakan ke menit. */
export const LEGACY_EXPIRY_OPTIONS: Array<{ code: string; labelKey: string; minutes: number }> = [
  { code: 'MIN_15', labelKey: 'payment.expiry.min15', minutes: 15 },
  { code: 'MIN_30', labelKey: 'payment.expiry.min30', minutes: 30 },
  { code: 'HOUR_1', labelKey: 'payment.expiry.hour1', minutes: 60 },
  { code: 'HOUR_3', labelKey: 'payment.expiry.hour3', minutes: 180 },
  { code: 'HOUR_6', labelKey: 'payment.expiry.hour6', minutes: 360 },
  { code: 'HOUR_24', labelKey: 'payment.expiry.hour24', minutes: 1440 },
  { code: 'DAY_3', labelKey: 'payment.expiry.day3', minutes: 4320 },
  { code: 'WEEK_1', labelKey: 'payment.expiry.week1', minutes: 10080 },
  { code: 'MONTH_1', labelKey: 'payment.expiry.month1', minutes: 43200 },
];

export function resolveExpiryMinutes(code: string | undefined, fallbackMinutes = 1440): number {
  if (!code) return fallbackMinutes;
  return LEGACY_EXPIRY_OPTIONS.find((option) => option.code === code)?.minutes ?? fallbackMinutes;
}
