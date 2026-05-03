'use client';

import { useRef } from 'react';
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
import { toast } from 'sonner';
import { Toggle } from '@/components/ui/toggle';
import { Button } from '@/components/ui/button';
import { requestUploadToken, uploadFileDirect } from '@/lib/courses/upload-client';
import type { UploadContentType } from '@/lib/courses/types';

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
 * Image flow: opens a hidden file input, runs the Plan 04 upload-token round-trip
 * (BFF → admin-api token, then BFF-bypass binary upload via XHR), then inserts
 * the resulting URL into the document via `setImage({src})`.
 *
 * Link flow: window.prompt for URL (replace with a dialog in a future polish);
 * Tiptap's link extension carries openOnClick=false (configured at editor init)
 * to prevent a click in the editor from navigating away.
 */

const ALLOWED_IMAGE_MIMES: readonly UploadContentType[] = ['image/jpeg', 'image/png', 'image/webp'];
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export interface TiptapToolbarProps {
    editor: Editor;
}

export function TiptapToolbar({ editor }: TiptapToolbarProps) {
    const t = useTranslations('admin.courses');
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    const handleImageClick = () => {
        fileInputRef.current?.click();
    };

    const handleImagePicked = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (!file) return;

        if (file.size > IMAGE_MAX_BYTES) {
            toast.error(t('upload_file_too_large'));
            return;
        }
        if (!ALLOWED_IMAGE_MIMES.includes(file.type as UploadContentType)) {
            toast.error(t('upload_mime_not_allowed'));
            return;
        }

        try {
            const tokenRes = await requestUploadToken({
                kind: 'image',
                size: file.size,
                content_type: file.type as UploadContentType,
            });
            const result = await uploadFileDirect(tokenRes.upload_url, tokenRes.token, file);
            editor.chain().focus().setImage({ src: result.file_url, alt: file.name }).run();
            toast.success(t('upload_succeeded'));
        } catch (err) {
            const msg = (err as Error)?.message ?? '';
            if (msg.includes('upload.token_already_used')) {
                toast.error(t('upload_already_used'));
            } else if (msg.includes('upload.token_invalid') || msg.includes('upload.token_missing')) {
                toast.error(t('upload_token_expired'));
            } else if (msg.includes('upload.size_exceeds') || msg.includes('upload.content_type')) {
                toast.error(t('upload_file_too_large'));
            } else {
                toast.error(t('upload_failed'));
            }
        }
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
            <input
                ref={fileInputRef}
                type='file'
                accept={ALLOWED_IMAGE_MIMES.join(',')}
                className='hidden'
                onChange={handleImagePicked}
                aria-hidden
            />
        </div>
    );
}
