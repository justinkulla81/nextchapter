import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getRateCardHistory } from '@/lib/admin/coaching-rate-card'
import { COACH_SESSION_TYPES, COACH_SESSION_TYPE_LABELS } from '@/lib/constants/coach-session-type'
import { createRateCardRow } from './actions'
import { RateCardForm } from '@/components/admin/RateCardForm'
import { Card, CardContent } from '@/components/ui/card'

function formatCents(cents: number) {
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function CoachingRatesAdminPage() {
  await requireAdmin()

  const [history, coaches] = await Promise.all([
    getRateCardHistory(),
    prisma.coach.findMany({ where: { isSampleData: false }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Coaching rate card</h1>
        <p className="mt-1 text-muted-foreground">
          Coach pay is configuration, not code. Adding a rate here never edits history — it inserts a new
          effective-dated row. A session locks in whatever rate is current the moment it&apos;s logged, so a rate
          change here never changes what a past session paid. Leave &quot;Applies to&quot; on the default option to
          set the standard rate for a session type, or pick a coach to set a per-coach override.
        </p>
      </div>

      <RateCardForm action={createRateCardRow} coaches={coaches} />

      {COACH_SESSION_TYPES.map((type) => {
        const rows = history[type]
        const current = rows.filter((r) => r.isCurrent)
        const past = rows.filter((r) => !r.isCurrent)
        return (
          <div key={type} className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight">{COACH_SESSION_TYPE_LABELS[type]}</h2>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rate seeded yet for this session type.</p>
            ) : (
              <>
                {current.length > 0 && (
                  <div className="space-y-2">
                    {current.map((row) => (
                      <Card key={row.id}>
                        <CardContent className="flex items-center justify-between gap-4 pt-6">
                          <div>
                            <p className="font-medium">
                              {formatCents(row.rateCents)}
                              <span className="ml-2 rounded-full bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand">
                                Current
                              </span>
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {row.coach ? `Override — ${row.coach.fullName}` : 'Default rate'} · effective{' '}
                              {row.effectiveDate.toLocaleDateString()} · set by {row.createdBy}
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {past.length > 0 && (
                  <details className="group">
                    <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
                      {past.length} past rate{past.length === 1 ? '' : 's'}
                    </summary>
                    <div className="mt-2 space-y-2">
                      {past.map((row) => (
                        <div key={row.id} className="rounded-md border border-border px-4 py-2 text-sm text-muted-foreground">
                          {formatCents(row.rateCents)} — {row.coach ? `Override, ${row.coach.fullName}` : 'Default'} ·
                          effective {row.effectiveDate.toLocaleDateString()} · set by {row.createdBy}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
