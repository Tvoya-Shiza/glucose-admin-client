'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { UserPicker } from '@/components/users/user-picker';
import { getUser } from '@/lib/users/api';
import type { UserRow } from '@/lib/users/types';
import { useBoardMembers, useSetBoardMembers } from '@/lib/boards/queries';
import type { BoardMemberRole } from '@/lib/boards/types';

/**
 * Board membership editor.
 *
 * Local edit-buffer pattern: the dialog clones the server roster on open into
 * `draft`, applies adds/removes/role-changes there, and POSTs the whole list
 * on save. Matches the backend's bulk-replace contract — server enforces
 * "at least one owner" so we mirror that as client-side disable + a guard.
 */
const ROLES: BoardMemberRole[] = ['owner', 'editor', 'viewer'];

interface DraftMember {
    user_id: number;
    role: BoardMemberRole;
    // Optional cached snapshot so newly-picked users don't flash `#id`.
    cached?: { full_name: string | null; email: string | null };
}

export function BoardMembersDialog({
    boardId,
    open,
    onOpenChange,
}: {
    boardId: number;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const t = useTranslations('admin.boards.members');
    const tForm = useTranslations('admin.boards.form');
    const { data, isLoading } = useBoardMembers(boardId, open);
    const saveMutation = useSetBoardMembers(boardId);

    const [draft, setDraft] = useState<DraftMember[]>([]);
    const [pickerValue, setPickerValue] = useState<number | null>(null);

    useEffect(() => {
        if (!open) return;
        if (!data?.rows) return;
        setDraft(
            data.rows.map((m) => ({
                user_id: m.user_id,
                role: m.role,
            })),
        );
    }, [open, data]);

    const ownerCount = draft.filter((m) => m.role === 'owner').length;

    function changeRole(idx: number, role: BoardMemberRole) {
        setDraft((prev) => {
            const target = prev[idx];
            if (!target) return prev;
            const currentOwners = prev.filter((m) => m.role === 'owner').length;
            // Block demotion of the last remaining owner.
            if (target.role === 'owner' && role !== 'owner' && currentOwners === 1) {
                toast.error('Должен остаться хотя бы один владелец');
                return prev;
            }
            const next = prev.slice();
            next[idx] = { ...target, role };
            return next;
        });
    }

    function removeAt(idx: number) {
        setDraft((prev) => {
            const target = prev[idx];
            if (!target) return prev;
            const currentOwners = prev.filter((m) => m.role === 'owner').length;
            if (target.role === 'owner' && currentOwners === 1) {
                toast.error('Должен остаться хотя бы один владелец');
                return prev;
            }
            return prev.filter((_, i) => i !== idx);
        });
    }

    function addUser(userId: number, user: UserRow | null) {
        if (!userId) return;
        if (draft.some((m) => m.user_id === userId)) {
            toast.error('Этот пользователь уже добавлен');
            setPickerValue(null);
            return;
        }
        setDraft((prev) => [
            ...prev,
            {
                user_id: userId,
                role: 'editor',
                cached: user ? { full_name: user.full_name, email: user.email } : undefined,
            },
        ]);
        setPickerValue(null);
    }

    function save() {
        saveMutation.mutate(
            { members: draft.map((m) => ({ user_id: m.user_id, role: m.role })) },
            {
                onSuccess: () => {
                    toast.success(t('save_success'));
                    onOpenChange(false);
                },
                onError: (err: unknown) => {
                    toast.error((err as Error)?.message ?? 'save_failed');
                },
            },
        );
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>{t('title')}</DialogTitle>
                    <DialogDescription className="sr-only">
                        Управление участниками доски и их ролями
                    </DialogDescription>
                </DialogHeader>

                {isLoading ? (
                    <div className="flex h-32 items-center justify-center text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-xs font-medium text-muted-foreground">
                                {t('add')}
                            </label>
                            <UserPicker
                                roles={['admin', 'curator', 'teacher']}
                                value={pickerValue}
                                onChange={(id, user) => {
                                    if (id != null) addUser(id, user);
                                }}
                                placeholder="Поиск пользователя…"
                            />
                        </div>

                        <Separator />

                        <div className="max-h-72 space-y-1 overflow-y-auto">
                            {draft.length === 0 ? (
                                <p className="py-4 text-center text-xs italic text-muted-foreground">—</p>
                            ) : (
                                draft.map((m, idx) => (
                                    <MemberRow
                                        key={m.user_id}
                                        member={m}
                                        onRoleChange={(r) => changeRole(idx, r)}
                                        onRemove={() => removeAt(idx)}
                                    />
                                ))
                            )}
                        </div>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="ghost" onClick={() => onOpenChange(false)}>
                        {tForm('cancel')}
                    </Button>
                    <Button onClick={save} disabled={saveMutation.isPending || draft.length === 0}>
                        {t('save')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function MemberRow({
    member,
    onRoleChange,
    onRemove,
}: {
    member: DraftMember;
    onRoleChange: (role: BoardMemberRole) => void;
    onRemove: () => void;
}) {
    const t = useTranslations('admin.boards.members');
    // Resolve display name via getUser. The TanStack cache dedupes across the
    // dialog (and the assignee-label hook on the kanban card), so this is at
    // most one network call per user_id per 5 min.
    const detailQuery = useQuery({
        queryKey: ['admin.users.detail', member.user_id],
        queryFn: () => getUser(member.user_id),
        staleTime: 5 * 60_000,
    });

    const label =
        member.cached?.full_name
        ?? member.cached?.email
        ?? detailQuery.data?.full_name
        ?? detailQuery.data?.email
        ?? `#${member.user_id}`;

    return (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                {label.slice(0, 1).toUpperCase()}
            </div>
            <span className="flex-1 truncate text-sm">{label}</span>
            <Select value={member.role} onValueChange={(v) => onRoleChange(v as BoardMemberRole)}>
                <SelectTrigger className="h-8 w-28">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {(['owner', 'editor', 'viewer'] as BoardMemberRole[]).map((r) => (
                        <SelectItem key={r} value={r}>
                            {t(`role_${r}`)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove} aria-label={t('remove')}>
                <X className="h-4 w-4" />
            </Button>
        </div>
    );
}

// Re-export Plus icon so callers can show "Add member" buttons with consistent visuals.
export { Plus as AddMemberIcon };
