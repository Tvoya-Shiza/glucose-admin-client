/**
 * Parses a user-supplied URL (or raw <iframe> snippet) into a normalized video
 * reference that maps cleanly onto the existing `Files.storage` enum values
 * (`youtube | vimeo | iframe`).
 *
 * Used by the course content upsert dialog (Phase 13 Plan — video URL subtype)
 * so admins can paste:
 *   - https://www.youtube.com/watch?v=ABC123     → embed at /embed/ABC123
 *   - https://youtu.be/ABC123                    → embed at /embed/ABC123
 *   - https://vimeo.com/12345                    → player.vimeo.com/video/12345
 *   - https://www.youtube.com/embed/ABC123       → kept as-is, storage='youtube'
 *   - <iframe src="https://example.com/..." ...> → src extracted, storage='iframe'
 *   - https://anything.else/foo                  → storage='iframe', file=URL
 *
 * No backend changes — the Files row uses (storage, file) as it does for uploads.
 */

export type VideoStorage = 'youtube' | 'vimeo' | 'iframe';

export interface ParsedVideoUrl {
    /** Maps directly onto Files.storage. */
    storage: VideoStorage;
    /** Final URL to store in Files.file (or render via <iframe src>). */
    file: string;
}

const YT_LONG = /youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{6,})/i;
const YT_SHORT = /youtu\.be\/([A-Za-z0-9_-]{6,})/i;
const YT_EMBED = /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/i;
const VIMEO = /vimeo\.com\/(?:.*\/)?([0-9]{4,})/i;
const VIMEO_PLAYER = /player\.vimeo\.com\/video\/([0-9]{4,})/i;
const IFRAME_SRC = /<iframe[^>]*\bsrc=["']([^"']+)["'][^>]*>/i;

export function parseVideoUrl(input: string): ParsedVideoUrl | null {
    const raw = input.trim();
    if (raw.length === 0) return null;

    // Raw <iframe …> HTML — extract src and recurse so the inner URL gets the right
    // storage tag (a YouTube embed src still resolves to storage='youtube').
    if (raw.startsWith('<iframe')) {
        const m = raw.match(IFRAME_SRC);
        if (m && m[1]) return parseVideoUrl(m[1]);
        return null;
    }

    // YouTube — normalize to /embed/<id> for predictable rendering.
    const ytLong = raw.match(YT_LONG);
    if (ytLong) return { storage: 'youtube', file: `https://www.youtube.com/embed/${ytLong[1]}` };
    const ytShort = raw.match(YT_SHORT);
    if (ytShort) return { storage: 'youtube', file: `https://www.youtube.com/embed/${ytShort[1]}` };
    const ytEmbed = raw.match(YT_EMBED);
    if (ytEmbed) return { storage: 'youtube', file: `https://www.youtube.com/embed/${ytEmbed[1]}` };

    // Vimeo — normalize to player.vimeo.com/video/<id>.
    const vimeoPlayer = raw.match(VIMEO_PLAYER);
    if (vimeoPlayer) return { storage: 'vimeo', file: `https://player.vimeo.com/video/${vimeoPlayer[1]}` };
    const vimeo = raw.match(VIMEO);
    if (vimeo) return { storage: 'vimeo', file: `https://player.vimeo.com/video/${vimeo[1]}` };

    // Fallback — must be an http(s) URL to be considered an iframe target.
    if (/^https?:\/\//i.test(raw)) {
        return { storage: 'iframe', file: raw };
    }
    return null;
}
