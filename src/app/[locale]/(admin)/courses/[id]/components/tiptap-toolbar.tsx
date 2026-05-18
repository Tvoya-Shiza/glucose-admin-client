'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { Editor } from '@tiptap/react';
import {
    Bold,
    Italic,
    Underline,
    Strikethrough,
    Heading1,
    Heading2,
    Heading3,
    List,
    ListOrdered,
    Quote,
    Code as CodeIcon,
    Link as LinkIcon,
    Image as ImageIcon,
} from 'lucide-react';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { FileLibraryPicker } from '@/components/ui/file-library-picker';

/**
 * TiptapToolbar — custom toolbar for Tiptap 3.
 *
 * Per Plan 01 spike verdict (PREBUILT_UI_BROKEN_FALLBACK_TO_TOOLBAR), Tiptap 3
 * ships no first-party prebuilt UI; the consumer owns it. This component is
 * built from shadcn `<Toggle>` + `<Button>` primitives (vendored Plan 01).
 *
 * Active-state reflection: each Toggle reads `editor.isActive('mark')` and
 * its onPressedChange runs `editor.chain().focus().toggleX().run()`.
 *
 * Image flow: opens FileLibraryPicker → user picks an existing asset, uploads
 * a new one into a chosen folder, or pastes a URL → setImage({src}) inserts it.
 *
 * Link flow: window.prompt for URL (replace with a dialog in a future polish);
 * Tiptap's link extension carries openOnClick=false (configured at editor init)
 * to prevent a click in the editor from navigating away.
 */

export interface TiptapToolbarProps {
    editor: Editor;
}

export function TiptapToolbar({ editor }: TiptapToolbarProps) {
    const t = useTranslations('admin.courses');
    const [pickerOpen, setPickerOpen] = useState(false);

    const handleImageClick = () => {
        setPickerOpen(true);
    };

    const handleLinkClick = () => {
        const previousUrl = (editor.getAttributes('link') as { href?: string } | undefined)?.href ?? '';
        const url = typeof window !== 'undefined' ? window.prompt(t('tiptap_link_url_prompt'), previousUrl) : null;
        if (url === null) return; // cancelled
        if (url === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
            return;
        }
        editor.chain().focus().extendMarkRange('link').setLink({ href: url, target: '_blank', rel: 'noopener noreferrer' }).run();
    };

    return (
        <div className='flex flex-wrap items-center gap-1 border-b p-2'>
            <Toggle
                size='sm'
                pressed={editor.isActive('bold')}
                onPressedChange={() => editor.chain().focus().toggleBold().run()}
                aria-label={t('tiptap_bold')}
                title={t('tiptap_bold')}
            >
                <Bold className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('italic')}
                onPressedChange={() => editor.chain().focus().toggleItalic().run()}
                aria-label={t('tiptap_italic')}
                title={t('tiptap_italic')}
            >
                <Italic className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('underline')}
                onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
                aria-label={t('tiptap_underline')}
                title={t('tiptap_underline')}
            >
                <Underline className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('strike')}
                onPressedChange={() => editor.chain().focus().toggleStrike().run()}
                aria-label={t('tiptap_strike')}
                title={t('tiptap_strike')}
            >
                <Strikethrough className='h-4 w-4' />
            </Toggle>

            <span className='bg-border mx-1 h-6 w-px' aria-hidden />

            <Toggle
                size='sm'
                pressed={editor.isActive('heading', { level: 1 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                aria-label={t('tiptap_h1')}
                title={t('tiptap_h1')}
            >
                <Heading1 className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('heading', { level: 2 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                aria-label={t('tiptap_h2')}
                title={t('tiptap_h2')}
            >
                <Heading2 className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('heading', { level: 3 })}
                onPressedChange={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                aria-label={t('tiptap_h3')}
                title={t('tiptap_h3')}
            >
                <Heading3 className='h-4 w-4' />
            </Toggle>

            <span className='bg-border mx-1 h-6 w-px' aria-hidden />

            <Toggle
                size='sm'
                pressed={editor.isActive('bulletList')}
                onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
                aria-label={t('tiptap_bullet_list')}
                title={t('tiptap_bullet_list')}
            >
                <List className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('orderedList')}
                onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
                aria-label={t('tiptap_ordered_list')}
                title={t('tiptap_ordered_list')}
            >
                <ListOrdered className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('blockquote')}
                onPressedChange={() => editor.chain().focus().toggleBlockquote().run()}
                aria-label={t('tiptap_blockquote')}
                title={t('tiptap_blockquote')}
            >
                <Quote className='h-4 w-4' />
            </Toggle>
            <Toggle
                size='sm'
                pressed={editor.isActive('codeBlock')}
                onPressedChange={() => editor.chain().focus().toggleCodeBlock().run()}
                aria-label={t('tiptap_code_block')}
                title={t('tiptap_code_block')}
            >
                <CodeIcon className='h-4 w-4' />
            </Toggle>

            <span className='bg-border mx-1 h-6 w-px' aria-hidden />

            <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={handleLinkClick}
                aria-label={t('tiptap_link')}
                title={t('tiptap_link')}
            >
                <LinkIcon className='h-4 w-4' />
            </Button>
            <Button
                type='button'
                variant='ghost'
                size='sm'
                onClick={handleImageClick}
                aria-label={t('tiptap_image')}
                title={t('tiptap_image')}
            >
                <ImageIcon className='h-4 w-4' />
            </Button>
            <FileLibraryPicker
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                kind='image'
                onPick={(url, meta) => {
                    const alt = meta.original_name ?? '';
                    editor.chain().focus().setImage({ src: url, alt }).run();
                }}
            />
        </div>
    );
}
