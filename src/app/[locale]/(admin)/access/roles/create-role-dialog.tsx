'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateRole } from '@/lib/access/api';
import { toast } from 'sonner';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const CODE_PATTERN = /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/;

export function CreateRoleDialog({ open, onOpenChange }: Props) {
    const t = useTranslations('admin.access');
    const [code, setCode] = useState('');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [error, setError] = useState<string | null>(null);
    const create = useCreateRole();

    function reset() {
        setCode('');
        setName('');
        setDescription('');
        setError(null);
    }

    async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError(null);
        const trimmedName = name.trim();
        if (!CODE_PATTERN.test(code)) {
            setError(t('create_error_code'));
            return;
        }
        if (trimmedName.length < 2) {
            setError(t('create_error_name'));
            return;
        }
        try {
            await create.mutateAsync({
                code,
                name: trimmedName,
                description: description.trim() || undefined,
            });
            toast.success(t('create_success'));
            reset();
            onOpenChange(false);
        } catch (err) {
            const msg = (err as Error).message;
            if (msg === 'role_code_taken') setError(t('create_error_code_taken'));
            else if (msg === 'role_code_reserved') setError(t('create_error_code_reserved'));
            else setError(msg);
        }
    }

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) reset();
                onOpenChange(o);
            }}
        >
            <DialogContent>
                <form onSubmit={onSubmit} className='space-y-4'>
                    <DialogHeader>
                        <DialogTitle>{t('create_role')}</DialogTitle>
                        <DialogDescription>{t('create_role_subtitle')}</DialogDescription>
                    </DialogHeader>
                    <div className='space-y-3'>
                        <div className='space-y-1.5'>
                            <Label htmlFor='role-code'>{t('field_code')}</Label>
                            <Input
                                id='role-code'
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder='marketing-manager'
                                autoComplete='off'
                                required
                            />
                            <p className='text-xs text-muted-foreground'>{t('field_code_hint')}</p>
                        </div>
                        <div className='space-y-1.5'>
                            <Label htmlFor='role-name'>{t('field_name')}</Label>
                            <Input
                                id='role-name'
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder={t('field_name_placeholder')}
                                required
                            />
                        </div>
                        <div className='space-y-1.5'>
                            <Label htmlFor='role-desc'>{t('field_description')}</Label>
                            <Textarea
                                id='role-desc'
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={3}
                                maxLength={255}
                            />
                        </div>
                        {error ? <p className='text-sm text-destructive'>{error}</p> : null}
                    </div>
                    <DialogFooter>
                        <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                            {t('cancel')}
                        </Button>
                        <Button type='submit' disabled={create.isPending}>
                            {create.isPending ? t('saving') : t('create')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
