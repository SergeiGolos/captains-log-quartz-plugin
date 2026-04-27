/**
 * Tests for EditableHeadings — Issue #9
 *
 * Covers:
 *  - slugify() helper
 *  - rehype transformer: button injection, heading ID generation from text
 *  - externalResources() shape
 */

import { unified } from "unified"
import { rehype } from "rehype"
import { slugify, EditableHeadings } from "../src/plugins/editableHeadings.js"

// ─── slugify ──────────────────────────────────────────────────────────────────

describe("slugify()", () => {
  it("lowercases and trims", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world")
  })

  it("replaces spaces with hyphens", () => {
    expect(slugify("Getting Started")).toBe("getting-started")
  })

  it("strips special characters", () => {
    expect(slugify("What's New? (v2.0)")).toBe("whats-new-v20")
  })

  it("collapses multiple hyphens", () => {
    expect(slugify("one -- two")).toBe("one-two")
  })

  it("handles empty string", () => {
    expect(slugify("")).toBe("")
  })

  it("does not produce leading or trailing hyphens", () => {
    expect(slugify("---hello---")).toBe("hello")
  })
})

// ─── rehype transformer ───────────────────────────────────────────────────────

async function transformHTML(html: string) {
  const plugin = EditableHeadings({ levels: [1, 2, 3], diffEndpoint: "/api/diff" })
  const rehypePlugins = plugin.htmlPlugins?.() ?? []

  let processor = rehype()
  for (const p of rehypePlugins) {
    processor = processor.use(p as any)
  }

  const file = await processor.process(html)
  return String(file)
}

describe("EditableHeadings rehype transformer", () => {
  it("injects an edit button into each configured heading level", async () => {
    const html = `<html><body><h1>Introduction</h1><h2>Details</h2></body></html>`
    const result = await transformHTML(html)
    // Both headings should get a button
    expect(result.match(/edit-heading-btn/g)?.length).toBe(2)
  })

  it("does NOT inject into headings outside configured levels", async () => {
    const html = `<html><body><h4>Deep Section</h4><h5>Deeper</h5></body></html>`
    const result = await transformHTML(html)
    // h4 is in levels [1,2,3] — not included. h5 also not included.
    expect(result).not.toContain("edit-heading-btn")
  })

  it("sets data-heading-id from heading text content, not node.properties.id", async () => {
    // Node has no id property — must derive from text
    const html = `<html><body><h2>Getting Started</h2></body></html>`
    const result = await transformHTML(html)
    expect(result).toContain('data-heading-id="getting-started"')
  })

  it("uses slugified text for headings with special characters", async () => {
    const html = `<html><body><h1>What's New? (v2.0)</h1></body></html>`
    const result = await transformHTML(html)
    expect(result).toContain('data-heading-id="whats-new-v20"')
  })

  it("renders the ✏️ emoji inside the button", async () => {
    const html = `<html><body><h1>Test</h1></body></html>`
    const result = await transformHTML(html)
    expect(result).toContain("✏️")
  })
})

// ─── externalResources shape ──────────────────────────────────────────────────

describe("EditableHeadings externalResources()", () => {
  it("returns css and js arrays", () => {
    const plugin = EditableHeadings({})
    const resources = plugin.externalResources?.()
    expect(resources).toBeDefined()
    expect(Array.isArray(resources!.css)).toBe(true)
    expect(Array.isArray(resources!.js)).toBe(true)
  })

  it("includes inline CSS with .edit-heading-btn", () => {
    const plugin = EditableHeadings({})
    const { css } = plugin.externalResources!()!
    const combined = css!.map((c: any) => c.content ?? "").join("")
    expect(combined).toContain(".edit-heading-btn")
  })

  it("includes inline JS that references the diffEndpoint", () => {
    const plugin = EditableHeadings({ diffEndpoint: "/custom/diff" })
    const { js } = plugin.externalResources!()!
    const combined = js!.map((j: any) => j.script ?? "").join("")
    expect(combined).toContain("/custom/diff")
  })

  it("JS references DIFF_ENDPOINT constant", () => {
    const plugin = EditableHeadings({ diffEndpoint: "/api/diff" })
    const { js } = plugin.externalResources!()!
    const combined = js!.map((j: any) => j.script ?? "").join("")
    expect(combined).toContain("DIFF_ENDPOINT")
  })
})
