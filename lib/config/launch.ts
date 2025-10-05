export interface LaunchConfig {
  /** ISO8601 timestamp describing when the launch goes live. */
  launchAt: string
}

const DEFAULT_OFFSET_DAYS = 87
const ENV_LAUNCH_AT = process.env.LAUNCH_AT

const launchAt = (() => {
  if (ENV_LAUNCH_AT) {
    const parsed = new Date(ENV_LAUNCH_AT)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString()
    }
    console.error("Invalid LAUNCH_AT environment variable, falling back to offset schedule")
  }

  const now = new Date()
  const launchDate = new Date(now.getTime() + DEFAULT_OFFSET_DAYS * 24 * 60 * 60 * 1000)
  launchDate.setMilliseconds(0)
  return launchDate.toISOString()
})()

export const launchConfig: LaunchConfig = {
  launchAt,
}
