import { unified } from "unified"
import remarkParse from "remark-parse"
import remarkRehype from "remark-rehype"
import rehypeStringify from "rehype-stringify"
import { EditableHeadings } from "../src/index"

async function process(md: string, opts?: Parameters<typeof EditableHeadings>[0]): Promise<string> {
  const plugin = EditableHeadings(opts)
  const htmlPlugins = plugin.htmlPlugins?.({} as any) ?? []

  const result = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(htmlPlugins as any)
    .use(rehypeStringify)
    .process(md)

  return String(result)
}

// --- Heading injection (rehype) ---

test("injects edit button into h2", async () => {
  const html = await process("## Hello World")
  expect(html).toContain("edit-heading-btn")
  expect(html).toContain("✏️")
})

test("does not inject into paragraphs", async () => {
  const html = await process("Just a paragraph")
  expect(html).not.toContain("edit-heading-btn")
})

test("respects levels option — h2 excluded when levels=[1]", async () => {
  const html = await process("## Not editable\n\n# Editable", { levels: [1] })
  const buttons = (html.match(/edit-heading-btn/g) ?? []).length
  expect(buttons).toBe(1)
})

test("injects button with data-heading-id attribute", async () => {
  const html = await process("## My Section")
  expect(html).toContain("data-heading-id")
})

// --- externalResources: CSS ---

test("externalResources returns inline CSS containing .edit-heading-btn", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const css = resources.css ?? []
  expect(css.length).toBeGreaterThan(0)
  const combinedCSS = css.map((c) => c.content).join("")
  expect(combinedCSS).toContain(".edit-heading-btn")
  expect(combinedCSS).toContain(".section-editor")
  expect(combinedCSS).toContain(".editor-controls")
})

// --- externalResources: JS ---

test("externalResources returns an inline JS resource", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  expect(js.length).toBeGreaterThan(0)
  const inlineScripts = js.filter((r) => r.contentType === "inline")
  expect(inlineScripts.length).toBe(1)
})

test("inline script is loaded afterDOMReady and has spaPreserve", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  const script = js.find((r) => r.contentType === "inline")!
  expect(script.loadTime).toBe("afterDOMReady")
  expect(script.spaPreserve).toBe(true)
})

test("inline script references default diffEndpoint /api/diff", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  const script = js.find((r) => r.contentType === "inline")!
  expect("script" in script && script.script).toContain("/api/diff")
})

test("inline script references custom diffEndpoint when configured", () => {
  const plugin = EditableHeadings({ diffEndpoint: "/custom/diff" })
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  const script = js.find((r) => r.contentType === "inline")!
  expect("script" in script && script.script).toContain("/custom/diff")
})

test("inline script contains activateEditor logic", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  const script = js.find((r) => r.contentType === "inline")!
  const src = "script" in script ? script.script : ""
  expect(src).toContain("activateEditor")
  expect(src).toContain("contentEditable")
  expect(src).toContain("Save")
  expect(src).toContain("Cancel")
})

test("inline script contains computeUnifiedDiff function", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  const script = js.find((r) => r.contentType === "inline")!
  const src = "script" in script ? script.script : ""
  expect(src).toContain("computeUnifiedDiff")
  expect(src).toContain("@@")
})

test("inline script POSTs original, edited, and diff fields", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  const script = js.find((r) => r.contentType === "inline")!
  const src = "script" in script ? script.script : ""
  expect(src).toContain("original")
  expect(src).toContain("edited")
  expect(src).toContain("diff")
  expect(src).toContain("fetch")
})

test("inline script contains getSectionContent for collecting sibling nodes", () => {
  const plugin = EditableHeadings()
  const resources = plugin.externalResources?.({} as any) ?? {}
  const js = resources.js ?? []
  const script = js.find((r) => r.contentType === "inline")!
  const src = "script" in script ? script.script : ""
  expect(src).toContain("getSectionContent")
  expect(src).toContain("nextElementSibling")
})
