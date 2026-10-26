import sanitizeHtml from 'sanitize-html';

/**
 * Blog content is rich HTML written in the admin editor and shown to every visitor,
 * so it is cleaned on the server before it is stored — never trust the editor alone.
 * Only an allow-list of formatting tags survives; scripts, styles, event handlers,
 * iframes, forms and javascript:/data: URLs are all removed. Links get
 * rel="noopener noreferrer"; images are lazy-loaded.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2', 'h3', 'h4', 'p', 'br', 'hr', 'blockquote', 'pre', 'code',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
    'ul', 'ol', 'li', 'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
  },
  // No data: or javascript: URLs (pasted base64 images are dropped; the editor uploads instead).
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  allowProtocolRelative: false,
  disallowedTagsMode: 'discard',
  transformTags: {
    // contentEditable wraps lines in divs and uses h1; map them onto safe tags.
    div: 'p',
    h1: 'h2',
    a: (tagName, attribs) => {
      const out: Record<string, string> = { ...attribs };
      if (out.target === '_blank') out.rel = 'noopener noreferrer';
      else delete out.target;
      if (out.href) out.rel = out.rel || 'noopener';
      return { tagName, attribs: out };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: 'lazy' } }),
  },
};

export function sanitizeBlogHtml(html: string): string {
  return sanitizeHtml(html, OPTIONS).trim();
}
