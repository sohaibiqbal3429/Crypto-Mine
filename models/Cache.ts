import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface ICache extends Document {
  key: string
  value: any
  expiresAt: Date
  createdAt: Date
  updatedAt: Date
}

const CacheSchema = new Schema<ICache>(
  {
    key: { type: String, required: true, unique: true },
    value: Schema.Types.Mixed,
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
  },
)

CacheSchema.index({ key: 1 }, { unique: true })
CacheSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export default createModelProxy<ICache>("Cache", CacheSchema)
