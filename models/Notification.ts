import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId
  kind:
    | "referral-joined"
    | "deposit-approved"
    | "withdraw-approved"
    | "withdraw-requested"
    | "withdraw-cancelled"
    | "level-up"
    | "cap-reached"
    | "team-reward-claimed"
    | "mining-reward"
    | "admin-adjustment"
  title: string
  body: string
  metadata?: Record<string, any>
  read: boolean
  createdAt: Date
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    kind: {
      type: String,
      enum: [
        "referral-joined",
        "deposit-approved",
        "withdraw-approved",
        "withdraw-requested",
        "withdraw-cancelled",
        "level-up",
        "cap-reached",
        "team-reward-claimed",
        "mining-reward",
        "admin-adjustment",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

NotificationSchema.index({ userId: 1, createdAt: -1 })
NotificationSchema.index({ userId: 1, read: 1 })

export default createModelProxy<INotification>("Notification", NotificationSchema)
