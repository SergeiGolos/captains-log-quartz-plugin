/**
 * EditableHeadings — Quartz v4 Transformer Plugin
 *
 * Injects an edit icon (✏️) next to each heading. The heading content is
 * wrapped in a `<span data-heading-id="slug">` for targeting, and a sibling
 * `<button class="edit-heading-btn">` is appended after that span. Clicking
 * the button will (Task 4):
 *   1. Activate contenteditable on that section's content
 *   2. Show Save / Cancel buttons
 *   3. On Save: generate a unified diff and POST to /api/diff
 */

import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import type { Element, Root, Text } from "hast"

export interface EditableHeadingsOptions {
  /** Heading levels to make editable. Default: [1, 2, 3, 4, 5, 6] */
  levels: number[]
  /** Server endpoint to POST diffs to. Default: "/api/diff" */
  diffEndpoint: string
}

const defaultOpts: EditableHeadingsOptions = {
  levels: [1, 2, 3, 4, 5, 6],
  diffEndpoint: "/api/diff",
}

/** Extract all text content from a hast node tree. */
function extractText(node: Element): string {
  let text = ""
  for (const child of node.children) {
    if (child.type === "text") {
      text += (child as Text).value
    } else if (child.type === "element") {
      text += extractText(child as Element)
    }
  }
  return text
}

/** Convert heading text to a URL-safe slug for use as a stable ID. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "")
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

            // Derive a stable slug-based ID from the heading's text content
            const headingText = extractText(node)
            const headingId = slugify(headingText)

            // Wrap all existing heading children in a <span data-heading-id="...">
            const contentSpan: Element = {
              type: "element",
              tagName: "span",
              properties: {
                "data-heading-id": headingId,
              },
              children: node.children.slice(),
            }

            // Build the edit button (sibling to the span, not nested inside it)
            const editBtn: Element = {
              type: "element",
              tagName: "button",
              properties: {
                className: ["edit-heading-btn"],
                "aria-label": "Edit this section",
                "data-heading-id": headingId,
              },
              children: [{ type: "text", value: "✏️" }],
            }

            // Replace heading children with [span, button]
            node.children = [contentSpan, editBtn]
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
