export type NormalizedSMTPError = {
  code: string
  message: string
  status: number
  debug?: Record<string, unknown>
  hint?: string
}

const toMessage = (error: unknown) => {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
    return (error as any).message
  }
  try {
    return JSON.stringify(error)
  } catch (jsonErr) {
    return String(jsonErr) || "Unknown SMTP error"
  }
}

const toLower = (value?: string) => value?.toLowerCase() || ""

export function normalizeSMTPError(
  error: unknown,
  { environment = process.env.NODE_ENV ?? "development" }: { environment?: string } = {},
): NormalizedSMTPError {
  const rawMessage = toMessage(error)
  const lowerMessage = toLower(rawMessage)
  const code = (error as any)?.code as string | undefined
  const responseCode = (error as any)?.responseCode as number | undefined
  const command = (error as any)?.command as string | undefined
  const response = (error as any)?.response as string | undefined
  const providedHint = (error as any)?.hint as string | undefined

  const isLimitError =
    responseCode === 421 ||
    responseCode === 429 ||
    responseCode === 450 ||
    responseCode === 451 ||
    responseCode === 452 ||
    lowerMessage.includes("quota") ||
    lowerMessage.includes("rate limit") ||
    lowerMessage.includes("limit exceeded") ||
    lowerMessage.includes("too many")

  const isAuthError = code === "EAUTH" || responseCode === 535 || lowerMessage.includes("auth")

  const isInvalidAddress =
    code === "EENVELOPE" ||
    code === "EADDRESS" ||
    responseCode === 501 ||
    responseCode === 503 ||
    responseCode === 550 ||
    responseCode === 551 ||
    responseCode === 553 ||
    lowerMessage.includes("invalid sender") ||
    lowerMessage.includes("invalid recipient") ||
    lowerMessage.includes("address")

  const isConnectionError =
    code === "ECONNECTION" ||
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ESOCKET" ||
    code === "EAI_AGAIN" ||
    lowerMessage.includes("timeout") ||
    lowerMessage.includes("dns") ||
    lowerMessage.includes("unreachable")

  const isTLSError = code === "ETLS" || lowerMessage.includes("tls") || lowerMessage.includes("certificate")

  let normalized: NormalizedSMTPError

  if (isLimitError) {
    normalized = {
      code: "SMTP_LIMIT_EXCEEDED",
      message: "You’ve hit the daily email limit. Please try again later or contact support.",
      status: 429,
      hint: "Your provider is rate limiting SMTP requests. Wait and retry, or request a limit increase.",
    }
  } else if (isAuthError) {
    normalized = {
      code: "SMTP_AUTH_FAILED",
      message: "Email service authentication failed. Please check SMTP credentials.",
      status: 401,
      hint: "Verify SMTP_USER/SMTP_PASS, app passwords, and that the account allows SMTP (e.g., Gmail requires an app password).",
    }
  } else if (isInvalidAddress) {
    normalized = {
      code: "SMTP_INVALID_EMAIL",
      message: "The email address was rejected by the provider. Please verify it and try again.",
      status: 400,
      hint: "Check the sender/recipient addresses and domain setup (SPF/DKIM) for your SMTP provider.",
    }
  } else if (isConnectionError) {
    normalized = {
      code: "SMTP_CONNECTION_ERROR",
      message: "Unable to reach the email server. Please try again in a few minutes.",
      status: 502,
      hint: "Confirm SMTP_HOST and SMTP_PORT, ensure outbound traffic isn’t blocked by firewalls/ISP, and that the provider (e.g., Gmail) allows the chosen port.",
    }
  } else if (isTLSError) {
    normalized = {
      code: "SMTP_TLS_ERROR",
      message: "Secure connection to the email server failed. Please try again.",
      status: 502,
      hint: "Ensure the SMTP port matches the TLS requirement (465 for secure), certificates are valid, and STARTTLS is supported.",
    }
  } else {
    normalized = {
      code: "SMTP_UNKNOWN_ERROR",
      message: "Failed to send verification email. Please try again later.",
      status: 500,
      hint: "Re-check SMTP host, port, username, password, and provider-side SMTP access settings.",
    }
  }

  const debug =
    environment === "production"
      ? undefined
      : {
          rawMessage,
          code,
          responseCode,
          command,
          response,
          stack: error instanceof Error ? error.stack : undefined,
        }

  return { ...normalized, ...(providedHint ? { hint: providedHint } : {}), ...(debug ? { debug } : {}) }
}
