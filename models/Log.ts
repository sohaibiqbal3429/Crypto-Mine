import { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ILog extends Document {
  level: "info" | "warn" | "error"
  message: string
  meta?: Record<string, unknown>
  createdAt: Date
  updatedAt: Date
}

const LogSchema = new Schema<ILog>(
  {
    level: { type: String, enum: ["info", "warn", "error"], default: "info" },
    message: { type: String, required: true },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
)

LogSchema.index({ createdAt: -1 })

export default createModelProxy<ILog>("Log", LogSchema)
