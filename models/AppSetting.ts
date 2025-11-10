import mongoose, { Schema, type Document } from "mongoose"

import { createModelProxy } from "@/lib/in-memory/model-factory"

export interface IAppSetting extends Document {
  key: string
  value: string
  encrypted: boolean
  updatedBy?: mongoose.Types.ObjectId | null
  updatedAt: Date
  createdAt: Date
}

const AppSettingSchema = new Schema<IAppSetting>(
  {
    key: { type: String, required: true, unique: true },
    value: { type: String, required: true },
    encrypted: { type: Boolean, default: false },
    updatedBy: { type: Schema.Types.ObjectId, ref: "User", required: false },
  },
  {
    timestamps: true,
  },
)

AppSettingSchema.index({ key: 1 }, { unique: true })

export default createModelProxy<IAppSetting>("AppSetting", AppSettingSchema)
