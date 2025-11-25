import path from "path"
import Module from "module"

// Lightweight alias resolver for Node scripts compiled to dist.
// Maps imports starting with "@/" to the project root.
const originalResolveFilename = (Module as any)._resolveFilename as (
  request: string,
  parent: NodeModule | null | undefined,
  isMain?: boolean,
  options?: any,
) => string

;(Module as any)._resolveFilename = function patchedResolve(
  request: string,
  parent: NodeModule | null | undefined,
  isMain?: boolean,
  options?: any,
) {
  if (typeof request === "string" && request.startsWith("@/")) {
    // Point to compiled JS under dist/
    const absolute = path.join(process.cwd(), "dist", request.slice(2))
    return originalResolveFilename.call(this, absolute, parent, isMain, options)
  }
  return originalResolveFilename.call(this, request, parent, isMain, options)
}
