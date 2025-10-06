import { NextRequest, NextResponse } from "next/server"
import { createReadStream } from "fs"
import { stat } from "fs/promises"
import { extname, join, normalize } from "path"
import { Readable } from "stream"

const UPLOAD_ROOT = join(process.cwd(), "public", "uploads")
const ALLOWED_SEGMENTS = new Set(["deposit-receipts"])

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
}

function resolveMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase()
  return MIME_TYPES[ext] ?? "application/octet-stream"
}

async function handleFileRequest(pathSegments: string[]) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  if (!ALLOWED_SEGMENTS.has(pathSegments[0])) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const absolutePath = join(UPLOAD_ROOT, ...pathSegments)
  const normalizedPath = normalize(absolutePath)

  if (!normalizedPath.startsWith(UPLOAD_ROOT)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const fileStat = await stat(normalizedPath).catch(() => null)
  if (!fileStat || !fileStat.isFile()) {
    return NextResponse.json({ error: "File not found" }, { status: 404 })
  }

  const stream = Readable.toWeb(createReadStream(normalizedPath)) as ReadableStream

  return new NextResponse(stream, {
    headers: {
      "Content-Type": resolveMimeType(normalizedPath),
      "Content-Length": fileStat.size.toString(),
      "Cache-Control": "public, max-age=86400, immutable",
    },
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  return handleFileRequest(params.path)
}

export async function HEAD(
  _request: NextRequest,
  { params }: { params: { path: string[] } },
) {
  const response = await handleFileRequest(params.path)
  if (response.body) {
    response.body.cancel()
  }
  return response
}
