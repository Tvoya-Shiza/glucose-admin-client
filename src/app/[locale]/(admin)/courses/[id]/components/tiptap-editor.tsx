'use client';

import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import { sanitizeTiptapHtml } from '@/lib/sanitize/sanitize-html';
import { Skeleton } from '@/components/ui/skeleton';
import { TiptapToolbar } from './tiptap-toolbar';

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
 *
 * Save flow:
 *   - On `update` Tiptap fires getHTML(). We sanitize CLIENT-SIDE via
 *     sanitizeTiptapHtml (Plan 01) and emit through onChange.
 *   - The parent (UpsertItemDialog) debounces 500ms before posting via upsertItem.
 *   - The admin-api ALSO sanitizes server-side (sanitizeTiptapHtmlServer) as
 *     the final gate (T-05-30 — defense in depth).
 *
 * controlled vs uncontrolled: the editor is uncontrolled (Tiptap manages its
 * own ProseMirror state). `initialHtml` seeds initial content; subsequent
 * upstream changes are applied via the `setContent` effect when the prop
 * reference changes (rare — only on dialog re-open with a different item).
 */
export interface TiptapEditorProps {
    initialHtml: string;
    onChange: (sanitizedHtml: string) => void;
    placeholder?: string;
}

export function TiptapEditor({ initialHtml, onChange }: TiptapEditorProps) {
    // Stable refs to feed the latest onChange into the Tiptap instance without
    // recreating the editor on every parent rerender.
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    }, [onChange]);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({ link: false }),
            Image,
            Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
        ],
        content: initialHtml,
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

    // If the parent passes a new initialHtml (e.g. dialog re-opened with a
    // different item), reset the editor content. We compare against the live
    // doc's HTML to avoid a no-op cycle.
    useEffect(() => {
        if (!editor) return;
        const current = editor.getHTML();
        if (current !== initialHtml) {
            editor.commands.setContent(initialHtml ?? '', { emitUpdate: false });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editor, initialHtml]);

    if (!editor) {
        return <Skeleton className='h-48 w-full' />;
    }

    return (
        <div className='overflow-hidden rounded-md border'>
            <TiptapToolbar editor={editor} />
            <EditorContent editor={editor} />
        </div>
    );
}
