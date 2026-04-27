/**
 * Minimal resource type stubs matching Quartz v4's quartz/util/resources.tsx
 */

export type JSResource =
  | {
      loadTime: "beforeDOMReady" | "afterDOMReady"
      moduleType?: "module"
      spaPreserve?: boolean
      src: string
      contentType: "external"
    }
  | {
      loadTime: "beforeDOMReady" | "afterDOMReady"
      moduleType?: "module"
      spaPreserve?: boolean
      script: string
      contentType: "inline"
    }

export type CSSResource = {
  content: string
  inline?: boolean
  spaPreserve?: boolean
}

export interface StaticResources {
  css: CSSResource[]
  js: JSResource[]
}
