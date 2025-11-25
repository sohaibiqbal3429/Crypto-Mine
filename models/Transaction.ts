import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ITransaction extends Document {
  userId: mongoose.Types.ObjectId
  type:
    | "deposit"
    | "withdraw"
    | "earn"
    | "stake"
    | "stakeInterest"
    | "commission"
    | "bonus"
    | "adjust"
    | "teamReward"
  amount: number
  meta: any
  userEmail?: string
  status?: "pending" | "approved" | "rejected"
  claimable?: boolean
  claimedAt?: Date
  createdAt: Date
}

const TransactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: [
        "deposit",
        "withdraw",
        "earn",
        "stake", 
        "stakeInterest",
        "commission",
        "bonus",
        "adjust",
        "teamReward",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    userEmail: { type: String, index: true },
    meta: { type: Schema.Types.Mixed },
    claimable: { type: Boolean, default: false },
    claimedAt: { type: Date },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: function (this: { type: ITransaction["type"] }) {
        return ["deposit", "withdraw"].includes(this.type) ? "pending" : "approved"
      },
    },
  },
  {
    timestamps: true,
  },
)

TransactionSchema.index({ userId: 1, createdAt: -1 })
TransactionSchema.index({ status: 1, createdAt: -1 })
TransactionSchema.index({ userEmail: 1 })
TransactionSchema.index({ createdAt: -1, _id: 1 })
TransactionSchema.index({ type: 1, status: 1 })
TransactionSchema.index({ userId: 1, claimable: 1, status: 1 })
TransactionSchema.index({ "meta.uniqueKey": 1 })
TransactionSchema.index({ userId: 1, "meta.uniqueEventId": 1 }, { unique: true, sparse: true })
TransactionSchema.index({ "meta.idempotencyKey": 1 }, { unique: true, sparse: true })

TransactionSchema.virtual("id").get(function (this: ITransaction) {
  return this._id ? this._id.toString() : undefined
})

TransactionSchema.set("id", true)

function ensureIdAccessor(doc: ITransaction | null) {
  if (!doc) {
    return
  }

  const target = doc as unknown as Record<string, unknown>
  const descriptor = Object.getOwnPropertyDescriptor(target, "id")

  if (!descriptor || descriptor.get === undefined) {
    Object.defineProperty(target, "id", {
      configurable: true,
      enumerable: true,
      get(this: ITransaction) {
        return this._id ? this._id.toString() : undefined
      },
    })
  }
}

TransactionSchema.post("init", ensureIdAccessor)
TransactionSchema.post("save", ensureIdAccessor)
TransactionSchema.post("findOne", ensureIdAccessor)
TransactionSchema.post("find", (docs) => {
  for (const doc of docs as ITransaction[]) {
    ensureIdAccessor(doc)
  }
})

export default createModelProxy<ITransaction>("Transaction", TransactionSchema)
