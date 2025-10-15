export type MetricTags = Record<string, string | number | boolean | null | undefined>

function serialiseTags(tags: MetricTags): Record<string, string> {
  return Object.entries(tags).reduce<Record<string, string>>((acc, [key, value]) => {
    if (value === undefined || value === null) {
      return acc
    }
    acc[key] = String(value)
    return acc
  }, {})
}

export function incrementCounter(name: string, value = 1, tags: MetricTags = {}): void {
  if (!name) {
    return
  }

  const payload = {
    ts: new Date().toISOString(),
    metric: name,
    type: "counter" as const,
    value,
    tags: serialiseTags(tags),
  }

  console.info(`[metric] ${JSON.stringify(payload)}`)
}

export function recordGauge(name: string, value: number, tags: MetricTags = {}): void {
  if (!name) {
    return
  }

  const payload = {
    ts: new Date().toISOString(),
    metric: name,
    type: "gauge" as const,
    value,
    tags: serialiseTags(tags),
  }

  console.info(`[metric] ${JSON.stringify(payload)}`)
}
