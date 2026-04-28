// src/lib/shared-types-smoke.ts
// Smoke test that @shared/* path alias resolves. This file is imported once
// (from the placeholder home page) so Next.js compiles it. Remove this and the
// import in [locale]/page.tsx when Phase 2 legitimately consumes shared types.
import { ROLES, type RoleName } from '@shared/roles';
import { DEFAULT_LOCALE } from '@shared/locales';

export const _SMOKE = {
    adminRole: ROLES.admin,
    defaultLocale: DEFAULT_LOCALE,
};
export type _SmokeRoleName = RoleName;
