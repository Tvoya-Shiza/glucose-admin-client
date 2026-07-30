import type { PDFDocumentProxy } from 'pdfjs-dist';

/**
 * Ленивая загрузка pdf.js для импорта книги из PDF.
 *
 * ⚠️ НИКОГДА не импортировать pdfjs-dist на верхнем уровне модуля. Библиотека —
 * чистый ESM и трогает DOMMatrix / Path2D / OffscreenCanvas, которых нет в
 * Node: любой top-level импорт (даже в типах через `import {}` без `type`)
 * ломает сборку standalone-сервера Next. Только `await import()` внутри
 * обработчика. Тот же приём уже применён для jspdf в rating-journal/export.ts.
 *
 * Воркер подключаем через `new URL(..., import.meta.url)`, а НЕ через public/:
 *   - директории public/ у админки нет, и admin-client.Dockerfile её не
 *     копирует в runner (COPY только .next/standalone и .next/static) — файл,
 *     положенный в public/, отдавал бы 404 ровно на проде, а локально работал;
 *   - при таком импорте бандлер сам кладёт воркер в .next/static и подставляет
 *     верный путь, а версия воркера всегда совпадает с версией библиотеки.
 *     Расхождение версий pdf.js встречает ошибкой «The API version does not
 *     match the Worker version».
 */

type PdfjsModule = typeof import('pdfjs-dist');

let modulePromise: Promise<PdfjsModule> | null = null;

async function loadPdfjs(): Promise<PdfjsModule> {
    if (!modulePromise) {
        modulePromise = (async () => {
            const pdfjs = await import('pdfjs-dist');
            // Отдельный поток: рендер 300 страниц в главном потоке заморозил бы
            // вкладку на всё время импорта, включая индикатор прогресса.
            pdfjs.GlobalWorkerOptions.workerPort = new Worker(
                new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
                { type: 'module' },
            );
            return pdfjs;
        })();
    }
    return modulePromise;
}

/**
 * Открывает PDF из выбранного файла.
 *
 * `useSystemFonts` оставляем включённым (значение по умолчанию в браузере): без
 * набора standard_fonts pdf.js подставляет системные шрифты для базовых 14.
 * Класть сами шрифты некуда — см. комментарий про public/ выше.
 */
export async function openPdfDocument(file: File): Promise<PDFDocumentProxy> {
    const pdfjs = await loadPdfjs();
    const data = new Uint8Array(await file.arrayBuffer());

    return pdfjs.getDocument({
        data,
        // Пароли и запароленные документы не поддерживаем: заказчик грузит
        // собственные учебники, а тихий запрос пароля повесил бы импорт.
        password: '',
        isEvalSupported: false,
    }).promise;
}
