import { normalizeProductIdentity, productPlaceholder } from './product-media.service';

describe('ProductMediaService identity and fallback', () => {
  it('normalizes equivalent product names to one shared identity', () => {
    expect(normalizeProductIdentity('  Bodrex Extra  ')).toBe('BODREX EXTRA');
    expect(normalizeProductIdentity('Bodrex-Extra')).toBe('BODREX EXTRA');
  });

  it('creates deterministic safe SVG bytes for products without a curated packshot', () => {
    const first = productPlaceholder('Produk <contoh>', 'CMN-001');
    const second = productPlaceholder('Produk <contoh>', 'CMN-001');
    expect(first.equals(second)).toBe(true);
    expect(first.toString('utf8')).toContain('Produk &lt;contoh&gt;');
    expect(first.toString('utf8')).not.toContain('<contoh>');
  });
});
