import { launchConfig } from "@/lib/config/launch"

export interface LaunchSchedule {
  launchAt: Date
}

export function getLaunchSchedule(): LaunchSchedule {
  return {
    launchAt: new Date(launchConfig.launchAt),
  }
}
