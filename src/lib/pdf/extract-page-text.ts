import type { TextContent, TextItem } from 'pdfjs-dist/types/src/display/api';

/** Минимум осмысленных символов, чтобы считать, что у страницы есть текстовый слой. */
export const MIN_TEXT_CHARS = 15;

/**
 * Сборка текста страницы из элементов pdf.js.
 *
 * pdf.js отдаёт текст кусками с координатами, без переносов строк: наивная
 * склейка через пробел превращает страницу в одну строку, а склейка без
 * пробелов слепляет слова. Ориентируемся на вертикальную координату (transform[5]):
 * заметный сдвиг вниз — новая строка. Флаг `hasEOL` у pdf.js есть не всегда,
 * поэтому полагаться только на него нельзя.
 *
 * Текст нужен для поиска по учебнику (book_page_index в Postgres), а не для
 * показа, поэтому точная типографика неважна — важно, чтобы слова не слипались
 * и строки не терялись.
 */
export function extractPageText(content: TextContent): string {
    const lines: string[] = [];
    let current = '';
    let prevY: number | null = null;
    let prevEndX: number | null = null;

    for (const raw of content.items) {
        const item = raw as TextItem;
        if (typeof item.str !== 'string') continue;

        const y = item.transform?.[5] ?? 0;
        const x = item.transform?.[4] ?? 0;
        const height = item.height || 10;

        // Сдвиг больше половины высоты строки — считаем новой строкой.
        const isNewLine = prevY !== null && Math.abs(y - prevY) > height * 0.5;

        if (isNewLine) {
            if (current.trim().length > 0) lines.push(current.trim());
            current = '';
            prevEndX = null;
        }

        // Внутри строки pdf.js часто разрывает слово на куски без пробела.
        // Пробел ставим, только если между кусками есть заметный зазор.
        if (current.length > 0 && prevEndX !== null && x - prevEndX > 1) {
            current += ' ';
        }

        current += item.str;
        if (item.hasEOL) {
            if (current.trim().length > 0) lines.push(current.trim());
            current = '';
            prevEndX = null;
            prevY = y;
            continue;
        }

        prevY = y;
        prevEndX = x + (item.width || 0);
    }

    if (current.trim().length > 0) lines.push(current.trim());

    return lines.join('\n').replace(/[ \t]{2,}/g, ' ').trim();
}

/**
 * Похож ли извлечённый текст на настоящий текстовый слой.
 *
 * У субсетных шрифтов без ToUnicode (типовой случай для учебников, свёрстанных
 * в InDesign) pdf.js возвращает связный по объёму, но бессмысленный набор
 * символов. Такой мусор попал бы в поисковый индекс и остался бы там незаметно:
 * список страниц отдаёт только признак `has_text`, сам текст не показывается.
 *
 * Грубая, но рабочая проверка: доля букв и цифр среди непробельных символов.
 * У настоящего текста она близка к единице, у мусора из подменённых глифов —
 * заметно ниже.
 */
export function looksLikeRealText(text: string): boolean {
    const compact = text.replace(/\s+/g, '');
    if (compact.length < MIN_TEXT_CHARS) return false;

    const meaningful = compact.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
    return meaningful / compact.length >= 0.6;
}
