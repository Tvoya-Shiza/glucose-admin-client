'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import type { CreditStatus } from '@/lib/credits/types';

const VARIANT_BY_STATUS: Record<CreditStatus, 'outline' | 'success' | 'muted'> = {
    draft: 'outline',
    active: 'success',
    archived: 'muted',
};

export function CreditStatusBadge({ status }: { status: CreditStatus }) {
    const t = useTranslations('admin.credits');
    return <Badge variant={VARIANT_BY_STATUS[status]}>{t(`status_${status}`)}</Badge>;
}
