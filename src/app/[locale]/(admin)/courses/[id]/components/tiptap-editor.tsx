'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { sanitizeTiptapHtml } from '@/lib/sanitize/sanitize-html';
import { Skeleton } from '@/components/ui/skeleton';
import { FormulaDialog } from '@/components/ui/formula-dialog';
import { TiptapToolbar } from './tiptap-toolbar';
import { MathInline, decodeMathInHtml, MATH_EDIT_EVENT, type MathEditEventDetail } from './math-extension';

/**
 * TiptapEditor — Tiptap 3 + custom shadcn-built toolbar (per Plan 01 spike verdict).
 *
 * Extensions:
 *   - StarterKit (defaults: paragraph, bold, italic, strike, code, underline,
 *     heading H1-H3, bullet/ordered list, blockquote, code-block, hard-break,
 *     dropcursor, gapcursor, history). Tiptap 3 StarterKit ships with `underline`
 *     and `link` bundled. We disable the bundled `link` via
 *     `StarterKit.configure({ link: false })` so we can register our own
 *     `Link.configure(...)` with `openOnClick: false` below (otherwise the two
 *     registrations collide and Tiptap warns
 *     `Duplicate extension names found: ['link']`).
 *   - Image — installed via Plan 05 (`@tiptap/extension-image@^3.22.5`); used by
 *     the toolbar's image button after the upload-token round-trip.
 *   - Link — explicit registration with `openOnClick: false` so a click in the
 *     editor doesn't navigate the admin away (T-05-50 mitigation —
 *     defense-in-depth alongside the sanitizer).
 *   - MathInline — custom KaTeX node. Renders live in the editor but serializes
 *     to plain `$...$` / `$$...$$` text (see math-extension.ts) so it survives the
 *     sanitizer and matches the student client's auto-render.
 *
 * Save flow:
 *   - On `update` Tiptap fires getHTML(). We sanitize CLIENT-SIDE via
 *     sanitizeTiptapHtml (Plan 01) and emit through onChange. Math nodes emit
 *     `<span data-latex=…>$x$</span>`; the sanitizer strips the span and keeps
 *     the inner `$x$` text, so the persisted value is plain delimiters.
 *   - The parent (UpsertItemDialog) debounces 500ms before posting via upsertItem.
 *   - The admin-api ALSO sanitizes server-side (sanitizeTiptapHtmlServer) as
 *     the final gate (T-05-30 — defense in depth).
 *
 * controlled vs uncontrolled: the editor is uncontrolled (Tiptap manages its
 * own ProseMirror state). `initialHtml` seeds initial content (decoded so plain
 * `$...$` text becomes live math nodes); subsequent upstream changes are applied
 * via the seed effect when the prop changes (rare — only on dialog re-open with a
 * different item).
 */
export interface TiptapEditorProps {
    initialHtml: string;
    onChange: (sanitizedHtml: string) => void;
    placeholder?: string;
}

interface FormulaDialogState {
    open: boolean;
    latex: string;
    display: boolean;
    mode: 'insert' | 'edit';
    pos: number | null;
}

export function TiptapEditor({ initialHtml, onChange }: TiptapEditorProps) {
    // Stable refs to feed the latest onChange into the Tiptap instance without
    // recreating the editor on every parent rerender.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const [dialog, setDialog] = useState<FormulaDialogState>({ open: false, latex: '', display: false, mode: 'insert', pos: null });

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ link: false }),
            Image,
            Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
            MathInline,
        ],
        content: decodeMathInHtml(initialHtml ?? ''),
        // Tiptap 3 SSR safety — without this Next.js will hydrate with a different DOM
        // than the server rendered, throwing a hydration warning.
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none focus:outline-none p-3 min-h-[160px]',
            },
        },
        onUpdate: ({ editor: ed }) => {
            const raw = ed.getHTML();
            const sanitized = sanitizeTiptapHtml(raw);
            onChangeRef.current(sanitized);
        },
    });

    // Re-seed when the parent passes a new initialHtml (e.g. dialog re-opened with
    // a different item). Track the last-seeded raw value so editing the doc (which
    // changes getHTML to the node-serialized form) never triggers a clobbering reset.
    const lastSeeded = useRef<string>(initialHtml ?? '');
    useEffect(() => {
        if (!editor) return;
        if (lastSeeded.current === initialHtml) return;
        lastSeeded.current = initialHtml ?? '';
        editor.commands.setContent(decodeMathInHtml(initialHtml ?? ''), { emitUpdate: false });
    }, [editor, initialHtml]);

    // Open the formula dialog in edit mode when a math node is clicked.
    useEffect(() => {
        if (!editor) return;
        const dom = editor.view.dom;
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<MathEditEventDetail>).detail;
            setDialog({ open: true, latex: detail.latex, display: detail.display, mode: 'edit', pos: detail.pos });
        };
        dom.addEventListener(MATH_EDIT_EVENT, handler);
        return () => dom.removeEventListener(MATH_EDIT_EVENT, handler);
    }, [editor]);

    const openInsertFormula = useCallback(() => {
        setDialog({ open: true, latex: '', display: false, mode: 'insert', pos: null });
    }, []);

    const handleFormulaConfirm = useCallback(
        (latex: string, display: boolean) => {
            if (!editor) return;
            if (dialog.mode === 'edit' && dialog.pos != null) {
                editor.chain().focus().updateMathAt(dialog.pos, { latex, display }).run();
            } else {
                editor.chain().focus().setMath({ latex, display }).run();
            }
        },
        [editor, dialog.mode, dialog.pos]
    );

    if (!editor) {
        return <Skeleton className='h-48 w-full' />;
    }

    return (
        <div className='overflow-hidden rounded-md border'>
            <TiptapToolbar editor={editor} onInsertFormula={openInsertFormula} />
            <EditorContent editor={editor} />
            <FormulaDialog
                open={dialog.open}
                onOpenChange={(open) => setDialog((s) => ({ ...s, open }))}
                initialLatex={dialog.latex}
                initialDisplay={dialog.display}
                editing={dialog.mode === 'edit'}
                onConfirm={handleFormulaConfirm}
            />
        </div>
    );
}
