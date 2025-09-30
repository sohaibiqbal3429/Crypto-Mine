import { z } from "zod"

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
<<<<<<< HEAD
  phone: z
    .string()
    .trim()
    .min(6, "Phone number is required"),
=======
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/, "Invalid phone number"),
>>>>>>> edbdc6cf53078ea3108b8217842cce9568beafab
  password: z.string().min(6, "Password must be at least 6 characters"),
  referralCode: z.string().min(1, "Referral code is required"),
})

export const loginSchema = z
  .object({
<<<<<<< HEAD
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
=======
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
})
>>>>>>> edbdc6cf53078ea3108b8217842cce9568beafab

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
