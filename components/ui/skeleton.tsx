import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('bg-muted/60 dark:bg-muted/40 animate-pulse rounded-md', className)}
      {...props}
    />
  )
}

export { Skeleton }
