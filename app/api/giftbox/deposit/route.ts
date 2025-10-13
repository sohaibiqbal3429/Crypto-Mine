import { NextResponse } from "next/server"
import { mkdir, writeFile } from "fs/promises"
import { extname, join } from "path"
import { randomUUID, createHash } from "crypto"

import { getUserFromRequest } from "@/lib/auth"
import dbConnect from "@/lib/mongodb"
import { createGiftBoxDeposit, getGiftBoxSettings } from "@/lib/services/giftbox"

const RECEIPT_DIRECTORY = join(process.cwd(), "public", "uploads", "deposit-receipts")

async function saveReceipt(file: File) {
  await mkdir(RECEIPT_DIRECTORY, { recursive: true })
  const buffer = Buffer.from(await file.arrayBuffer())
  const extension = resolveExtension(file)
  const fileName = `${randomUUID()}${extension}`
  const filePath = join(RECEIPT_DIRECTORY, fileName)
  await writeFile(filePath, buffer)
  const checksum = createHash("sha256").update(buffer).digest("hex")
  return {
    url: `/uploads/deposit-receipts/${fileName}`,
    meta: {
      originalName: file.name,
      mimeType: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      checksum,
    },
  }
}

function resolveExtension(file: File) {
  const derivedExtension = extname(file.name)
  if (derivedExtension) return derivedExtension
  switch (file.type) {
    case "image/png":
      return ".png"
    case "image/jpeg":
    case "image/jpg":
      return ".jpg"
    case "application/pdf":
      return ".pdf"
    default:
      return ".png"
  }
}

export async function POST(request: Request) {
  try {
    const user = getUserFromRequest(request as any)
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    await dbConnect()

    const contentType = request.headers.get("content-type") ?? ""
    let amountValue: number | null = null
    let networkValue = ""
    let addressValue = ""
    let txHashValue = ""
    let receiptUrlValue = ""

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData()
      amountValue = Number(formData.get("amount"))
      networkValue = String(formData.get("network") ?? "")
      addressValue = String(formData.get("address") ?? "")
      txHashValue = String(formData.get("txHash") ?? "")
      const receiptFile = formData.get("receipt")
      if (receiptFile instanceof File && receiptFile.size > 0) {
        const saved = await saveReceipt(receiptFile)
        receiptUrlValue = saved.url
      }
    } else {
      const payload = await request.json().catch(() => null)
      if (!payload) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
      }
      amountValue = Number(payload.amount)
      networkValue = String(payload.network ?? "")
      addressValue = String(payload.address ?? "")
      txHashValue = String(payload.txHash ?? "")
      receiptUrlValue = String(payload.receiptUrl ?? "")
    }

    if (!amountValue || !txHashValue) {
      return NextResponse.json({ error: "Amount and transaction hash are required." }, { status: 400 })
    }

    if (!receiptUrlValue) {
      return NextResponse.json({ error: "Receipt upload is required." }, { status: 400 })
    }

    await createGiftBoxDeposit({
      userId: user.userId,
      amount: Number(amountValue),
      network: String(networkValue || ""),
      address: String(addressValue || ""),
      txHash: String(txHashValue || ""),
      receiptUrl: String(receiptUrlValue || ""),
    })

    const settings = await getGiftBoxSettings()

    return NextResponse.json({
      success: true,
      message: "Deposit submitted for review.",
      minDeposit: settings.minDeposit,
      entryValue: settings.entryValue,
    })
  } catch (error) {
    console.error("Giftbox deposit error", error)
    const message = error instanceof Error ? error.message : "Unable to submit deposit"
    const status = /unauthorized/i.test(message) ? 401 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
