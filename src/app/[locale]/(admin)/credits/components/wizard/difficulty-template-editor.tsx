'use client';

import { useTranslations } from 'next-intl';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { CreditDifficulty } from '@/lib/credits/types';

export interface DifficultyTemplateEditorProps {
    value: CreditDifficulty[];
    onChange: (next: CreditDifficulty[]) => void;
    disabled?: boolean;
}

const LETTERS: CreditDifficulty[] = ['A', 'B', 'C'];

/**
 * question_count slots, each a 3-way A/B/C toggle. The parent auto-resizes the
 * array when question_count changes (cyclic A A B B C extension, prefix-
 * preserving truncation) — this editor only flips single slots.
 */
export function DifficultyTemplateEditor({ value, onChange, disabled }: DifficultyTemplateEditorProps) {
    const t = useTranslations('admin.credits');
    return (
        <div className='flex flex-wrap gap-3'>
            {value.map((letter, idx) => (
                <div key={idx} className='flex flex-col items-center gap-1'>
                    <span className='text-muted-foreground text-[11px]'>{t('template_slot', { n: idx + 1 })}</span>
                    <ToggleGroup
                        type='single'
                        variant='outline'
                        size='sm'
                        value={letter}
                        disabled={disabled}
                        onValueChange={(v) => {
                            if (!v) return; // ignore deselect — a slot always has a difficulty
                            const next = [...value];
                            next[idx] = v as CreditDifficulty;
                            onChange(next);
                        }}
                    >
                        {LETTERS.map((l) => (
                            <ToggleGroupItem key={l} value={l} aria-label={l}>
                                {l}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>
            ))}
        </div>
    );
}
