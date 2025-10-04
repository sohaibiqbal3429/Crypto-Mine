import nodemailer from "nodemailer"

const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number.parseInt(process.env.SMTP_PORT || "587"),
    secure: false, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })
}

export async function sendOTPEmail(email: string, otp: string, purpose = "registration") {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error("SMTP configuration missing. Please set SMTP_USER and SMTP_PASS environment variables.")
  }

  const transporter = createTransporter()
  const subject = `Your Apple Mine Verification Code`

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Verification Code</title>
    </head>
    <body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background: linear-gradient(135deg, #4ade80, #a3e635, #facc15); color: #064e3b; width: 64px; height: 64px; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; font-weight: bold;">
          🍏
        </div>
      </div>
      
      <div style="background: #f8f9fa; padding: 30px; border-radius: 10px; text-align: center;">
        <h2 style="color: #047857; margin-bottom: 20px;">Apple Mine Verification Code</h2>
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
        <p>© 2025 Apple Mine. All rights reserved.</p>
      </div>
    </body>
    </html>
  `

  try {
    await transporter.sendMail({
      from: `"Apple Mine" <${process.env.SMTP_USER}>`,
      to: email,
      subject,
      html,
    })
  } catch (error) {
    console.error("Email sending failed:", error)
    throw new Error("Failed to send email. Please check your SMTP configuration.")
  }
}
