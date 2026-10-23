export default function Loading() {
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <p className="text-sm text-muted-foreground">Loading the capability matrix…</p>
      <div className="h-8 w-64 animate-pulse rounded bg-muted" />
      <div className="h-64 animate-pulse rounded-lg bg-muted/60" />
    </div>
  )
}
