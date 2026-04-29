'use client';

import { useCallback, useMemo, useState } from 'react';

export interface UseBulkSelectionApi<TId extends string | number = number> {
    selected: Set<TId>;
    selectedCount: number;
    isSelected: (id: TId) => boolean;
    toggle: (id: TId) => void;
    togglePageScoped: (pageRows: ReadonlyArray<{ id: TId }>) => void;
    isPageAllSelected: (pageRows: ReadonlyArray<{ id: TId }>) => boolean;
    clear: () => void;
}

/**
 * Page-scoped bulk-selection state (D-12 from CONTEXT — there is NO global
 * "select all 12k" affordance, by hard requirement).
 *
 * `togglePageScoped(currentlyRenderedRows)` selects all of those rows, OR clears
 * them if all are currently selected. The hook never touches rows that aren't
 * passed in — selection across pages is opt-in by clicking through pages.
 *
 * Reused by Phase 3 Plans 05/06 (users) and Phase 7 (Stories/Banners/Blogs).
 */
export function useBulkSelection<TId extends string | number = number>(): UseBulkSelectionApi<TId> {
    const [selected, setSelected] = useState<Set<TId>>(() => new Set());

    const isSelected = useCallback((id: TId) => selected.has(id), [selected]);

    const toggle = useCallback((id: TId) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const isPageAllSelected = useCallback(
        (pageRows: ReadonlyArray<{ id: TId }>) => {
            if (pageRows.length === 0) return false;
            for (const r of pageRows) if (!selected.has(r.id)) return false;
            return true;
        },
        [selected],
    );

    const togglePageScoped = useCallback((pageRows: ReadonlyArray<{ id: TId }>) => {
        setSelected((prev) => {
            const allSelected = pageRows.every((r) => prev.has(r.id));
            const next = new Set(prev);
            if (allSelected) {
                for (const r of pageRows) next.delete(r.id);
            } else {
                for (const r of pageRows) next.add(r.id);
            }
            return next;
        });
    }, []);

    const clear = useCallback(() => setSelected(new Set()), []);

    const api = useMemo<UseBulkSelectionApi<TId>>(
        () => ({
            selected,
            selectedCount: selected.size,
            isSelected,
            toggle,
            togglePageScoped,
            isPageAllSelected,
            clear,
        }),
        [selected, isSelected, toggle, togglePageScoped, isPageAllSelected, clear],
    );

    return api;
}
