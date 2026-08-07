/**
 * Pengujian sanitasi rich text (pertahanan stored XSS).
 */

import { sanitizeRichText } from './rich-text-sanitizer';

describe('sanitizeRichText', () => {
  it('membuang tag <script>', () => {
    expect(sanitizeRichText('<p>Halo</p><script>alert(1)</script>')).toBe('<p>Halo</p>');
  });

  it('membuang event handler HTML seperti onerror/onclick', () => {
    expect(sanitizeRichText('<img src="x" onerror="alert(1)">')).not.toContain('onerror');
    expect(sanitizeRichText('<p onclick="alert(1)">Klik</p>')).not.toContain('onclick');
  });

  it('membuang skema javascript: pada href/src', () => {
    expect(sanitizeRichText('<a href="javascript:alert(1)">tautan</a>')).not.toContain('javascript:');
  });

  it('membuang tag iframe/style bebas', () => {
    const bersih = sanitizeRichText('<iframe src="https://evil.example"></iframe><style>body{display:none}</style>');
    expect(bersih).not.toContain('<iframe');
    expect(bersih).not.toContain('<style');
  });

  it('mempertahankan format teks yang aman', () => {
    const html = '<p>Kabar <strong>pondok</strong> minggu ini.</p><ul><li>Satu</li></ul>';
    expect(sanitizeRichText(html)).toBe(html);
  });

  it('mempertahankan tautan aman dan menambah rel="noopener noreferrer"', () => {
    const bersih = sanitizeRichText('<a href="https://contoh.id">kunjungi</a>');
    expect(bersih).toContain('href="https://contoh.id"');
    expect(bersih).toContain('rel="noopener noreferrer"');
  });
});
