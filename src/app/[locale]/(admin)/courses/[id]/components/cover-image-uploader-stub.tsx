'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Cover-image uploader STUB (CRS-05 dependency on Plan 04).
 *
 * Plan 04 lands the upload-token flow + binary BFF-bypass; until then this component
 * renders a disabled button with a tooltip explaining the dependency. When Plan 04
 * lands, this file is replaced (NOT extended) with the real uploader so callers
 * stay simple.
 *
 * Props:
 *   - imageCover: current Webinar.image_cover value (may be ''). When non-empty we
 *     render a small preview <img>; otherwise a placeholder div.
 *
 * The tooltip lives within the parent's <TooltipProvider> (course-detail-client.tsx
 * wraps the whole page in TooltipProvider), so we don't re-mount one here.
 */
export interface CoverImageUploaderStubProps {
    imageCover: string;
}

export function CoverImageUploaderStub({ imageCover }: CoverImageUploaderStubProps) {
    const t = useTranslations('admin.courses');

    return (
        <div className='flex items-start gap-4'>
            <div className='bg-muted flex h-24 w-40 items-center justify-center overflow-hidden rounded border text-xs text-muted-foreground'>
                {imageCover && imageCover.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageCover} alt='' className='h-full w-full object-cover' />
                ) : (
                    <span>{t('cover_label')}</span>
                )}
            </div>
            <Tooltip>
                <TooltipTrigger asChild>
                    <span tabIndex={0}>
                        <Button variant='outline' disabled>
                            {t('choose_cover')}
                        </Button>
                    </span>
                </TooltipTrigger>
                <TooltipContent>{t('cover_upload_disabled_until_plan_04')}</TooltipContent>
            </Tooltip>
        </div>
    );
}
