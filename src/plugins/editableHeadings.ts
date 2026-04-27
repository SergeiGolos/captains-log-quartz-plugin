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
            // Source of truth: src/scripts/editableHeadings.client.ts
            script: `
(function () {
  var DIFF_ENDPOINT = '${opts.diffEndpoint}';

  /* --- Unified diff (pure JS, LCS-based, no external deps) --- */
  function computeUnifiedDiff(filename, original, edited) {
    if (original === edited) return '';
    var A = original.split('\\n');
    var B = edited.split('\\n');
    var n = A.length, m = B.length;
    var dp = [];
    for (var r = 0; r <= n; r++) {
      dp[r] = [];
      for (var c = 0; c <= m; c++) dp[r][c] = 0;
    }
    for (var i = 1; i <= n; i++)
      for (var j = 1; j <= m; j++)
        dp[i][j] = A[i-1] === B[j-1] ? dp[i-1][j-1]+1 : Math.max(dp[i-1][j], dp[i][j-1]);
    var ops = [];
    i = n; j = m;
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && A[i-1] === B[j-1]) { ops.unshift([' ', A[i-1]]); i--; j--; }
      else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) { ops.unshift(['+', B[j-1]]); j--; }
      else { ops.unshift(['-', A[i-1]]); i--; }
    }
    var ol = 1, el = 1;
    var lined = ops.map(function(op) {
      var entry = [op[0], op[1], ol, el];
      if (op[0] !== '+') ol++;
      if (op[0] !== '-') el++;
      return entry;
    });
    var CTX = 3, len = lined.length;
    var changeIdx = [];
    for (var k = 0; k < len; k++) { if (lined[k][0] !== ' ') changeIdx.push(k); }
    if (!changeIdx.length) return '';
    var ranges = [];
    var hs = Math.max(0, changeIdx[0] - CTX);
    var he = Math.min(len - 1, changeIdx[0] + CTX);
    for (var k = 1; k < changeIdx.length; k++) {
      var ns = Math.max(0, changeIdx[k] - CTX);
      if (ns <= he + 1) { he = Math.min(len - 1, changeIdx[k] + CTX); }
      else { ranges.push([hs, he]); hs = ns; he = Math.min(len - 1, changeIdx[k] + CTX); }
    }
    ranges.push([hs, he]);
    var out = ['--- ' + filename, '+++ ' + filename];
    for (var ri = 0; ri < ranges.length; ri++) {
      var hunk = lined.slice(ranges[ri][0], ranges[ri][1] + 1);
      var oc = 0, ec = 0, oStart = 0, eStart = 0;
      for (var x = 0; x < hunk.length; x++) {
        if (hunk[x][0] !== '+') { if (!oStart) oStart = hunk[x][2]; oc++; }
        if (hunk[x][0] !== '-') { if (!eStart) eStart = hunk[x][3]; ec++; }
      }
      out.push('@@ -' + (oStart||1) + ',' + oc + ' +' + (eStart||1) + ',' + ec + ' @@');
      for (var x = 0; x < hunk.length; x++) { out.push(hunk[x][0] + hunk[x][1]); }
    }
    return out.join('\\n') + '\\n';
  }

  /* --- DOM helpers --- */
  function getSectionContent(heading) {
    var level = parseInt(heading.tagName[1], 10);
    var siblings = [];
    var el = heading.nextElementSibling;
    while (el) {
      var hm = el.tagName.match(/^H(\\d)$/i);
      if (hm && parseInt(hm[1], 10) <= level) break;
      siblings.push(el);
      el = el.nextElementSibling;
    }
    return siblings;
  }

  function cleanupEditor(editor, controls, section, heading) {
    editor.remove();
    controls.remove();
    section.forEach(function(el) { el.style.display = el.dataset.origDisplay || ''; });
    delete heading.dataset.editing;
  }

  function activateEditor(heading) {
    if (heading.dataset.editing) return;
    heading.dataset.editing = '1';

    var section = getSectionContent(heading);
    var originalHTML = section.map(function(el) { return el.outerHTML; }).join('\\n');

    section.forEach(function(el) {
      el.dataset.origDisplay = el.style.display || '';
      el.style.display = 'none';
    });

    var editor = document.createElement('div');
    editor.className = 'section-editor';
    editor.contentEditable = 'true';
    editor.innerHTML = originalHTML;

    var controls = document.createElement('div');
    controls.className = 'editor-controls';

    var saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.onclick = function() {
      var editedHTML = editor.innerHTML;
      var headingId = heading.id || (heading.textContent || '').trim() || 'section';
      var diff = computeUnifiedDiff(headingId, originalHTML, editedHTML);
      var metaEl = document.querySelector("meta[name='quartz-slug']");
      var slug = (metaEl && metaEl.getAttribute('content')) || window.location.pathname;
      fetch(DIFF_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: slug, headingId: headingId, original: originalHTML, edited: editedHTML, diff: diff })
      }).catch(function(err) { console.error('EditableHeadings: POST failed', err); });
      cleanupEditor(editor, controls, section, heading);
    };

    var cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.onclick = function() { cleanupEditor(editor, controls, section, heading); };

    controls.append(saveBtn, cancelBtn);
    heading.after(editor, controls);
  }

  /* --- Wire up all edit buttons --- */
  document.querySelectorAll('.edit-heading-btn').forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      var heading = btn.closest('h1,h2,h3,h4');
      if (heading) activateEditor(heading);
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
