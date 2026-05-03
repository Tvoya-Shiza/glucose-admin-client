/**
 * Tiptap 3 + React 19 compatibility spike (Plan 01 / STATE.md gate).
 *
 * Purpose: surface incompatibilities (peer-dep mismatches, runtime errors,
 * missing exports) at PLAN 01 time so Plan 05 doesn't burn its budget
 * discovering them. This file is type-checked and bundled by next build,
 * which is the actual spike — IF tsc + next build pass, the imports resolve
 * and the runtime contract is approximately honored.
 *
 * No exports are USED at runtime in Phase 5 — Plan 05 will replace this with
 * a real editor wiring. Keeping it as a probe lets us re-run the spike on
 * dependency upgrades.
 */
import { Editor, EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import DOMPurify from 'dompurify';

// Reference identifiers so tree-shaking doesn't drop them silently.
export const __TIPTAP_PROBE = {
    Editor: Editor as unknown,
    EditorContent: EditorContent as unknown,
    useEditor: useEditor as unknown,
    StarterKit: StarterKit as unknown,
    DOMPurify: DOMPurify as unknown,
};
