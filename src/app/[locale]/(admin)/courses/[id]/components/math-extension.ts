import { Node, nodeInputRule } from '@tiptap/core';
import katex from 'katex';

/**
 * MathInline — a custom Tiptap 3 node for LaTeX math.
 *
 * Design goal: live WYSIWYG rendering in the editor, but persistence as PLAIN
 * `$...$` / `$$...$$` text so it survives every sanitizer untouched (the admin
 * client + admin-api sanitizers set `ALLOW_DATA_ATTR: false` and do NOT allow
 * `span`, so a `data-latex`-only node would be destroyed on save). The student
 * client already auto-renders `$...$` via `katex/contrib/auto-render`.
 *
 * How the round-trip works:
 *   - In-editor: an inline atom node renders KaTeX through a NodeView.
 *   - `renderHTML` emits `<span data-latex=…>$latex$</span>`. The editor's
 *     `sanitizeTiptapHtml` strips the `<span>` + `data-*` and KEEPS the inner
 *     `$latex$` text, so what is saved/emitted is plain `$latex$`.
 *   - On load, content from the DB is plain `$latex$` text. `decodeMathInHtml`
 *     (below) rewraps those runs in `<span data-latex=…>` markers so `parseHTML`
 *     turns them back into live nodes. That conversion is editor-only and never
 *     persisted.
 *
 * A single node carries a `display` flag (inline `$…$` vs block `$$…$$`) — this
 * avoids ProseMirror block-placement headaches of a separate block node.
 */

export interface MathAttributes {
    latex: string;
    display: boolean;
}

declare module '@tiptap/core' {
    interface Commands<ReturnType> {
        mathInline: {
            /** Insert a math node at the current selection. */
            setMath: (attrs: MathAttributes) => ReturnType;
            /** Replace the attributes of the math node at `pos`. */
            updateMathAt: (pos: number, attrs: MathAttributes) => ReturnType;
        };
    }
}

/** DOM CustomEvent dispatched on the editor root when a math node is clicked. */
export const MATH_EDIT_EVENT = 'glucose:math-edit';
export interface MathEditEventDetail {
    pos: number | null;
    latex: string;
    display: boolean;
}

function wrap(latex: string, display: boolean): string {
    return display ? `$$${latex}$$` : `$${latex}$`;
}

export const MathInline = Node.create({
    name: 'mathInline',
    group: 'inline',
    inline: true,
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
        return {
            // `rendered: false` — node-level renderHTML/parseHTML fully own (de)serialization.
            latex: { default: '', rendered: false },
            display: { default: false, rendered: false },
        };
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-latex]',
                getAttrs: (el) => ({
                    latex: (el as HTMLElement).getAttribute('data-latex') ?? '',
                    display: (el as HTMLElement).getAttribute('data-display') === 'block',
                }),
            },
        ];
    },

    renderHTML({ node }) {
        const latex = (node.attrs.latex as string) ?? '';
        const display = !!node.attrs.display;
        // Inner text is the plain delimiter form; the surrounding span (and its
        // data-* attrs) are stripped by the sanitizer, leaving `$latex$` behind.
        return ['span', { 'data-latex': latex, 'data-display': display ? 'block' : 'inline' }, wrap(latex, display)];
    },

    renderText({ node }) {
        return wrap((node.attrs.latex as string) ?? '', !!node.attrs.display);
    },

    addNodeView() {
        return ({ editor, node, getPos }) => {
            const dom = document.createElement('span');
            dom.className = 'math-node';
            dom.style.cursor = 'pointer';

            const render = (n: typeof node) => {
                const latex = (n.attrs.latex as string) ?? '';
                const display = !!n.attrs.display;
                dom.dataset.latex = latex;
                dom.style.display = display ? 'block' : 'inline-block';
                try {
                    katex.render(latex, dom, { throwOnError: false, displayMode: display });
                } catch {
                    dom.textContent = wrap(latex, display);
                }
            };

            let current = node;
            render(current);

            dom.addEventListener('click', () => {
                const pos = typeof getPos === 'function' ? getPos() : null;
                editor.view.dom.dispatchEvent(
                    new CustomEvent<MathEditEventDetail>(MATH_EDIT_EVENT, {
                        detail: { pos: pos ?? null, latex: (current.attrs.latex as string) ?? '', display: !!current.attrs.display },
                    })
                );
            });

            return {
                dom,
                update: (updated) => {
                    if (updated.type.name !== node.type.name) return false;
                    current = updated;
                    render(updated);
                    return true;
                },
                // KaTeX writes a lot of internal DOM into `dom`; tell ProseMirror to
                // ignore those mutations so it doesn't try to read them as content.
                ignoreMutation: () => true,
            };
        };
    },

    addInputRules() {
        return [
            nodeInputRule({
                find: /\$\$([^$\n]+)\$\$$/,
                type: this.type,
                getAttributes: (match) => ({ latex: match[1], display: true }),
            }),
            nodeInputRule({
                find: /(?<!\$)\$([^$\n]+)\$$/,
                type: this.type,
                getAttributes: (match) => ({ latex: match[1], display: false }),
            }),
        ];
    },

    addCommands() {
        return {
            setMath:
                (attrs) =>
                ({ commands }) =>
                    commands.insertContent({ type: this.name, attrs }),
            updateMathAt:
                (pos, attrs) =>
                ({ tr, dispatch }) => {
                    if (dispatch) tr.setNodeMarkup(pos, undefined, attrs);
                    return true;
                },
        };
    },
});

/**
 * decodeMathInHtml — rewrap plain `$…$` / `$$…$$` runs (as loaded from the DB)
 * into `<span data-latex=…>` markers so `MathInline.parseHTML` turns them into
 * live nodes. Client-only (uses the DOM); a no-op on the server or empty input.
 * Skips text inside <code>/<pre> and inside existing math markers.
 */
export function decodeMathInHtml(html: string): string {
    if (typeof document === 'undefined' || !html || html.indexOf('$') === -1) return html;

    const container = document.createElement('div');
    container.innerHTML = html;

    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        textNodes.push(n as Text);
    }

    const insideSkippable = (node: Text): boolean => {
        let p = node.parentElement;
        while (p && p !== container) {
            const tag = p.tagName;
            if (tag === 'CODE' || tag === 'PRE' || p.hasAttribute('data-latex')) return true;
            p = p.parentElement;
        }
        return false;
    };

    const re = /\$\$([^$\n]+)\$\$|\$([^$\n]+)\$/g;

    for (const textNode of textNodes) {
        const text = textNode.nodeValue ?? '';
        if (text.indexOf('$') === -1 || insideSkippable(textNode)) continue;

        re.lastIndex = 0;
        if (!re.test(text)) continue;

        re.lastIndex = 0;
        const frag = document.createDocumentFragment();
        let last = 0;
        let match: RegExpExecArray | null;
        while ((match = re.exec(text)) !== null) {
            const [full, blockLatex, inlineLatex] = match;
            if (match.index > last) frag.appendChild(document.createTextNode(text.slice(last, match.index)));
            const isBlock = blockLatex !== undefined;
            const latex = (isBlock ? blockLatex : inlineLatex) ?? '';
            const span = document.createElement('span');
            span.setAttribute('data-latex', latex);
            span.setAttribute('data-display', isBlock ? 'block' : 'inline');
            span.textContent = isBlock ? `$$${latex}$$` : `$${latex}$`;
            frag.appendChild(span);
            last = match.index + full.length;
        }
        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
        textNode.parentNode?.replaceChild(frag, textNode);
    }

    return container.innerHTML;
}
