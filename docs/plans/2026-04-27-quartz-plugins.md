# Quartz Plugins Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Two production-quality Quartz v4 transformer plugins — EditableHeadings and EmbeddedCommands — plus a small Express server that handles diffs and command execution.

**Architecture:**
- Each plugin is a Quartz `QuartzTransformerPlugin` factory function in `src/plugins/`.
- Plugins inject HTML nodes via `htmlPlugins()` (rehype) and client JS via `externalResources()`.
- The server (`server/index.ts`) provides two POST endpoints: `/api/diff` and `/api/run-command`.
- Commands are registered in `server/commands.yaml` (allow-list only — no arbitrary shell access).

**Tech Stack:** TypeScript, Quartz v4 (unified/rehype/remark), Express, unist-util-visit, diff (npm)

---

## Phase 1 — EditableHeadings Plugin

### Task 1: Install deps and verify TypeScript compiles

**Objective:** Get the project building cleanly.

**Files:**
- Modify: `package.json`

**Steps:**

1. Install dependencies:
```bash
cd ~/projects/quartz-plugins
npm install
```

2. Install the `diff` library (for client-side unified diff generation):
```bash
npm install diff
npm install --save-dev @types/diff
```

3. Compile:
```bash
npm run build
```
Expected: `dist/` populated, no type errors.

4. Commit:
```bash
git add -A && git commit -m "chore: initial scaffold and deps"
```

---

### Task 2: Write failing test for heading injection (rehype plugin)

**Objective:** Verify the rehype plugin injects `.edit-heading-btn` into heading nodes.

**Files:**
- Create: `tests/editableHeadings.test.ts`

**Steps:**

1. Create the test file:

```typescript
// tests/editableHeadings.test.ts
import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import rehypeStringify from "rehype-stringify"
import { EditableHeadings } from "../src/index"

async function process(md: string): Promise<string> {
  const plugin = EditableHeadings()
  const htmlPlugins = plugin.htmlPlugins?.({} as any) ?? []

  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(htmlPlugins as any)
    .use(rehypeStringify)
    .process(md)

  return String(result)
}

test("injects edit button into h2", async () => {
  const html = await process("## Hello World")
  expect(html).toContain("edit-heading-btn")
  expect(html).toContain("✏️")
})

test("does not inject into paragraphs", async () => {
  const html = await process("Just a paragraph")
  expect(html).not.toContain("edit-heading-btn")
})

test("respects levels option", async () => {
  const plugin = EditableHeadings({ levels: [1] })
  const htmlPlugins = plugin.htmlPlugins?.({} as any) ?? []

  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(htmlPlugins as any)
    .use(rehypeStringify)
    .process("## Not editable\n\n# Editable")

  const html = String(result)
  const buttons = (html.match(/edit-heading-btn/g) ?? []).length
  expect(buttons).toBe(1)
})
```

2. Install test deps:
```bash
npm install --save-dev remark-parse remark-rehype rehype-stringify
```

3. Run tests (expect failure — script is TODO):
```bash
npm test
```

---

### Task 3: Implement heading injection (rehype plugin)

**Objective:** Make the Task 2 tests pass by completing the `htmlPlugins` implementation.

**Files:**
- Modify: `src/plugins/editableHeadings.ts` — the `htmlPlugins()` implementation already exists in the stub. Verify it's correct and add `id` generation if missing.

**Steps:**

1. The stub in `editableHeadings.ts` already injects the button. Verify tests pass:
```bash
npm test -- --testPathPattern=editableHeadings
```
Expected: all 3 tests green.

2. If any fail, fix the rehype visitor. The key is:
   - `node.tagName` must be in `["h1","h2","h3","h4"]`
   - Push an `Element` node with `tagName: "button"` and `className: ["edit-heading-btn"]`

3. Commit:
```bash
git add src/plugins/editableHeadings.ts tests/editableHeadings.test.ts
git commit -m "feat: EditableHeadings rehype heading injection"
```

---

### Task 4: Implement client-side editor JS

**Objective:** Wire up the inline editor — click ✏️, section becomes editable, Save/Cancel controls appear.

**Files:**
- Create: `src/scripts/editableHeadings.client.ts` — standalone client script (will be inlined via `externalResources`)
- Modify: `src/plugins/editableHeadings.ts` — import and use the client script

**The client script logic:**

```typescript
// src/scripts/editableHeadings.client.ts
// This gets compiled to a string and injected as an inline <script>

(function () {
  function getSectionContent(heading: Element): Element[] {
    // Collect all sibling nodes until the next same-or-higher heading
    const level = parseInt(heading.tagName[1])
    const siblings: Element[] = []
    let el = heading.nextElementSibling
    while (el) {
      const sibLevel = el.tagName.match(/^H(\d)$/i)
      if (sibLevel && parseInt(sibLevel[1]) <= level) break
      siblings.push(el as Element)
      el = el.nextElementSibling
    }
    return siblings
  }

  function activateEditor(heading: HTMLElement) {
    const section = getSectionContent(heading)
    const originalHTML = section.map((el) => el.outerHTML).join("\n")

    // Hide original section content
    section.forEach((el) => el.setAttribute("data-original-display", (el as HTMLElement).style.display || ""))
    section.forEach((el) => ((el as HTMLElement).style.display = "none"))

    // Create editor
    const editor = document.createElement("div")
    editor.className = "section-editor"
    editor.contentEditable = "true"
    // Show as rendered text (simplified — full implementation: convert back to MD)
    editor.innerHTML = originalHTML

    // Controls
    const controls = document.createElement("div")
    controls.className = "editor-controls"

    const saveBtn = document.createElement("button")
    saveBtn.textContent = "Save"
    saveBtn.onclick = async () => {
      const newHTML = editor.innerHTML
      // Generate diff
      const { createPatch } = await import("diff")
      const patch = createPatch(
        heading.id || heading.textContent || "section",
        originalHTML,
        newHTML,
      )
      // POST diff
      const slug = document.querySelector("meta[name='quartz-slug']")?.getAttribute("content") ?? window.location.pathname
      await fetch(DIFF_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, headingId: heading.id, diff: patch }),
      })
      // Restore section with new content
      editor.remove()
      controls.remove()
      section.forEach((el) => ((el as HTMLElement).style.display = el.getAttribute("data-original-display") || ""))
    }

    const cancelBtn = document.createElement("button")
    cancelBtn.textContent = "Cancel"
    cancelBtn.onclick = () => {
      editor.remove()
      controls.remove()
      section.forEach((el) => ((el as HTMLElement).style.display = el.getAttribute("data-original-display") || ""))
    }

    controls.append(saveBtn, cancelBtn)
    heading.after(editor, controls)
  }

  document.querySelectorAll<HTMLElement>(".edit-heading-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault()
      const heading = btn.closest("h1,h2,h3,h4") as HTMLElement
      if (heading) activateEditor(heading)
    })
  })
})()
```

**Integration in plugin:**

In `editableHeadings.ts`, replace the `// TODO` in `externalResources` with the actual client script (read the compiled file contents at build time, or import the source as a string).

**Steps:**

1. Create `src/scripts/editableHeadings.client.ts` with the above content.
2. In `externalResources()`, read the file and inline it.
3. Run build: `npm run build`
4. Manual test: link into a Quartz install and try the edit flow.
5. Commit:
```bash
git add src/scripts/ src/plugins/editableHeadings.ts
git commit -m "feat: EditableHeadings client-side editor and diff generation"
```

---

## Phase 2 — Server (diff writer + command runner)

### Task 5: Write failing tests for POST /api/diff

**Objective:** Verify the diff endpoint writes a `.patch` file.

**Files:**
- Create: `tests/server.test.ts`

```typescript
import request from "supertest"
import { app } from "../server/app"   // extract app without listen() call
import { readFile, mkdir } from "fs/promises"
import path from "path"

const TEST_DIFF_DIR = "./test-diffs"

beforeAll(async () => {
  process.env.DIFF_OUTPUT_DIR = TEST_DIFF_DIR
  await mkdir(TEST_DIFF_DIR, { recursive: true })
})

test("POST /api/diff writes patch file", async () => {
  const res = await request(app).post("/api/diff").send({
    slug: "notes/my-note",
    headingId: "section-1",
    diff: "--- original\n+++ modified\n@@ -1 +1 @@\n-old\n+new",
  })
  expect(res.status).toBe(200)
  expect(res.body.ok).toBe(true)

  const content = await readFile(path.join(TEST_DIFF_DIR, "notes_my-note-section-1.patch"), "utf8")
  expect(content).toContain("+new")
})

test("POST /api/diff rejects missing fields", async () => {
  const res = await request(app).post("/api/diff").send({ slug: "x" })
  expect(res.status).toBe(400)
})
```

Install supertest: `npm install --save-dev supertest @types/supertest`

---

### Task 6: Refactor server for testability + make tests pass

**Objective:** Extract Express `app` from `listen()` so it's testable. Make Task 5 tests green.

**Files:**
- Create: `server/app.ts` — exports `app` without calling `.listen()`
- Modify: `server/index.ts` — imports `app` and calls `app.listen()`

**Steps:**

1. Move route handlers from `server/index.ts` into `server/app.ts`, export `app`.
2. `server/index.ts` becomes just:
```typescript
import { app } from "./app"
const port = parseInt(process.env.PORT ?? "3001", 10)
app.listen(port, () => console.log(`quartz-plugin-server on :${port}`))
```
3. Run: `npm test -- --testPathPattern=server`  
   Expected: 2 tests green.
4. Commit:
```bash
git add server/ tests/server.test.ts
git commit -m "feat: command server with /api/diff endpoint"
```

---

### Task 7: Implement POST /api/run-command + streaming

**Objective:** Wire up command execution with allow-list and stdout streaming. Write tests.

**Files:**
- Modify: `server/app.ts`
- Add: `tests/server-commands.test.ts`

**Test:**
```typescript
test("POST /api/run-command runs allowed command", async () => {
  const res = await request(app)
    .post("/api/run-command")
    .send({ name: "echo-test" })
  expect(res.status).toBe(200)
  expect(res.text).toContain("hello")
})

test("POST /api/run-command rejects unknown command", async () => {
  const res = await request(app)
    .post("/api/run-command")
    .send({ name: "rm-everything" })
  expect(res.status).toBe(403)
})
```

Add `echo-test` to `commands.yaml` for testing:
```yaml
echo-test:
  cmd: echo
  args: [hello]
  description: Test command
```

**Steps:**
1. The stub in `server/index.ts` already has the route — move it to `server/app.ts`.
2. Run tests green.
3. Commit: `git commit -m "feat: /api/run-command with allow-list and streaming"`

---

## Phase 3 — EmbeddedCommands Plugin

### Task 8: Write failing test for textTransform

**Objective:** Verify `[[cmd:name]]` is replaced with the correct HTML structure.

**Files:**
- Create: `tests/embeddedCommands.test.ts`

```typescript
import { EmbeddedCommands } from "../src/index"

test("transforms [[cmd:name]] to button HTML", () => {
  const plugin = EmbeddedCommands()
  const result = plugin.textTransform?.({} as any, "Run [[cmd:rebuild-index]] now") ?? ""
  expect(result).toContain('data-cmd="rebuild-index"')
  expect(result).toContain("run-cmd-btn")
  expect(result).toContain("▶ rebuild-index")
})

test("leaves non-cmd text alone", () => {
  const plugin = EmbeddedCommands()
  const result = plugin.textTransform?.({} as any, "Normal text") ?? "Normal text"
  expect(result).toBe("Normal text")
})
```

Run: `npm test -- --testPathPattern=embeddedCommands`  
Expected: already green (textTransform is implemented in stub).

Commit: `git commit -m "test: EmbeddedCommands textTransform tests"`

---

### Task 9: Implement client-side command runner JS

**Objective:** Wire up the ▶ button to POST to `/api/run-command` and stream output.

**Files:**
- Create: `src/scripts/embeddedCommands.client.ts`

```typescript
(function () {
  document.querySelectorAll<HTMLButtonElement>(".run-cmd-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const cmdName = btn.dataset.cmd
      if (!cmdName) return

      const container = btn.closest<HTMLElement>(".embedded-command")
      const output = container?.querySelector<HTMLPreElement>(".cmd-output")
      if (!output) return

      btn.disabled = true
      output.hidden = false
      output.textContent = "Running…\n"

      try {
        const res = await fetch(RUN_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: cmdName }),
        })

        if (!res.ok || !res.body) {
          output.textContent += `Error: ${res.status}\n`
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          output.textContent += decoder.decode(value, { stream: true })
        }
      } catch (e) {
        output.textContent += `Error: ${e}\n`
      } finally {
        btn.disabled = false
      }
    })
  })
})()
```

Integrate into `embeddedCommands.ts` `externalResources()` — replace the TODO comment with this script (replace `RUN_ENDPOINT` constant with `${opts.runEndpoint}` via template literal).

Commit: `git commit -m "feat: EmbeddedCommands client-side command runner with streaming"`

---

## Phase 4 — Integration & Docs

### Task 10: Write integration README for Quartz installation

**Objective:** Document exactly how to drop these plugins into a Quartz install.

**Files:**
- Create: `docs/quartz-integration.md`

Content should cover:
1. Copy `src/plugins/editableHeadings.ts` → `quartz/plugins/transformers/editableHeadings.ts`
2. Copy `src/plugins/embeddedCommands.ts` → `quartz/plugins/transformers/embeddedCommands.ts`
3. Update `quartz/plugins/transformers/index.ts` to re-export both
4. Register in `quartz.config.ts`
5. Start the server: `cd server && npx ts-node index.ts`
6. Configure `commands.yaml`
7. Add the slug meta tag to the Quartz layout (for diff file naming)

Commit: `git commit -m "docs: Quartz integration guide"`

---

### Task 11: GitHub repo + CI

**Objective:** Push to GitHub with a basic CI workflow.

**Files:**
- Create: `.github/workflows/ci.yml`

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
      - run: npm test
      - run: npm run build
```

**Steps:**
1. Create the workflow file.
2. Push repo to GitHub (use `github-repo-management` skill).
3. Verify CI passes.
4. Final commit: `git commit -m "ci: add GitHub Actions test workflow"`

---

## Summary

| Plugin | Mechanism | Key File |
|--------|-----------|----------|
| EditableHeadings | rehype visitor injects button; client JS activates contenteditable + diff | `src/plugins/editableHeadings.ts` |
| EmbeddedCommands | textTransform regex replaces directive; client JS streams command output | `src/plugins/embeddedCommands.ts` |
| Server /api/diff | Express POST, writes `.patch` file | `server/app.ts` |
| Server /api/run-command | Express POST, allow-list lookup, streams stdout | `server/app.ts` |

**Security notes:**
- `/api/run-command` must ONLY run commands in `commands.yaml`. No dynamic shell eval.
- The server should only be reachable on localhost or internal network (not public internet).
- Diff endpoint should sanitize the `slug` field to prevent path traversal.
