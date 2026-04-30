'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { patchUserMemberships } from '@/lib/users/api';
import type { UserDetail } from '@/lib/users/types';

/**
 * USR-08 — group membership add/remove.
 *
 * Phase 3 ships an ID-input shell intentionally: Phase 4 (Group CRUD) brings the full
 * group picker (search-and-select). The shell respects the wire contract (`{add, remove}`
 * arrays) so when Phase 4 lands the picker, the only diff is replacing the Input with
 * the picker — the mutation hookup stays.
 *
 * Curator gate is server-side (T-03-22); the toast surfaces the server's
 * `groups_out_of_scope:<ids>` error key without leaking which groups exist.
 */
export function MembershipsTab({ user }: { user: UserDetail }) {
    const t = useTranslations('admin.users');
    const qc = useQueryClient();
    const [addId, setAddId] = useState('');

    const mutate = useMutation({
        mutationFn: (body: { add?: number[]; remove?: number[] }) => patchUserMemberships(user.id, body),
        onSuccess: (next) => {
            qc.setQueryData(['admin.users.detail', String(user.id)], next);
            toast.success(t('saved'));
            setAddId('');
        },
        onError: () => toast.error(t('save_failed')),
    });

    return (
        <div className='space-y-3 pt-4'>
            <div className='flex flex-wrap gap-2'>
                {user.groups.length === 0 ? (
                    <span className='text-muted-foreground text-sm'>—</span>
                ) : (
                    user.groups.map((g) => (
                        <Badge key={g.id} variant='outline' className='gap-2'>
                            {g.name}
                            <button
                                type='button'
                                className='text-muted-foreground hover:text-destructive'
                                onClick={() => mutate.mutate({ remove: [g.id] })}
                                aria-label={`remove ${g.name}`}
                                disabled={mutate.isPending}
                            >
                                ×
                            </button>
                        </Badge>
                    ))
                )}
            </div>
            <div className='flex gap-2'>
                <Input
                    type='number'
                    inputMode='numeric'
                    placeholder='group_id'
                    value={addId}
                    onChange={(e) => setAddId(e.target.value)}
                    className='max-w-xs'
                />
                <Button
                    disabled={!addId || mutate.isPending}
                    onClick={() => {
                        const n = Number(addId);
                        if (!Number.isFinite(n) || n <= 0) return;
                        mutate.mutate({ add: [n] });
                    }}
                >
                    {mutate.isPending ? t('saving') : t('save')}
                </Button>
            </div>
            {/* Phase 4 will replace the ID-input with a search-and-select group picker. */}
        </div>
    );
}
