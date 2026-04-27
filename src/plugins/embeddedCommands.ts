/**
 * EmbeddedCommands — Quartz v4 Transformer Plugin
 *
 * Parses [[cmd:command-name]] directives in Markdown.
 * At render time injects a "▶ Run" button. On click, POSTs to /api/run-command
 * which executes a pre-registered command from commands.yaml.
 *
 * Syntax in Markdown:
 *   [[cmd:rebuild-index]]
 *   [[cmd:clear-cache]]
 */

import { QuartzTransformerPlugin } from "../types"
import type { Root } from "hast"

export interface EmbeddedCommandsOptions {
  /** Server endpoint for running commands. Default: "/api/run-command" */
  runEndpoint: string
  /** CSS class on the injected button. Default: "run-cmd-btn" */
  buttonClass: string
}

const defaultOpts: EmbeddedCommandsOptions = {
  runEndpoint: "/api/run-command",
  buttonClass: "run-cmd-btn",
}

export const EmbeddedCommands: QuartzTransformerPlugin<Partial<EmbeddedCommandsOptions>> = (
  userOpts,
) => {
  const opts = { ...defaultOpts, ...userOpts }

  return {
    name: "EmbeddedCommands",

    textTransform(_ctx, src) {
      // Pre-parse [[cmd:name]] before the Markdown AST is built.
      // Replace with an HTML div that will survive as raw HTML in the hast tree.
      return src.replace(
        /\[\[cmd:([a-zA-Z0-9_-]+)\]\]/g,
        (_match, cmdName) =>
          `<div class="embedded-command" data-cmd="${cmdName}">` +
          `<button class="${opts.buttonClass}" data-cmd="${cmdName}">▶ ${cmdName}</button>` +
          `<pre class="cmd-output" hidden></pre>` +
          `</div>`,
      )
    },

    externalResources() {
      return {
        css: [
          {
            inline: true,
            content: `
              .embedded-command {
                display: flex;
                flex-direction: column;
                gap: 0.5em;
                margin: 1em 0;
                padding: 0.75em;
                border: 1px solid var(--secondary);
                border-radius: 4px;
                background: var(--light);
              }
              .run-cmd-btn {
                align-self: flex-start;
                cursor: pointer;
                padding: 0.3em 0.8em;
                border-radius: 4px;
                border: 1px solid var(--secondary);
                background: var(--tertiary);
                font-family: monospace;
              }
              .cmd-output {
                white-space: pre-wrap;
                font-family: monospace;
                font-size: 0.85em;
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
                // TODO: implement in Task 7
                // - attach click handlers to .run-cmd-btn
                // - POST { name: cmdName } to ${opts.runEndpoint}
                // - stream/show output in .cmd-output pre
              })()
            `,
          },
        ],
      }
    },
  }
}
