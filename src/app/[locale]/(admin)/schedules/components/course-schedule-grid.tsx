'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getCourse } from '@/lib/courses/api';
import type { Chapter, ChapterItem } from '@/lib/courses/types';
import { listSchedules, saveScheduleGrid } from '@/lib/schedules/api';
import { datetimeLocalToUnix, unixToDatetimeLocal } from '@/lib/schedules/format';
import type { Schedule, ScheduleGridNode, ScheduleItemKind } from '@/lib/schedules/types';
import { GroupContextPicker } from '../../courses/[id]/components/group-context-picker';

type Scope = 'general' | 'group';

/** Local edit state for one module/lesson node. */
interface NodeState {
    start: string; // datetime-local
    end: string; // datetime-local
    block_before_start: boolean;
    block_after_end: boolean;
    /** Existing single-item schedule row id for the current scope (if any). */
    scheduleId?: number;
}

const EMPTY_NODE: NodeState = { start: '', end: '', block_before_start: false, block_after_end: false };

function pickTitle(translations: Array<{ locale: string; title?: string | null }> | undefined, locale: string): string {
    if (!translations || translations.length === 0) return '';
    return (
        translations.find((t) => t.locale === locale)?.title ||
        translations.find((t) => t.locale === 'ru')?.title ||
        translations[0]?.title ||
        ''
    );
}

/** Maps a course chapter item to its schedule (kind, ref_id) target. */
function itemTarget(item: ChapterItem): { kind: ScheduleItemKind; ref_id: number } {
    return { kind: item.type as ScheduleItemKind, ref_id: item.item_id };
}

function itemLabel(item: ChapterItem, locale: string): string {
    if (item.type === 'file') return pickTitle(item.translations, locale) || `#${item.item_id}`;
    if (item.type === 'assignment') return item.assignment?.title || `#${item.item_id}`;
    if (item.type === 'quiz') return item.quiz?.slug || `#${item.item_id}`;
    return `#${item.item_id}`;
}

const nodeKey = (kind: ScheduleItemKind, ref: number) => `${kind}:${ref}`;

/**
 * Phase 32 — per-course schedule GRID. Renders the course as modules → lessons
 * with an inline access window (start/end + two block toggles) on each node.
 *
 * Cascade is achieved through the student gating precedence (granularity-first):
 * a module window = a chapter-level rule that applies to every lesson inside it,
 * and a lesson window = an item-level rule that overrides the module. So an empty
 * lesson "inherits" its module's window; filling it creates an override.
 *
 * Group scope is one selector for the whole grid (General / a specific group);
 * switching it reloads the windows configured for that audience.
 */
export function CourseScheduleGrid({ courseId, canEdit }: { courseId: number; canEdit: boolean }) {
    const t = useTranslations('admin.schedules');
    const locale = useLocale();
    const qc = useQueryClient();

    const [scope, setScope] = useState<Scope>('group');
    const [groupId, setGroupId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<Record<number, boolean>>({});
    const [nodes, setNodes] = useState<Record<string, NodeState>>({});

    const { data: course, isLoading: courseLoading } = useQuery({
        queryKey: ['admin.courses.detail', courseId],
        queryFn: () => getCourse(courseId),
        retry: false,
    });

    const { data: schedulesResp, isLoading: schedLoading } = useQuery({
        queryKey: ['admin.schedules.list', { course_id: courseId, page: 1, page_size: 200, grid: true }],
        queryFn: () => listSchedules({ page: 1, page_size: 200, course_id: courseId, sort: 'start_at', order: 'asc' }),
        // Avoid a background refetch wiping unsaved edits mid-session; save invalidates explicitly.
        staleTime: 5 * 60_000,
        refetchOnWindowFocus: false,
    });

    const scopeKey = scope === 'general' ? 'general' : groupId ?? '';

    // Single-item schedule rows indexed by `${scope}|${kind}:${ref}` — these are the
    // grid-managed rows. Multi-item rows (calendar events) are left untouched.
    const existingByScopeNode = useMemo(() => {
        const map = new Map<string, Schedule>();
        for (const row of schedulesResp?.rows ?? []) {
            const it = row.items[0];
            if (row.items.length !== 1 || !it) continue;
            const rowScope = row.group_id == null ? 'general' : String(row.group_id);
            map.set(`${rowScope}|${nodeKey(it.kind, it.ref_id)}`, row);
        }
        return map;
    }, [schedulesResp]);

    // (Re)seed local node state whenever the scope or loaded data changes.
    useEffect(() => {
        if (!course) return;
        const next: Record<string, NodeState> = {};
        const seed = (kind: ScheduleItemKind, ref: number) => {
            const key = nodeKey(kind, ref);
            const row = existingByScopeNode.get(`${scopeKey}|${key}`);
            next[key] = row
                ? {
                      start: unixToDatetimeLocal(row.start_at),
                      end: unixToDatetimeLocal(row.end_at),
                      block_before_start: row.block_before_start,
                      block_after_end: row.block_after_end,
                      scheduleId: row.id,
                  }
                : { ...EMPTY_NODE };
        };
        for (const ch of course.chapters) {
            seed('lesson', ch.id);
            for (const it of ch.items) {
                const { kind, ref_id } = itemTarget(it);
                seed(kind, ref_id);
            }
        }
        setNodes(next);
    }, [course, existingByScopeNode, scopeKey]);

    const setNode = (key: string, patch: Partial<NodeState>) =>
        setNodes((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_NODE), ...patch } }));

    const mutation = useMutation({
        mutationFn: () => {
            const upserts: ScheduleGridNode[] = [];
            const deletes: number[] = [];
            if (!course) return Promise.resolve({ ok: true, upserted: 0, deleted: 0 });

            const visit = (kind: ScheduleItemKind, ref: number) => {
                const st = nodes[nodeKey(kind, ref)] ?? EMPTY_NODE;
                const start = datetimeLocalToUnix(st.start);
                const end = datetimeLocalToUnix(st.end);
                const hasWindow = start != null && end != null;
                if (hasWindow) {
                    if (end <= start) throw new Error('invalid_range');
                    upserts.push({
                        id: st.scheduleId,
                        kind,
                        ref_id: ref,
                        start_at: start,
                        end_at: end,
                        block_before_start: st.block_before_start,
                        block_after_end: st.block_after_end,
                    });
                } else if (st.scheduleId != null) {
                    deletes.push(st.scheduleId);
                }
            };

            for (const ch of course.chapters) {
                visit('lesson', ch.id);
                for (const it of ch.items) {
                    const { kind, ref_id } = itemTarget(it);
                    visit(kind, ref_id);
                }
            }

            const group_id = scope === 'general' ? null : groupId ? Number(groupId) : null;
            return saveScheduleGrid(courseId, { group_id, upserts, deletes });
        },
        onSuccess: () => {
            toast.success(t('grid_saved'));
            qc.invalidateQueries({ queryKey: ['admin.schedules.list'], exact: false });
            qc.invalidateQueries({ queryKey: ['admin.schedules.calendar'], exact: false });
        },
        onError: (err: unknown) => {
            const msg = err instanceof Error ? err.message : 'save_failed';
            toast.error(t(msg) || msg);
        },
    });

    const saveDisabled = !canEdit || mutation.isPending || (scope === 'group' && !groupId);

    if (courseLoading || schedLoading) {
        return (
            <div className='space-y-2 pt-4'>
                <Skeleton className='h-10 w-1/2' />
                <Skeleton className='h-40 w-full' />
            </div>
        );
    }
    if (!course) return <p className='text-muted-foreground p-4 text-sm'>{t('grid_no_course')}</p>;

    return (
        <div className='space-y-4'>
            {/* Scope selector */}
            <Card className='flex flex-wrap items-center gap-3 p-3'>
                <span className='text-sm font-medium'>{t('field_group')}:</span>
                <div role='radiogroup' className='bg-muted/30 inline-flex gap-1 rounded-md border p-1'>
                    {(['general', 'group'] as const).map((opt) => (
                        <button
                            key={opt}
                            type='button'
                            role='radio'
                            aria-checked={scope === opt}
                            onClick={() => setScope(opt)}
                            className={cn(
                                'rounded px-3 py-1.5 text-sm font-medium transition-colors',
                                scope === opt ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                            )}
                        >
                            {t(`scope_${opt}`)}
                        </button>
                    ))}
                </div>
                {scope === 'group' ? <GroupContextPicker value={groupId} onChange={setGroupId} /> : null}
                <div className='ml-auto'>
                    <Button onClick={() => mutation.mutate()} disabled={saveDisabled}>
                        {mutation.isPending ? <Loader2 className='size-4 animate-spin' /> : null}
                        {t('grid_save')}
                    </Button>
                </div>
            </Card>

            <p className='text-muted-foreground text-xs'>{t('grid_hint')}</p>

            {/* Tree */}
            <div className='space-y-2'>
                {course.chapters.map((ch) => (
                    <ChapterRow
                        key={ch.id}
                        chapter={ch}
                        locale={locale}
                        expanded={!!expanded[ch.id]}
                        onToggle={() => setExpanded((p) => ({ ...p, [ch.id]: !p[ch.id] }))}
                        nodes={nodes}
                        setNode={setNode}
                        disabled={!canEdit}
                        t={t}
                    />
                ))}
                {course.chapters.length === 0 ? (
                    <p className='text-muted-foreground rounded border border-dashed p-4 text-center text-sm'>{t('grid_no_chapters')}</p>
                ) : null}
            </div>
        </div>
    );
}

function ChapterRow({
    chapter,
    locale,
    expanded,
    onToggle,
    nodes,
    setNode,
    disabled,
    t,
}: {
    chapter: Chapter;
    locale: string;
    expanded: boolean;
    onToggle: () => void;
    nodes: Record<string, NodeState>;
    setNode: (key: string, patch: Partial<NodeState>) => void;
    disabled: boolean;
    t: ReturnType<typeof useTranslations>;
}) {
    const key = nodeKey('lesson', chapter.id);
    const title = pickTitle(chapter.translations, locale) || `#${chapter.id}`;
    const moduleState = nodes[key] ?? EMPTY_NODE;
    const moduleHasWindow = !!moduleState.start && !!moduleState.end;

    return (
        <Card className='overflow-hidden'>
            <div className='bg-muted/30 flex flex-wrap items-center gap-2 p-3'>
                <button type='button' onClick={onToggle} className='hover:bg-muted rounded p-1' aria-label='toggle'>
                    {expanded ? <ChevronDown className='size-4' /> : <ChevronRight className='size-4' />}
                </button>
                <span className='min-w-40 flex-1 truncate text-sm font-semibold'>{title}</span>
                <span className='text-muted-foreground text-xs'>
                    {chapter.items.length} {t('items_short')}
                </span>
            </div>
            <div className='border-t p-3'>
                <p className='text-muted-foreground mb-2 text-xs'>{t('grid_module_window')}</p>
                <WindowEditor state={moduleState} onChange={(p) => setNode(key, p)} disabled={disabled} t={t} />
            </div>
            {expanded ? (
                <div className='space-y-3 border-t p-3'>
                    {chapter.items.map((it) => {
                        const { kind, ref_id } = itemTarget(it);
                        const ik = nodeKey(kind, ref_id);
                        const st = nodes[ik] ?? EMPTY_NODE;
                        return (
                            <div key={it.id} className='rounded border p-2'>
                                <div className='mb-1.5 flex items-center gap-2'>
                                    <span className='bg-muted rounded px-1.5 py-0.5 text-[10px] tracking-wide uppercase'>{kind}</span>
                                    <span className='flex-1 truncate text-sm'>{itemLabel(it, locale)}</span>
                                    {!st.start && !st.end && moduleHasWindow ? (
                                        <span className='text-muted-foreground text-[11px]'>{t('grid_inherits_module')}</span>
                                    ) : null}
                                </div>
                                <WindowEditor state={st} onChange={(p) => setNode(ik, p)} disabled={disabled} t={t} />
                            </div>
                        );
                    })}
                    {chapter.items.length === 0 ? <p className='text-muted-foreground text-xs'>{t('grid_no_items')}</p> : null}
                </div>
            ) : null}
        </Card>
    );
}

function WindowEditor({
    state,
    onChange,
    disabled,
    t,
}: {
    state: NodeState;
    onChange: (patch: Partial<NodeState>) => void;
    disabled: boolean;
    t: ReturnType<typeof useTranslations>;
}) {
    const clear = () => onChange({ start: '', end: '', block_before_start: false, block_after_end: false });
    const hasWindow = !!state.start || !!state.end;
    return (
        <div className='space-y-2'>
            <div className='grid grid-cols-1 gap-2 sm:grid-cols-2'>
                <label className='block'>
                    <span className='text-muted-foreground text-[11px]'>{t('field_start')}</span>
                    <Input
                        type='datetime-local'
                        value={state.start}
                        disabled={disabled}
                        onChange={(e) => onChange({ start: e.target.value })}
                    />
                </label>
                <label className='block'>
                    <span className='text-muted-foreground text-[11px]'>{t('field_end')}</span>
                    <Input
                        type='datetime-local'
                        value={state.end}
                        disabled={disabled}
                        onChange={(e) => onChange({ end: e.target.value })}
                    />
                </label>
            </div>
            <div className='flex flex-wrap items-center gap-4'>
                <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                        checked={state.block_before_start}
                        disabled={disabled}
                        onCheckedChange={(v) => onChange({ block_before_start: !!v })}
                    />
                    {t('field_block_before_start')}
                </label>
                <label className='flex items-center gap-2 text-sm'>
                    <Checkbox
                        checked={state.block_after_end}
                        disabled={disabled}
                        onCheckedChange={(v) => onChange({ block_after_end: !!v })}
                    />
                    {t('field_block_after_end')}
                </label>
                {hasWindow && !disabled ? (
                    <button type='button' onClick={clear} className='text-muted-foreground hover:text-destructive ml-auto text-xs underline'>
                        {t('grid_clear')}
                    </button>
                ) : null}
            </div>
        </div>
    );
}
