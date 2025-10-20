import assert from "node:assert/strict"
import test from "node:test"

process.env.SEED_IN_MEMORY = "true"

import { NextRequest } from "next/server"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Balance from "@/models/Balance"
import { signToken } from "@/lib/auth"
import { PUT as blockUserRoute } from "@/app/api/admin/users/[id]/block/route"
import { GET as adminUsersGet } from "@/app/api/admin/users/route"
import { POST as withdrawRoute } from "@/app/api/wallet/withdraw/route"
import { PATCH as profilePatchRoute } from "@/app/api/profile/route"
import type { JWTPayload } from "@/lib/auth"
import { PROFILE_AVATAR_OPTIONS } from "@/lib/constants/avatars"

const apiBase = "http://localhost"

async function createUser(overrides: Record<string, unknown> = {}) {
  await dbConnect()
  const base = {
    email: `user-${Math.random().toString(16).slice(2)}@example.com`,
    passwordHash: "hash",
    name: "Test User",
    role: "user",
    referralCode: `RC${Math.random().toString(16).slice(2, 8)}`,
    status: "active",
    isActive: true,
    isBlocked: false,
    profileAvatar: PROFILE_AVATAR_OPTIONS[0]?.value ?? "avatar-01",
    phone: "+15551234567",
    phoneVerified: true,
    emailVerified: true,
  }
  return User.create({ ...base, ...overrides } as any)
}

function createAuthorizedRequest(
  url: string,
  method: string,
  tokenPayload: JWTPayload,
  body?: unknown,
) {
  const token = signToken(tokenPayload)
  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }
  if (body !== undefined) {
    init.body = JSON.stringify(body)
  }
  return new NextRequest(new Request(url, init))
}

const toId = (value: unknown) =>
  typeof value === "string"
    ? value
    : typeof (value as { toString?: () => string })?.toString === "function"
      ? (value as { toString: () => string }).toString()
      : ""

test("blocked users are denied withdrawals until unblocked", async () => {
  const admin = await createUser({
    email: "admin-test@example.com",
    role: "admin",
    referralCode: "ADMIN123",
  })
  const user = await createUser({ email: "withdraw-user@example.com" })
  await Balance.create({
    userId: user._id,
    current: 200,
    totalBalance: 200,
    totalEarning: 0,
    pendingWithdraw: 0,
    staked: 0,
  })

  const blockRequest = createAuthorizedRequest(
    `${apiBase}/api/admin/users/${toId(user._id)}/block`,
    "PUT",
    { userId: toId(admin._id), email: admin.email, role: admin.role },
    { blocked: true },
  )
  const blockResponse = await blockUserRoute(blockRequest, { params: { id: toId(user._id) } })
  assert.equal(blockResponse.status, 200)
  const blockPayload = (await blockResponse.json()) as any
  assert.equal(blockPayload.user.isBlocked, true)

  const withdrawRequest = createAuthorizedRequest(
    `${apiBase}/api/wallet/withdraw`,
    "POST",
    { userId: toId(user._id), email: user.email, role: user.role },
    { amount: 50, walletAddress: "TVnBlockedWalletAddress123" },
  )
  const withdrawResponse = await withdrawRoute(withdrawRequest)
  assert.equal(withdrawResponse.status, 403)
  const withdrawPayload = (await withdrawResponse.json()) as any
  assert.equal(withdrawPayload.blocked, true)

  const unblockRequest = createAuthorizedRequest(
    `${apiBase}/api/admin/users/${toId(user._id)}/block`,
    "PUT",
    { userId: toId(admin._id), email: admin.email, role: admin.role },
    { blocked: false },
  )
  const unblockResponse = await blockUserRoute(unblockRequest, { params: { id: toId(user._id) } })
  assert.equal(unblockResponse.status, 200)

  const refreshedUser = await User.findById(user._id)
  assert.equal(refreshedUser?.isBlocked, false)
})

test("admin users endpoint supports status filters and search", async () => {
  const admin = await createUser({ email: "filter-admin@example.com", role: "admin", referralCode: "ADMIN456" })
  const blockedUser = await createUser({ email: "blocked@example.com", isBlocked: true, referralCode: "BLOCKED01" })
  await createUser({ email: "active@example.com", name: "Active Member", referralCode: "ACTIVE01" })

  const blockedQuery = createAuthorizedRequest(
    `${apiBase}/api/admin/users?status=blocked`,
    "GET",
    { userId: toId(admin._id), email: admin.email, role: admin.role },
  )
  const blockedResponse = await adminUsersGet(blockedQuery)
  assert.equal(blockedResponse.status, 200)
  const blockedPayload = (await blockedResponse.json()) as any
  assert.equal(blockedPayload.data.length, 1)
  assert.equal(blockedPayload.data[0].email, blockedUser.email)
  assert.equal(blockedPayload.data[0].isBlocked, true)

  const searchQuery = createAuthorizedRequest(
    `${apiBase}/api/admin/users?q=active@example.com`,
    "GET",
    { userId: toId(admin._id), email: admin.email, role: admin.role },
  )
  const searchResponse = await adminUsersGet(searchQuery)
  assert.equal(searchResponse.status, 200)
  const searchPayload = (await searchResponse.json()) as any
  assert.ok(
    searchPayload.data.some((entry: any) => entry.email === "active@example.com" && entry.isBlocked === false),
    "Search should return the active user",
  )
})

test("profile avatar updates persist through the profile API", async () => {
  const user = await createUser({
    email: "avatar-user@example.com",
    profileAvatar: PROFILE_AVATAR_OPTIONS[0]?.value ?? "avatar-01",
    phone: "+15551231234",
    referralCode: "AVATAR12",
  })

  const newAvatar = PROFILE_AVATAR_OPTIONS[1]?.value ?? "avatar-02"
  const patchRequest = createAuthorizedRequest(
    `${apiBase}/api/profile`,
    "PATCH",
    { userId: toId(user._id), email: user.email, role: user.role },
    {
      name: "Avatar Tester",
      phone: "+15551231234",
      avatar: newAvatar,
    },
  )
  const patchResponse = await profilePatchRoute(patchRequest)
  assert.equal(patchResponse.status, 200)
  const patchPayload = (await patchResponse.json()) as any
  assert.equal(patchPayload.user.profileAvatar, newAvatar)

  const refreshedUser = await User.findById(user._id)
  assert.equal(refreshedUser?.profileAvatar, newAvatar)
})
