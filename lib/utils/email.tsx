import nodemailer from "nodemailer"

export function getSMTPConfig() {
  const port = Number.parseInt(process.env.SMTP_PORT?.trim() || "587", 10)

  const smtpUser = process.env.SMTP_USER?.trim() || ""
  const smtpPass = process.env.SMTP_PASS?.trim() || ""

  return {
    host: process.env.SMTP_HOST?.trim() || "smtp.gmail.com",
    port,
    user: smtpUser,
    pass: smtpPass,
    from: process.env.SMTP_FROM?.trim() || smtpUser,
  }
}

export function hasSMTPConfig(): boolean {
  const { user, pass } = getSMTPConfig()
  return Boolean(user && pass)
}

const createTransporter = () => {
  const config = getSMTPConfig()

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    // Use a secure connection for implicit TLS (port 465) and STARTTLS otherwise
    secure: config.port === 465,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  })
}

export async function sendOTPEmail(email: string, otp: string, purpose = "registration") {
  const { user, pass, from } = getSMTPConfig()

  if (!user || !pass) {
    throw new Error("SMTP configuration missing. Please set SMTP_USER and SMTP_PASS environment variables.")
  }

  const transporter = createTransporter()
  const subject = `Your Mintmine Pro Verification Code`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verification Code</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: #f59e0b; color: white; width: 60px; height: 60px; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold;">
          M
        </div>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
        <h2 style="color: #1e40af; margin-bottom: 20px;">Verification Code</h2>
        <p style="font-size: 16px; color: #374151; margin-bottom: 25px;">
          Your verification code for ${purpose} is:
        </p>
        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; color: #1e40af; letter-spacing: 5px;">${otp}</span>
        </div>
        <p style="font-size: 14px; color: #6b7280;">
          This code will expire in 10 minutes. Do not share this code with anyone.
        </p>
      </div>
      
      <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #9ca3af;">
        <p>© 2025 Mintmine Pro. All rights reserved.</p>
      </div>
    </body>
    </html>
  `

  try {
    await transporter.sendMail({
      from: `"Mintmine Pro" <${from}>`,
      to: email,
      subject,
      html,
    })
  } catch (error) {
    console.error("Email sending failed:", error)
    throw new Error("Failed to send email. Please check your SMTP configuration.")
  }
}
