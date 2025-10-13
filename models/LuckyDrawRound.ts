import { Schema, type Document, type Types } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export type LuckyDrawRoundStatus = "ACTIVE" | "COMPLETED"

export interface ILuckyDrawRound extends Document {
  roundNumber: number
  status: LuckyDrawRoundStatus
  prizePoolUsd: number
  startAtUtc: Date
  endAtUtc: Date
  announcementAtUtc: Date
  selectedDepositId?: Types.ObjectId | null
  selectedUserId?: Types.ObjectId | null
  selectedWinnerName?: string | null
  selectedAt?: Date | null
  lastWinnerName?: string | null
  lastWinnerAnnouncedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

const LuckyDrawRoundSchema = new Schema<ILuckyDrawRound>(
  {
    roundNumber: { type: Number, required: true, default: 1 },
    status: { type: String, enum: ["ACTIVE", "COMPLETED"], default: "ACTIVE" },
    prizePoolUsd: { type: Number, required: true, default: 30 },
    startAtUtc: { type: Date, required: true },
    endAtUtc: { type: Date, required: true },
    announcementAtUtc: { type: Date, required: true },
    selectedDepositId: { type: Schema.Types.ObjectId, ref: "LuckyDrawDeposit", default: null },
    selectedUserId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    selectedWinnerName: { type: String, default: null },
    selectedAt: { type: Date, default: null },
    lastWinnerName: { type: String, default: null },
    lastWinnerAnnouncedAt: { type: Date, default: null },
  },
  { timestamps: true },
)

LuckyDrawRoundSchema.index({ status: 1, createdAt: -1 })
LuckyDrawRoundSchema.index({ roundNumber: -1 })

export default createModelProxy<ILuckyDrawRound>("LuckyDrawRound", LuckyDrawRoundSchema)
