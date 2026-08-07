import sanitizeHtml from 'sanitize-html';

/** Whitelist rich text — tidak ada script, event handler, iframe, atau style bebas. */
export const RICH_TEXT_POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'strong', 'em', 'u', 's', 'blockquote', 'ul', 'ol', 'li',
    'h2', 'h3', 'h4', 'h5', 'a', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'code', 'pre',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https', 'data'] },
  disallowedTagsMode: 'discard',
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
  },
};

export function sanitizeRichText(html: string): string {
  return sanitizeHtml(html, RICH_TEXT_POLICY);
}
