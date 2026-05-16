'use client';
import { useQuery } from '@tanstack/react-query';
import type { FileFolder } from '@shared/folders';
import { listFolders } from './client';

export interface FolderNode extends FileFolder {
    children: FolderNode[];
}

export const FOLDERS_QUERY_KEY = ['admin.folders.list'] as const;

export function useFolderTree() {
    return useQuery({
        queryKey: FOLDERS_QUERY_KEY,
        queryFn: async () => {
            const res = await listFolders();
            return res.data;
        },
        staleTime: 30_000,
    });
}

/**
 * Build a tree from a flat folder list. Roots are folders with parent_id === null.
 * Children are sorted by `name` (case-insensitive) so the UI is deterministic.
 */
export function buildFolderTree(folders: FileFolder[]): FolderNode[] {
    const byId = new Map<number, FolderNode>();
    for (const folder of folders) {
        byId.set(folder.id, { ...folder, children: [] });
    }
    const roots: FolderNode[] = [];
    for (const folder of folders) {
        const node = byId.get(folder.id)!;
        if (folder.parent_id === null) {
            roots.push(node);
        } else {
            const parent = byId.get(folder.parent_id);
            if (parent) {
                parent.children.push(node);
            } else {
                // Orphaned (parent deleted) — surface at root so it's not lost.
                roots.push(node);
            }
        }
    }
    const sortRec = (nodes: FolderNode[]) => {
        nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        for (const n of nodes) sortRec(n.children);
    };
    sortRec(roots);
    return roots;
}

export function findFolderById(folders: FileFolder[], id: number | null): FileFolder | null {
    if (id === null) return null;
    return folders.find((f) => f.id === id) ?? null;
}

/**
 * Walk parents from leaf to root and return the resulting chain (root first).
 * Returns an empty array when `id` is null (root) or the folder is missing.
 */
export function getBreadcrumbs(folders: FileFolder[], id: number | null): FileFolder[] {
    if (id === null) return [];
    const byId = new Map(folders.map((f) => [f.id, f]));
    const chain: FileFolder[] = [];
    let cursor: number | null = id;
    let safety = 0;
    while (cursor !== null && safety < 50) {
        const node = byId.get(cursor);
        if (!node) break;
        chain.unshift(node);
        cursor = node.parent_id;
        safety += 1;
    }
    return chain;
}
