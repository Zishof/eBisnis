import { AppError, ErrorCodes } from '../../common/errors/app-error';

/**
 * Regex final untuk nama schema tenant. Identifier apa pun yang tidak lolos
 * regex ini TIDAK BOLEH pernah dirangkai ke dalam SQL.
 */
export const SCHEMA_NAME_REGEX = /^[a-z][a-z0-9_]{2,47}$/;

export const RESERVED_SCHEMA_NAMES = new Set([
  'public',
  'platform',
  'platform__audit',
  'demo',
  'demo__audit',
  'postgres',
  'information_schema',
  'pg_catalog',
  'pg_toast',
  'pg_temp',
  'root',
  'admin',
  'system',
  'tenant_template',
]);

const TRANSLITERATION: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ä: 'a', ã: 'a', å: 'a', ā: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e', ē: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i', ī: 'i',
  ó: 'o', ò: 'o', ô: 'o', ö: 'o', õ: 'o', ø: 'o', ō: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u', ū: 'u',
  ñ: 'n', ç: 'c', ý: 'y', ÿ: 'y', š: 's', ž: 'z', đ: 'd', ß: 'ss',
};

/**
 * Algoritma normalisasi nama schema (Bagian 11.4 master prompt):
 *  1. trim
 *  2. transliterasi karakter Latin yang wajar
 *  3. lowercase
 *  4. spasi dan tanda hubung menjadi `_`
 *  5. hapus karakter selain a-z, 0-9, `_`
 *  6. gabungkan underscore berulang
 *  7. harus diawali huruf
 *  8. panjang 3–48 karakter
 */
export function normalizeSchemaName(input: string): string {
  let value = (input ?? '').trim().toLowerCase();

  value = value
    .split('')
    .map((ch) => TRANSLITERATION[ch] ?? ch)
    .join('');

  value = value.normalize('NFD').replace(/[̀-ͯ]/g, '');
  value = value.replace(/[\s-]+/g, '_');
  value = value.replace(/[^a-z0-9_]/g, '');
  value = value.replace(/_{2,}/g, '_');
  value = value.replace(/^_+/, '').replace(/_+$/, '');

  return value;
}

export interface SchemaNameValidation {
  valid: boolean;
  normalized: string;
  auditName: string;
  errorCode?: string;
  message?: string;
  suggestions?: string[];
}

export interface SchemaNameOptions {
  auditSuffix?: string;
  /**
   * Nama yang boleh melewati daftar reserved. HANYA untuk schema sistem yang
   * diprovision internal (mis. `demo`). Tidak pernah berasal dari input pengguna.
   */
  allowReserved?: string[];
}

export function validateSchemaName(
  input: string,
  auditSuffixOrOptions: string | SchemaNameOptions = '__audit',
): SchemaNameValidation {
  const options: SchemaNameOptions =
    typeof auditSuffixOrOptions === 'string'
      ? { auditSuffix: auditSuffixOrOptions }
      : auditSuffixOrOptions;
  const auditSuffix = options.auditSuffix ?? '__audit';
  const allowReserved = new Set(options.allowReserved ?? []);

  const normalized = normalizeSchemaName(input);
  const auditName = `${normalized}${auditSuffix}`;

  if (!normalized) {
    return {
      valid: false,
      normalized,
      auditName,
      errorCode: ErrorCodes.INVALID_SCHEMA_NAME,
      message: 'Nama pengguna tidak menghasilkan nama schema yang valid.',
    };
  }

  // `pg_` selalu ditolak, tanpa pengecualian.
  if (normalized.startsWith('pg_')) {
    return {
      valid: false,
      normalized,
      auditName,
      errorCode: ErrorCodes.RESERVED_SCHEMA_NAME,
      message: 'Nama yang diawali "pg_" tidak diizinkan.',
    };
  }

  const isReserved =
    (RESERVED_SCHEMA_NAMES.has(normalized) && !allowReserved.has(normalized)) ||
    (RESERVED_SCHEMA_NAMES.has(auditName) && !allowReserved.has(normalized));

  if (isReserved) {
    return {
      valid: false,
      normalized,
      auditName,
      errorCode: ErrorCodes.RESERVED_SCHEMA_NAME,
      message: 'Nama tersebut merupakan nama yang dicadangkan sistem.',
      suggestions: buildSuggestions(normalized),
    };
  }

  if (!SCHEMA_NAME_REGEX.test(normalized)) {
    return {
      valid: false,
      normalized,
      auditName,
      errorCode: ErrorCodes.INVALID_SCHEMA_NAME,
      message:
        'Nama schema harus diawali huruf, hanya berisi huruf kecil, angka, dan garis bawah, dengan panjang 3–48 karakter.',
      suggestions: buildSuggestions(normalized),
    };
  }

  return { valid: true, normalized, auditName };
}

export function assertValidSchemaName(input: string, auditSuffix = '__audit'): string {
  const result = validateSchemaName(input, auditSuffix);
  if (!result.valid) {
    throw AppError.badRequest(
      result.errorCode ?? ErrorCodes.INVALID_SCHEMA_NAME,
      result.message ?? 'Nama schema tidak valid.',
      { suggestions: result.suggestions ?? [] },
    );
  }
  return result.normalized;
}

function buildSuggestions(base: string): string[] {
  const seed = base && /^[a-z]/.test(base) ? base : `biz_${base}`;
  const trimmed = seed.slice(0, 40).replace(/_+$/, '') || 'bisnis';
  return [`${trimmed}_id`, `${trimmed}_group`, `${trimmed}_${new Date().getFullYear()}`].filter(
    (candidate) => SCHEMA_NAME_REGEX.test(candidate) && !RESERVED_SCHEMA_NAMES.has(candidate),
  );
}

/**
 * Quoting identifier PostgreSQL yang aman. Hanya menerima identifier yang telah
 * lolos regex. Jangan pernah memakai concatenation string biasa.
 */
export function quoteIdentifier(identifier: string): string {
  if (!/^[a-z][a-z0-9_]{2,71}$/.test(identifier)) {
    throw AppError.badRequest(
      ErrorCodes.INVALID_SCHEMA_NAME,
      `Identifier tidak valid: ${identifier}`,
    );
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}
