import { Badge } from '@/components/ui/badge';
import type { CreditDifficulty } from '@/lib/credits/types';

const VARIANT_BY_DIFFICULTY: Record<CreditDifficulty, 'success' | 'info' | 'warning'> = {
    A: 'success',
    B: 'info',
    C: 'warning',
};

/** Compact A/B/C difficulty pill (A = easy, C = hard). */
export function DifficultyBadge({ difficulty, className }: { difficulty: CreditDifficulty; className?: string }) {
    return (
        <Badge variant={VARIANT_BY_DIFFICULTY[difficulty]} className={className}>
            {difficulty}
        </Badge>
    );
}
