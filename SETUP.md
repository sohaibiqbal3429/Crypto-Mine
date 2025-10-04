# Apple Mine Habitat Setup Guide

## Quick Setup Instructions

### 1. Environment Variables
Copy the `.env.example` file to `.env.local` and fill in your values:

\`\`\`bash
cp .env.example .env.local
\`\`\`

### 2. Required Environment Variables

**MONGODB_URI**: Your MongoDB Atlas connection string
- Go to MongoDB Atlas (https://cloud.mongodb.com)
- Create a cluster or use existing one
- Click "Connect" → "Connect your application"
- Copy the connection string
- Replace `<password>` with your database user password
- Replace `<database_name>` with your preferred database name

Example:
\`\`\`
MONGODB_URI=mongodb+srv://username:password@cluster0.abc123.mongodb.net/cryptomine?retryWrites=true&w=majority
\`\`\`

**NEXTAUTH_SECRET**: Random secret key for JWT tokens
- Generate a random string (32+ characters)
- You can use: `openssl rand -base64 32`
- Or any random string generator

Example:
\`\`\`
NEXTAUTH_SECRET=your-super-secret-random-string-here-32-chars-min
\`\`\`

**NEXTAUTH_URL**: Your application URL
- For development: `http://localhost:3000`
- For production: your actual domain

**DEPOSIT_WALLET_ADDRESS**: Platform wallet address used for user deposits
- For development you can use a dummy value like `USDT-DEMO-ADDRESS-123`
- This value is shared with users when they initiate a deposit

**DEPOSIT_WALLET_NETWORK** (optional): Network label shown alongside the deposit address
- Example: `TRON (TRC20)` or `Ethereum`

### 3. Install Dependencies
\`\`\`bash
npm install
# or
pnpm install
\`\`\`

### 4. Seed Database (Optional)
\`\`\`bash
npm run seed:db
\`\`\`

> 💡 Want to verify the seed logic without a MongoDB instance? Run `SEED_IN_MEMORY=true npm run seed:db` to execute the script against an in-memory store.

### 5. Start Development Server
\`\`\`bash
npm run dev
\`\`\`

Visit `http://localhost:3000` to explore the luminous habitat!

## Features Included
- ✅ Spectral authentication rituals with dual-factor support
- ✅ Cinematic mining dashboards and live reactor telemetry
- ✅ Vault management with layered safeguards
- ✅ Alliance structure and transparent commission matrix
- ✅ Admin deck for approvals and oversight
- ✅ Transaction history with contextual storytelling
- ✅ Mobile-first, motion-rich interface
- ✅ MongoDB integration with Mongoose
- ✅ JWT-based authentication
- ✅ Role-based access control

## Default Admin Account
After seeding, you can login with:
- Email: `admin@cryptomining.com`
- Password: `admin123`

## Need Help?
Check the README.md for detailed documentation and API endpoints.
