import type { ReactNode } from "react"

interface GiftBoxErrorStateProps {
  title?: string
  message: string
  actions?: ReactNode
  details?: string
}

export function GiftBoxErrorState({
  title = "Gift Box is temporarily unavailable",
  message,
  actions,
  details,
}: GiftBoxErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/50 p-10 text-center text-slate-200">
      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-300">{message}</p>
        </div>
        {details ? <p className="text-xs text-slate-400">{details}</p> : null}
        {actions ? <div className="mt-4 flex justify-center gap-3">{actions}</div> : null}
      </div>
    </div>
  )
}
