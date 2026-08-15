import Link from 'next/link'
import { Lock } from 'lucide-react'
import { CONFIDENTIAL_MODE_INDICATOR_TEXT } from '@/lib/constants/confidential-mode-copy'

// The persistent, quiet indicator spec §6 calls for "wherever visibility
// could be at stake" — Community, Marketing Plan/LinkedIn, Outreach, Gmail
// connection. Deliberately small and non-alarming (no red/destructive
// color) — this is reassurance, not a warning.
export function ConfidentialModeIndicator({ className }: { className?: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded-md border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground ${className ?? ''}`}
    >
      <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">{CONFIDENTIAL_MODE_INDICATOR_TEXT}.</span>{' '}
        Nothing you do here is visible to other members or outside NextChapter.{' '}
        <Link href="/dashboard/privacy" className="underline underline-offset-2 hover:text-foreground">
          Manage
        </Link>
      </span>
    </div>
  )
}
