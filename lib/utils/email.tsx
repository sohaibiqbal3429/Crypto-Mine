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
  const subject = `Apple Mine habitat verification`

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Apple Mine Verification</title>
      </head>
      <body style="font-family: 'Inter', Arial, sans-serif; background: #030216; padding: 32px; margin: 0; color: #f8fafc;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 560px; margin: 0 auto; background: linear-gradient(160deg, rgba(56,189,248,0.15), rgba(244,114,182,0.18)); border-radius: 28px; overflow: hidden; border: 1px solid rgba(148,163,184,0.25);">
          <tr>
            <td style="padding: 40px 32px 32px; text-align: center;">
              <div style="width: 72px; height: 72px; margin: 0 auto 20px; border-radius: 20px; background: linear-gradient(135deg, #22d3ee, #3b82f6, #f472b6); display: flex; align-items: center; justify-content: center; font-size: 30px; font-weight: bold; color: #020617;">
                🍏
              </div>
              <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #e2e8f0;">Habitat Verification</h1>
              <p style="margin: 18px 0 0; font-size: 15px; line-height: 1.6; color: rgba(226,232,240,0.8);">
                Use the following one-time code to complete the ${purpose} ritual for your Apple Mine ident.
              </p>
              <div style="margin: 32px auto 24px; max-width: 340px; background: rgba(15,23,42,0.65); border: 1px solid rgba(148,163,184,0.3); border-radius: 18px; padding: 24px;">
                <span style="display: inline-block; font-size: 36px; letter-spacing: 12px; font-weight: 700; color: #67e8f9;">${otp}</span>
              </div>
              <p style="margin: 0; font-size: 13px; color: rgba(226,232,240,0.65);">
                This code expires in 10 minutes. Apple Mine navigators will never ask you to share it.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px 32px 36px; background: rgba(2,6,23,0.85); text-align: center;">
              <p style="margin: 0; font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(148,163,184,0.7);">Apple Mine • Luminous Mining Habitat</p>
              <p style="margin: 12px 0 0; font-size: 12px; color: rgba(148,163,184,0.55);">If you didn&apos;t request this, contact support@applemine.co immediately.</p>
            </td>
          </tr>
        </table>
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
