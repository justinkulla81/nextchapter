import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCrucibleEmployerDashboardData } from '@/lib/crucible/employers/get-employer-dashboard-data'
import { publishCrucibleContest, closeCrucibleContest } from '../actions'
import { CandidateResumeDownloadButton } from '@/components/crucible/employers/CandidateResumeDownloadButton'
import { ShortlistToggleButton } from '@/components/crucible/employers/ShortlistToggleButton'
import { SubmitButton } from '@/components/ui/submit-button'
import { CRUCIBLE_BAND_LABEL } from '@/lib/crucible/variants'

export const metadata: Metadata = {
  title: { absolute: 'noexperienceneeded.ai — Contest' },
  robots: { index: false, follow: false },
}

const STATE_LABEL: Record<string, string> = { DRAFT: 'Draft', OPEN: 'Open', CLOSED: 'Closed' }

export default async function CrucibleContestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const employer = await getCrucibleEmployerDashboardData()

  const contest = await prisma.crucibleContest.findUnique({
    where: { id },
    include: {
      entries: {
        orderBy: [{ status: 'desc' }, { shortlisted: 'desc' }, { submittedAt: 'desc' }],
        include: {
          session: { select: { id: true, score: true, variant: true, jobIntent: true, resumeFilePath: true } },
        },
      },
    },
  })
  if (!contest || contest.employerId !== employer.id) notFound()

  const publishAction = publishCrucibleContest.bind(null, contest.id)
  const closeAction = closeCrucibleContest.bind(null, contest.id)

  return (
    <div className="space-y-8">
      <div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">{contest.title}</h1>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {STATE_LABEL[contest.state]}
            </span>
            {contest.state === 'DRAFT' && (
              <form action={publishAction}>
                <SubmitButton>Publish &amp; notify candidates</SubmitButton>
              </form>
            )}
            {contest.state === 'OPEN' && (
              <form action={closeAction}>
                <SubmitButton variant="outline">Close contest</SubmitButton>
              </form>
            )}
          </div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{contest.businessProblem}</p>
        {contest.referenceFilePath && (
          <a
            href={contest.referenceFilePath}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-medium text-primary underline underline-offset-4"
          >
            {contest.referenceFileName ?? 'Reference file'}
          </a>
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold text-foreground">
          Entries ({contest.entries.filter((e) => e.status === 'SUBMITTED').length} submitted of{' '}
          {contest.entries.length} invited)
        </h2>

        {contest.entries.length === 0 ? (
          <p className="mt-3 rounded-lg border border-border p-6 text-center text-muted-foreground">
            {contest.state === 'DRAFT'
              ? 'Publish this contest to invite qualified candidates.'
              : 'No candidates were eligible when this was published.'}
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {contest.entries.map((entry) => (
              <li key={entry.id} className="rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <span>{entry.session.score != null ? `${entry.session.score}/100` : '—'}</span>
                    <span>{entry.session.score != null ? CRUCIBLE_BAND_LABEL(entry.session.score) : ''}</span>
                    <span>{entry.session.variant ?? '—'}</span>
                    <span className="uppercase tracking-wide">{entry.status}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {entry.session.resumeFilePath && (
                      <CandidateResumeDownloadButton sessionId={entry.session.id} contestId={contest.id} />
                    )}
                    <ShortlistToggleButton entryId={entry.id} shortlisted={entry.shortlisted} />
                  </div>
                </div>
                {entry.submission ? (
                  <p className="mt-3 whitespace-pre-wrap text-sm text-foreground">{entry.submission}</p>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {entry.openedAt ? 'Opened, no submission yet.' : 'Not opened yet.'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
