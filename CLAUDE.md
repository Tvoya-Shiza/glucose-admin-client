# CLAUDE.md (glucose-admin-client)

## Project

Glucose admin panel — Next.js 16.2 LTS + React 19 + Tailwind v4 + shadcn/ui v4 + next-intl 4.9 (RU/KZ).

Server: `next dev -p 4100` (or `next start -p 4100` in prod). Talks to glucose-admin-api on port 4101 (configured in Phase 2).

## Critical conventions

- **App Router only.** No Pages Router fallbacks.
- **`src/` layout** with `@/*` import alias resolving to `src/*`.
- **All routes are locale-prefixed.** Pages live under `src/app/[locale]/`. The bare root `src/app/page.tsx` does not exist; bare paths redirect to `/ru/` via `localePrefix: 'as-needed'`.
- **Locales are `'ru'` (default) and `'kz'`.** Note: `'kz'` is what we use in URLs and message catalog filenames; CLDR's official Kazakh code is `'kk'`. If you need `Intl.PluralRules`/`Intl.DateTimeFormat`, remap `'kz'` → `'kk-KZ'` at the BCP-47 boundary. Do not rename our directory/cookie/URL convention.
- **No state in the browser for auth.** Phase 2 will add a BFF cookie pattern: JWT lives in an httpOnly cookie set by Next.js Route Handlers; middleware verifies via `jose.jwtVerify`. Phase 0's `middleware.ts` is a thin next-intl pass-through — do NOT add auth logic here yet.
- **All server-state goes through TanStack Query.** Local UI state via `useState`. URL filter state via `nuqs` (added in Phase 3). Don't reach for Redux Toolkit.
- **shadcn/ui only.** Don't install Material UI, Mantine, Chakra, Ant Design, or any other "kit" UI. Components are vendored under `src/components/ui/` — we own the code.
- **BigInt-as-string from admin-api.** When admin-api responses include big integer fields, they are JSON strings. Do NOT call `Number(value)` on them; treat them as opaque IDs.

## Code style

Prettier config (`.prettierrc`):
- 4-space indents, single quotes, semis, 140-col print width — mirrors glucose-api.
- **Diverges from glucose-api**: `bracketSameLine: false` for JSX (closing `>` on its own line for multiline JSX). This is intentional; don't "fix" it.

## What lands in which phase

- Phase 0 (this): bootstrap, locale routing, placeholder home, TanStack Query Provider, shadcn primitives (button, card, sonner).
- Phase 2: login page, BFF route handlers (`app/api/proxy/[...path]/route.ts`), Edge middleware with jose JWT verification, login UI in RU/KZ, refresh-token rotation.
- Phase 3: Users page (reference DataTable + nuqs + bulk actions + audit-aware mutations).
- Phase 5: Tiptap editor + dnd-kit drag-drop.
- Phase 9: Recharts dashboards.

## Forbidden

- Removing `src/i18n/routing.ts` or changing `localePrefix` without team review.
- Storing JWTs in `localStorage` or any other browser-readable storage.
- Bypassing the BFF proxy (Phase 2+) by calling admin-api directly from the browser. The browser must NEVER send a Bearer token to admin-api.

## Shared types

Cross-repo TypeScript types live in `glucose-api/shared-types/` (canonical).
A vendored copy lives at `vendor/shared-types/` here, populated by
`scripts/sync-shared-types.sh` from the project root.

Import via the path alias `@shared/*` configured in `tsconfig.json`.

Workflow + CI: same as glucose-admin-api. See `glucose-api/shared-types/README.md`.

DO NOT edit `vendor/shared-types/` directly. Edit canonical, then run sync.

## Commands

```bash
npm install
npm run dev          # next dev --turbopack -p 4100
npm run build
npm run start        # next start -p 4100 (or PORT env)
npm run lint
npm run format
```
