"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { verifyToken } from "@/lib/auth"
import { submitDeposit, DepositSubmissionError } from "@/lib/services/deposit"

export interface DepositFormState {
  error?: string | null
  success?: string | null
}

export interface WithdrawFormState {
  error?: string | null
  success?: string | null
}

function isFileLike(value: unknown): value is File {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Record<string, unknown>
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.size === "number" &&
    typeof candidate.name === "string" &&
    candidate.name.length > 0
  )
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
  const receiptFile = isFileLike(receiptEntry) ? receiptEntry : null

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

export async function submitWithdrawAction(_: WithdrawFormState, formData: FormData): Promise<WithdrawFormState> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) {
    return { error: "You must be signed in to submit a withdrawal." }
  }

  const user = verifyToken(token)
  if (!user) {
    return { error: "Session expired. Please sign in again." }
  }

  const amountValue = Number.parseFloat(String(formData.get("amount") ?? ""))
  if (!Number.isFinite(amountValue) || amountValue <= 0) {
    return { error: "Enter a valid withdrawal amount" }
  }

  const walletAddress = String(formData.get("walletAddress") ?? "").trim()
  if (!walletAddress) {
    return { error: "Enter or select a wallet address" }
  }

  const cookieHeader = cookieStore
    .getAll()
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join("; ")

  try {
    const response = await fetch("/api/wallet/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
      },
      body: JSON.stringify({
        amount: amountValue,
        walletAddress,
      }),
      cache: "no-store",
    })

    const data = await response.json().catch(() => null)

    if (!response.ok) {
      const message =
        data?.error ||
        (Array.isArray(data?.details) && data.details.length > 0 && data.details[0]?.message) ||
        "Withdrawal request failed. Please try again."

      return { error: message }
    }

    revalidatePath("/wallet")

    return {
      success:
        typeof data?.transaction?.amount === "number"
          ? `Withdrawal request for $${Number(data.transaction.amount).toFixed(2)} submitted successfully.`
          : "Withdrawal request submitted successfully.",
    }
  } catch (error) {
    console.error("Withdrawal submission failed", error)
    return { error: "Unable to submit withdrawal. Please try again." }
  }
}
