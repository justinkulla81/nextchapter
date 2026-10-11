import { Hammer } from 'lucide-react'

// Placeholder for a tab whose build step hasn't landed yet. Says which
// step and what it will do, rather than an empty screen.
export function ComingIn({ step, what }: { step: string; what: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border p-8 text-center">
      <Hammer className="size-5 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium">Arrives in {step}</p>
      <p className="max-w-md text-sm text-muted-foreground">{what}</p>
    </div>
  )
}
