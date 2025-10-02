"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { verifyToken } from "@/lib/auth"
import { submitDeposit, DepositSubmissionError } from "@/lib/services/deposit"

export interface DepositFormState {
  error?: string | null
  success?: string | null
}

function isFileInstance(value: unknown): value is File {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  const hasArrayBuffer = typeof candidate.arrayBuffer === "function"
  const hasSize = typeof candidate.size === "number"
  const hasName = typeof candidate.name === "string" && candidate.name.length > 0

  return hasArrayBuffer && hasSize && hasName
}
export async function submitDepositAction(_: DepositFormState, formData: FormData): Promise<DepositFormState> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) {
    return { error: "You must be signed in to submit a deposit." }
  }

  const user = verifyToken(token)
  if (!user) {
    return { error: "Session expired. Please sign in again." }
  }

  const amountValue = Number.parseFloat(String(formData.get("amount") ?? ""))
  const transactionNumber = String(formData.get("transactionNumber") ?? "").trim()
  const exchangePlatform = String(formData.get("exchangePlatform") ?? "").trim() || undefined
  const network = String(formData.get("network") ?? "").trim()

  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: "Enter a valid deposit amount" }
  }

  if (!network) {
    return { error: "Select a deposit network" }
  }

  const receiptEntry = formData.get("receipt")
  const receiptFile = isFileInstance(receiptEntry) ? receiptEntry : null

  try {
    const result = await submitDeposit({
      userId: user.userId,
      amount: amountValue,
      transactionNumber,
      exchangePlatform,
      network,
      receiptFile,
    })

    revalidatePath("/wallet")

    return {
      success: result.message,
    }
  } catch (error: any) {
    if (error instanceof DepositSubmissionError) {
      return { error: error.message }
    }

    console.error("Deposit submission failed", error)
    return { error: "Unable to submit deposit. Please try again." }
  }
}
