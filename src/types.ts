/**
 * Minimal type stubs matching Quartz v4's plugin types.
 * Replace with the real quartz/plugins/types import when working inside a Quartz repo.
 */

import type { PluggableList } from "unified"
import type { StaticResources } from "./resources"

export type BuildCtx = {
  argv: Record<string, unknown>
  cfg: unknown
  allSlugs: string[]
}

export type QuartzTransformerPluginInstance = {
  name: string
  textTransform?: (ctx: BuildCtx, src: string) => string
  markdownPlugins?: (ctx: BuildCtx) => PluggableList
  htmlPlugins?: (ctx: BuildCtx) => PluggableList
  externalResources?: (ctx: BuildCtx) => Partial<StaticResources>
}

export type QuartzTransformerPlugin<Options extends object | undefined = undefined> = (
  opts?: Options,
) => QuartzTransformerPluginInstance
