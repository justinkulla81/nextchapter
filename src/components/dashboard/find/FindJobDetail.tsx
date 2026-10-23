'use client'

import { useActionState, useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Check, Minus } from 'lucide-react'
import type { ExclusiveJobPosting } from '@prisma/client'
import { SubmitButton } from '@/components/ui/submit-button'
import { Button } from '@/components/ui/button'
import { Avatar, Section } from '@/components/candidate/ui'
import { ActionLink } from '@/components/candidate/ActionLink'
import { ShowMore } from '@/components/candidate/ShowMore'
import { promoteJobBoardListing, recordJobClick } from '@/app/dashboard/find-my-job/actions'
import { undoDismissBoardJob, type DismissResult } from '@/app/dashboard/find-my-job/dismiss-actions'
import { posthog } from '@/lib/posthog/client'
import { cn } from '@/lib/utils'
import { edgeTip, postedAgo, type CompetitionScore } from '@/lib/jobs/competition'
import { cardMetaParts, isStillListed } from '@/lib/jobs/job-card'
import { fitFactors, type JobListItem, type NextStep } from '@/lib/jobs/find-list'
import { postingOpenHref } from '@/lib/jobs/posting-open-href'
import { aggregatorKind } from '@/lib/jobs/liveness'
import { nativePosterOf } from '@/lib/jobs/native-apply'
import { classifyWorkType, compensationKind, payBasisLabel, payComparison, payPeriodOf } from '@/lib/jobs/work-type'
import { benefitsBadgeFor, payBadgeFor, type EmployerSignals } from '@/lib/jobs/great-employer-display'
import { benefitsHighlights, type JobBenefits } from '@/lib/jobs/benefits'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import type { JobContacts } from '@/lib/jobs/job-contacts'
import type { JobSkillGap } from '@/lib/jobs/job-skill-gap'
import type { JobMatch } from '@/lib/jobs/job-match-types'
import type { SkillsFit } from '@/lib/careers/skills-fit'
import type { OccupationExposure } from '@/lib/skills/ai-exposure'
import type { JobAiView } from '@/lib/jobs/job-ai-view'
import { NoExperienceLine } from '@/components/jobs/NoExperienceLine'
import { TrainingProvidedLine } from '@/components/jobs/TrainingProvidedLine'
import { JobAiExposure } from '@/components/dashboard/find/JobAiExposure'
import type { CardTrackState } from '@/lib/jobs/my-jobs-data'
import type { MatchReason } from '@/lib/jobs/search-breadth'
import type { Bridge } from '@/lib/jobs/relevance'
import type { PayVsMarket } from '@/lib/pay/market-pay'
import { PayVsMarketBadge } from '@/components/companies/CompanyOpeningsList'
import { RepostNote } from '@/components/jobs/RepostNote'
import { ReportClosedButton } from '@/components/jobs/ReportClosedButton'
import { NativeApply } from '@/components/jobs/NativeApply'
import { ApplyKit } from '@/components/jobs/ApplyKit'
import { CandidatePlusExtraLine } from '@/components/jobs/CandidatePlusExtraLine'
import { WhoToContactPanel } from '@/components/dashboard/WhoToContactPanel'
import { SentItPrompt } from '@/components/dashboard/SentItPrompt'
import { JobMatchDetails } from '@/components/dashboard/JobMatchPanel'
import { JobRequirementDetails } from '@/components/dashboard/JobRequirementLabels'
import { JobTrackControls } from '@/components/dashboard/one-board/JobTrackControls'
import { DismissJobButton } from '@/components/dashboard/DismissJobButton'
import { useFindPane } from '@/components/dashboard/find/FindTwoPane'
import {
  BridgeDetails,
  CoverNote,
  COMPETITION_LABEL,
  EmployerSignalsLine,
  MarketPayLine,
  RequestIntroButton,
  SkillGapLine,
  SkillsFitLine,
  POSTING_TYPE_LABEL,
  attributionOf,
} from '@/components/dashboard/DiscoverJobCard'

// The open job in Find a job (mockup: JobDetail in _mockups/jobs-find.tsx). One headline, one primary action
// (apply), three sections on the first view (why it fits, what to do next, the role) and everything the old
// card carried behind "More about this job". The server builds one of these per listed job; the list only
// picks which to show.

function Factor({ state, label, note }: { state: 'match' | 'gap'; label: string; note: string }) {
  const Icon = state === 'match' ? Check : Minus
  return (
    <li className="flex gap-2.5 text-base">
      <Icon className={cn('mt-1 size-4 shrink-0', state === 'match' ? 'text-success' : 'text-muted-foreground')} aria-hidden />
      <span>
        <span className="font-semibold text-ink">{label}.</span> {note}
      </span>
    </li>
  )
}

export interface FindJobDetailProps {
  /** On the job's own page (not beside the list): shows the whole listing and no link back to itself. */
  standalone?: boolean
  posting: ExclusiveJobPosting
  /** The list row for this job: the same verdict and reason the member just read. */
  item: JobListItem
  fitBucket: FitBucket
  nextStep: NextStep | null
  candidatePlus?: boolean
  bridge?: Bridge
  matchReason?: MatchReason
  searchResult?: { rank: number; q: string; loc: string }
  employer?: EmployerSignals
  benefits?: { benefits: JobBenefits | null; strong: boolean }
  competition?: CompetitionScore
  contacts?: JobContacts
  skillGap?: JobSkillGap
  skillsFit?: SkillsFit
  match?: JobMatch
  explainGapsEnabled?: boolean
  insiders?: { count: number; href: string }
  track?: CardTrackState
  watched?: boolean
  /** AI exposure of the occupation this job is placed in (Anthropic Economic Index); null when not placed or not measured. */
  exposure?: OccupationExposure | null
  /** The posting asks for AI skills, and what they pay when the live comparison says more. */
  ai?: JobAiView | null
}

export function FindJobDetail({
  standalone = false,
  posting,
  item,
  fitBucket,
  nextStep,
  competition,
  contacts,
  skillGap,
  skillsFit,
  match,
  explainGapsEnabled,
  insiders,
  track,
  watched,
  employer,
  benefits,
  searchResult,
  matchReason,
  bridge,
  candidatePlus = false,
  exposure = null,
  ai = null,
}: FindJobDetailProps) {
  const [state, formAction, pending] = useActionState(promoteJobBoardListing.bind(null, posting.id), undefined)
  const { passed, setPassed } = useFindPane()
  const [dismissed, setDismissed] = useState<DismissResult | null>(null)
  const [undoing, startUndo] = useTransition()
  const confidential = posting.disclosure === 'CONFIDENTIAL'
  const workType = classifyWorkType(posting)
  const payLabel = payBasisLabel({ ...posting, workType })
  const comparePay = payComparison(workType, compensationKind(posting), payPeriodOf(posting)).compare
  const payBadge = payBadgeFor({ jobVerdictShown: comparePay && !!posting.payVsMarket, signals: employer })
  const benefitsBadge = benefitsBadgeFor({ strongBenefits: !!benefits?.strong, signals: employer })
  const highlights = benefitsHighlights(benefits?.benefits)
  const remote = /\bremote\b/i.test(posting.location ?? '') || (posting.targetRemotePolicy ?? '').toLowerCase() === 'remote'
  const meta = cardMetaParts({ posted: postedAgo(posting), location: posting.location, remote, pay: payLabel, workType, title: posting.title, verifiedAt: posting.lastVerifiedAt, stillListed: isStillListed(posting) })
  const kind = attributionOf(posting) ?? (posting.postingType ? POSTING_TYPE_LABEL[posting.postingType] : null)
  const factors = fitFactors(match)
  const native = !!nativePosterOf(posting)

  // The events the open card used to send when it was expanded: the member now reads these on opening the job.
  useEffect(() => {
    if (matchReason) posthog.capture('job_match_reason_viewed', { jobId: posting.id, reason: matchReason.kind, label: matchReason.label, verdict: item.verdict })
    if (payBadge || benefitsBadge) posthog.capture('job_employer_badges_viewed', { postingId: posting.id, companyName: posting.companyName, payBadge, benefitsBadge, fitBucket })
    if (posting.marketPayMid) {
      posthog.capture('job_market_pay_viewed', { postingId: posting.id, payVsMarket: posting.payVsMarket ?? 'not_posted', marketPayMid: posting.marketPayMid, basis: posting.marketPayBasis, fitBucket })
    }
    // Once per opened job: the pane is remounted for each one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleApplyClick() {
    if (searchResult) posthog.capture('job_search_result_clicked', { jobId: posting.id, rank: searchResult.rank, q: searchResult.q, loc: searchResult.loc })
    if (matchReason?.kind === 'skills') posthog.capture('skills_adjacent_job_clicked', { jobId: posting.id, sharedSkills: matchReason.sharedSkills ?? [], label: matchReason.label })
    void recordJobClick({
      source: 'job_board',
      sourceId: posting.id,
      jobTitle: posting.title,
      companyName: posting.companyName,
      location: posting.location,
      url: posting.url,
      fitBucket,
      workType,
    })
  }

  if (dismissed || passed.has(posting.id)) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-white p-7 text-base text-ink" role="status">
        <span>
          Passed on {posting.title}
          {dismissed && dismissed.applied.length > 0 && `. We ${dismissed.applied.map((a) => `hid ${a.label}`).join(' and ')}`}.
        </span>
        <button
          type="button"
          disabled={undoing}
          aria-busy={undoing}
          onClick={() =>
            startUndo(async () => {
              const r = await undoDismissBoardJob(posting.id).catch(() => null)
              if (r?.ok) {
                posthog.capture('dismiss_undone', { jobId: posting.id, scope: 'job', source: 'find_pane' })
                setDismissed(null)
                setPassed(posting.id, false)
              }
            })
          }
          className={cn('text-sm font-medium text-brand underline underline-offset-4', undoing && 'cursor-wait')}
        >
          {undoing ? 'Undoing…' : 'Undo'}
        </button>
      </div>
    )
  }

  const applyHref = posting.source === 'ats_feed' ? postingOpenHref(posting.id) : posting.url

  return (
    <article className="space-y-7 rounded-2xl border border-border bg-white p-5 sm:p-7" aria-label={`${posting.title} at ${item.company}`}>
      <header className="space-y-4">
        <div className="flex items-start gap-4">
          <Avatar name={item.company} size="lg" />
          <div className="min-w-0 space-y-1">
            <h2 className="font-display text-2xl leading-tight font-semibold text-ink">{posting.title}</h2>
            <p className="text-base text-ink">
              {!confidential ? (
                <Link href={`/dashboard/companies/${encodeURIComponent(normalizeOrgName(posting.companyName))}`} className="underline underline-offset-4">
                  {item.company}
                </Link>
              ) : (
                item.company
              )}
              {posting.location ? ` · ${posting.location}` : ''}
            </p>
            <p className="text-sm text-muted-foreground">{[kind, ...meta.filter((m) => m !== posting.location)].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          {native ? (
            <NativeApply postingId={posting.id} />
          ) : confidential ? (
            candidatePlus ? <RequestIntroButton postingId={posting.id} /> : <CandidatePlusExtraLine extra="request_intro" jobId={posting.id} surface="find_pane" />
          ) : (
            <ActionLink href={applyHref} external kind="dark" event="job_apply_opened" props={{ jobId: posting.id, source: 'find_pane', fitBucket, verdict: item.verdict }} onClick={handleApplyClick}>
              Apply
            </ActionLink>
          )}
          {!confidential && (
            <JobTrackControls
              jobRef={{ source: 'job_board', sourceId: posting.id, title: posting.title, companyName: posting.companyName, url: posting.url, workType }}
              initial={track}
              watched={watched}
              companyId={posting.companyId}
            />
          )}
          <DismissJobButton
            label="Not for me"
            jobId={posting.id}
            title={posting.title}
            companyName={confidential ? null : posting.companyName}
            onDismissed={(r) => {
              setDismissed(r)
              setPassed(posting.id, true)
            }}
          />
        </div>
        {!native && !confidential && <p className="text-xs text-muted-foreground">Apply opens the employer&apos;s posting in a new tab.</p>}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      </header>

      <NoExperienceLine jobId={posting.id} signals={posting.postingSignals} phrase={posting.noExperiencePhrase} surface="find_pane" />
      <TrainingProvidedLine jobId={posting.id} signals={posting.postingSignals} phrase={posting.trainingPhrase} surface="find_pane" />
      <JobAiExposure jobId={posting.id} exposure={exposure} ai={ai} />

      <Section id={`fit-${posting.id}`} title="Why this fits you">
        <p className="text-lg text-ink">
          {item.verdictLabel && <span className={cn('font-semibold', item.verdict === 'worth_a_look' ? 'text-ink' : 'text-success')}>{item.verdictLabel}.</span>} {item.reason}
        </p>
        {factors.length > 0 && (
          <ul className="space-y-2">
            {factors.map((f) => (
              <Factor key={`${f.label}:${f.note}`} {...f} />
            ))}
          </ul>
        )}
        {match && match.requirements.length > 0 && <JobRequirementDetails jobId={posting.id} checks={match.requirements} surface="find_pane" />}
        {bridge && <BridgeDetails jobId={posting.id} bridge={bridge} />}
      </Section>

      {nextStep && (
        <Section id={`next-${posting.id}`} title="What to do next">
          <p className="text-base font-semibold text-ink">{nextStep.text}</p>
          <p className="text-sm text-muted-foreground">{nextStep.because}</p>
        </Section>
      )}

      {(posting.marketPayLow || payLabel || (standalone && posting.description && !confidential)) && (
        <Section id={`role-${posting.id}`} title={standalone ? 'From the listing' : 'About the role'}>
          {payLabel && !posting.marketPayLow && <p className="text-base text-ink">{payLabel}</p>}
          <MarketPayLine posting={posting} workType={workType} />
          {standalone && posting.description && !confidential && <p className="text-sm whitespace-pre-line text-muted-foreground">{posting.description}</p>}
        </Section>
      )}

      <ShowMore event="job_detail_more_opened" properties={{ jobId: posting.id, source: 'find_pane' }} label="More about this job">
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {[kind, posting.location, payLabel].filter(Boolean).join(' · ')}
            {comparePay && posting.payVsMarket && (
              <>
                {' '}
                <PayVsMarketBadge verdict={posting.payVsMarket as PayVsMarket} marketLow={posting.marketPayLow} marketHigh={posting.marketPayHigh} />
              </>
            )}
          </p>
          {!standalone && posting.description && !confidential && <p className="line-clamp-6 text-sm text-muted-foreground">{posting.description}</p>}
          <RepostNote posting={posting} />
          {!confidential && (
            <EmployerSignalsLine postingId={posting.id} companyName={posting.companyName} employer={employer} highlights={highlights} payBadge={payBadge} benefitsBadge={benefitsBadge} />
          )}
          {competition && (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Applicants, our estimate: {COMPETITION_LABEL[competition.level]}</span>
              {competition.reasons.length > 0 && ` — ${competition.reasons.join(' · ')}`}. Not an applicant count.
            </p>
          )}
          {skillsFit && <SkillsFitLine fit={skillsFit} />}
          {!match && skillGap && skillGap.basis !== 'none' && skillGap.requested.length > 0 && <SkillGapLine gap={skillGap} />}
          {match && <JobMatchDetails jobId={posting.id} match={match} explainEnabled={explainGapsEnabled} candidatePlus={candidatePlus} insiders={confidential ? undefined : insiders} />}
          {candidatePlus || !confidential ? (
            <div data-who-to-contact={posting.id}>
              <WhoToContactPanel postingId={posting.id} confidential={confidential} contacts={contacts} />
              <SentItPrompt context={{ source: 'who_to_contact', subjectKey: `job:${posting.id}`, jobId: posting.id }} reaskOnMount />
            </div>
          ) : (
            <CandidatePlusExtraLine extra="request_intro" jobId={posting.id} surface="find_pane" />
          )}
          <ApplyKit postingId={posting.id} surface="find_pane" />
          <p className="text-sm text-ink">{edgeTip(posting)}</p>
          <div className="flex flex-wrap items-center gap-2">
            {!confidential && (
              <Button
                nativeButton={false}
                render={<a href={applyHref} target="_blank" rel="noopener noreferrer" onClick={handleApplyClick} />}
                variant="outline"
                size="sm"
              >
                View posting
              </Button>
            )}
            {!standalone && (
              <Link href={`/dashboard/jobs/${posting.id}?src=board`} className="text-sm font-medium text-brand underline underline-offset-4">
                Open this job&apos;s own page
              </Link>
            )}
            {!confidential && posting.source === 'ats_feed' && aggregatorKind(posting.url) && <ReportClosedButton jobId={posting.id} />}
            {state?.jobPostingId ? (
              <p className="text-sm text-success">Added to My Applications, with a full fit analysis below.</p>
            ) : (
              <form action={formAction}>
                <SubmitButton variant="outline" size="sm" pendingLabel="Analyzing…" className={pending ? 'cursor-progress' : ''}>
                  See full fit &amp; tailor your approach
                </SubmitButton>
              </form>
            )}
          </div>
          <CoverNote postingId={posting.id} />
        </div>
      </ShowMore>
    </article>
  )
}
