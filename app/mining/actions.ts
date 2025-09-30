"use server"

import { revalidatePath } from "next/cache"
import { cookies } from "next/headers"

import { verifyToken } from "@/lib/auth"
import { performMiningClick, MiningActionError } from "@/lib/services/mining"

export interface MiningFormState {
  error?: string | null
  success?: string | null
  profit?: number
}

export async function mineAction(): Promise<MiningFormState> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth-token")?.value
  if (!token) {
    return { error: "You must be signed in to mine." }
  }

  const session = verifyToken(token)
  if (!session) {
    return { error: "Session expired. Please sign in again." }
  }

  try {
    const result = await performMiningClick(session.userId)

    revalidatePath("/mining")
    revalidatePath("/dashboard")

    return {
      success: `Mining successful! Earned $${result.profit.toFixed(2)}`,
      profit: result.profit,
    }
  } catch (error: any) {
    if (error instanceof MiningActionError) {
      if ((error as any).details?.timeLeft) {
        return {
          error: `${error.message}. Try again in ${(error as any).details.timeLeft} seconds.`,
        }
      }
      return { error: error.message }
    }

    console.error("Mining action failed", error)
    return { error: "Unable to start mining. Please try again." }
  }
}
