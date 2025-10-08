import "dotenv/config"

import { createReportWorker } from "@/lib/queue"
import Transaction from "@/models/Transaction"

createReportWorker(async (job) => {
  if (job.name === "tx-export") {
    const { from, to, adminId } = job.data as { from?: string; to?: string; adminId: string }

    const matchStage: Record<string, unknown> = {}
    if (from || to) {
      matchStage.createdAt = {
        ...(from ? { $gte: new Date(from) } : {}),
        ...(to ? { $lte: new Date(to) } : {}),
      }
    }

    const transactions = await Transaction.aggregate([
      { $match: matchStage },
      { $project: { _id: 0, userId: 1, amount: 1, status: 1, createdAt: 1 } },
    ])

    console.log(`[reports] Generated ${transactions.length} transactions for admin ${adminId}`)
  }
})
