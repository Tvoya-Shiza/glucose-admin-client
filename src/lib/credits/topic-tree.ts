import type { CreditTopic } from './types';

/**
 * Adjacency-list → tree helpers for credit topics. Clones the buildTree
 * approach from quizzes/categories/categories-tree-client.tsx, adapted to
 * STRING ids (credit-domain ids are BigInt-as-string).
 */

export interface CreditTopicNode extends CreditTopic {
    children: CreditTopicNode[];
}

const CLIENT_DEPTH_GUARD = 50;

export function buildCreditTopicTree(rows: CreditTopic[]): CreditTopicNode[] {
    const nodes = new Map<string, CreditTopicNode>();
    for (const r of rows) {
        nodes.set(r.id, { ...r, children: [] });
    }
    const roots: CreditTopicNode[] = [];
    for (const node of nodes.values()) {
        if (node.parent_id != null && nodes.has(node.parent_id)) {
            nodes.get(node.parent_id)!.children.push(node);
        } else {
            roots.push(node);
        }
    }
    // Iterative depth-prune (belt-and-braces against cyclic parent data).
    function prune(level: CreditTopicNode[], depth: number): void {
        if (depth >= CLIENT_DEPTH_GUARD) {
            for (const n of level) n.children = [];
            return;
        }
        for (const n of level) prune(n.children, depth + 1);
    }
    prune(roots, 0);
    // Sort siblings by position ASC, then name.
    function sortSiblings(level: CreditTopicNode[]): void {
        level.sort((a, b) => (a.position !== b.position ? a.position - b.position : a.name.localeCompare(b.name)));
        for (const n of level) sortSiblings(n.children);
    }
    sortSiblings(roots);
    return roots;
}

/** Depth-first flatten preserving tree order — for indented flat selects. */
export function flattenCreditTopicTree(roots: CreditTopicNode[]): Array<{ node: CreditTopicNode; depth: number }> {
    const out: Array<{ node: CreditTopicNode; depth: number }> = [];
    function walk(level: CreditTopicNode[], depth: number): void {
        for (const n of level) {
            out.push({ node: n, depth });
            if (n.children.length > 0) walk(n.children, depth + 1);
        }
    }
    walk(roots, 0);
    return out;
}

/** The node's own id plus every descendant id (parent checkbox toggles the subtree). */
export function collectTopicSubtreeIds(node: CreditTopicNode): string[] {
    const out: string[] = [];
    function walk(n: CreditTopicNode): void {
        out.push(n.id);
        for (const c of n.children) walk(c);
    }
    walk(node);
    return out;
}
