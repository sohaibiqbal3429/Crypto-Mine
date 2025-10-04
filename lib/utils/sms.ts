import twilio from "twilio"

export async function sendOTPSMS(phone: string, otp: string, purpose = "registration") {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error(
      "Twilio configuration missing. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.",
    )
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const message = `Apple Mine code: ${otp}. Use this within 10 minutes to finish your ${purpose} ritual. Navigators will never ask for it.`

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    })
  } catch (error) {
    console.error("SMS sending failed:", error)
    throw new Error("Failed to send SMS. Please check your Twilio configuration.")
  }
}
