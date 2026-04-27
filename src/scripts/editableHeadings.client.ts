/**
 * EditableHeadings — client-side script
 *
 * This TypeScript file is the authoritative source for the browser script that is
 * compiled to a plain-JS string and injected inline by EditableHeadings.externalResources().
 *
 * At runtime in the browser there is no bundler, so:
 *  - No npm imports are used — the unified diff is implemented inline.
 *  - `DIFF_ENDPOINT` is replaced with the configured endpoint string at plugin build time.
 */

declare const DIFF_ENDPOINT: string

/**
 * Produce a unified diff string between `original` and `edited`.
 * Uses a pure-JS LCS (longest-common-subsequence) algorithm; no external deps required.
 */
function computeUnifiedDiff(filename: string, original: string, edited: string): string {
  if (original === edited) return ""

  const A = original.split("\n")
  const B = edited.split("\n")
  const n = A.length
  const m = B.length

  // Build LCS dp table
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = 1; i <= n; i++)
    for (let j = 1; j <= m; j++)
      dp[i][j] =
        A[i - 1] === B[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1])

  // Backtrack to build edit sequence: [type, value] where type is ' ', '-', or '+'
  const ops: [string, string][] = []
  let i = n
  let j = m
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && A[i - 1] === B[j - 1]) {
      ops.unshift([" ", A[i - 1]])
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      ops.unshift(["+", B[j - 1]])
      j--
    } else {
      ops.unshift(["-", A[i - 1]])
      i--
    }
  }

  // Annotate each op with 1-based line numbers in original and edited
  type LinedOp = { t: string; v: string; ol: number; el: number }
  let ol = 1
  let el = 1
  const lined: LinedOp[] = ops.map(([t, v]) => {
    const entry: LinedOp = { t, v, ol, el }
    if (t !== "+") ol++
    if (t !== "-") el++
    return entry
  })

  // Determine which indices contain changes, then group into hunks (3-line context)
  const CTX = 3
  const len = lined.length
  const changeIdx = lined.map((e, idx) => (e.t !== " " ? idx : -1)).filter((idx) => idx >= 0)
  if (!changeIdx.length) return ""

  const ranges: [number, number][] = []
  let hs = Math.max(0, changeIdx[0] - CTX)
  let he = Math.min(len - 1, changeIdx[0] + CTX)
  for (let k = 1; k < changeIdx.length; k++) {
    const ns = Math.max(0, changeIdx[k] - CTX)
    if (ns <= he + 1) {
      he = Math.min(len - 1, changeIdx[k] + CTX)
    } else {
      ranges.push([hs, he])
      hs = ns
      he = Math.min(len - 1, changeIdx[k] + CTX)
    }
  }
  ranges.push([hs, he])

  // Format the unified diff output
  const out = [`--- ${filename}`, `+++ ${filename}`]
  for (const [rs, re] of ranges) {
    const hunk = lined.slice(rs, re + 1)
    let oc = 0
    let ec = 0
    let oStart = 0
    let eStart = 0
    for (const entry of hunk) {
      if (entry.t !== "+") {
        if (!oStart) oStart = entry.ol
        oc++
      }
      if (entry.t !== "-") {
        if (!eStart) eStart = entry.el
        ec++
      }
    }
    out.push(`@@ -${oStart || 1},${oc} +${eStart || 1},${ec} @@`)
    hunk.forEach((entry) => out.push(entry.t + entry.v))
  }
  return out.join("\n") + "\n"
}

/** Collect all sibling DOM elements that belong to this heading's section. */
function getSectionContent(heading: HTMLElement): HTMLElement[] {
  const level = parseInt(heading.tagName[1], 10)
  const siblings: HTMLElement[] = []
  let el = heading.nextElementSibling as HTMLElement | null
  while (el) {
    const m = el.tagName.match(/^H(\d)$/i)
    if (m && parseInt(m[1], 10) <= level) break
    siblings.push(el)
    el = el.nextElementSibling as HTMLElement | null
  }
  return siblings
}

/** Restore the original section content and remove editor UI. */
function cleanupEditor(
  editor: HTMLElement,
  controls: HTMLElement,
  section: HTMLElement[],
  heading: HTMLElement,
): void {
  editor.remove()
  controls.remove()
  section.forEach((el) => {
    el.style.display = el.dataset.origDisplay || ""
  })
  delete heading.dataset.editing
}

/** Activate the inline editor for the section beneath `heading`. */
function activateEditor(heading: HTMLElement): void {
  // Prevent double-activation if the heading is already in editing state
  if (heading.dataset.editing) return
  heading.dataset.editing = "1"

  const section = getSectionContent(heading)
  const originalHTML = section.map((el) => el.outerHTML).join("\n")

  // Hide the original section content while editing
  section.forEach((el) => {
    el.dataset.origDisplay = el.style.display || ""
    el.style.display = "none"
  })

  // Create the contenteditable editor div
  const editor = document.createElement("div")
  editor.className = "section-editor"
  editor.contentEditable = "true"
  editor.innerHTML = originalHTML

  // Create Save / Cancel control buttons
  const controls = document.createElement("div")
  controls.className = "editor-controls"

  const saveBtn = document.createElement("button")
  saveBtn.textContent = "Save"
  saveBtn.onclick = () => {
    const editedHTML = editor.innerHTML
    const headingId = heading.id || heading.textContent?.trim() || "section"
    const diff = computeUnifiedDiff(headingId, originalHTML, editedHTML)
    const metaEl = document.querySelector<HTMLMetaElement>("meta[name='quartz-slug']")
    const slug = metaEl ? metaEl.getAttribute("content") : window.location.pathname
    fetch(DIFF_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slug: slug || window.location.pathname,
        headingId,
        original: originalHTML,
        edited: editedHTML,
        diff,
      }),
    }).catch((err: unknown) => console.error("EditableHeadings: POST failed", err))
    cleanupEditor(editor, controls, section, heading)
  }

  const cancelBtn = document.createElement("button")
  cancelBtn.textContent = "Cancel"
  cancelBtn.onclick = () => cleanupEditor(editor, controls, section, heading)

  controls.append(saveBtn, cancelBtn)
  heading.after(editor, controls)
}

// Attach click handlers to every edit button injected by the rehype plugin
document.querySelectorAll<HTMLElement>(".edit-heading-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.preventDefault()
    const heading = btn.closest<HTMLElement>("h1,h2,h3,h4")
    if (heading) activateEditor(heading)
  })
})
