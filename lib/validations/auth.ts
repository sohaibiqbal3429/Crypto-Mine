import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Invalid phone number"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().min(1, "Referral code is required"),
})

export const loginSchema = z
  .object({
    identifier: z.string().min(1, "Email or phone number is required"),
    identifierType: z.enum(["email", "phone"]),
    password: z.string().min(1, "Password is required"),
  })
  .superRefine((data, ctx) => {
    if (data.identifierType === "email") {
      const result = z.string().email().safeParse(data.identifier)
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["identifier"],
          message: "Invalid email address",
        })
      }
    } else {
      const result = z
        .string()
        .regex(/^\+[1-9]\d{7,14}$/)
        .safeParse(data.identifier)
      if (!result.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["identifier"],
          message: "Invalid phone number",
        })
      }
    }
  })

export const resetPasswordSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  otpCode: z.string().length(6, "OTP must be 6 digits"),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
