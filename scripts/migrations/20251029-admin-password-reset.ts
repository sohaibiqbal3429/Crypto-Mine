import dotenv from "dotenv"
import path from "path"

// Load env like the seeder does so server + scripts match
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })
import bcrypt from "bcryptjs"

import dbConnect from "@/lib/mongodb"
import User from "@/models/User"

async function run() {
  const email = process.env.ADMIN_EMAIL || "admin@cryptomining.com"
  const newPassword = process.env.ADMIN_NEW_PASSWORD || "Coin4$"

  await dbConnect()

  const user = await User.findOne({ email })
  if (!user) {
    console.error(`[admin-reset] User not found: ${email}`)
    process.exit(1)
    return
  }

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await User.updateOne({ _id: user._id }, { $set: { passwordHash } })

  console.log(`[admin-reset] Password updated for ${email}`)
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[admin-reset] Error:", err)
    process.exit(1)
  })
