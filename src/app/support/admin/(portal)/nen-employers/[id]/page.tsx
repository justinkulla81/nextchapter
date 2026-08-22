import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, listAllAuthUsers } from '@/lib/admin/auth-users'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { suspendEmployer } from './actions'

export const maxDuration = 30

const FUNCTION_INTEREST_LABEL: Record<string, string> = {
  TECH: 'Tech / Engineering',
  MARKETING: 'Marketing',
  DATA: 'Data / Analytics',
  DESIGN: 'Design',
  BUSINESS: 'Business / Operations',
  GENERALIST: 'Generalist',
}

export default async function AdminNenEmployerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [employer, authUsers] = await Promise.all([
    prisma.crucibleEmployerProfile.findUnique({
      where: { id },
      include: {
        contests: { orderBy: { createdAt: 'desc' }, select: { id: true, title: true, state: true, createdAt: true } },
        resumeViews: { orderBy: { viewedAt: 'desc' }, take: 20, select: { id: true, sessionId: true, contestId: true, viewedAt: true } },
      },
    }),
    listAllAuthUsers(),
  ])
  if (!employer) notFound()

  const isSuspended = !!employer.suspendedAt

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/nen-employers" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to NEN employers
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          {employer.companyName}
          {isSuspended && (
            <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              Suspended
            </span>
          )}
        </h1>
        <p className="mt-1 text-muted-foreground">
          {employer.contactName ?? 'No contact name'} · {getAuthEmail(authUsers, employer.userId)}
        </p>
        <ConfirmForm
          action={suspendEmployer.bind(null, employer.id, isSuspended)}
          confirmMessage={
            isSuspended
              ? 'Unsuspend this employer? This clears the flag — it does not itself grant any access back that another change may have removed.'
              : "Suspend this employer? This flags the account for admin/ops visibility only — it does NOT sign them out or block their login."
          }
          className="mt-3"
        >
          <SubmitButton size="sm" variant={isSuspended ? 'outline' : 'destructive'}>
            {isSuspended ? 'Unsuspend employer' : 'Suspend employer'}
          </SubmitButton>
        </ConfirmForm>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Website</dt>
              <dd className="text-foreground">{employer.companyWebsite ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Company size</dt>
              <dd className="text-foreground">{employer.companySize ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Function interest</dt>
              <dd className="text-foreground">
                {employer.functionInterest ? FUNCTION_INTEREST_LABEL[employer.functionInterest] : 'Any'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Onboarding</dt>
              <dd className="text-foreground">{employer.onboardingCompletedAt ? 'Completed' : 'Incomplete'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Joined</dt>
              <dd className="text-foreground">{employer.createdAt.toLocaleDateString()}</dd>
            </div>
            {isSuspended && (
              <div>
                <dt className="text-muted-foreground">Suspended by</dt>
                <dd className="text-foreground">{employer.suspendedBy}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Contests ({employer.contests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {employer.contests.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {employer.contests.map((c) => (
                <li key={c.id}>
                  <Link href={`/support/admin/nen-contests/${c.id}`} className="text-primary underline underline-offset-4">
                    {c.title}
                  </Link>{' '}
                  <span className="text-muted-foreground">
                    — {c.state} · {c.createdAt.toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent resume views ({employer.resumeViews.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {employer.resumeViews.length === 0 ? (
            <p className="text-sm text-muted-foreground">None yet.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {employer.resumeViews.map((v) => (
                <li key={v.id} className="text-foreground">
                  <Link href={`/support/admin/nen-sessions/${v.sessionId}`} className="text-primary underline underline-offset-4">
                    Session {v.sessionId.slice(0, 8)}
                  </Link>{' '}
                  <span className="text-muted-foreground">
                    — {v.viewedAt.toLocaleString()}
                    {v.contestId ? ' (from a contest entry list)' : ' (from the general directory)'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
