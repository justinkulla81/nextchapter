import { ChevronDown } from 'lucide-react'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { updateEmailSchedule, toggleEmailScheduleActive } from './actions'
import { EmailCadenceForm } from '@/components/admin/EmailCadenceForm'
import { Card, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'

export const maxDuration = 30

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export default async function EmailCadenceAdminPage() {
  await requireAdmin()

  const rows = await prisma.candidateEmailSchedule.findMany({ orderBy: { dayOfWeek: 'asc' } })
  // Sort Monday-first for display — dayOfWeek is stored 0=Sun..6=Sat to match getUTCDay().
  const displayRows = [...rows].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7))

  return (
    <div className="mx-auto max-w-3xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Cadence</h1>
        <p className="mt-1 text-muted-foreground">
          One editable row per weekday — each drives the title, framing copy, send time, active state, and
          privacy-tier eligibility for that day&apos;s candidate email. Which sender a weekday points to is fixed
          in code, not editable here.
        </p>
      </div>

      <div className="space-y-3">
        {displayRows.map((row) => (
          <Card key={row.id}>
            <CardContent className="space-y-3 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                    {DAY_LABELS[row.dayOfWeek]} · {row.emailKey}
                  </p>
                  <p className="font-medium">
                    {row.title}
                    {!row.isActive && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                        Inactive
                      </span>
                    )}
                  </p>
                  {row.description && <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sends at {String(row.sendHourUtc).padStart(2, '0')}:00 UTC ·{' '}
                    {row.eligiblePrivacyTiers.length > 0 ? row.eligiblePrivacyTiers.join(', ') : 'All privacy tiers'}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <form action={toggleEmailScheduleActive.bind(null, row.id, row.isActive)}>
                    <SubmitButton variant="ghost" size="sm">
                      {row.isActive ? 'Deactivate' : 'Activate'}
                    </SubmitButton>
                  </form>
                </div>
              </div>
              <details className="group">
                <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-brand">
                  Edit
                  <ChevronDown className="size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <div className="mt-3">
                  <EmailCadenceForm action={updateEmailSchedule.bind(null, row.id)} existing={row} />
                </div>
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
