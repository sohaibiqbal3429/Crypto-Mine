import { z } from "zod"

const TRANSACTION_NUMBER_MAX_LENGTH = 120

export const depositSchema = z.object({
  amount: z.number().min(30, "Minimum deposit is $30 USDT"),
  transactionNumber: z
    .string()
    .trim()
    .min(3, "Transaction number must be at least 3 characters")
    .max(
      TRANSACTION_NUMBER_MAX_LENGTH,
      `Transaction number must be ${TRANSACTION_NUMBER_MAX_LENGTH} characters or less`,
    ),
})

export const withdrawSchema = z.object({
  amount: z.number().min(30, "Minimum withdrawal is $30 USDT"),
  walletAddress: z.string().min(1, "Wallet address is required"),
})

export const walletAddressSchema = z.object({
  label: z.string().min(1, "Label is required"),
  chain: z.string().min(1, "Chain is required"),
  address: z.string().min(1, "Address is required"),
})

export type DepositInput = z.infer<typeof depositSchema>
export type WithdrawInput = z.infer<typeof withdrawSchema>
export type WalletAddressInput = z.infer<typeof walletAddressSchema>
