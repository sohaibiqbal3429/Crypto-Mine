"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const model_factory_1 = require("@/lib/in-memory/model-factory");
const LevelHistorySchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true },
    level: { type: Number, required: true },
    achievedAt: { type: Date, required: true },
}, {
    timestamps: true,
});
LevelHistorySchema.index({ userId: 1, level: 1 }, { unique: true });
exports.default = (0, model_factory_1.createModelProxy)("LevelHistory", LevelHistorySchema);
