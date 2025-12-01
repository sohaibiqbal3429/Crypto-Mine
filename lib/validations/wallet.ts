import { z } from "zod"

const TRANSACTION_NUMBER_MAX_LENGTH = 120

function hasAtMostTwoDecimalPlaces(value: number): boolean {
  const [, fractional = ""] = value.toString().split(".")
  return fractional.length <= 2
}

export const depositSchema = z.object({
  amount: z
    .number()
    .min(30, "Amount must be at least $30.")
    .refine(hasAtMostTwoDecimalPlaces, {
      message: "Amount can have at most 2 decimal places.",
    }),
  transactionNumber: z
    .string()
    .trim()
    .min(10, "Transaction hash must be at least 10 characters")
    .max(
      TRANSACTION_NUMBER_MAX_LENGTH,
      `Transaction hash must be ${TRANSACTION_NUMBER_MAX_LENGTH} characters or less`,
    ),
  exchangePlatform: z
    .enum(["binance", "okx", "bybit", "kucoin", "coinbase", "other"])
    .optional(),
  network: z.string().trim().min(1, "Network selection is required"),
})

export const withdrawSchema = z.object({
  amount: z.number().min(30, "Minimum withdrawal is $30 USDT"),
  walletAddress: z.string().min(1, "Wallet address is required"),
  source: z.enum(["main", "earnings"]).default("main"),
})

export const walletAddressSchema = z.object({
  label: z.string().min(1, "Label is required"),
  chain: z.string().min(1, "Chain is required"),
  address: z.string().min(1, "Address is required"),
})

export type DepositInput = z.infer<typeof depositSchema>
export type WithdrawInput = z.infer<typeof withdrawSchema>
export type WalletAddressInput = z.infer<typeof walletAddressSchema>
