import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z
    .string()
    .trim()
    .min(6, "Phone number is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().min(1, "Referral code is required"),
})

export const loginSchema = z
  .object({
    email: z.string().email("Invalid email address").optional(),
    phone: z
      .string()
      .trim()
      .min(6, "Phone number is required")
      .optional(),
    password: z.string().min(1, "Password is required"),
  })
  .refine((data) => data.email || data.phone, {
    message: "Email or phone is required",
    path: ["email"],
  })

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
