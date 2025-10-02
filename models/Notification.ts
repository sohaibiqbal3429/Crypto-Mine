import mongoose, { Schema, type Document } from "mongoose"

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId
  kind:
    | "referral-joined"
    | "deposit-approved"
    | "withdraw-approved"
    | "level-up"
    | "cap-reached"
    | "team-reward-claimed"
    | "mining-reward"
  title: string
  body: string
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
        "level-up",
        "cap-reached",
        "team-reward-claimed",
        "mining-reward",
      ],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    read: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  },
)

NotificationSchema.index({ userId: 1, createdAt: -1 })
NotificationSchema.index({ userId: 1, read: 1 })

export default mongoose.models.Notification || mongoose.model<INotification>("Notification", NotificationSchema)
