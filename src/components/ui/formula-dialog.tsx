'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import katex from 'katex';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * FormulaDialog — shared LaTeX authoring dialog.
 *
 * Reused by the Tiptap toolbar (insert/edit a math node) and by MathInput
 * (insert a `$...$` fragment into a plain-text field). It only produces a LaTeX
 * string + display flag; callers decide how to apply it. The live preview is
 * rendered with `katex.renderToString` (its output is KaTeX-generated markup,
 * not user HTML, so dangerouslySetInnerHTML here is safe). `throwOnError: true`
 * lets us catch invalid input and surface a graceful error instead of crashing.
 */
export interface FormulaDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    initialLatex?: string;
    initialDisplay?: boolean;
    editing?: boolean;
    onConfirm: (latex: string, display: boolean) => void;
}

export function FormulaDialog({ open, onOpenChange, initialLatex = '', initialDisplay = false, editing = false, onConfirm }: FormulaDialogProps) {
    const t = useTranslations('admin.courses');
    const [latex, setLatex] = useState(initialLatex);
    const [display, setDisplay] = useState(initialDisplay);

    // Re-seed the fields each time the dialog opens (it stays mounted between uses).
    useEffect(() => {
        if (open) {
            setLatex(initialLatex);
            setDisplay(initialDisplay);
        }
    }, [open, initialLatex, initialDisplay]);

    const preview = useMemo(() => {
        const src = latex.trim();
        if (!src) return { html: '', error: false };
        try {
            return { html: katex.renderToString(src, { throwOnError: true, displayMode: display }), error: false };
        } catch {
            return { html: '', error: true };
        }
    }, [latex, display]);

    const canConfirm = latex.trim().length > 0 && !preview.error;

    const handleConfirm = () => {
        if (!canConfirm) return;
        onConfirm(latex.trim(), display);
        onOpenChange(false);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className='sm:max-w-lg'>
                <DialogHeader>
                    <DialogTitle>{editing ? t('formula_dialog_edit_title') : t('formula_dialog_title')}</DialogTitle>
                </DialogHeader>
                <div className='space-y-3'>
                    <div className='space-y-1.5'>
                        <Label htmlFor='formula-latex'>{t('formula_latex_label')}</Label>
                        <Textarea
                            id='formula-latex'
                            value={latex}
                            onChange={(e) => setLatex(e.target.value)}
                            placeholder={t('formula_latex_placeholder')}
                            className='font-mono'
                            rows={3}
                            autoFocus
                            onKeyDown={(e) => {
                                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    handleConfirm();
                                }
                            }}
                        />
                    </div>
                    <label className='flex items-center gap-2 text-sm select-none'>
                        <input
                            type='checkbox'
                            checked={display}
                            onChange={(e) => setDisplay(e.target.checked)}
                            className='size-4 accent-[var(--primary)]'
                        />
                        {t('formula_display_label')}
                    </label>
                    <div className='space-y-1.5'>
                        <Label>{t('formula_preview_label')}</Label>
                        <div className={cn('min-h-12 rounded-md border bg-muted/30 px-3 py-2', display && 'text-center')}>
                            {!latex.trim() ? (
                                <span className='text-sm text-muted-foreground'>{t('formula_empty')}</span>
                            ) : preview.error ? (
                                <span className='text-sm text-destructive'>{t('formula_invalid')}</span>
                            ) : (
                                <span dangerouslySetInnerHTML={{ __html: preview.html }} />
                            )}
                        </div>
                        <p className='text-xs text-muted-foreground'>{t('formula_help')}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button type='button' variant='outline' onClick={() => onOpenChange(false)}>
                        {t('formula_cancel')}
                    </Button>
                    <Button type='button' onClick={handleConfirm} disabled={!canConfirm}>
                        {t('formula_insert')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
