export interface AuditEvent {
  event: string
  actorId?: string
  metadata?: Record<string, unknown>
  severity?: "info" | "warn" | "error"
}

export function emitAuditLog(event: AuditEvent | string, metadata: Record<string, unknown> = {}): void {
  if (typeof event === "string") {
    const payload = {
      ts: new Date().toISOString(),
      event,
      severity: "info" as const,
      metadata,
    }
    console.info(`[audit] ${JSON.stringify(payload)}`)
    return
  }

  const payload = {
    ts: new Date().toISOString(),
    event: event.event,
    severity: event.severity ?? "info",
    metadata: { ...(event.metadata ?? {}), ...(metadata ?? {}) },
    actorId: event.actorId,
  }

  console.info(`[audit] ${JSON.stringify(payload)}`)
}
