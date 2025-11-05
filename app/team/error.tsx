"use client"

import { useEffect } from "react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface TeamErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function TeamError({ error, reset }: TeamErrorProps) {
  useEffect(() => {
    console.error("Team page runtime error", error)
  }, [error])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-lg border-border/60 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">Something went wrong</CardTitle>
          <p className="text-sm text-muted-foreground">
            We could not load the team experience right now. The issue has been logged for review.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Error message</p>
            <p>{error.message || "Unknown error"}</p>
            {error.digest ? <p className="mt-1 text-xs">Reference: {error.digest}</p> : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button variant="outline" onClick={reset} className="sm:w-auto">
              Try again
            </Button>
            <Button asChild className="sm:w-auto">
              <Link href="/dashboard">Return to dashboard</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
