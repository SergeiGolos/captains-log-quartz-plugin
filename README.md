# quartz-plugins

Two Quartz v4 transformer plugins for the Captain's Log / wod.wiki Quartz installation.

## Plugins

### 1. `EditableHeadings`

Injects a ✏️ edit icon next to every `h1`–`h4` heading. Clicking it activates an
inline editor (contenteditable) for that section's content. On save, a unified diff
is generated client-side and posted to a small server endpoint, which writes it to a
file for later review.

**Flow:**
```
User clicks ✏️ → section becomes editable → user edits → clicks Save
  → client generates diff → POST /api/diff → server writes <slug>-<heading>.patch
```

### 2. `EmbeddedCommands`

Parses `[[cmd:command-name]]` directives embedded in Markdown. At render time a
button is injected into the page. When clicked, the browser POSTs to
`/api/run-command` with `{ name: "command-name" }`. The server looks up the command
in a pre-registered allow-list (`commands.yaml`) and executes it, streaming stdout
back to the page.

**Syntax:**
```markdown
[[cmd:rebuild-index]]
[[cmd:clear-cache]]
```

## Development

```bash
# Install deps
npm install

# Build (outputs to dist/)
npm run build

# Tests
npm test

# Link into your Quartz install
# Copy src/plugins/*.ts → quartz/plugins/transformers/
# Add exports to quartz/plugins/transformers/index.ts
# Register in quartz.config.ts
```

## Server Component

Both plugins require a small Express server running alongside Quartz's dev/prod
server. See `server/` directory.

## Docs

- [Implementation Plan](docs/plans/2026-04-27-quartz-plugins.md)
- [Plugin Architecture Research](docs/getting-started.md)
