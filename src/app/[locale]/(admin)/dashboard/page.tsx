'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { fetchWithRefresh } from '@/lib/auth/refresh-on-401';

interface MeResponse {
    success: boolean;
    data?: { user_id: number; email: string | null; role_name: string };
}

export default function DashboardPage() {
    const t = useTranslations('dashboard');
    const locale = useLocale();
    const router = useRouter();
    const qc = useQueryClient();

    const { data, isLoading } = useQuery<MeResponse>({
        queryKey: ['auth.me'],
        queryFn: async () => {
            const res = await fetchWithRefresh('/api/auth/me');
            return res.json();
        },
    });

    const logout = useMutation({
        mutationFn: async () => {
            await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
        },
        onSuccess: () => {
            qc.clear();
            router.replace(`/${locale}/login`);
        },
    });

    return (
        <div className='mx-auto max-w-3xl space-y-6 px-4 py-12'>
            <header className='space-y-1'>
                <h1 className='text-2xl font-semibold'>{t('title')}</h1>
                {isLoading ? (
                    <p className='text-muted-foreground text-sm'>…</p>
                ) : data?.data ? (
                    <p className='text-muted-foreground text-sm'>
                        {t('welcome')}, {data.data.email ?? '—'} ({t('role')}: {data.data.role_name})
                    </p>
                ) : (
                    <p className='text-muted-foreground text-sm'>—</p>
                )}
            </header>

            <Button variant='outline' onClick={() => logout.mutate()} disabled={logout.isPending}>
                {t('logout')}
            </Button>
        </div>
    );
}
