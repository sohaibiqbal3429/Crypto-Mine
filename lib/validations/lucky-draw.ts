import { z } from "zod"

const HASH_MAX_LENGTH = 120

export const luckyDrawDepositSchema = z.object({
  transactionHash: z
    .string()
    .trim()
    .min(10, "Transaction hash must be at least 10 characters")
    .max(HASH_MAX_LENGTH, `Transaction hash must be ${HASH_MAX_LENGTH} characters or less`),
  receiptUrl: z
    .string()
    .trim()
    .url("Receipt URL must be a valid URL")
    .optional(),
})

export const luckyDrawAdminDecisionSchema = z.object({
  note: z
    .string()
    .trim()
    .max(500, "Notes must be 500 characters or less")
    .optional(),
})

export type LuckyDrawDepositInput = z.infer<typeof luckyDrawDepositSchema>
export type LuckyDrawAdminDecisionInput = z.infer<typeof luckyDrawAdminDecisionSchema>
