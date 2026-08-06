'use client';

import { useEffect, useMemo, useRef } from 'react';
import { cn } from '@/lib/utils';

interface RichMathContentProps {
    html: string;
    className?: string;
}

/**
 * RichMathContent — read-only renderer for admin previews.
 *
 * Mirrors the student client's `RichContent` (glucose-client/src/shared/ui/rich-content.tsx)
 * so what an admin previews matches what students see: sanitized HTML with KaTeX
 * math auto-rendered from `$...$` (inline) and `$$...$$` (display) delimiters.
 * The `html` must already be sanitized by the caller — this component does not
 * sanitize.
 */
export function RichMathContent({ html, className }: RichMathContentProps) {
    const ref = useRef<HTMLDivElement>(null);

    /**
     * Объект для `dangerouslySetInnerHTML` обязан быть стабильным по ссылке.
     *
     * React 19 сравнивает этот проп ПО ССЫЛКЕ и при несовпадении безусловно
     * присваивает `innerHTML`, не глядя на содержимое. Литерал прямо в JSX
     * создаётся заново на каждом рендере — значит разметка переписывалась
     * всегда, а вместе с ней пересоздавались `<img>` внутри, и браузер слал
     * новый запрос за картинкой. На вкладке вопросов теста это давало поток
     * запросов за одной и той же картинкой и в итоге вешало вкладку.
     *
     * Ту же правку сделали на клиенте ученика (`shared/ui/rich-content.tsx`);
     * здесь она осталась незакрытой, хотя жалоба была именно про админку.
     */
    const markup = useMemo(() => ({ __html: html }), [html]);

    useEffect(() => {
        if (!ref.current || !html) return;
        import('katex/contrib/auto-render').then(({ default: renderMathInElement }) => {
            if (!ref.current) return;
            renderMathInElement(ref.current, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false },
                    { left: '\\(', right: '\\)', display: false },
                    { left: '\\[', right: '\\]', display: true },
                ],
                throwOnError: false,
            });
        });
    }, [html]);

    return (
        <div
            ref={ref}
            className={cn(
                'min-w-0 break-words [overflow-wrap:anywhere]',
                '[&_img]:h-auto [&_img]:max-w-full',
                '[&_pre]:overflow-x-auto [&_pre]:whitespace-pre-wrap [&_code]:break-words',
                '[&_table]:block [&_table]:max-w-full [&_table]:overflow-x-auto',
                className
            )}
            dangerouslySetInnerHTML={markup}
        />
    );
}
