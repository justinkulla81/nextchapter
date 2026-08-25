import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { generateHiringManagerReport } from '@/lib/reports/hiring-manager-report'
import { getDossierSections } from '@/lib/reports/dossier-sections'
import { computeDossierCompleteness } from '@/lib/scoring/dossier-unlock'
import { DossierSectionsView } from '@/components/dashboard/DossierSections'
import { SubmitButton } from '@/components/ui/submit-button'
import { captureServerEvent } from '@/lib/posthog/server'
import { isCandidateConsentedForRecruiter, recordIntroductionEvent } from '@/lib/recruiter/introductions'
import { SubmissionPacketPanel } from '@/components/recruiter/SubmissionPacketPanel'
import { RecruiterSubmissionPanel } from '@/components/recruiter/RecruiterSubmissionPanel'
import { requestPortfolioAccess, startConversationWithCandidate, getPoolCandidateResumeSignedUrl } from './actions'

export const maxDuration = 30

// Module-level helper, not called inline inside the component body — Date.now()
// is an impure call the react-hooks/purity rule flags wherever a component
// function reads it directly (see action-counts/page.tsx's rangeToDate for
// the same pattern).
function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000))
}

export default async function RecruiterCandidateBriefPage({
  params,
}: {
  params: Promise<{ candidateId: string }>
}) {
  const { candidateId } = await params

  const supabase = await createClient('recruiter')
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/recruiters/login')

  const recruiter = await prisma.recruiter.findUnique({
    where: { userId: user.id },
    include: { recruiterFirm: { select: { exportDestinationsEnabled: true } } },
  })
  if (!recruiter) redirect('/recruiters/signup')

  const candidate = await prisma.candidateProfile.findUnique({
    where: { id: candidateId },
    select: { id: true, privacyTier: true },
  })
  const consented = candidate ? await isCandidateConsentedForRecruiter(candidate.id, recruiter.id) : false
  if (!candidate || !consented || candidate.privacyTier === 'LOCKED' || candidate.privacyTier === 'STEALTH') {
    notFound()
  }

  const [brief, dossier, resume, resumeSignedUrl, portfolioAccess, completeness, submissions] = await Promise.all([
    generateHiringManagerReport(candidateId),
    getDossierSections(candidateId),
    prisma.resume.findFirst({ where: { candidateId }, orderBy: { uploadedAt: 'desc' }, select: { fileName: true } }),
    getPoolCandidateResumeSignedUrl(candidateId),
    prisma.portfolioAccessRequest.findUnique({
      where: { candidateId_recruiterId: { candidateId, recruiterId: recruiter.id } },
    }),
    computeDossierCompleteness(candidateId),
    prisma.recruiterCandidateSubmission.findMany({
      where: { recruiterId: recruiter.id, candidateId },
      orderBy: { createdAt: 'desc' },
      include: { placement: true },
    }),
  ])
  captureServerEvent(recruiter.id, 'recruiter_candidate_brief_viewed', { candidateId })
  await recordIntroductionEvent(recruiter.id, candidateId, 'DOSSIER_VIEWED', `recruiter:${recruiter.id}`)

  // Work Samples/Narrative are gated on an APPROVED request — only pull
  // them from the DB when they'll actually be rendered below, instead of
  // fetching on every page load regardless of access.
  const [workSamples, narratives] =
    portfolioAccess?.status === 'APPROVED'
      ? await Promise.all([
          prisma.workSample.findMany({ where: { candidateId }, orderBy: { createdAt: 'desc' } }),
          prisma.candidateNarrative.findMany({ where: { candidateId }, orderBy: { generatedAt: 'asc' }, take: 1 }),
        ])
      : [[], []]

  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <Link href="/recruiters/search" className="text-sm text-muted-foreground underline underline-offset-4">
        ← Back to search
      </Link>

      <div className="mt-4 mb-8 space-y-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Candidate Brief</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {brief.candidateName}
            {completeness.isComplete && (
              <span
                className="ml-2 inline-flex items-center rounded-full bg-brand px-2 py-0.5 align-middle text-xs font-medium text-brand-foreground"
                title="Every Dossier requirement is complete — references, assessments, and active search evidence."
              >
                Dossier Complete
              </span>
            )}
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={startConversationWithCandidate.bind(null, candidateId)}>
            <SubmitButton size="sm">Message this candidate</SubmitButton>
          </form>
          {resumeSignedUrl && (
            <a
              href={resumeSignedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-foreground"
            >
              {resume ? `View resume — ${resume.fileName}` : 'View resume'}
            </a>
          )}
        </div>
      </div>

      <div className="space-y-5">
        {brief.profileConsistencyAlert && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-4">
            <p className="text-sm font-medium text-foreground">{brief.profileConsistencyAlert.label}</p>
            <p className="mt-1 text-sm text-muted-foreground">{brief.profileConsistencyAlert.message}</p>
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">{brief.redFlags.label}</p>
          <ul className="mt-2 space-y-1">
            {brief.redFlags.summary.map((line, i) => (
              <li key={i} className="text-sm text-foreground">
                {line}
              </li>
            ))}
          </ul>
          {brief.redFlags.interviewAuditFocusAreas.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted-foreground">Interview audit focus areas</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {brief.redFlags.interviewAuditFocusAreas.map((area) => (
                  <span key={area} className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">
                    {area}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {brief.verified.length > 0 && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Verified</p>
            <ul className="mt-2 space-y-1.5">
              {brief.verified.map((item) => (
                <li key={item.label} className="text-sm text-foreground">
                  {item.label}
                  {item.confirmedCount > 0 && (
                    <span className="text-muted-foreground"> — confirmed by {item.confirmedCount}</span>
                  )}
                  {item.correction && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      One correction: a reference notes &ldquo;{item.correction}&rdquo;
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.performance.completedReferenceCount > 0 && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Performance</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Rated by people who worked with them, on a scale where &ldquo;Solid&rdquo; means they did the job
              well and &ldquo;Exceptional&rdquo; is reserved for the best people someone has worked with.
            </p>
            {brief.performance.confidenceTier === 'PROVISIONAL' ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Only {brief.performance.completedReferenceCount} response
                {brief.performance.completedReferenceCount === 1 ? '' : 's'} so far — not enough yet to show
                performance averages.
              </p>
            ) : (
              <div className="mt-3 space-y-1.5">
                {brief.performance.dimensions.map((d) => (
                  <div key={d.dimension} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{d.dimension}</span>
                    <span className="text-muted-foreground">
                      {d.label ? `${d.label} · ${d.n} response${d.n === 1 ? '' : 's'}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {brief.comparative.responseCount > 0 && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Comparative standing</p>
            <ul className="mt-2 space-y-1 text-sm text-foreground">
              {brief.comparative.managerCount > 0 && (
                <li>
                  {brief.comparative.managerWouldHireAgainDefinitely} of {brief.comparative.managerCount} former
                  manager{brief.comparative.managerCount === 1 ? '' : 's'} would definitely hire them again
                </li>
              )}
              {brief.comparative.rankAnsweredCount > 0 && (
                <li>
                  Ranked in the top 10% by {brief.comparative.topTierRankCount} of{' '}
                  {brief.comparative.rankAnsweredCount} who answered
                </li>
              )}
              {brief.comparative.foughtToKeepCount > 0 && <li>A former manager fought to keep them when they left</li>}
              {brief.comparative.takeAgainAnsweredCount > 0 && (
                <li>
                  {brief.comparative.wouldTakeAgainCount} of {brief.comparative.takeAgainAnsweredCount} would take
                  them if starting something new
                </li>
              )}
              {brief.comparative.scopeAnsweredCount > 0 && (
                <li>
                  {brief.comparative.meaningfullyMoreScopeCount} of {brief.comparative.scopeAnsweredCount} would
                  trust them with meaningfully more scope than they&apos;ve had
                </li>
              )}
            </ul>
          </div>
        )}

        {(brief.attributedQuotes.length > 0 || brief.unattributedCommentCount > 0) && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">In their words</p>
            <div className="mt-3 space-y-3">
              {brief.attributedQuotes.map((q, i) => (
                <blockquote key={i} className="border-l-2 border-border pl-3 text-sm text-foreground italic">
                  &ldquo;{q.text}&rdquo;
                  <footer className="mt-1 text-xs font-normal text-muted-foreground not-italic">
                    — {q.refereeName}
                    {q.refereeTitle ? `, ${q.refereeTitle}` : ''}
                  </footer>
                </blockquote>
              ))}
              {brief.unattributedCommentCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {brief.unattributedCommentCount} additional reference
                  {brief.unattributedCommentCount === 1 ? '' : 's'} provided written comments without releasing
                  attribution.
                </p>
              )}
            </div>
          </div>
        )}

        {brief.frictionExamples.length > 0 && (
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm font-medium text-muted-foreground">Self vs. reference friction examples</p>
            <div className="mt-3 space-y-4">
              {brief.frictionExamples.map((ex) => (
                <div key={ex.dimension}>
                  <p className="text-sm font-medium text-foreground">{ex.dimensionLabel}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">Self-described:</span> {ex.candidateDescription}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">References described:</span>{' '}
                    {ex.referenceDescription}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-muted-foreground">Self-awareness</p>
          <p className="mt-1 text-sm text-foreground">
            {brief.selfAwarenessLabel
              ? `${brief.selfAwarenessLabel} — how closely this candidate's self-report matches how references described them.`
              : 'Not enough reference data yet to assess.'}
          </p>
        </div>
      </div>

      <div className="mt-10 space-y-5">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Executive Dossier
        </h2>
        <DossierSectionsView dossier={dossier} readOnly hideGradeSignals />
      </div>

      <div className="mt-10 space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Portfolio</h2>
        {portfolioAccess?.status === 'APPROVED' ? (
          <div className="space-y-4">
            {narratives[0] && (
              <div className="rounded-lg border border-border p-4">
                <p className="text-sm font-medium text-foreground">{narratives[0].label}</p>
                <p className="mt-1 text-sm text-muted-foreground">{narratives[0].coreStatement}</p>
              </div>
            )}
            {workSamples.length === 0 ? (
              <p className="text-sm text-muted-foreground">No work samples uploaded yet.</p>
            ) : (
              workSamples.map((sample) => (
                <div key={sample.id} className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium text-foreground">{sample.title}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{sample.description}</p>
                  {(sample.fileUrl || sample.externalUrl) && (
                    <a
                      href={sample.fileUrl ?? sample.externalUrl ?? undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-sm underline underline-offset-4"
                    >
                      View sample →
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        ) : portfolioAccess?.status === 'REQUESTED' ? (
          <p className="text-sm text-muted-foreground">
            Portfolio access requested — you&apos;ll be able to view it here once the candidate approves.
          </p>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-4">
            <p className="text-sm text-muted-foreground">
              This candidate&apos;s work samples and narrative are one step more personal than the Dossier
              and resume above — ask them for access.
            </p>
            <form action={requestPortfolioAccess.bind(null, candidateId)} className="mt-3">
              <SubmitButton size="sm" variant="outline">
                Ask to see portfolio
              </SubmitButton>
            </form>
          </div>
        )}
      </div>

      <div className="mt-10 space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Submission packet &amp; export
        </h2>
        <SubmissionPacketPanel
          candidateId={candidateId}
          enabledDestinations={recruiter.recruiterFirm?.exportDestinationsEnabled ?? []}
        />
      </div>

      <div className="mt-10 space-y-3">
        <h2 className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Feedback loop &amp; placement
        </h2>
        <RecruiterSubmissionPanel
          candidateId={candidateId}
          submissions={submissions.map((s) => ({ ...s, daysSinceUpdate: daysSince(s.stageUpdatedAt) }))}
        />
      </div>
    </div>
  )
}
