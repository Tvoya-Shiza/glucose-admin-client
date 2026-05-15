/**
 * Resolve an upload URL for `<img src>` / `<video src>` consumption.
 *
 * admin-api stores file_url as a RELATIVE path (e.g. `/static/courses/<ulid>.jpg`)
 * so the same DB row works across environments — in prod behind one nginx, in
 * dev behind admin-client (4100) + admin-api (4005) cross-origin, in staging
 * behind a CDN. The host is decided at render time by the consuming client.
 *
 * Rules:
 *   - absolute URLs (http:// or https://) pass through unchanged
 *   - empty / null / undefined returns ''
 *   - relative paths are prefixed with NEXT_PUBLIC_ADMIN_API_URL (or '' for
 *     same-origin in prod)
 *
 * Use this anywhere you render an uploaded asset URL — preview boxes, table
 * thumbnails, story/banner display, Tiptap image renderers. The student app
 * should keep an identical helper using its own NEXT_PUBLIC_* var.
 */
const ASSET_ORIGIN = process.env.NEXT_PUBLIC_ADMIN_API_URL ?? '';

export function resolveAssetUrl(url: string | null | undefined): string {
    if (!url) return '';
    if (/^https?:\/\//i.test(url)) return url;
    return `${ASSET_ORIGIN}${url}`;
}
