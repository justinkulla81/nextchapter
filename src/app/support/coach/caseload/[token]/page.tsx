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

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-16">
      <div>
        <Link href="/support/coach" className="text-sm text-muted-foreground underline underline-offset-4">
          ← Back home
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Your caseload</h1>
        <p className="mt-1 text-muted-foreground">
          Roster-level view — grade trend and who&apos;s stalled, at a glance.
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

      <div className="divide-y divide-border rounded-lg border border-border">
        {caseload.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No clients yet.</p>
        ) : (
          caseload.map((client) => (
            <Link
              key={client.id}
              href={`/support/coach/clients/${token}/${client.id}`}
              className="flex items-center justify-between gap-4 p-4 hover:bg-muted"
            >
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
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
