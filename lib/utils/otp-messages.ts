export interface OTPSuccessPayload {
  message?: string
  devOtp?: string
}

export function formatOTPSuccessMessage(payload: OTPSuccessPayload | undefined, fallbackMessage: string): string {
  const baseMessage = payload?.message?.trim() || fallbackMessage

  if (payload?.devOtp) {
    return `${baseMessage} (Dev OTP: ${payload.devOtp})`
  }

  return baseMessage
}
