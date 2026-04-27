/**
 * EditableHeadings — Quartz v4 Transformer Plugin
 *
 * Injects an edit icon (✏️) next to each heading. Clicking it:
 *   1. Activates contenteditable on that section's content
 *   2. Shows Save / Cancel buttons
 *   3. On Save: generates a unified diff and POSTs to /api/diff
 */

import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import type { Element, Root } from "hast"

export interface EditableHeadingsOptions {
  /** Heading levels to make editable. Default: [1, 2, 3, 4] */
  levels: number[]
  /** Server endpoint to POST diffs to. Default: "/api/diff" */
  diffEndpoint: string
}

const defaultOpts: EditableHeadingsOptions = {
  levels: [1, 2, 3, 4],
  diffEndpoint: "/api/diff",
}

export const EditableHeadings: QuartzTransformerPlugin<Partial<EditableHeadingsOptions>> = (
  userOpts,
) => {
  const opts = { ...defaultOpts, ...userOpts }
  const tags = opts.levels.map((l) => `h${l}`)

  return {
    name: "EditableHeadings",

    htmlPlugins() {
      return [
        () => (tree: Root) => {
          visit(tree, "element", (node: Element) => {
            if (!tags.includes(node.tagName)) return

            // Inject edit button as last child of each heading
            const editBtn: Element = {
              type: "element",
              tagName: "button",
              properties: {
                className: ["edit-heading-btn"],
                "aria-label": "Edit this section",
                "data-heading-id": (node.properties?.id as string) ?? "",
              },
              children: [{ type: "text", value: "✏️" }],
            }

            node.children.push(editBtn)
          })
        },
      ]
    },

    externalResources() {
      return {
        css: [
          {
            inline: true,
            content: `
              .edit-heading-btn {
                background: none;
                border: none;
                cursor: pointer;
                font-size: 0.75em;
                opacity: 0;
                margin-left: 0.4em;
                transition: opacity 0.2s;
              }
              h1:hover .edit-heading-btn,
              h2:hover .edit-heading-btn,
              h3:hover .edit-heading-btn,
              h4:hover .edit-heading-btn {
                opacity: 1;
              }
              .section-editor {
                border: 1px solid var(--secondary);
                border-radius: 4px;
                padding: 0.5em;
                min-height: 4em;
                font-family: monospace;
                background: var(--light);
              }
              .editor-controls {
                display: flex;
                gap: 0.5em;
                margin-top: 0.5em;
              }
            `,
          },
        ],
        js: [
          {
            contentType: "inline",
            loadTime: "afterDOMReady",
            spaPreserve: true,
            script: `
              (function() {
                // TODO: implement in Task 4
                // - find section content between headings
                // - activate contenteditable on click
                // - generate diff on save
                // - POST to ${opts.diffEndpoint}
              })()
            `,
          },
        ],
      }
    },
  }
}
