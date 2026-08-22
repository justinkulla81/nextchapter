import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { getAuthEmail, listAllAuthUsers } from '@/lib/admin/auth-users'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { CRUCIBLE_VARIANTS } from '@/lib/crucible/variants'
import { AdminResumeDownloadButton } from './AdminResumeDownloadButton'

export const maxDuration = 30

interface AiToolsData {
  tools?: string[]
  bestMove?: string
}

export default async function AdminNenSessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const [session, authUsers] = await Promise.all([
    prisma.crucibleSession.findUnique({
      where: { id },
      include: {
        candidate: { select: { firstName: true, lastName: true, userId: true } },
        retryOf: { select: { id: true, score: true, completedAt: true } },
        retries: { select: { id: true, score: true, completedAt: true }, orderBy: { startedAt: 'asc' } },
      },
    }),
    listAllAuthUsers(),
  ])
  if (!session) notFound()

  const displayName = session.candidate
    ? [session.candidate.firstName, session.candidate.lastName].filter(Boolean).join(' ') ||
      getAuthEmail(authUsers, session.candidate.userId)
    : (session.email ?? '— (anonymous)')

  const aiTools = session.aiTools as AiToolsData | null
  const canShowResume = !!session.resumeFilePath

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <Link href="/support/admin/nen-sessions" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to sessions
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{displayName}</h1>
        <p className="mt-1 text-muted-foreground">
          {session.source} · {session.variant ? CRUCIBLE_VARIANTS[session.variant].label : 'No discipline recorded'} ·{' '}
          {session.jobIntent ?? '—'}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Result</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Score</dt>
              <dd className="text-foreground">{session.score ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Band</dt>
              <dd className="text-foreground">{session.band ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Branch</dt>
              <dd className="text-foreground">{session.branch ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">State</dt>
              <dd className="text-foreground">{session.state}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Started</dt>
              <dd className="text-foreground">{session.startedAt.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Completed</dt>
              <dd className="text-foreground">{session.completedAt ? session.completedAt.toLocaleString() : '—'}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>QA judgment (tier: {session.qaTier})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Verdict:</span> {session.verdict ?? '—'}
          </p>
          {Array.isArray(session.selectedOptionIds) && session.selectedOptionIds.length > 0 ? (
            <ul className="list-disc space-y-1 pl-5 text-foreground">
              {(session.selectedOptionIds as string[]).map((optionId) => (
                <li key={optionId}>{optionId}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">No selections recorded.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Prompt authoring (tier: {session.promptTier})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Score:</span> {session.promptScore ?? '—'}
          </p>
          {session.promptSubmission && (
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-foreground">{session.promptSubmission}</p>
          )}
          {session.promptFeedback && <p className="text-muted-foreground">{session.promptFeedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dataset analysis (tier: {session.datasetTier})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Score:</span> {session.datasetScore ?? '—'}
          </p>
          {session.datasetSubmission && (
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-foreground">{session.datasetSubmission}</p>
          )}
          {session.datasetFeedback && <p className="text-muted-foreground">{session.datasetFeedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Results judgment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Score:</span> {session.resultsScore ?? '—'}
          </p>
          {session.resultsSubmission && (
            <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-foreground">{session.resultsSubmission}</p>
          )}
          {session.resultsFeedback && <p className="text-muted-foreground">{session.resultsFeedback}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI usage</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="text-muted-foreground">Grading calls made:</span> {session.aiGradeCallCount}
          </p>
          {aiTools?.tools && aiTools.tools.length > 0 && (
            <p>
              <span className="text-muted-foreground">Tools used:</span> {aiTools.tools.join(', ')}
            </p>
          )}
          {aiTools?.bestMove && (
            <p>
              <span className="text-muted-foreground">Best move:</span> {aiTools.bestMove}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resume</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {canShowResume ? (
            <>
              <p className="text-muted-foreground">
                Share-with-employers consent: {session.resumeShareConsent ? 'Yes' : 'No'}
              </p>
              <AdminResumeDownloadButton sessionId={session.id} />
            </>
          ) : (
            <p className="text-muted-foreground">No resume uploaded.</p>
          )}
        </CardContent>
      </Card>

      {(session.retryOf || session.retries.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Retry chain</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {session.retryOf && (
              <p>
                Retry of{' '}
                <Link href={`/support/admin/nen-sessions/${session.retryOf.id}`} className="text-primary underline underline-offset-4">
                  session scoring {session.retryOf.score ?? '—'}
                </Link>
              </p>
            )}
            {session.retries.length > 0 && (
              <ul className="list-disc space-y-1 pl-5">
                {session.retries.map((r) => (
                  <li key={r.id}>
                    <Link href={`/support/admin/nen-sessions/${r.id}`} className="text-primary underline underline-offset-4">
                      Retry scoring {r.score ?? '(in progress)'}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
