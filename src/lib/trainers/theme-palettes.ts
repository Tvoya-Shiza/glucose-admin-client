import { TRAINER_THEME_PALETTES, type TrainerThemePalette } from '@shared/trainers';

/**
 * Образцы палитр для выбора темы (phase-43).
 *
 * Здесь лежат ТОЛЬКО hex'ы для кружков-превью в форме. Реальные плитки ответов
 * красит клиент ученика своими классами Tailwind
 * (glucose-client/src/shared/config/trainer-palettes.ts) — общий CSS-рантайм у
 * приложений отсутствует, поэтому цвета неизбежно описаны дважды.
 *
 * ВАЖНО: при правке набора цветов править оба файла. Ключи палитр общие и
 * приходят из @shared/trainers, так что «потерять» палитру целиком нельзя —
 * разъехаться могут только оттенки.
 */
export const TRAINER_PALETTE_SWATCHES: Record<TrainerThemePalette, readonly string[]> = {
    classic: ['#fbbf24', '#8b5cf6', '#f97316', '#14b8a6', '#0ea5e9', '#ec4899'],
    ocean: ['#0ea5e9', '#06b6d4', '#3b82f6', '#14b8a6', '#6366f1', '#0891b2'],
    sunset: ['#f97316', '#ef4444', '#ec4899', '#f59e0b', '#e11d48', '#fb7185'],
    forest: ['#16a34a', '#65a30d', '#059669', '#84cc16', '#15803d', '#4d7c0f'],
    mono: ['#0f4f44', '#166f5f', '#1f8a77', '#2aa58f', '#3fbfa7', '#5bd6bf'],
};

/** Названия палитр для селекта (kz — единственная локаль админки). */
export const TRAINER_PALETTE_LABELS: Record<TrainerThemePalette, string> = {
    classic: 'Классикалық',
    ocean: 'Мұхит',
    sunset: 'Күн батысы',
    forest: 'Орман',
    mono: 'Бір реңк',
};

export const TRAINER_PALETTE_OPTIONS = TRAINER_THEME_PALETTES;

export type { TrainerThemePalette };
