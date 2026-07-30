import type { PDFDocumentProxy } from 'pdfjs-dist';
import { extractPageText, looksLikeRealText } from './extract-page-text';

/** Ширина отрендеренной страницы в пикселях. 1600 — компромисс читаемости и веса. */
export const TARGET_WIDTH_PX = 1600;

/**
 * Потолок площади холста. Развороты и плакаты в учебниках дают огромные страницы,
 * а Safari молча отдаёт пустой холст выше ~16 Мпикс.
 */
const MAX_CANVAS_PIXELS = 16_000_000;

/** Лимит сервера на картинку (uploads.service.ts, kind='image'). Держим запас. */
const IMAGE_CAP_BYTES = 10 * 1024 * 1024;
const SAFE_IMAGE_BYTES = 9 * 1024 * 1024;

const QUALITY_LADDER = [0.82, 0.7, 0.6];

export interface RenderedPage {
    /** Номер страницы в PDF, начиная с 1. */
    pageNumber: number;
    blob: Blob;
    mime: string;
    /** Текстовый слой; null, когда его нет или он похож на мусор. */
    text: string | null;
}

/** WebP экономит около трети веса при том же качестве; JPEG — запасной вариант. */
function pickMime(canvas: HTMLCanvasElement): string {
    const webp = canvas.toDataURL('image/webp', 0.5);
    return webp.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
}

function toBlob(canvas: HTMLCanvasElement, mime: string, quality: number): Promise<Blob | null> {
    return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

/**
 * Рендерит страницы PDF в картинки — по одной, лениво.
 *
 * Генератор, а не массив: книга на триста страниц в виде массива блобов — это
 * сотни мегабайт в памяти вкладки. Вызывающий код забирает страницу, грузит её
 * и отпускает, поэтому одновременно живёт ровно один блоб.
 *
 * Холст переиспользуется между страницами по той же причине.
 */
export async function* renderPdfPages(
    doc: PDFDocumentProxy,
    options: { fromPage: number; signal?: AbortSignal },
): AsyncGenerator<RenderedPage> {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) throw new Error('canvas_unavailable');

    let mime: string | null = null;

    try {
        for (let pageNumber = options.fromPage; pageNumber <= doc.numPages; pageNumber++) {
            if (options.signal?.aborted) return;

            const page = await doc.getPage(pageNumber);
            try {
                const base = page.getViewport({ scale: 1 });
                const byWidth = TARGET_WIDTH_PX / base.width;
                const byArea = Math.sqrt(MAX_CANVAS_PIXELS / (base.width * base.height));
                const viewport = page.getViewport({ scale: Math.min(byWidth, byArea) });

                canvas.width = Math.floor(viewport.width);
                canvas.height = Math.floor(viewport.height);
                // Страницы PDF прозрачны: без заливки белым сканы уедут в чёрный
                // фон после конвертации в JPEG.
                context.fillStyle = '#ffffff';
                context.fillRect(0, 0, canvas.width, canvas.height);

                await page.render({ canvas, canvasContext: context, viewport, background: '#ffffff' }).promise;

                if (!mime) mime = pickMime(canvas);

                let blob: Blob | null = null;
                for (const quality of QUALITY_LADDER) {
                    blob = await toBlob(canvas, mime, quality);
                    if (blob && blob.size <= SAFE_IMAGE_BYTES) break;
                }
                if (!blob) throw new Error('render_failed');
                if (blob.size > IMAGE_CAP_BYTES) throw new Error('page_too_heavy');

                let text: string | null = null;
                try {
                    const content = await page.getTextContent();
                    const extracted = extractPageText(content);
                    text = looksLikeRealText(extracted) ? extracted : null;
                } catch {
                    // Битый текстовый слой не повод терять картинку страницы.
                    text = null;
                }

                yield { pageNumber, blob, mime, text };
            } finally {
                page.cleanup();
            }
        }
    } finally {
        canvas.width = 0;
        canvas.height = 0;
    }
}

/**
 * Быстрая проба текстового слоя по нескольким страницам — чтобы предупредить
 * оператора ДО импорта, что книга окажется картинками без поиска.
 */
export async function probeTextLayer(doc: PDFDocumentProxy, sample = 5): Promise<boolean> {
    const step = Math.max(1, Math.floor(doc.numPages / sample));

    for (let i = 1; i <= doc.numPages; i += step) {
        const page = await doc.getPage(i);
        try {
            const text = extractPageText(await page.getTextContent());
            if (looksLikeRealText(text)) return true;
        } catch {
            // пропускаем страницу
        } finally {
            page.cleanup();
        }
    }
    return false;
}
