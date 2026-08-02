/**
 * Token portal pendaftar PSB -- disimpan TERPISAH dari token staf
 * (`ebisnis.refresh` di `lib/api.ts`), kunci `sessionStorage` sendiri,
 * supaya kedua sistem auth (staf vs. calon santri, lihat
 * `psb-applicant-auth.guard.ts` di backend) tidak pernah bentrok di
 * peramban yang sama -- mis. pengurus membuka portal pendaftar di tab lain
 * tanpa kehilangan sesi login stafnya, atau sebaliknya.
 *
 * `sessionStorage`, BUKAN `localStorage` -- pola sama dengan refresh token
 * staf (ADR-006): token yang memberi akses tulis data orang lain tidak
 * boleh bertahan lebih lama dari tab yang membukanya.
 */

const STORAGE_KEY = 'ebisnis.psbApplicantToken';

export function getPsbApplicantToken(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  return sessionStorage.getItem(STORAGE_KEY);
}

export function setPsbApplicantToken(token: string): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearPsbApplicantToken(): void {
  if (typeof sessionStorage === 'undefined') return;
  sessionStorage.removeItem(STORAGE_KEY);
}
