/**
 * Source of truth for the permission codes the client knows about.
 *
 * Kept in sync (by hand) with glucose-admin-api/prisma/seeds/permissions.seed.ts.
 * The server is authoritative — this file only exists so usePermission(code) can
 * narrow `code` to a known literal type at compile time (catches typos).
 *
 * Unknown codes received from /api/auth/me are still respected at runtime
 * (usePermission falls back to a plain string check), so a server-side catalog
 * addition won't break the client; you just don't get IntelliSense for it
 * until you update this file.
 */
export const PERMISSION_CODES = [
    // dashboard
    'dashboard.view',
    // users
    'users.view',
    'users.create',
    'users.import',
    'users.edit',
    'users.delete',
    'users.export',
    'users.impersonate',
    // groups
    'groups.view',
    'groups.create',
    'groups.edit',
    'groups.delete',
    // courses
    'courses.view',
    'courses.create',
    'courses.edit',
    'courses.delete',
    'courses.publish',
    'courses.export',
    // quizzes
    'quizzes.view',
    'quizzes.create',
    'quizzes.edit',
    'quizzes.delete',
    'quizzes.publish',
    'quizzes.export',
    'quizzes.badges_manage',
    'quizzes.categories_manage',
    'quizzes.results_view',
    // files
    'files.view',
    'files.create',
    'files.delete',
    // stories
    'stories.view',
    'stories.create',
    'stories.edit',
    'stories.delete',
    'stories.publish',
    // banners
    'banners.view',
    'banners.create',
    'banners.edit',
    'banners.delete',
    'banners.publish',
    // blogs
    'blogs.view',
    'blogs.create',
    'blogs.edit',
    'blogs.delete',
    'blogs.publish',
    'blogs.categories_manage',
    // promocodes
    'promocodes.view',
    'promocodes.create',
    'promocodes.edit',
    'promocodes.delete',
    // push
    'push.view',
    'push.create',
    'push.schedule',
    'push.history_view',
    // mailings
    'mailings.view',
    'mailings.create',
    'mailings.history_view',
    // payments
    'payments.view',
    'payments.export',
    'payments.refund',
    // sales
    'sales.view',
    'sales.edit',
    'sales.export',
    // access
    'access.manage',
    // boards (Phase 12 — mini-Trello)
    'boards.view',
    'boards.create',
    'boards.edit',
    'boards.delete',
    'boards.manage_members',
    'boards.manage_columns',
    // tasks (Phase 12 — mini-Trello)
    'tasks.view',
    'tasks.create',
    'tasks.edit',
    'tasks.delete',
    'tasks.assign',
    'tasks.comment',
    'tasks.complete',
] as const;

export type PermissionCode = (typeof PERMISSION_CODES)[number];
