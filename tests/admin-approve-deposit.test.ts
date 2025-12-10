import assert from "node:assert/strict"
import test from "node:test"
import mongoose from "mongoose"

process.env.SEED_IN_MEMORY = "true"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"
import Transaction from "@/models/Transaction"
import Balance from "@/models/Balance"
import BonusPayout from "@/models/Payout"
import Notification from "@/models/Notification"
import type { NextRequest } from "next/server"

import { signToken } from "@/lib/auth"
import { POST as approveDeposit } from "@/app/api/admin/approve-deposit/route"

async function reset() {
  await Promise.all([
    User.deleteMany({}),
    Transaction.deleteMany({}),
    Balance.deleteMany({}),
    BonusPayout.deleteMany({}),
    Notification.deleteMany({}),
  ])
}

async function buildApproveRequest() {
  const admin = await User.create({
    email: "admin@example.com",
    passwordHash: "hash",
    role: "admin",
    name: "Admin",
    referralCode: "adminref",
    status: "active",
    isActive: true,
  })

  const member = await User.create({
    email: "user@example.com",
    passwordHash: "hash",
    role: "user",
    name: "User",
    referralCode: "userref",
    status: "inactive",
    isActive: false,
    depositTotal: 0,
  })

  const transaction = await Transaction.create({
    userId: member._id,
    type: "deposit",
    amount: 100,
    status: "pending",
    meta: { transactionNumber: "abc" },
  })

  const transactionId =
    transaction._id instanceof mongoose.Types.ObjectId
      ? transaction._id.toHexString()
      : new mongoose.Types.ObjectId(String(transaction._id)).toHexString()

  const adminId =
    admin._id instanceof mongoose.Types.ObjectId
      ? admin._id.toHexString()
      : new mongoose.Types.ObjectId(String(admin._id)).toHexString()

  const token = signToken({ userId: adminId, email: admin.email, role: "admin" })

  const request = {
    headers: new Headers({ authorization: `Bearer ${token}` }),
    cookies: {
      get(name: string) {
        if (name === "auth-token") return { value: token }
        return undefined
      },
    },
    json: async () => ({ transactionId }),
  } as unknown as NextRequest

  return { request, transactionId }
}

test.before(async () => {
  await dbConnect()
})

test.beforeEach(async () => {
  await reset()
})

test("admin can approve deposit without error", async () => {
  const { request, transactionId } = await buildApproveRequest()

  const response = await approveDeposit(request)
  assert.equal(response.status, 200)

  const updated = await Transaction.findById(transactionId)
  assert.ok(updated)
  assert.equal(updated?.status, "approved")
})

test("approving deposit falls back when transactions are unsupported", async () => {
  const { request, transactionId } = await buildApproveRequest()

  const replicaError = Object.assign(
    new Error("Transaction numbers are only allowed on a replica set member or mongos"),
    { code: 20 },
  )

  const sessionMock = {
    async withTransaction() {
      throw replicaError
    },
    async endSession() {
      return
    },
  } as unknown as mongoose.ClientSession

  const originalStartSession = mongoose.startSession
  ;(mongoose.startSession as unknown) = async () => sessionMock

  try {
    const response = await approveDeposit(request)
    assert.equal(response.status, 200)

    const updated = await Transaction.findById(transactionId)
    assert.ok(updated)
    assert.equal(updated?.status, "approved")
  } finally {
    ;(mongoose.startSession as unknown) = originalStartSession
  }
})
