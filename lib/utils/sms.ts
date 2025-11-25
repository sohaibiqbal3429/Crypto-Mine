import twilio from "twilio"

export async function sendOTPSMS(phone: string, otp: string, purpose = "registration") {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
    throw new Error(
      "Twilio configuration missing. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.",
    )
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  const message = `Your Mintmine Pro verification code for ${purpose} is: ${otp}. This code expires in 10 minutes. Do not share this code.`

  try {
    await client.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    })
  } catch (error) {
    console.error("SMS sending failed:", error)
    const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Failed to send SMS"
    throw new Error(message)
  }
}
