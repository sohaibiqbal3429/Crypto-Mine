import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IClick extends Document {
  userId: mongoose.Types.ObjectId
  source?: string
  meta?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const ClickSchema = new Schema<IClick>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    source: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
)

ClickSchema.index({ userId: 1, createdAt: -1 })

export default createModelProxy<IClick>("Click", ClickSchema)
