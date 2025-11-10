import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IAppSettingAudit extends Document {
  key: string
  oldValue?: string | null
  newValue?: string | null
  changedBy?: mongoose.Types.ObjectId | null
  changedAt: Date
  ipAddress?: string | null
  reason?: string | null
}

const AppSettingAuditSchema = new Schema<IAppSettingAudit>(
  {
    key: { type: String, required: true },
    oldValue: { type: String, required: false },
    newValue: { type: String, required: false },
    changedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
    ipAddress: { type: String, required: false },
    reason: { type: String, required: false },
    changedAt: { type: Date, default: () => new Date() },
  },
  {
    timestamps: false,
  },
)

AppSettingAuditSchema.index({ key: 1, changedAt: -1 })
AppSettingAuditSchema.index({ changedBy: 1, changedAt: -1 })

export default createModelProxy<IAppSettingAudit>("AppSettingAudit", AppSettingAuditSchema)
