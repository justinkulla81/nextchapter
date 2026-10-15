import { Card, CardContent } from '@/components/ui/card'
import type { PlaybookMilestone, PlaybookPosition } from '@/lib/journey/search-playbook'
import { PlaybookActionLink } from './PlaybookActionLink'

const BASIS_LABEL = {
  SINCE_LAST_JOB: 'weeks since your last day',
  SINCE_SEARCH_STARTED: 'weeks since you started applying',
} as const

function Milestone({ m, journey }: { m: PlaybookMilestone; journey: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-foreground">{m.title}</p>
      <p className="text-sm text-muted-foreground">{m.summary}</p>
      <ul className="space-y-1 text-sm text-foreground">
        {m.actions.map((a) => (
          <li key={a.text} className="flex gap-2">
            <span aria-hidden className="text-muted-foreground">•</span>
            <span>{a.href ? <PlaybookActionLink href={a.href} journey={journey} atWeek={m.atWeek}>{a.text}</PlaybookActionLink> : a.text}</span>
          </li>
        ))}
      </ul>
      {m.evidence && <p className="text-xs text-muted-foreground">{m.evidence}</p>}
    </div>
  )
}

// Shows the step the member is on in their search and what to change next.
// Quiet when no search is running. Journey-aware: nothing here assumes the
// member is out of work.
export function SearchPlaybookCard({ position }: { position: PlaybookPosition }) {
  const { clock, current, next, journey, isLongTermUnemployed } = position
  const focus = current ?? next
  if (!focus) return null

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium text-foreground">Your search plan, week {clock.weeks}</p>
          <p className="text-xs text-muted-foreground">{BASIS_LABEL[clock.basis]}</p>
        </div>
        {isLongTermUnemployed && (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-foreground">
            A longer search is not a personal failure. More professionals are in this position than a year ago, and what works changes at this point.
          </p>
        )}
        <Milestone m={focus} journey={journey} />
        {current && next && (
          <p className="border-t border-border pt-3 text-xs text-muted-foreground">
            Next, at week {next.atWeek}: {next.title.replace(/^Week \d+( and beyond)?: /, '')}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
