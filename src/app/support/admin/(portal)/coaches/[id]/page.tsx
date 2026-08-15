import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { SubmitButton } from '@/components/ui/submit-button'
import { toggleCoachTestAccount, toggleCoachBench } from './actions'
import { TransferClientForm } from '@/components/admin/TransferClientForm'
import { getCoachingSettings } from '@/lib/admin/coaching-settings'

export const maxDuration = 30

export default async function AdminCoachDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [coach, otherCoaches, settings] = await Promise.all([
    prisma.coach.findUnique({
      where: { id },
      include: {
        clients: {
          select: { id: true, firstName: true, lastName: true, coachDossierConsentedAt: true },
        },
        sessions: {
          orderBy: { occurredAt: 'desc' },
          take: 20,
          select: { id: true, occurredAt: true, candidateId: true, candidateRating: true },
        },
      },
    }),
    prisma.coach.findMany({ where: { id: { not: id }, isSampleData: false }, select: { id: true, fullName: true }, orderBy: { fullName: 'asc' } }),
    getCoachingSettings(),
  ])
  if (!coach) notFound()

  // §A5.4 quality control — flagging only, never automatic removal.
  const ratedSessions = coach.sessions.filter((s) => s.candidateRating !== null)
  const avgRating =
    ratedSessions.length > 0
      ? ratedSessions.reduce((sum, s) => sum + (s.candidateRating ?? 0), 0) / ratedSessions.length
      : null
  const removalThreshold = settings.sessionRatingRemovalThreshold ? Number(settings.sessionRatingRemovalThreshold) : null
  const belowThreshold = avgRating !== null && removalThreshold !== null && avgRating < removalThreshold

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/coaches" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to coaches
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {coach.fullName}
          {coach.isSampleData && (
            <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              Test account
            </span>
          )}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {coach.firmName ?? 'No firm'} · {coach.workEmail} · {coach.focus}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {coach.userId ? 'Has a real login' : 'Token-only access (no login)'}
        </p>
        {avgRating !== null && (
          <p className={`mt-1 text-sm ${belowThreshold ? 'font-medium text-destructive' : 'text-muted-foreground'}`}>
            Avg session rating: {avgRating.toFixed(1)} / 5 ({ratedSessions.length} rated)
            {belowThreshold && ' — below removal threshold, flagged for review'}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <form action={toggleCoachTestAccount.bind(null, coach.id, coach.isSampleData)}>
            <SubmitButton size="sm" variant="outline">
              {coach.isSampleData ? 'Unmark as test account' : 'Mark as test account'}
            </SubmitButton>
          </form>
          <form action={toggleCoachBench.bind(null, coach.id, coach.isOnCallBench)}>
            <SubmitButton size="sm" variant={coach.isOnCallBench ? 'outline' : 'secondary'}>
              {coach.isOnCallBench ? 'Remove from surge bench' : 'Add to surge bench'}
            </SubmitButton>
          </form>
        </div>
        {coach.isOnCallBench && (
          <p className="mt-1 text-xs text-muted-foreground">
            On-call for surge outreach — see the bench panel on the coaches list.
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Clients ({coach.clients.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {coach.clients.length === 0 ? (
            <p className="text-sm text-muted-foreground">No clients yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-foreground">
              {coach.clients.map((c) => (
                <li key={c.id}>
                  <Link href={`/support/admin/candidates/${c.id}`} className="text-primary underline underline-offset-4">
                    {[c.firstName, c.lastName].filter(Boolean).join(' ') || 'Unnamed'}
                  </Link>
                  {c.coachDossierConsentedAt ? ' — consented' : ' — no consent yet'}
                  <TransferClientForm coachId={coach.id} candidateId={c.id} otherCoaches={otherCoaches} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent sessions ({coach.sessions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {coach.sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {coach.sessions.map((s) => (
                <li key={s.id}>{s.occurredAt.toLocaleDateString()}</li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
