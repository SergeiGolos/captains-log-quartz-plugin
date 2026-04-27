/**
 * EditableHeadings — Quartz v4 Transformer Plugin
 *
 * Injects an edit icon (✏️) next to each heading. Clicking it:
 *   1. Activates contenteditable on the section content below the heading
 *   2. Shows Save / Cancel buttons
 *   3. On Save: generates a unified diff and POSTs to /api/diff
 */

import { QuartzTransformerPlugin } from "../types"
import { visit } from "unist-util-visit"
import { toString } from "hast-util-to-string"
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

/** Generate a stable URL-safe slug from heading text content */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
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

            // Generate stable heading ID from text content, not from node.properties.id
            // (rehype-slug may not have run yet at this point in the pipeline)
            const headingText = toString(node)
            const headingId = slugify(headingText)

            // Inject edit button as last child of each heading
            const editBtn: Element = {
              type: "element",
              tagName: "button",
              properties: {
                className: ["edit-heading-btn"],
                "aria-label": `Edit section: ${headingText}`,
                "data-heading-id": headingId,
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
                vertical-align: middle;
              }
              h1:hover .edit-heading-btn,
              h2:hover .edit-heading-btn,
              h3:hover .edit-heading-btn,
              h4:hover .edit-heading-btn {
                opacity: 1;
              }
              .edit-heading-btn.active {
                opacity: 1;
              }
              .section-editor {
                border: 1px solid var(--secondary);
                border-radius: 4px;
                padding: 0.5em;
                min-height: 4em;
                font-family: inherit;
                background: var(--light);
                outline: 2px solid var(--tertiary);
              }
              .editor-controls {
                display: flex;
                gap: 0.5em;
                margin-top: 0.5em;
              }
              .editor-controls button {
                padding: 0.25em 0.75em;
                border-radius: 4px;
                cursor: pointer;
                font-size: 0.85em;
              }
              .editor-save-btn {
                background: var(--tertiary);
                color: var(--light);
                border: none;
              }
              .editor-cancel-btn {
                background: none;
                border: 1px solid var(--secondary);
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
  "use strict";

  const DIFF_ENDPOINT = ${JSON.stringify(opts.diffEndpoint)};

  /** Compute a naive unified diff between two strings */
  function unifiedDiff(original, edited, label) {
    if (original === edited) return null;
    // Line-by-line diff output in unified format
    const origLines = original.split("\\n");
    const editLines = edited.split("\\n");
    const header = [
      "--- a/" + label,
      "+++ b/" + label,
      "@@ -1," + origLines.length + " +1," + editLines.length + " @@",
    ];
    const removed = origLines.map(l => "-" + l);
    const added   = editLines.map(l => "+" + l);
    return header.join("\\n") + "\\n" + removed.join("\\n") + "\\n" + added.join("\\n");
  }

  /** Find all sibling elements between this heading and the next heading of equal/higher rank */
  function getSectionNodes(headingEl) {
    const level = parseInt(headingEl.tagName[1], 10);
    const siblings = [];
    let el = headingEl.nextElementSibling;
    while (el) {
      const tag = el.tagName.toLowerCase();
      if (/^h[1-6]$/.test(tag) && parseInt(tag[1], 10) <= level) break;
      siblings.push(el);
      el = el.nextElementSibling;
    }
    return siblings;
  }

  function activateEditor(btn, headingEl) {
    const headingId = btn.dataset.headingId;
    const sectionNodes = getSectionNodes(headingEl);
    if (sectionNodes.length === 0) return;

    // Capture original content
    const origHTML = sectionNodes.map(n => n.outerHTML).join("\\n");
    const origText = sectionNodes.map(n => n.innerText).join("\\n");

    // Replace section nodes with a single contenteditable div
    const editor = document.createElement("div");
    editor.className = "section-editor";
    editor.contentEditable = "true";
    editor.innerHTML = sectionNodes.map(n => n.outerHTML).join("");
    sectionNodes[0].parentNode.insertBefore(editor, sectionNodes[0]);
    sectionNodes.forEach(n => n.remove());

    // Add save/cancel controls
    const controls = document.createElement("div");
    controls.className = "editor-controls";
    controls.innerHTML =
      '<button class="editor-save-btn">Save</button>' +
      '<button class="editor-cancel-btn">Cancel</button>';
    editor.parentNode.insertBefore(controls, editor.nextSibling);

    btn.classList.add("active");
    editor.focus();

    // Cancel
    controls.querySelector(".editor-cancel-btn").addEventListener("click", () => {
      editor.replaceWith(...sectionNodes);
      sectionNodes.forEach((n, i) => {
        // re-insert originals
        const tmp = document.createElement("template");
        tmp.innerHTML = origHTML.split("\\n")[i] || "";
        if (tmp.content.firstChild) editor.parentNode.insertBefore(tmp.content.firstChild, controls);
      });
      controls.remove();
      // restore originals from saved HTML
      const tmp = document.createElement("template");
      tmp.innerHTML = origHTML;
      while (tmp.content.firstChild) {
        controls.parentNode.insertBefore(tmp.content.firstChild, editor);
      }
      editor.remove();
      controls.remove();
      btn.classList.remove("active");
    });

    // Save
    controls.querySelector(".editor-save-btn").addEventListener("click", () => {
      const editedText = editor.innerText;
      const diff = unifiedDiff(origText, editedText, headingId);

      if (!diff) {
        // No changes — cancel silently
        controls.querySelector(".editor-cancel-btn").click();
        return;
      }

      const slug = location.pathname.replace(/\\/+/g, "/").replace(/\\/$/, "") || "/";

      fetch(DIFF_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, headingId, diff }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.ok) {
            console.info("[EditableHeadings] Diff saved:", data.path);
          } else {
            console.error("[EditableHeadings] Server error:", data.error);
          }
        })
        .catch(err => console.error("[EditableHeadings] POST failed:", err));

      // Restore editor content into normal DOM
      const tmp = document.createElement("template");
      tmp.innerHTML = editor.innerHTML;
      while (tmp.content.firstChild) {
        controls.parentNode.insertBefore(tmp.content.firstChild, editor);
      }
      editor.remove();
      controls.remove();
      btn.classList.remove("active");
    });
  }

  document.querySelectorAll(".edit-heading-btn").forEach(btn => {
    const headingEl = btn.closest("h1,h2,h3,h4,h5,h6");
    if (!headingEl) return;
    btn.addEventListener("click", e => {
      e.preventDefault();
      activateEditor(btn, headingEl);
    });
  });
})();
            `,
          },
        ],
      }
    },
  }
}
