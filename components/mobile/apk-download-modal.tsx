"use client"

import { Download, RefreshCcw, Smartphone } from "lucide-react"
import { useState } from "react"

import { useMobileApkMetadata } from "@/hooks/use-mobile-apk-metadata"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"

interface ApkDownloadModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ApkDownloadModal({ open, onOpenChange }: ApkDownloadModalProps) {
  const { data, error, isLoading, isValidating, mutate } = useMobileApkMetadata()
  const [isCopying, setIsCopying] = useState(false)

  const metadata = data?.apk

  async function handleCopy() {
    if (!metadata?.downloadUrl || typeof navigator === "undefined" || !navigator.clipboard) {
      return
    }
    try {
      setIsCopying(true)
      await navigator.clipboard.writeText(metadata.downloadUrl)
    } catch (copyError) {
      console.error("Failed to copy download URL", copyError)
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Smartphone className="h-5 w-5 text-primary" />
            Download the Crypto Mine app
          </DialogTitle>
          <DialogDescription>Install the latest Android release and stay in sync with your mining dashboard.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              {error instanceof Error ? error.message : "Failed to load APK metadata."}
            </div>
          ) : metadata ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Version {metadata.version}</Badge>
                {data?.pollIntervalMs ? (
                  <span className="text-xs text-muted-foreground">
                    Auto-refresh every {Math.round(data.pollIntervalMs / 1000)}s
                  </span>
                ) : null}
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
                <dl className="grid gap-2">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">APK URL</dt>
                    <Button variant="ghost" size="sm" onClick={handleCopy} disabled={isCopying}>
                      {isCopying ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <dd className="break-all font-mono text-xs text-primary-foreground/80">{metadata.downloadUrl}</dd>
                  {metadata.fileSizeMb ? (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>File size</span>
                      <span>{metadata.fileSizeMb.toFixed(2)} MB</span>
                    </div>
                  ) : null}
                  {metadata.buildDate ? (
                    <div className="flex items-center justify-between text-muted-foreground">
                      <span>Built on</span>
                      <span>{new Date(metadata.buildDate).toLocaleString()}</span>
                    </div>
                  ) : null}
                </dl>
              </div>

              {metadata.releaseNotes ? (
                <div className="rounded-lg border bg-card p-3 text-sm">
                  <h3 className="mb-2 text-sm font-semibold">What\'s new</h3>
                  <p className="whitespace-pre-line text-muted-foreground">{metadata.releaseNotes}</p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              No download is currently available. Check back soon.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              void mutate(undefined, true)
            }}
            disabled={isValidating}
          >
            <RefreshCcw className="mr-2 h-4 w-4" /> Refresh
          </Button>
          <Button asChild disabled={!metadata?.downloadUrl}>
            <a href={metadata?.downloadUrl ?? "#"} target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Download APK
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
