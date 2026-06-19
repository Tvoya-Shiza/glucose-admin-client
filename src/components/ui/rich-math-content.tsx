'use client';

import { useEffect, useRef } from 'react';
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
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}
