'use client'

import { useActionState, useState, useTransition } from 'react'
import { ChevronDown } from 'lucide-react'
import type { ExclusiveJobPosting } from '@prisma/client'
import { Button } from '@/components/ui/button'
import { SubmitButton } from '@/components/ui/submit-button'
import { promoteJobBoardListing, requestJobBoardIntro, recordJobClick, draftJobCoverNote } from '@/app/dashboard/find-my-job/actions'
import { SKILLS_FIT_LABEL, type SkillsFit } from '@/lib/careers/skills-fit'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import { cn } from '@/lib/utils'
import { edgeTip, fewerApplicantsHint, postedAgo, type CompetitionScore } from '@/lib/jobs/competition'
import { cardMetaParts, cardVerdict, isStillListed } from '@/lib/jobs/job-card'
import { postingOpenHref } from '@/lib/jobs/posting-open-href'
import { aggregatorKind } from '@/lib/jobs/liveness'
import { ReportClosedButton } from '@/components/jobs/ReportClosedButton'
import { JobMetaLine, JobVerdict, JobWhyLine } from '@/components/jobs/JobCardParts'
import type { JobContacts } from '@/lib/jobs/job-contacts'
import type { JobSkillGap } from '@/lib/jobs/job-skill-gap'
import { posthog } from '@/lib/posthog/client'
import { PostingSignalTag } from '@/components/jobs/PostingSignalTag'
import { postingSignalTag, tagTakesHintSlot } from '@/lib/jobs/posting-signals'
import { RepostNote } from '@/components/jobs/RepostNote'
import { WhoToContactPanel } from '@/components/dashboard/WhoToContactPanel'
import { ApplyKit } from '@/components/jobs/ApplyKit'
import { SentItPrompt } from '@/components/dashboard/SentItPrompt'
import { CandidatePlusExtraLine } from '@/components/jobs/CandidatePlusExtraLine'
import { NativeApply } from '@/components/jobs/NativeApply'
import { nativePosterOf } from '@/lib/jobs/native-apply'
import { PayVsMarketBadge } from '@/components/companies/CompanyOpeningsList'
import { formatUsdK, marketBasisLabel, type PayVsMarket } from '@/lib/pay/market-pay'
import type { JobMatch } from '@/lib/jobs/job-match-types'
import { JobMatchBreakdown, JobMatchDetails } from '@/components/dashboard/JobMatchPanel'
import { JobRequirementLabels } from '@/components/dashboard/JobRequirementLabels'
import { classifyWorkType, compensationKind, hourlyMarketRange, payBasisLabel, payComparison, payPeriodOf, type JobWorkType } from '@/lib/jobs/work-type'
import type { CardTrackState } from '@/lib/jobs/my-jobs-data'
import { JobTrackControls } from '@/components/dashboard/one-board/JobTrackControls'
import {
  benefitsBadgeFor,
  payBadgeFor,
  type BenefitsBadge,
  type EmployerSignals,
  type PayBadge,
} from '@/lib/jobs/great-employer-display'
import { benefitsHighlights, type JobBenefits } from '@/lib/jobs/benefits'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { matchReasonSentence, type MatchReason } from '@/lib/jobs/search-breadth'
import type { Bridge } from '@/lib/jobs/relevance'
import type { WhyThisJob } from '@/lib/personalization/why-this-job'
import { TrackedLink } from '@/components/dashboard/TrackedLink'
import { DismissJobButton } from '@/components/dashboard/DismissJobButton'
import { undoDismissBoardJob, type DismissResult } from '@/app/dashboard/find-my-job/dismiss-actions'

export const POSTING_TYPE_LABEL: Record<string, string> = {
  direct: 'Direct Employer',
  recruiter_search: 'Recruiter-Led Search',
}

// Jobs found through an aggregator (Himalayas, The Muse, Remote OK…) carry
// a "Listed on X" badge from the import; their terms ask us to name them,
// and "View posting" links to their listing.
export function attributionOf(posting: Pick<ExclusiveJobPosting, 'badges'>): string | null {
  return posting.badges.find((b) => b.startsWith('Listed on ')) ?? null
}

// The open card's honest read of the rules estimate (competition.ts) — never an applicant count.
export const COMPETITION_LABEL = { low: 'likely fewer applicants', medium: 'a typical number of applicants', high: 'likely many applicants' } as const

// Why the card shows its pay / benefits badges, in the open card: the posting's
// own benefits, the employer's posted pay, and the curated list's sources.
export function EmployerSignalsLine({
  postingId,
  companyName,
  employer,
  highlights,
  payBadge,
  benefitsBadge,
}: {
  postingId: string
  companyName: string
  employer?: EmployerSignals
  highlights: string[]
  payBadge: PayBadge
  benefitsBadge: BenefitsBadge
}) {
  const top = employer?.topEmployer ?? null
  if (!employer?.payHigh && !top && highlights.length === 0) return null
  const href = `/dashboard/companies/${encodeURIComponent(normalizeOrgName(companyName))}`
  return (
    <div className="space-y-0.5 text-sm">
      {highlights.length > 0 && (
        <p className="text-foreground">
          <span className="font-medium">Benefits listed:</span> {highlights.join(' · ')}
        </p>
      )}
      {employer?.payHigh && (
        <p className="text-foreground">
          <span className="font-medium">Employer pay:</span> posted pay across its jobs runs above market for the role.
        </p>
      )}
      {top && (
        <p className="text-foreground">
          <span className="font-medium">Known for:</span> {top.knownFor}
          <span className="text-muted-foreground"> — {top.sources} </span>
          <a
            href={href}
            className="text-primary underline underline-offset-4"
            onClick={() =>
              posthog.capture('job_employer_signal_clicked', { postingId, companyName, payBadge, benefitsBadge, knownFor: top.knownFor })
            }
          >
            See the company
          </a>
        </p>
      )}
    </div>
  )
}

// Market pay for the role (function x seniority x state, from posted salaries). When
// the job posts pay it is compared; when it doesn't, the market range is shown and
// labelled as our estimate — never as the employer's pay.
export function MarketPayLine({ posting, workType }: { posting: ExclusiveJobPosting; workType: JobWorkType }) {
  if (!posting.marketPayLow || !posting.marketPayHigh) return null
  // Benchmarks are full-time salaries: contract, part-time, advisory and unpaid
  // roles aren't compared with them; hourly full-time pay is compared hourly.
  const comparison = payComparison(workType, compensationKind(posting), payPeriodOf(posting))
  if (!comparison.compare) return <p className="text-xs text-muted-foreground">{comparison.reason}.</p>
  const range =
    comparison.basis === 'hour'
      ? hourlyMarketRange(posting.marketPayLow, posting.marketPayHigh)
      : `${formatUsdK(posting.marketPayLow)}–${formatUsdK(posting.marketPayHigh)}`
  const basis = marketBasisLabel(posting.marketPayBasis, posting.marketPaySample)
  const verdict = posting.payVsMarket as PayVsMarket | null
  return (
    <div className="space-y-0.5 text-sm">
      {verdict ? (
        <p className="flex flex-wrap items-center gap-2 text-foreground">
          <span className="font-medium">Pay vs. market:</span>
          <PayVsMarketBadge verdict={verdict} marketLow={posting.marketPayLow} marketHigh={posting.marketPayHigh} />
          <span className="text-muted-foreground">market for this role {range}</span>
        </p>
      ) : (
        <p className="text-foreground">
          <span className="font-medium">Market pay for this role:</span> {range}
          <span className="text-muted-foreground"> — our estimate; this employer didn&apos;t post pay</span>
        </p>
      )}
      {basis && <p className="text-xs text-muted-foreground">Based on: {basis}</p>}
    </div>
  )
}

// How the member's skills line up with what this job's own description asks for.
export function SkillGapLine({ gap }: { gap: JobSkillGap }) {
  const scope = 'this role asks for'
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">
        Skills: you show {gap.have.length} of {gap.requested.length} {scope}
      </span>
      {gap.missing.length > 0 && ` — missing ${gap.missing.slice(0, 4).join(', ')}`}
    </p>
  )
}

// Next to the fit badge, never part of it: how this kind of work lines up with the person's own,
// from O*NET. A band, not a number. A title we cannot place says so instead of guessing.
export function SkillsFitLine({ fit }: { fit: SkillsFit }) {
  if (fit.status === 'unmapped') {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Skills fit:</span>{' '}
        {fit.reason === 'title' ? 'we could not tell what kind of work this is from its title.' : 'add your latest job title to your profile and we will compare.'}
      </p>
    )
  }
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-medium text-foreground">Skills fit: {SKILLS_FIT_LABEL[fit.band]}</span> with your current work, treating this as {fit.targetTitle.toLowerCase()}
      {fit.toolsToLearn.length > 0 && `. Tools it uses that you do not show: ${fit.toolsToLearn.join(', ')}`}
      {fit.knowledgeToBuild.length > 0 && `. Knowledge it asks more of: ${fit.knowledgeToBuild.join(', ').toLowerCase()}`}.
    </p>
  )
}

export function BridgeDetails({ jobId, bridge }: { jobId: string; bridge: Bridge }) {
  const props = (step: string) => ({ jobId, step, relaxed: bridge.relaxed })
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-sm">
      <p>
        <span className="font-medium text-foreground">What transfers:</span> <span className="text-muted-foreground">{bridge.transfers}</span>
      </p>
      <p>
        <span className="font-medium text-foreground">What&apos;s missing:</span> <span className="text-muted-foreground">{bridge.missing}</span>
      </p>
      <p>
        <span className="font-medium text-foreground">How to close it:</span>{' '}
        <TrackedLink href={bridge.learn.href} event="bridge_step_clicked" properties={props('learn')} className="text-primary underline underline-offset-4">
          {bridge.learn.label}
        </TrackedLink>
        {' · '}
        <TrackedLink href={bridge.network.href} event="bridge_step_clicked" properties={props('network')} className="text-primary underline underline-offset-4">
          {bridge.network.label}
        </TrackedLink>
      </p>
    </div>
  )
}

export function DiscoverJobCard({
  posting,
  fitBucket,
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
  why,
  dismissible = true,
  candidatePlus = false,
  signalLift = false,
}: {
  /** The member is changing careers or early in their career: the welcome tag wins the meta line's quiet slot (posting-signals.ts). */
  signalLift?: boolean
  /** Candidate+ (isDossierUnlocked): shows who to contact, the apply kit and explain-my-gaps; others see one line each. */
  candidatePlus?: boolean
  /** Wide's one-relaxed jobs (relevance.ts): what transfers, what's missing, how to close it. */
  bridge?: Bridge
  /** "Why this job" (personalization/why-this-job.ts): up to three fits and one gap, one line. Replaces the reason and bridge lines. */
  why?: WhyThisJob
  /** Show the X (pass on it with reasons). On by default for board cards. */
  dismissible?: boolean
  posting: ExclusiveJobPosting
  /** Why the job is on the member's board (search-breadth.ts); the why line's fallback when there is no `why`. */
  matchReason?: MatchReason
  fitBucket: FitBucket
  /** Shown as a board search result: its 1-based rank and the query, for job_search_result_clicked. */
  searchResult?: { rank: number; q: string; loc: string }
  /** The employer's pay level and curated "known for" (great-employers.ts); none for a confidential search. */
  employer?: EmployerSignals
  /** The posting's structured benefits, when the import sent them. */
  benefits?: { benefits: JobBenefits | null; strong: boolean }
  competition?: CompetitionScore
  contacts?: JobContacts
  skillGap?: JobSkillGap
  skillsFit?: SkillsFit
  /** Per-member match and gaps (job-match.ts), computed server-side for the jobs shown. */
  match?: JobMatch
  /** Phase 2 "Explain my gaps" — off unless JOB_GAPS_EXPLAIN_ENABLED. */
  explainGapsEnabled?: boolean
  /** Members a viewer could ask about this company (insider network), with the company page link. */
  insiders?: { count: number; href: string }
  /** My jobs: saved / application status for this job. */
  track?: CardTrackState
  /** Is the member watching this company? */
  watched?: boolean
}) {
  const [state, formAction, pending] = useActionState(promoteJobBoardListing.bind(null, posting.id), undefined)
  const [dismissed, setDismissed] = useState<DismissResult | null>(null)
  const [undoing, startUndo] = useTransition()
  const confidential = posting.disclosure === 'CONFIDENTIAL'
  const workType = classifyWorkType(posting)
  const payLabel = payBasisLabel({ ...posting, workType })
  const comparePay = payComparison(workType, compensationKind(posting), payPeriodOf(posting)).compare
  const payBadge = payBadgeFor({ jobVerdictShown: comparePay && !!posting.payVsMarket, signals: employer })
  const benefitsBadge = benefitsBadgeFor({ strongBenefits: !!benefits?.strong, signals: employer })
  const highlights = benefitsHighlights(benefits?.benefits)
  const verdict = cardVerdict(fitBucket, { bridge: !!bridge })
  const remote = /\bremote\b/i.test(posting.location ?? '') || (posting.targetRemotePolicy ?? '').toLowerCase() === 'remote'
  const meta = cardMetaParts({ posted: postedAgo(posting), location: posting.location, remote, pay: payLabel, workType, title: posting.title, verifiedAt: posting.lastVerifiedAt, stillListed: isStillListed(posting) })
  // Say less rather than something generic: a field match without `why` adds nothing.
  const fallbackWhy = !why && matchReason && matchReason.kind !== 'field' ? { fits: [matchReason.label], gap: null } : null
  // One quiet slot after the meta line: the competition hint, or the posting-signal tag (posting-signals.ts).
  const signal = postingSignalTag(posting.postingSignals, { lift: signalLift })
  const hint = fewerApplicantsHint(competition)
  const metaHint = signal && tagTakesHintSlot(signal, signalLift) ? null : hint

  function handleClick() {
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

  if (dismissed) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-muted-foreground" role="status">
        <span>
          Passed on {posting.title}
          {dismissed.applied.length > 0 && ` — we ${dismissed.applied.map((a) => `hid ${a.label}`).join(' and ')}`}.
        </span>
        <button
          type="button"
          disabled={undoing}
          aria-busy={undoing}
          onClick={() =>
            startUndo(async () => {
              const r = await undoDismissBoardJob(posting.id).catch(() => null)
              if (r?.ok) {
                posthog.capture('dismiss_undone', { jobId: posting.id, scope: 'job' })
                setDismissed(null)
              }
            })
          }
          className={cn('text-primary underline underline-offset-4', undoing && 'cursor-wait')}
        >
          Undo
        </button>
      </div>
    )
  }

  return (
    <details
      className="group"
      onToggle={(e) => {
        if (!(e.currentTarget as HTMLDetailsElement).open) return
        // Opening the card is when the member reads why it is there.
        if (matchReason) posthog.capture('job_match_reason_viewed', { jobId: posting.id, reason: matchReason.kind, label: matchReason.label, verdict })
        if (payBadge || benefitsBadge) {
          posthog.capture('job_employer_badges_viewed', { postingId: posting.id, companyName: posting.companyName, payBadge, benefitsBadge, fitBucket })
        }
        if (!posting.marketPayMid) return
        posthog.capture('job_market_pay_viewed', {
          postingId: posting.id,
          payVsMarket: posting.payVsMarket ?? 'not_posted',
          marketPayMid: posting.marketPayMid,
          basis: posting.marketPayBasis,
          fitBucket,
        })
      }}
    >
      <summary className="block cursor-pointer list-none px-4 py-3">
        <span className="flex items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-foreground">{posting.title}</span>
              <span className="text-sm text-muted-foreground">{confidential ? 'Confidential search' : `at ${posting.companyName}`}</span>
            </span>
            {/* On a phone the verdict sits under the title, so the title keeps the width. */}
            <JobVerdict verdict={verdict} className="mt-1 inline-block sm:hidden" />
            {/* One why line: up to three member-specific reasons and at most one gap. */}
            {(why ?? fallbackWhy) && (
              <JobWhyLine
                fits={(why ?? fallbackWhy)!.fits}
                gap={(why ?? fallbackWhy)!.gap}
                lowerFit={why?.lowerFit}
                title={matchReason ? matchReasonSentence(matchReason) : undefined}
              />
            )}
            {/* One quiet meta line, with the competition hint only when the estimate is low. */}
            <JobMetaLine
              parts={meta}
              hint={metaHint}
              tag={signal ? <PostingSignalTag jobId={posting.id} signal={signal} surface="board_card" /> : null}
              jobId={posting.id}
            />
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <JobVerdict verdict={verdict} className="hidden sm:inline-block" />
            {dismissible && (
              <DismissJobButton jobId={posting.id} title={posting.title} companyName={confidential ? null : posting.companyName} onDismissed={(r) => setDismissed(r)} />
            )}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden />
          </span>
        </span>
      </summary>
      <div className="space-y-3 px-4 pb-4">
        {/* The breakdown behind the verdict: the five dimensions, then the job's stated requirements. */}
        {match && (
          <div className="space-y-1">
            <JobMatchBreakdown match={match} />
            <JobRequirementLabels jobId={posting.id} checks={match.requirements} surface="board_card" />
          </div>
        )}
        <p className="text-sm text-muted-foreground">
          {[attributionOf(posting) ?? (posting.postingType && POSTING_TYPE_LABEL[posting.postingType]), posting.location, payLabel].filter(Boolean).join(' · ')}
          {comparePay && posting.payVsMarket && (
            <>
              {' '}
              <PayVsMarketBadge verdict={posting.payVsMarket as PayVsMarket} marketLow={posting.marketPayLow} marketHigh={posting.marketPayHigh} />
            </>
          )}
        </p>
        <RepostNote posting={posting} />

        <MarketPayLine posting={posting} workType={workType} />
        {!confidential && (
          <EmployerSignalsLine
            postingId={posting.id}
            companyName={posting.companyName}
            employer={employer}
            highlights={highlights}
            payBadge={payBadge}
            benefitsBadge={benefitsBadge}
          />
        )}

        {/* A confidential search's description usually names the client — never shown. */}
        {posting.description && !confidential && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{posting.description}</p>
        )}

        {competition && (
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Applicants, our estimate: {COMPETITION_LABEL[competition.level]}</span>
            {competition.reasons.length > 0 && ` — ${competition.reasons.join(' · ')}`}. Not an applicant count.
          </p>
        )}
        {bridge && <BridgeDetails jobId={posting.id} bridge={bridge} />}
        {skillsFit && <SkillsFitLine fit={skillsFit} />}
        {/* The match panel's skills row covers the skills gap; the line stays for cards without one. */}
        {!match && skillGap && skillGap.basis !== 'none' && skillGap.requested.length > 0 && <SkillGapLine gap={skillGap} />}
        {match && (
          <JobMatchDetails
            jobId={posting.id}
            match={match}
            explainEnabled={explainGapsEnabled}
            candidatePlus={candidatePlus}
            insiders={confidential ? undefined : insiders}
          />
        )}
        {candidatePlus || !confidential ? (
          <div data-who-to-contact={posting.id}>
            <WhoToContactPanel postingId={posting.id} confidential={confidential} contacts={contacts} />
            <SentItPrompt context={{ source: 'who_to_contact', subjectKey: `job:${posting.id}`, jobId: posting.id }} reaskOnMount />
          </div>
        ) : (
          <CandidatePlusExtraLine extra="request_intro" jobId={posting.id} surface="job_card" />
        )}
        <ApplyKit postingId={posting.id} surface="job_card" />
        {nativePosterOf(posting) && <NativeApply postingId={posting.id} size="sm" />}

        <div className="space-y-2 border-t border-border pt-3">
        <p className="text-sm text-foreground">{edgeTip(posting)}</p>
        <div className="flex flex-wrap items-center gap-2">
          {confidential ? (
            candidatePlus && <RequestIntroButton postingId={posting.id} />
          ) : (
            <Button
              nativeButton={false}
              // Crawled jobs open through the click-time liveness check (jobs/[id]/open).
              render={<a href={posting.source === 'ats_feed' ? postingOpenHref(posting.id) : posting.url} target="_blank" rel="noopener noreferrer" onClick={handleClick} />}
              variant="outline"
              size="sm"
            >
              View posting
            </Button>
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
        </div>
        {!confidential && (
          <JobTrackControls
            jobRef={{ source: 'job_board', sourceId: posting.id, title: posting.title, companyName: posting.companyName, url: posting.url, workType }}
            initial={track}
            watched={watched}
            companyId={posting.companyId}
          />
        )}
        {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
        <CoverNote postingId={posting.id} />
      </div>
    </details>
  )
}

export function RequestIntroButton({ postingId }: { postingId: string }) {
  return (
    <form action={requestJobBoardIntro.bind(null, postingId)}>
      <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
        Request intro
      </SubmitButton>
    </form>
  )
}

// Drafted on click (an LLM call, capped per day — see cover-note.ts).
export function CoverNote({ postingId }: { postingId: string }) {
  const [pending, startTransition] = useTransition()
  const [note, setNote] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function draft() {
    setError(null)
    startTransition(async () => {
      const result = await draftJobCoverNote(postingId)
      if (!result.ok) return setError(result.error)
      setNote(result.body)
      setRemaining(result.remainingToday)
    })
  }

  async function copy() {
    if (!note) return
    await navigator.clipboard.writeText(note)
    setCopied(true)
    posthog.capture('job_cover_note_copied', { postingId })
  }

  if (!note) {
    return (
      <div className="space-y-1">
        <Button variant="outline" size="sm" onClick={draft} disabled={pending} aria-busy={pending} className={pending ? 'cursor-wait' : ''}>
          {pending ? 'Drafting…' : 'Draft a cover note'}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    )
  }
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-foreground" htmlFor={`cover-note-${postingId}`}>
        Cover note — edit before you send
      </label>
      <textarea
        id={`cover-note-${postingId}`}
        defaultValue={note}
        rows={8}
        className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? 'Copied' : 'Copy note'}
        </Button>
        {remaining !== null && (
          <p className="text-xs text-muted-foreground">{remaining} more drafts available today</p>
        )}
      </div>
    </div>
  )
}
