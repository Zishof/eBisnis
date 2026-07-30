import { buildEmbedUrl, parseYoutubeUrl } from './youtube.util';

const VALID_ID = 'dQw4w9WgXcQ';

describe('parseYoutubeUrl', () => {
  describe('bentuk yang diterima', () => {
    const forms = [
      `https://www.youtube.com/watch?v=${VALID_ID}`,
      `https://youtube.com/watch?v=${VALID_ID}`,
      `https://m.youtube.com/watch?v=${VALID_ID}`,
      `https://youtu.be/${VALID_ID}`,
      `https://www.youtube.com/embed/${VALID_ID}`,
      `https://www.youtube.com/shorts/${VALID_ID}`,
      `https://www.youtube.com/live/${VALID_ID}`,
      `https://www.youtube-nocookie.com/embed/${VALID_ID}`,
    ];

    it.each(forms)('mengekstrak id dari %s', (url) => {
      expect(parseYoutubeUrl(url)).toMatchObject({ ok: true, videoId: VALID_ID });
    });

    it('mengabaikan parameter tambahan', () => {
      const result = parseYoutubeUrl(`https://www.youtube.com/watch?v=${VALID_ID}&t=42&list=PLabc`);
      expect(result).toMatchObject({ ok: true, videoId: VALID_ID });
    });
  });

  describe('alamat dibangun sistem, bukan dari input', () => {
    it('selalu memakai domain nocookie apa pun bentuk masukannya', () => {
      // Inilah yang menutup R21: apa pun yang dikirim penjual tidak pernah
      // menjadi bagian dari HTML. Yang disimpan hanya id, dan alamatnya
      // dibentuk sistem.
      const result = parseYoutubeUrl(`http://m.youtube.com/watch?v=${VALID_ID}&x=<script>`);
      expect(result.embedUrl).toBe(`https://www.youtube-nocookie.com/embed/${VALID_ID}`);
      expect(result.embedUrl).not.toContain('script');
      expect(result.embedUrl).not.toContain('m.youtube');
    });

    it('membangun alamat sampul dari id yang sama', () => {
      expect(parseYoutubeUrl(`https://youtu.be/${VALID_ID}`).thumbnailUrl).toBe(
        `https://i.ytimg.com/vi/${VALID_ID}/hqdefault.jpg`,
      );
    });
  });

  describe('protokol berbahaya', () => {
    const dangerous = [
      'javascript:alert(1)',
      'javascript:void(0)',
      'data:text/html,<script>alert(1)</script>',
      'file:///etc/passwd',
      'vbscript:msgbox(1)',
    ];

    it.each(dangerous)('menolak %s', (url) => {
      const result = parseYoutubeUrl(url);
      expect(result.ok).toBe(false);
    });
  });

  describe('host yang bukan YouTube', () => {
    const impostors = [
      'https://evil.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ',
      'https://notyoutube.com/watch?v=dQw4w9WgXcQ',
      'https://youtube.evil.com/watch?v=dQw4w9WgXcQ',
      'https://fakeyoutu.be/dQw4w9WgXcQ',
    ];

    it.each(impostors)('menolak %s', (url) => {
      expect(parseYoutubeUrl(url)).toMatchObject({ ok: false });
    });

    it('menyebut host yang ditolak pada alasannya', () => {
      expect(parseYoutubeUrl('https://evil.com/watch?v=dQw4w9WgXcQ').reason).toMatch(/evil\.com/);
    });
  });

  describe('bentuk yang menyesatkan', () => {
    it('menolak URL yang memuat kredensial', () => {
      // "youtube.com@evil.com" dibaca sebagai host evil.com oleh pengurai URL,
      // tetapi terlihat seperti youtube.com bagi pembaca manusia.
      expect(parseYoutubeUrl(`https://youtube.com@evil.com/watch?v=${VALID_ID}`).ok).toBe(false);
    });

    it('menolak URL yang sangat panjang', () => {
      expect(parseYoutubeUrl(`https://youtube.com/watch?v=${VALID_ID}&x=${'a'.repeat(3000)}`).ok).toBe(
        false,
      );
    });
  });

  describe('id yang tidak sah', () => {
    it('menolak id terlalu pendek', () => {
      expect(parseYoutubeUrl('https://youtu.be/abc').ok).toBe(false);
    });

    it('menolak id terlalu panjang', () => {
      expect(parseYoutubeUrl('https://youtu.be/abcdefghijklmnop').ok).toBe(false);
    });

    it('menolak id dengan karakter di luar base64url', () => {
      expect(parseYoutubeUrl('https://youtu.be/abc<script>d').ok).toBe(false);
    });

    it('menolak daftar putar tanpa video tunggal', () => {
      expect(parseYoutubeUrl('https://www.youtube.com/playlist?list=PLabc').ok).toBe(false);
    });

    it('menolak halaman kanal', () => {
      expect(parseYoutubeUrl('https://www.youtube.com/@namakanal').ok).toBe(false);
    });
  });

  describe('masukan kosong', () => {
    it.each([null, undefined, '', '   '])('menolak %p', (value) => {
      expect(parseYoutubeUrl(value as string).ok).toBe(false);
    });

    it('menolak yang bukan URL sama sekali', () => {
      expect(parseYoutubeUrl('bukan url').ok).toBe(false);
    });
  });
});

describe('buildEmbedUrl', () => {
  it('membangun alamat dari id yang sah', () => {
    expect(buildEmbedUrl(VALID_ID)).toBe(`https://www.youtube-nocookie.com/embed/${VALID_ID}`);
  });

  it('menolak id yang tidak sah alih-alih membangun alamat rusak', () => {
    for (const id of ['', 'pendek', 'terlalu-panjang-sekali', '<script>abc', '../../etc']) {
      expect(buildEmbedUrl(id)).toBeNull();
    }
  });
});
