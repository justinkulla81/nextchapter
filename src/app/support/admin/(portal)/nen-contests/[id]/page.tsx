import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ConfirmForm } from '@/components/admin/ConfirmForm'
import { SubmitButton } from '@/components/ui/submit-button'
import { forceCloseContest } from './actions'

export const maxDuration = 30

const FUNCTION_INTEREST_LABEL: Record<string, string> = {
  TECH: 'Tech / Engineering',
  MARKETING: 'Marketing',
  DATA: 'Data / Analytics',
  DESIGN: 'Design',
  BUSINESS: 'Business / Operations',
  GENERALIST: 'Generalist',
}

export default async function AdminNenContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const contest = await prisma.crucibleContest.findUnique({
    where: { id },
    include: {
      employer: { select: { id: true, companyName: true } },
      entries: {
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          sessionId: true,
          status: true,
          submittedAt: true,
          openedAt: true,
          emailSentAt: true,
          shortlisted: true,
          session: { select: { score: true, jobIntent: true } },
        },
      },
    },
  })
  if (!contest) notFound()

  const isClosed = contest.state === 'CLOSED'

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <Link href="/support/admin/nen-contests" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to NEN contests
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{contest.title}</h1>
        <p className="mt-1 text-muted-foreground">
          Posted by{' '}
          <Link href={`/support/admin/nen-employers/${contest.employer.id}`} className="text-primary underline underline-offset-4">
            {contest.employer.companyName}
          </Link>{' '}
          · {contest.state}
        </p>
        {!isClosed && (
          <ConfirmForm
            action={forceCloseContest.bind(null, contest.id)}
            confirmMessage="Force-close this contest? Candidates will no longer be able to submit entries — this cannot be reopened."
            className="mt-3"
          >
            <SubmitButton size="sm" variant="destructive">
              Force-close contest
            </SubmitButton>
          </ConfirmForm>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contest details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="whitespace-pre-wrap text-foreground">{contest.businessProblem}</p>
          <dl className="grid grid-cols-2 gap-2">
            <div>
              <dt className="text-muted-foreground">Target function</dt>
              <dd className="text-foreground">
                {contest.targetFunction ? FUNCTION_INTEREST_LABEL[contest.targetFunction] : 'Any (open to all)'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Created</dt>
              <dd className="text-foreground">{contest.createdAt.toLocaleDateString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Published</dt>
              <dd className="text-foreground">{contest.publishedAt ? contest.publishedAt.toLocaleDateString() : '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Closed</dt>
              <dd className="text-foreground">{contest.closedAt ? contest.closedAt.toLocaleDateString() : '—'}</dd>
            </div>
          </dl>
          {contest.referenceFilePath && (
            <p className="text-muted-foreground">Reference file: {contest.referenceFileName ?? contest.referenceFilePath}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entries ({contest.entries.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {contest.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="px-3 py-2 font-medium">Candidate</th>
                    <th className="px-3 py-2 font-medium">Score</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Shortlisted</th>
                    <th className="px-3 py-2 font-medium">Invited</th>
                    <th className="px-3 py-2 font-medium">Opened</th>
                    <th className="px-3 py-2 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {contest.entries.map((e) => (
                    <tr key={e.id} className="border-b border-border last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/support/admin/nen-sessions/${e.sessionId}`} className="text-primary underline underline-offset-4">
                          {e.sessionId.slice(0, 8)}
                        </Link>
                      </td>
                      <td className="px-3 py-2 tabular-nums">{e.session.score ?? '—'}</td>
                      <td className="px-3 py-2">{e.status}</td>
                      <td className="px-3 py-2">{e.shortlisted ? 'Yes' : 'No'}</td>
                      <td className="px-3 py-2 tabular-nums">{e.emailSentAt ? 'Sent' : '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{e.openedAt ? e.openedAt.toLocaleDateString() : '—'}</td>
                      <td className="px-3 py-2 tabular-nums">{e.submittedAt ? e.submittedAt.toLocaleDateString() : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
