const Module = require("node:module") as any
const path = require("node:path") as typeof import("node:path")

const originalResolveFilename = Module._resolveFilename.bind(Module)
const distRoot = path.join(process.cwd(), "dist-tests")

Module._resolveFilename = function patchedResolveFilename(request: string, parent: any, isMain: boolean, options: any) {
  if (typeof request === "string" && request.startsWith("@/")) {
    const normalized = path.join(distRoot, request.slice(2))
    return originalResolveFilename(normalized, parent, isMain, options)
  }

  return originalResolveFilename(request, parent, isMain, options)
}
