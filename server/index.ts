/**
 * Command Server — Express app that handles:
 *   POST /api/diff        → write unified diff to file
 *   POST /api/run-command → execute a pre-registered command by name
 */

import express from "express"
import { readFileSync } from "fs"
import { writeFile } from "fs/promises"
import { execFile } from "child_process"
import { parse as parseYaml } from "yaml"
import path from "path"

const app = express()
app.use(express.json())

// --- Config ---

interface CommandsConfig {
  commands: Record<string, { cmd: string; args?: string[]; description?: string }>
  diff_output_dir: string
}

const configPath = process.env.COMMANDS_CONFIG ?? "./commands.yaml"
let config: CommandsConfig

try {
  config = parseYaml(readFileSync(configPath, "utf8")) as CommandsConfig
} catch (e) {
  console.error(`Failed to load ${configPath}:`, e)
  process.exit(1)
}

// --- Routes ---

/**
 * POST /api/diff
 * Body: { slug: string, headingId: string, diff: string }
 * Writes diff to <diff_output_dir>/<slug>-<headingId>.patch
 */
app.post("/api/diff", async (req, res) => {
  const { slug, headingId, diff } = req.body as {
    slug?: string
    headingId?: string
    diff?: string
  }

  if (!slug || !headingId || !diff) {
    res.status(400).json({ error: "slug, headingId, and diff are required" })
    return
  }

  const filename = `${slug.replace(/\//g, "_")}-${headingId}.patch`
  const outputPath = path.join(config.diff_output_dir, filename)

  await writeFile(outputPath, diff, "utf8")
  res.json({ ok: true, path: outputPath })
})

/**
 * POST /api/run-command
 * Body: { name: string }
 * Executes the named command from commands.yaml allow-list.
 */
app.post("/api/run-command", (req, res) => {
  const { name } = req.body as { name?: string }

  if (!name) {
    res.status(400).json({ error: "name is required" })
    return
  }

  const entry = config.commands[name]
  if (!entry) {
    res.status(403).json({ error: `Unknown command: ${name}` })
    return
  }

  // Stream output back as plain text
  res.setHeader("Content-Type", "text/plain")
  res.setHeader("Transfer-Encoding", "chunked")

  const child = execFile(entry.cmd, entry.args ?? [], { shell: false })

  child.stdout?.on("data", (chunk: Buffer) => res.write(chunk))
  child.stderr?.on("data", (chunk: Buffer) => res.write(chunk))
  child.on("close", (code) => {
    res.write(`\n[exit ${code}]`)
    res.end()
  })
  child.on("error", (err) => {
    res.write(`\n[error: ${err.message}]`)
    res.end()
  })
})

// --- Start ---

const port = parseInt(process.env.PORT ?? "3001", 10)
app.listen(port, () => console.log(`quartz-plugin-server listening on :${port}`))
