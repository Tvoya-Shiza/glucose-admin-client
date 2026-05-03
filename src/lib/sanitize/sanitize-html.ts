/**
 * Tiptap HTML sanitizer (used on save in Plan 05).
 *
 * Mitigates T-05-30 (XSS via Tiptap content): admin-authored content is
 * rendered in the student app; treat author input as untrusted at the
 * sanitization boundary even though authors are staff.
 *
 * Whitelist matches the chosen Tiptap StarterKit extension surface plus
 * link + image + code-block. Tighten/loosen as the editor's extension list
 * evolves.
 */
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
    'p',
    'br',
    'strong',
    'em',
    'u',
    's',
    'h1',
    'h2',
    'h3',
    'ul',
    'ol',
    'li',
    'a',
    'img',
    'pre',
    'code',
    'blockquote',
];

const ALLOWED_ATTR = ['href', 'src', 'alt', 'title', 'target', 'rel', 'class'];

export function sanitizeTiptapHtml(html: string): string {
    if (typeof window === 'undefined') {
        // Server-side path: DOMPurify needs jsdom on Node. The student app
        // re-sanitizes on render, but admin-api should also sanitize before
        // persistence (Plan 05's API path). For now, return as-is on server
        // — Plan 05's admin-api adds server-side sanitization with isomorphic-dompurify.
        return html;
    }
    return DOMPurify.sanitize(html, {
        ALLOWED_TAGS,
        ALLOWED_ATTR,
        ALLOW_DATA_ATTR: false,
        FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
        FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus'],
    });
}

/** Escape-hatch for tests / debugging. Do NOT call from production code. */
export const __SANITIZE_INTERNAL = { ALLOWED_TAGS, ALLOWED_ATTR };
