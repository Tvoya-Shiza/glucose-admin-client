import type { UploadContentType } from '@shared/uploads';
import { requestUploadToken, uploadFileDirect } from '@/lib/uploads/client';
import { replaceBookPages } from '@/lib/ebooks/api';
import type { ReplacePageInput } from '@/lib/ebooks/types';
import { openPdfDocument } from './pdfjs-loader';
import { renderPdfPages } from './render-pdf-pages';

/**
 * Сколько страниц копим перед отправкой на сервер.
 *
 * Каждый PUT /ebooks/:id/pages сбрасывает кэш книг в Redis (два прохода SCAN
 * по всему кейспейсу) и пересчитывает page_count, поэтому частые мелкие флаши
 * бьют по серверу сильнее, чем редкие крупные. Верхняя граница — лимит тела
 * запроса admin-api (10 МБ JSON): даже при страницах с плотным текстовым слоем
 * пятьдесят страниц в него укладываются с запасом.
 */
const FLUSH_PAGES = 50;
const FLUSH_BYTES = 4 * 1024 * 1024;

/**
 * Пауза между страницами. Глобальный троттлер admin-api — 100 запросов в минуту
 * на связку «обработчик + IP»; на страницу приходится по одному запросу к
 * /uploads/token и к /uploads/file. Держим темп заведомо ниже лимита, иначе
 * импорт начнёт ловить 429 и заодно перекроет загрузку файлов остальным.
 */
const MIN_MS_PER_PAGE = 700;

const MAX_RETRIES = 4;

export interface PdfImportProgress {
    /** Всего страниц в PDF. */
    total: number;
    /** Сколько уже сохранено в книге. */
    done: number;
    /** Номер страницы книги, который сейчас обрабатывается. */
    currentBookPage: number;
    /** Страницы PDF, которые не удалось перенести. */
    failed: number[];
    /** Найден ли текстовый слой (влияет на поиск по книге). */
    hasText: boolean;
}

export interface PdfImportOptions {
    bookId: number;
    file: File;
    /** С какого номера класть страницы книги: продолжение нумерации или 1. */
    startPageNumber: number;
    signal: AbortSignal;
    onProgress: (progress: PdfImportProgress) => void;
}

export interface PdfImportResult {
    imported: number;
    failed: number[];
    hasText: boolean;
    aborted: boolean;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Загружает одну отрендеренную страницу и возвращает её URL.
 *
 * Токен запрашивается ПОСЛЕ рендера и под конкретный размер: admin-api
 * подписывает `size` и `content_type` в claims и отбивает файл, который им не
 * соответствует. Поэтому запросить пачку токенов заранее нельзя — размеры
 * станут известны только после сжатия.
 *
 * Повторяем на 429 (троттлер), 401 (токен протух — TTL 5 минут) и сетевых
 * ошибках: обрывать импорт книги из-за одной неудачной страницы нельзя.
 */
async function uploadPage(blob: Blob, mime: string, name: string, signal: AbortSignal): Promise<string> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (signal.aborted) throw new Error('aborted');
        try {
            const token = await requestUploadToken({
                kind: 'image',
                size: blob.size,
                content_type: mime as UploadContentType,
            });
            // Именно File, а не Blob: сервер сверяет MIME с подписанным в токене
            // и сохраняет исходное имя — у голого Blob оно было бы «blob» у всех
            // страниц сразу.
            const file = new File([blob], name, { type: mime });
            const handle = uploadFileDirect(token.upload_url, token.token, file);
            const result = await handle.promise;
            return result.file_url;
        } catch (err) {
            lastError = err;
            const message = err instanceof Error ? err.message : String(err);
            if (message === 'aborted') throw err;
            // Троттлер отпускает через минуту, протухший токен перевыпускается
            // сразу — растущая пауза покрывает оба случая.
            await sleep(1500 * (attempt + 1));
        }
    }

    throw lastError instanceof Error ? lastError : new Error('upload_failed');
}

/**
 * Импорт книги из PDF: рендер страниц в браузере, загрузка картинок и
 * сохранение их как страниц книги.
 *
 * Сохраняем порциями по ходу дела, а не одним куском в конце: импорт трёхсот
 * страниц занимает минуты, и при закрытой вкладке или обрыве сети уже
 * перенесённые страницы должны остаться в книге.
 */
export async function runPdfImport(options: PdfImportOptions): Promise<PdfImportResult> {
    const { bookId, file, startPageNumber, signal, onProgress } = options;

    const doc = await openPdfDocument(file);
    const total = doc.numPages;

    const progress: PdfImportProgress = {
        total,
        done: 0,
        currentBookPage: startPageNumber,
        failed: [],
        hasText: false,
    };
    onProgress({ ...progress });

    let pending: ReplacePageInput[] = [];
    let pendingBytes = 0;

    const flush = async () => {
        if (pending.length === 0) return;
        await replaceBookPages(bookId, { pages: pending });
        progress.done += pending.length;
        pending = [];
        pendingBytes = 0;
        onProgress({ ...progress });
    };

    try {
        for await (const page of renderPdfPages(doc, { fromPage: 1, signal })) {
            if (signal.aborted) break;

            const startedAt = Date.now();
            const bookPageNumber = startPageNumber + page.pageNumber - 1;
            progress.currentBookPage = bookPageNumber;

            const extension = page.mime === 'image/webp' ? 'webp' : 'jpg';
            const name = `book-${bookId}-p${String(page.pageNumber).padStart(4, '0')}.${extension}`;

            try {
                const imageUrl = await uploadPage(page.blob, page.mime, name, signal);
                if (page.text) progress.hasText = true;

                pending.push({
                    page_number: bookPageNumber,
                    image_url: imageUrl,
                    // Явный null, а не пропуск поля: сервер не трогает колонку,
                    // если ключа нет, и от прежней страницы остался бы чужой
                    // текст — он молча ушёл бы в поисковый индекс.
                    text_content: page.text,
                });
                pendingBytes += (page.text?.length ?? 0) + 128;
            } catch {
                progress.failed.push(page.pageNumber);
            }

            onProgress({ ...progress });

            if (pending.length >= FLUSH_PAGES || pendingBytes >= FLUSH_BYTES) {
                await flush();
            }

            const elapsed = Date.now() - startedAt;
            if (elapsed < MIN_MS_PER_PAGE) await sleep(MIN_MS_PER_PAGE - elapsed);
        }

        await flush();
    } finally {
        await doc.destroy().catch(() => undefined);
    }

    return {
        imported: progress.done,
        failed: progress.failed,
        hasText: progress.hasText,
        aborted: signal.aborted,
    };
}
