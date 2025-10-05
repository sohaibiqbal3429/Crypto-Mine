import type { HydratedDocument } from "mongoose"

import type { IUser } from "@/models/User"

export type SerializableUser = {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  phoneVerified: boolean
  emailVerified: boolean
  referralCode: string
  level: number
  isActive: boolean
  depositTotal: number
  withdrawTotal: number
  roiEarnedTotal: number
  createdAt: string
  updatedAt: string
  profileStatus: "Verified" | "Unverified"
}

type UserDocument = HydratedDocument<IUser>

export function serializeUser(user: UserDocument | (IUser & { _id: any })): SerializableUser {
  const id = typeof user._id === "string" ? user._id : user._id?.toString?.() ?? ""

  const phoneVerified = Boolean(user.phoneVerified)

  return {
    id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone ?? null,
    phoneVerified,
    emailVerified: Boolean(user.emailVerified),
    referralCode: user.referralCode,
    level: user.level ?? 0,
    isActive: Boolean(user.isActive),
    depositTotal: user.depositTotal ?? 0,
    withdrawTotal: user.withdrawTotal ?? 0,
    roiEarnedTotal: user.roiEarnedTotal ?? 0,
    createdAt: new Date(user.createdAt).toISOString(),
    updatedAt: new Date(user.updatedAt).toISOString(),
    profileStatus: phoneVerified ? "Verified" : "Unverified",
  }
}
