import User from "@/models/User"
import Transaction from "@/models/Transaction"

import { getOrSet } from "../mongoCache"

export async function getKpis() {
  return getOrSet("kpis:v1", 30, async () => {
    const [usersCount, revenue] = await Promise.all([
      User.estimatedDocumentCount().exec(),
      Transaction.aggregate([
        { $match: { status: { $ne: "rejected" } } },
        { $group: { _id: null, sum: { $sum: "$amount" } } },
        { $project: { _id: 0, sum: 1 } },
      ]).exec(),
    ])

    return {
      users: usersCount,
      revenue: revenue[0]?.sum ?? 0,
    }
  })
}
