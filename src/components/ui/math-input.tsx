'use client';

import { useRef, useState, type Ref } from 'react';
import { useTranslations } from 'next-intl';
import { Sigma } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { FormulaDialog } from '@/components/ui/formula-dialog';
import { RichMathContent } from '@/components/ui/rich-math-content';
import { cn } from '@/lib/utils';

/**
 * MathInput — a plain-text Input/Textarea plus a "Σ" button that opens the
 * shared FormulaDialog and inserts a `$...$` / `$$...$$` fragment at the caret,
 * with a live KaTeX preview line below. Used for fields that stay plain text
 * (titles, answer options, descriptive `correct`) but may carry formulas. The
 * stored value is just text with delimiters — rendered on the student side by
 * MathText / RichContent.
 */
export interface MathInputProps {
    value: string;
    onChange: (value: string) => void;
    onBlur?: () => void;
    multiline?: boolean;
    placeholder?: string;
    className?: string;
    id?: string;
    rows?: number;
    maxLength?: number;
    disabled?: boolean;
    'aria-invalid'?: boolean;
}

function escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function MathInput({
    value,
    onChange,
    onBlur,
    multiline = false,
    placeholder,
    className,
    id,
    rows,
    maxLength,
    disabled,
    'aria-invalid': ariaInvalid,
}: MathInputProps) {
    const t = useTranslations('admin.courses');
    const [dialogOpen, setDialogOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

    const insertAtCaret = (snippet: string) => {
        const el = inputRef.current;
        if (!el) {
            onChange(value + snippet);
            return;
        }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        onChange(value.slice(0, start) + snippet + value.slice(end));
        requestAnimationFrame(() => {
            el.focus();
            const caret = start + snippet.length;
            el.setSelectionRange(caret, caret);
        });
    };

    const handleConfirm = (latex: string, display: boolean) => {
        insertAtCaret(display ? `$$${latex}$$` : `$${latex}$`);
    };

    const showPreview = value.includes('$');

    return (
        <div className='space-y-1.5'>
            <div className='flex items-start gap-1.5'>
                {multiline ? (
                    <Textarea
                        ref={inputRef as Ref<HTMLTextAreaElement>}
                        id={id}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={onBlur}
                        placeholder={placeholder}
                        rows={rows}
                        maxLength={maxLength}
                        disabled={disabled}
                        aria-invalid={ariaInvalid}
                        className={cn('flex-1', className)}
                    />
                ) : (
                    <Input
                        ref={inputRef as Ref<HTMLInputElement>}
                        id={id}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        onBlur={onBlur}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        disabled={disabled}
                        aria-invalid={ariaInvalid}
                        className={cn('flex-1', className)}
                    />
                )}
                <Button
                    type='button'
                    variant='outline'
                    size='icon'
                    className='size-9 shrink-0'
                    onClick={() => setDialogOpen(true)}
                    disabled={disabled}
                    aria-label={t('tiptap_formula')}
                    title={t('tiptap_formula')}
                >
                    <Sigma className='h-4 w-4' />
                </Button>
            </div>
            {showPreview && (
                <RichMathContent
                    html={escapeHtml(value)}
                    className='rounded-md border bg-muted/20 px-3 py-1.5 text-sm text-muted-foreground'
                />
            )}
            <FormulaDialog open={dialogOpen} onOpenChange={setDialogOpen} onConfirm={handleConfirm} />
        </div>
    );
}
