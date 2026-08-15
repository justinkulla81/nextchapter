import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoachByToken } from '@/lib/coach/access'
import { getCoachCaseload } from '@/lib/coach/caseload'

export const maxDuration = 30

const TREND_LABEL: Record<string, string> = { up: '↑', down: '↓', flat: '→' }

export default async function CoachCaseloadPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const coach = await getCoachByToken(token)
  if (!coach) notFound()

  const caseload = await getCoachCaseload(coach.id)
  const stalled = caseload.filter((c) => c.isStalled)
  const riskTriggerCount = caseload.reduce((sum, c) => sum + c.triggers.filter((t) => t.type === 'RISK').length, 0)
  const goodNewsCount = caseload.reduce((sum, c) => sum + c.triggers.filter((t) => t.type === 'GOOD_NEWS').length, 0)

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <div>
        <Link href="/support/coach" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your caseload</h1>
        <p className="mt-1 text-muted-foreground">
          Roster-level view — grade trend, who&apos;s stalled, and real risk/good-news triggers, at a glance.
        </p>
      </div>

      {stalled.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="font-medium text-amber-900">
            {stalled.length} client{stalled.length > 1 ? 's' : ''} showing an avoidance pattern —{' '}
            {stalled.map((c) => c.name).join(', ')}.
          </p>
        </div>
      )}

      {(riskTriggerCount > 0 || goodNewsCount > 0) && (
        <div className="flex flex-wrap gap-3 text-sm">
          {riskTriggerCount > 0 && (
            <span className="rounded-full bg-warning/10 px-3 py-1 font-medium text-warning">
              {riskTriggerCount} risk trigger{riskTriggerCount > 1 ? 's' : ''}
            </span>
          )}
          {goodNewsCount > 0 && (
            <span className="rounded-full bg-success/10 px-3 py-1 font-medium text-success">
              {goodNewsCount} good-news trigger{goodNewsCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      <div className="divide-y divide-border rounded-lg border border-border">
        {caseload.length === 0 ? (
          <p className="flex min-h-[var(--row-height-partner)] items-center px-4 py-2 text-sm text-muted-foreground">
            No clients yet.
          </p>
        ) : (
          caseload.map((client) => {
            const riskTriggers = client.triggers.filter((t) => t.type === 'RISK')
            const goodNewsTriggers = client.triggers.filter((t) => t.type === 'GOOD_NEWS')
            return (
              <Link
                key={client.id}
                href={`/support/coach/clients/${token}/${client.id}`}
                className="flex min-h-[var(--row-height-partner)] flex-col gap-1 px-4 py-2 hover:bg-muted"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-foreground">{client.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {client.weekNumber !== null ? `Week ${client.weekNumber}` : 'Not yet registered'}
                      {client.isStalled && ' · Avoidance pattern flagged'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-foreground">
                      {client.executionGrade ?? '—'} {client.trend && TREND_LABEL[client.trend]}
                    </p>
                  </div>
                </div>
                {(riskTriggers.length > 0 || goodNewsTriggers.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {riskTriggers.map((t) => (
                      <span
                        key={t.key}
                        title={t.detail}
                        className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning"
                      >
                        {t.label}
                      </span>
                    ))}
                    {goodNewsTriggers.map((t) => (
                      <span
                        key={t.key}
                        title={t.detail}
                        className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                      >
                        {t.label}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
