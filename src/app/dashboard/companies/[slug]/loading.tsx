import { Loader2 } from 'lucide-react'

export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <p className="text-sm">Loading company…</p>
    </div>
  )
}
