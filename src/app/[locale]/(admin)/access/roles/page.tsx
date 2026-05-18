import { setRequestLocale } from 'next-intl/server';
import { RolesListClient } from './roles-list-client';

/**
 * Phase 11 — server-component shell for /access/roles.
 *
 * Mounting is gated on the server side by middleware (JWT signature only) and
 * on the API side by @RequirePermission('access.manage'). The client component
 * additionally hides the page chrome when the user lacks access.manage so
 * non-admins who type the URL directly get an empty state rather than an
 * unstyled 403.
 */
export default async function AccessRolesPage({
    params,
}: {
    params: Promise<{ locale: string }>;
}) {
    const { locale } = await params;
    setRequestLocale(locale);
    return <RolesListClient />;
}
