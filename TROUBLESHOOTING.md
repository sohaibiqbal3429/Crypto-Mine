# Troubleshooting Guide

## Registration Error: "Internal server error"

### Quick Fix Steps:

1. **Check Environment Variables**
   \`\`\`bash
   # Visit: http://localhost:3000/api/health
   # This will show if your environment is configured correctly
   \`\`\`

2. **Setup Database**
   \`\`\`bash
   # Run the setup script to create initial user
   node scripts/setup-database.js
   \`\`\`

3. **Test Registration Components**
   \`\`\`bash
   # Visit: http://localhost:3000/api/debug/test-registration
   # This will test each part of the registration process
   \`\`\`

### Common Issues:

#### 1. MongoDB Connection Error
**Symptoms:** "Database connection failed" or "MONGODB_URI not configured"

**Solutions:**
- Check your `.env.local` file has the correct MongoDB URI
- Ensure your MongoDB Atlas cluster is running
- Verify your IP address is whitelisted in MongoDB Atlas
- Check your username/password in the connection string

#### 2. Missing Initial User
**Symptoms:** "Invalid referral code" when using "AAAAAA"

**Solution:**
\`\`\`bash
node scripts/setup-database.js
\`\`\`

#### 3. Password Hashing Error
**Symptoms:** Error during user creation

**Solution:**
- Ensure `bcryptjs` is installed: `npm install bcryptjs`
- Check if the password meets minimum requirements (6+ characters)

#### 4. JWT Token Error
**Symptoms:** "Token generation failed"

**Solution:**
- Ensure `NEXTAUTH_SECRET` is set in `.env.local`
- The secret should be at least 32 characters long

### Debug Endpoints:

- **Health Check:** `GET /api/health` - Tests database connection and environment
- **Registration Debug:** `POST /api/debug/test-registration` - Tests all registration components

### Environment File Example:

\`\`\`env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/crypto-mining-platform
NEXTAUTH_SECRET=your-32-character-secret-key-here
NEXTAUTH_URL=http://localhost:3000
\`\`\`

### Getting Help:

1. Check the browser console for detailed error messages
2. Check the server console (terminal) for backend errors
3. Use the debug endpoints to isolate the issue
4. Ensure all dependencies are installed: `npm install`

## Git Pull Errors on `package.json` / `package-lock.json`

If `git pull` refuses to run because it would overwrite local changes to
`package.json` or `package-lock.json`, it means you have uncommitted edits to
those files. Use one of the following approaches to proceed safely:

### 1. Keep your local edits

1. Review the changes:
   ```bash
   git status
   git diff package.json package-lock.json
   ```
2. Stage and commit them before pulling:
   ```bash
   git add package.json package-lock.json
   git commit -m "Describe your changes"
   git pull
   ```

### 2. Temporarily stash your edits

```bash
git stash push package.json package-lock.json
git pull
# Re-apply your work after the pull finishes
git stash pop
```

### 3. Discard the local changes

If the edits were unintentional, reset the files to the last committed state.
You can do this manually or by using the helper script described below.

```bash
git restore --staged --worktree package.json package-lock.json
git pull
```

If you run into the problem regularly, use the provided script so you don't
have to remember the exact Git plumbing:

```bash
scripts/reset-package-files.sh
git pull
```

The script clears any lingering `skip-worktree` flags and restores both files
to their committed versions before you retry the pull.

If the files are marked with the `skip-worktree` flag (visible as an `H` in
`git ls-files -v` output), clear it before retrying:

```bash
git update-index --no-skip-worktree package.json package-lock.json
```

Choose the workflow that matches whether you need to keep or discard the local
changes before pulling updates from the remote repository.
