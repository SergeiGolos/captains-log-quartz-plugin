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

describe("EditableHeadings rehype transformer", () => {
  test("injects edit button into h2", async () => {
    const html = await process("## Hello World")
    expect(html).toContain("edit-heading-btn")
    expect(html).toContain("✏️")
  })

  test("does not inject into paragraphs", async () => {
    const html = await process("Just a paragraph")
    expect(html).not.toContain("edit-heading-btn")
  })

  test("wraps heading text in a span with data-heading-id", async () => {
    const html = await process("## Hello World")
    expect(html).toMatch(/<span data-heading-id="[^"]+">/)
    expect(html).toContain("Hello World")
  })

  test("button is a sibling of the span, not nested inside heading text", async () => {
    const html = await process("## My Heading")
    // The span closes before the button starts
    expect(html).toMatch(/<\/span><button[^>]*class="edit-heading-btn"/)
  })

  test("data-heading-id is a stable slug of the heading text", async () => {
    const html = await process("## Hello World")
    expect(html).toContain('data-heading-id="hello-world"')
  })

  test("slug strips special characters", async () => {
    const html = await process("## My Heading!")
    expect(html).toContain('data-heading-id="my-heading"')
  })

  test("span and button share the same data-heading-id", async () => {
    const html = await process("## Shared ID")
    const spanMatch = html.match(/<span data-heading-id="([^"]+)"/)
    const btnMatch = html.match(/<button[^>]*data-heading-id="([^"]+)"/)
    expect(spanMatch).not.toBeNull()
    expect(btnMatch).not.toBeNull()
    expect(spanMatch![1]).toBe(btnMatch![1])
  })

  test("respects levels option — only injects into specified levels", async () => {
    const html = await process("## Not editable\n\n# Editable", { levels: [1] })
    const buttons = (html.match(/edit-heading-btn/g) ?? []).length
    expect(buttons).toBe(1)
  })

  test("injects into h1 through h6 by default", async () => {
    const md = "# H1\n\n## H2\n\n### H3\n\n#### H4\n\n##### H5\n\n###### H6"
    const html = await process(md)
    const buttons = (html.match(/edit-heading-btn/g) ?? []).length
    expect(buttons).toBe(6)
  })

  test("heading id is stable across multiple calls with the same text", async () => {
    const html1 = await process("## Stable Heading")
    const html2 = await process("## Stable Heading")
    const id1 = html1.match(/data-heading-id="([^"]+)"/)?.[1]
    const id2 = html2.match(/data-heading-id="([^"]+)"/)?.[1]
    expect(id1).toBe(id2)
    expect(id1).toBe("stable-heading")
  })
})
