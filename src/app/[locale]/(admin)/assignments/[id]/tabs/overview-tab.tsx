'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { usePermission } from '@/lib/access/use-permission';
import { toggleAssignmentStatus, updateAssignment } from '@/lib/assignments/api';
import type { AssignmentDetail } from '@/lib/assignments/types';

interface OverviewTabProps {
    detail: AssignmentDetail;
}

/**
 * Detail-page Overview tab — KZ only, no deadline, no course/chapter inputs.
 * Course binding lives on the course content tab (WebinarChapterItem) and is
 * back-filled into webinar_id/chapter_id on first attachment.
 */
export function OverviewTab({ detail }: OverviewTabProps) {
    const t = useTranslations('admin.assignments');
    const qc = useQueryClient();
    const canEdit = usePermission('assignments.edit');
    const canPublish = usePermission('assignments.publish');

    const kz = detail.translations.find((x) => x.locale === 'kz') ?? { locale: 'kz' as const, title: '', description: '' };

    const [attempts, setAttempts] = useState(detail.attempts == null ? '' : String(detail.attempts));
    const [grade, setGrade] = useState(detail.grade == null ? '' : String(detail.grade));
    const [passGrade, setPassGrade] = useState(detail.pass_grade == null ? '' : String(detail.pass_grade));
    const [title, setTitle] = useState(kz.title);
    const [desc, setDesc] = useState(kz.description);

    const save = useMutation({
        mutationFn: async () => {
            await updateAssignment(detail.id, {
                attempts: attempts.trim().length > 0 ? Number(attempts) : undefined,
                grade: grade.trim().length > 0 ? Number(grade) : undefined,
                pass_grade: passGrade.trim().length > 0 ? Number(passGrade) : undefined,
                translations: [{ locale: 'kz', title, description: desc }],
            });
        },
        onSuccess: () => {
            toast.success(t('updated_success'));
            qc.invalidateQueries({ queryKey: ['admin.assignments.detail', detail.id] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.list'] });
        },
        onError: (e: Error) => toast.error(t('save_failed'), { description: e.message }),
    });

    const publish = useMutation({
        mutationFn: async () => toggleAssignmentStatus(detail.id, detail.status === 'active' ? 'inactive' : 'active'),
        onSuccess: () => {
            toast.success(t('updated_success'));
            qc.invalidateQueries({ queryKey: ['admin.assignments.detail', detail.id] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.list'] });
            qc.invalidateQueries({ queryKey: ['admin.assignments.analytics'] });
        },
        onError: (e: Error) => toast.error(t('save_failed'), { description: e.message }),
    });

    return (
        <div className='space-y-4'>
            <Card>
                <CardContent className='space-y-4 p-4'>
                    <div className='space-y-1.5'>
                        <Label>{t('title_label')}</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!canEdit} />
                    </div>

                    <div className='space-y-1.5'>
                        <Label>{t('description_label')}</Label>
                        <Textarea
                            rows={5}
                            value={desc}
                            onChange={(e) => setDesc(e.target.value)}
                            disabled={!canEdit}
                        />
                    </div>

                    <div className='grid grid-cols-2 gap-3 md:grid-cols-4'>
                        <div className='space-y-1.5'>
                            <Label>{t('status_label')}</Label>
                            <Select value={detail.status} disabled>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value='active'>{t('status_active')}</SelectItem>
                                    <SelectItem value='inactive'>{t('status_inactive')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className='space-y-1.5'>
                            <Label>{t('attempts_label')}</Label>
                            <Input
                                type='number'
                                min={1}
                                value={attempts}
                                onChange={(e) => setAttempts(e.target.value)}
                                disabled={!canEdit}
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <Label>{t('grade_label')}</Label>
                            <Input
                                type='number'
                                min={0}
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                disabled={!canEdit}
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <Label>{t('pass_grade_label')}</Label>
                            <Input
                                type='number'
                                min={0}
                                value={passGrade}
                                onChange={(e) => setPassGrade(e.target.value)}
                                disabled={!canEdit}
                            />
                        </div>
                    </div>

                    {detail.webinar_id != null ? (
                        <div className='text-xs text-muted-foreground'>
                            {t('bound_course_hint', { id: detail.webinar_id })}
                        </div>
                    ) : (
                        <div className='text-xs text-muted-foreground'>{t('unbound_hint')}</div>
                    )}

                    <div className='flex justify-end gap-2'>
                        {canPublish ? (
                            <Button variant='outline' onClick={() => publish.mutate()} disabled={publish.isPending}>
                                {detail.status === 'active' ? t('publish_inactive') : t('publish_active')}
                            </Button>
                        ) : null}
                        {canEdit ? (
                            <Button onClick={() => save.mutate()} disabled={save.isPending}>
                                {save.isPending ? t('saving_dot') : t('save')}
                            </Button>
                        ) : null}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
