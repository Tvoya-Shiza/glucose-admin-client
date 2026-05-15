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

## Auth + BFF cookie flow (Phase 2)

### Cookie names

Both cookies are HttpOnly + SameSite=Lax + Secure (prod) + Path=/ + no Domain attr (host-only on the deployed admin subdomain).
- `glc_admin_at` — access token (15-minute TTL)
- `glc_admin_rt` — refresh token (7-day TTL)

Cookies are set ONLY by Next.js Route Handlers under `src/app/api/auth/*` — never by middleware, never by RSCs, never by Client Components.

### Edge middleware (`middleware.ts`)

Composes `adminMiddleware` BEFORE the next-intl middleware:
1. Public paths (`/login`, `/[locale]/login`, `/favicon.ts`) skip the auth check and delegate to next-intl for locale rewriting.
2. Protected paths read `glc_admin_at` and call `verifyAdminJwt(token)` (jose.jwtVerify with HS256 + JWT_ADMIN_SECRET).
3. On verification failure → `NextResponse.redirect` to `/[locale]/login?next=<original-path>`.
4. On success → delegate to next-intl.

Middleware NEVER sets cookies (AUTH-08 rule).

### BFF Route Handlers (`src/app/api/auth/*` + `/api/proxy/[...path]`)

- `POST /api/auth/login` — forwards `{email, password}` body to `admin-api /admin-api/auth/login` server-to-server, mirrors upstream Set-Cookie headers onto the browser response.
- `POST /api/auth/refresh` — reads `glc_admin_rt` via `cookies()`, forwards to `admin-api /admin-api/auth/refresh` as `{refresh_token}` body, mirrors new Set-Cookie.
- `POST /api/auth/logout` — calls upstream + ALWAYS clears both cookies on the browser response (idempotent). Body is `{refresh_token}` when the cookie exists; `{}` when no cookie (per upstream LogoutDto contract — never `null`).
- `GET /api/auth/me` — forwards `glc_admin_at` as `Authorization: Bearer ...` to `admin-api /admin-api/auth/me`.
- `/api/proxy/[...path]` (GET/POST/PUT/PATCH/DELETE) — generic BFF proxy. Reads `glc_admin_at` via `cookies()` and attaches it as Bearer to the admin-api call. Does NOT forward request cookies. Streams the body for non-GET requests.

The admin-api URL is read from `process.env.ADMIN_API_URL` (no `NEXT_PUBLIC_` prefix). The helper at `src/lib/auth/admin-api-client.ts` is marked `import 'server-only'` so it cannot be bundled into client code.

**Proxy header pass-through trade-offs (Phase 2):** The `/api/proxy/[...path]` route copies ONLY `Content-Type` from the upstream response. `Cache-Control`, `ETag`, `Last-Modified`, and other caching headers are NOT forwarded by the proxy in Phase 2 — revisit if Phase 3+ list endpoints need browser caching. The trade-off is intentional: the proxy owns response shaping (cookie management, Bearer-token confidentiality), and any header pass-through must be explicit + audited.

### Client-side wrappers

- `src/lib/auth/refresh-on-401.ts` exports `fetchWithRefresh(input, init)` — retries ONCE on 401 by hitting `/api/auth/refresh`; on terminal 401 redirects to `/[locale]/login?next=...`. Concurrent 401s coalesce on a single in-flight refresh.
- All TanStack Query queries that call `/api/proxy/*` or `/api/auth/me` use `fetchWithRefresh` as the queryFn.

### Login UI

- `src/app/[locale]/login/page.tsx` — server component, bilingual via `getTranslations('login')`.
- `src/app/[locale]/login/login-form.tsx` — client component, react-hook-form + zod + shadcn `Form/Input/Label/Button` + sonner toast for errors.
- `?next=` query param is sanitized to start with `/` (open-redirect guard).

### Files (Phase 2)

- `middleware.ts` (replaced Phase 0 next-intl pass-through)
- `src/lib/auth/{cookies,jwt-verify,middleware-compose,refresh-on-401,admin-api-client}.ts`
- `src/app/api/auth/{login,refresh,logout,me}/route.ts`
- `src/app/api/proxy/[...path]/route.ts`
- `src/app/[locale]/login/{page.tsx,login-form.tsx}`
- `src/app/[locale]/(admin)/dashboard/page.tsx`
- `src/components/ui/{form,input,label}.tsx` (shadcn or vendored)
- `messages/{ru,kz}.json` (login.* + admin.auth.* + dashboard.* namespaces)

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
- Bypassing the BFF proxy (Phase 2+) by calling admin-api directly from the browser. The browser must NEVER send a Bearer token to admin-api. EXCEPTION: the file-upload route uses an `X-Upload-Token` (a 5-min single-use JWT) as the credential per CONTEXT D-13 — Bearer is still never sent to admin-api.

## Local dev env vars

- `ADMIN_API_URL` (server-only, no `NEXT_PUBLIC_` prefix) — admin-api origin for BFF route handlers.
- `NEXT_PUBLIC_ADMIN_API_URL` — admin-api origin for the **browser**, used ONLY by the BFF-bypass file upload (`src/lib/uploads/client.ts`). Required in dev when admin-client (4100) and admin-api (4101) run on different ports — otherwise `POST /admin-api/v1/admin/uploads/file` lands on the Next.js server and 404s. Prod behind nginx leaves this empty (same origin). admin-api's `CORS_ORIGINS` must include the admin-client origin and its `enableCors().allowedHeaders` must include `X-Upload-Token`.

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
