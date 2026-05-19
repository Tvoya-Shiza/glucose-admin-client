'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Check } from 'lucide-react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getUnreadCount, listNotifications, markAllRead, markRead } from '@/lib/notifications/api';
import type { NotificationRow } from '@/lib/notifications/api';

/**
 * In-app notification bell — polls `/notifications/unread-count` every 30s and
 * lists the most recent 30 in a dropdown. Floating fixed-position button so we
 * don't have to add a global topbar to admin-shell.
 */
export function NotificationBell() {
    const locale = useLocale();
    const qc = useQueryClient();

    const unread = useQuery({
        queryKey: ['notifications.unread_count'],
        queryFn: getUnreadCount,
        refetchInterval: 30_000,
        staleTime: 10_000,
    });

    const list = useQuery({
        queryKey: ['notifications.list'],
        queryFn: () => listNotifications(false, 1, 30),
        enabled: false, // only fetched when popover opens
    });

    const readMutation = useMutation({
        mutationFn: (id: string) => markRead(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications.unread_count'] });
            qc.invalidateQueries({ queryKey: ['notifications.list'] });
        },
    });
    const readAllMutation = useMutation({
        mutationFn: () => markAllRead(),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['notifications.unread_count'] });
            qc.invalidateQueries({ queryKey: ['notifications.list'] });
        },
    });

    const count = unread.data?.unread_count ?? 0;

    return (
        <DropdownMenu
            onOpenChange={(open) => {
                if (open) list.refetch();
            }}
        >
            <DropdownMenuTrigger asChild>
                <Button
                    variant="default"
                    size="icon"
                    className="fixed bottom-6 right-6 z-50 h-12 w-12 rounded-full shadow-lg"
                    aria-label="Notifications"
                >
                    <Bell className="h-5 w-5" />
                    {count > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                            {count > 99 ? '99+' : count}
                        </span>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                side="top"
                align="end"
                className="w-96 p-0"
                onCloseAutoFocus={(e) => e.preventDefault()}
            >
                <div className="flex items-center justify-between px-3 py-2">
                    <DropdownMenuLabel className="m-0 p-0">Уведомления</DropdownMenuLabel>
                    {count > 0 && (
                        <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => readAllMutation.mutate()}
                            className="h-7 gap-1 text-xs"
                        >
                            <Check className="h-3.5 w-3.5" /> Все прочитаны
                        </Button>
                    )}
                </div>
                <DropdownMenuSeparator className="m-0" />
                <div className="max-h-96 overflow-y-auto">
                    {(list.data?.rows ?? []).length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm italic text-muted-foreground">—</p>
                    ) : (
                        list.data!.rows.map((n) => (
                            <NotificationItem
                                key={n.id}
                                notification={n}
                                locale={locale}
                                onRead={() => {
                                    if (!n.is_read) readMutation.mutate(n.id);
                                }}
                            />
                        ))
                    )}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function NotificationItem({
    notification,
    locale,
    onRead,
}: {
    notification: NotificationRow;
    locale: string;
    onRead: () => void;
}) {
    const payload = notification.payload as { board_id?: number; task_id?: string; title?: string };
    const href = payload.board_id ? `/${locale}/boards/${payload.board_id}` : `/${locale}/boards`;

    return (
        <Link
            href={href}
            onClick={onRead}
            className={`block border-b border-border px-3 py-2.5 transition-colors hover:bg-accent ${
                notification.is_read ? 'opacity-70' : ''
            }`}
        >
            <div className="flex items-start gap-2">
                {!notification.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{renderCategory(notification.category)}</p>
                    {payload.title && <p className="truncate text-xs text-muted-foreground">{payload.title}</p>}
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                        {new Date(notification.created_at * 1000).toLocaleString('ru-RU')}
                    </p>
                </div>
            </div>
        </Link>
    );
}

function renderCategory(category: string): string {
    switch (category) {
        case 'task_assigned':
            return 'Назначена новая задача';
        case 'task_unassigned':
            return 'С задачи сняли назначение';
        case 'task_due_soon':
            return 'Дедлайн скоро';
        case 'task_overdue':
            return 'Просрочена';
        case 'task_comment':
            return 'Новый комментарий';
        case 'task_column_changed':
            return 'Задача переехала';
        case 'task_completed':
            return 'Задача закрыта';
        case 'board_invited':
            return 'Добавлены в доску';
        default:
            return category;
    }
}
