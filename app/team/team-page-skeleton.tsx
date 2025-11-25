import { Skeleton } from "@/components/ui/skeleton"

export function TeamPageSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-background md:flex-row">
      <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:border-border/60 md:bg-muted/20">
        <div className="space-y-4 p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-9 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden">
        <div className="space-y-6 p-5 sm:p-6 lg:p-8">
          <div className="space-y-2">
            <Skeleton className="h-8 w-60" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-10 w-32 rounded-full" />
            <Skeleton className="h-10 w-32 rounded-full" />
          </div>
          <div className="space-y-6">
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-8 w-28" />
                  <Skeleton className="h-10 w-40" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-4 w-44" />
                  <Skeleton className="h-4 w-52" />
                </div>
              </div>
            </div>
            <div className="rounded-xl border border-border/60 bg-card p-6">
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-52" />
                    </div>
                    <div className="flex gap-3">
                      <Skeleton className="h-4 w-16" />
                      <Skeleton className="h-4 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
