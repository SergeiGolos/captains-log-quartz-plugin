# captains-log-quartz-plugin

> **Status page** — this README tracks implementation progress. It will be replaced with full setup and usage documentation in [issue #11](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/11) once all phases are complete.

Two Quartz v4 transformer plugins:

| Plugin | What it does |
|--------|-------------|
| **EditableHeadings** | Injects a ✏️ edit icon next to every heading. Click to edit inline; generates a unified diff and POSTs it to `/api/diff` on save. |
| **EmbeddedCommands** | Parses `[[cmd:command-name]]` directives in Markdown; renders a ▶ Run button that POSTs to `/api/run-command` and streams stdout back to the page. |

---

## Implementation Status

### Phase 1 — Setup & EditableHeadings

| # | Issue | Status |
|---|-------|--------|
| 1 | [Install dependencies and verify TypeScript compilation](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/6) | 🔲 open |
| 2 | [Implement EditableHeadings rehype transformer](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/7) | 🔲 open |
| 3 | [Write client-side edit / diff / save JavaScript](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/8) | 🔲 open |
| 4 | [Tests for EditableHeadings plugin](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/9) | 🔲 open |

### Phase 2 — EmbeddedCommands

| # | Issue | Status |
|---|-------|--------|
| 5 | [Implement EmbeddedCommands textTransform and rehype injection](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/1) | 🔲 open |
| 6 | [Write client-side run / stream JavaScript](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/2) | 🔲 open |
| 7 | [Tests for EmbeddedCommands plugin](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/3) | 🔲 open |

### Phase 3 — Express Server

| # | Issue | Status |
|---|-------|--------|
| 8 | [Implement POST /api/diff endpoint](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/4) | 🔲 open |
| 9 | [Implement POST /api/run-command endpoint with allow-list](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/5) | 🔲 open |

### Phase 4 — Integration & Docs

| # | Issue | Status |
|---|-------|--------|
| 10 | [Integration test: mount plugins in a real Quartz repo](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/10) | 🔲 open |
| 11 | [Write final README](https://github.com/SergeiGolos/captains-log-quartz-plugin/issues/11) | 🔲 open |

---

## Repository Structure

```
captains-log-quartz-plugin/
├── src/
│   ├── plugins/
│   │   ├── editableHeadings.ts   # rehype transformer — injects edit buttons
│   │   └── embeddedCommands.ts   # textTransform + rehype — [[cmd:name]] directives
│   ├── types.ts                  # Quartz plugin type stubs
│   ├── resources.ts              # JSResource / CSSResource stubs
│   └── index.ts                  # re-exports
├── server/
│   ├── index.ts                  # Express: /api/diff + /api/run-command
│   └── commands.yaml             # allow-list of executable commands
├── tests/
├── docs/plans/
│   └── 2026-04-27-quartz-plugins.md   # full implementation plan
├── package.json
└── tsconfig.json
```

---

*See [docs/plans/2026-04-27-quartz-plugins.md](docs/plans/2026-04-27-quartz-plugins.md) for the full TDD implementation plan.*
