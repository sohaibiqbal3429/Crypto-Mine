import dotenv from "dotenv"
import path from "path"
import dbConnect from "@/lib/mongodb"
import User from "@/models/User"

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") })

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="))
  const email = (emailArg ? emailArg.split("=")[1] : process.env.ADMIN_EMAIL || "admin@cryptomining.com").toLowerCase()

  console.log("[diag] NODE_ENV=", process.env.NODE_ENV)
  console.log("[diag] SEED_IN_MEMORY=", process.env.SEED_IN_MEMORY)
  console.log("[diag] MONGODB_URI set:", Boolean(process.env.MONGODB_URI))
  console.log("[diag] AUTH_SERVICE env present:", Boolean(process.env.AUTH_SERVICE_LOGIN_URL || process.env.AUTH_SERVICE_URL || process.env.BACKEND_API_URL || process.env.API_BASE_URL))

  const conn = await dbConnect()
  console.log("[diag] Connected:", (conn as any)?.inMemory ? "in-memory" : "mongodb")

  const user = (await User.findOne({ email }).select({ _id: 1, updatedAt: 1, passwordHash: 1 }).lean()) as
    | { _id: any; updatedAt?: Date; passwordHash?: string }
    | null
  if (!user) {
    console.log("[diag] User not found:", email)
    process.exit(1)
    return
  }

  console.log("[diag] User id:", String(user._id))
  console.log("[diag] PasswordHash head:", String(user.passwordHash || "").slice(0, 12))
  console.log("[diag] UpdatedAt:", user.updatedAt)
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1) })
