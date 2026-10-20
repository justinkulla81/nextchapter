import type { ReactNode } from 'react'
import type { ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { cardMetaParts, cardVerdict } from '@/lib/jobs/job-card'
import { fewerApplicantsHint, isFresh, postedAgo, type CompetitionScore } from '@/lib/jobs/competition'
import { listItemOf, nextStepFor, oneFact, type JobListItem } from '@/lib/jobs/find-list'
import { classifyWorkType, payBasisLabel } from '@/lib/jobs/work-type'
import { postingSignalTag, tagTakesHintSlot } from '@/lib/jobs/posting-signals'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import type { JobMatch } from '@/lib/jobs/job-match-types'
import type { WhyThisJob } from '@/lib/personalization/why-this-job'
import type { Bridge } from '@/lib/jobs/relevance'
import type { MatchReason } from '@/lib/jobs/search-breadth'
import type { JobContacts } from '@/lib/jobs/job-contacts'
import type { JobSkillGap } from '@/lib/jobs/job-skill-gap'
import type { SkillsFit } from '@/lib/careers/skills-fit'
import type { CardTrackState } from '@/lib/jobs/my-jobs-data'
import type { EmployerSignals } from '@/lib/jobs/great-employer-display'
import type { JobBenefits } from '@/lib/jobs/benefits'
import { FindJobDetail } from '@/components/dashboard/find/FindJobDetail'
import { FindSurfacedDetail } from '@/components/dashboard/find/FindSurfacedDetail'

// Server-side: turns what the Find a job page already computed for a job (its fit, the why line, the match,
// the contacts) into the list row and the open-job pane. Nothing is scored or ranked here.

export interface FindEntry {
  item: JobListItem
  detail: ReactNode
}

export function boardEntry(a: {
  posting: ExclusiveJobPosting
  fitBucket: FitBucket
  why: WhyThisJob
  bridge?: Bridge
  competition: CompetitionScore
  contacts?: JobContacts
  skillGap?: JobSkillGap
  skillsFit?: SkillsFit | null
  match: JobMatch
  explainGapsEnabled: boolean
  insiders?: { count: number; href: string }
  track?: CardTrackState
  watched: boolean
  employer?: EmployerSignals
  benefits?: { benefits: JobBenefits | null; strong: boolean }
  searchResult?: { rank: number; q: string; loc: string }
  matchReason?: MatchReason
  candidatePlus: boolean
  /** Changing careers or early career: the welcome tag wins the row's one fact (posting-signals.ts). */
  signalLift?: boolean
}): FindEntry {
  const { posting } = a
  const signal = postingSignalTag(posting.postingSignals, { lift: !!a.signalLift })
  const confidential = posting.disclosure === 'CONFIDENTIAL'
  const workType = classifyWorkType(posting)
  const remote = /\bremote\b/i.test(posting.location ?? '') || (posting.targetRemotePolicy ?? '').toLowerCase() === 'remote'
  const item = listItemOf({
    id: posting.id,
    kind: 'board',
    title: posting.title,
    companyName: posting.companyName,
    confidential,
    place: posting.location || (remote ? 'Remote' : null),
    verdict: cardVerdict(a.fitBucket, { bridge: !!a.bridge }),
    why: a.why,
    fact: oneFact({
      posted: postedAgo(posting),
      fewerApplicants: fewerApplicantsHint(a.competition),
      pay: payBasisLabel({ ...posting, workType }),
      signal,
      signalFirst: !!signal && tagTakesHintSlot(signal, !!a.signalLift),
    }),
    signal,
  })
  const nextStep = nextStepFor({
    blocker: a.match.requirements.find((r) => r.status === 'blocker')?.label ?? null,
    contactName: confidential ? null : (a.contacts?.known[0]?.name ?? null),
    insiderCount: confidential ? 0 : (a.insiders?.count ?? 0),
    fresh: isFresh(posting),
  })
  return {
    item,
    detail: (
      <FindJobDetail
        posting={posting}
        item={item}
        fitBucket={a.fitBucket}
        nextStep={nextStep}
        competition={a.competition}
        contacts={a.contacts}
        skillGap={a.skillGap}
        skillsFit={a.skillsFit ?? undefined}
        match={a.match}
        explainGapsEnabled={a.explainGapsEnabled}
        insiders={a.insiders}
        track={a.track}
        watched={a.watched}
        employer={a.employer}
        benefits={a.benefits}
        searchResult={a.searchResult}
        matchReason={a.matchReason}
        bridge={a.bridge}
        candidatePlus={a.candidatePlus}
      />
    ),
  }
}

export function surfacedEntry(a: {
  job: SurfacedJob
  fitBucket: FitBucket
  worksHereContacts: { id: string; name: string }[]
  worksHereTotalCount: number
  track?: CardTrackState
  watched: boolean
}): FindEntry {
  const { job } = a
  const workType = classifyWorkType(job)
  const found = postedAgo({ postedAt: null, createdAt: job.surfacedAt }).replace(/^Posted/, 'Found')
  const item = listItemOf({
    id: job.id,
    kind: 'surfaced',
    title: job.title,
    companyName: job.companyName,
    place: job.location,
    verdict: cardVerdict(a.fitBucket),
    why: { fits: ['the roles your automated searches look for'], gap: null },
    fact: oneFact({ posted: found, extra: cardMetaParts({ posted: null, location: null, pay: null, workType, title: job.title }) }),
  })
  return {
    item,
    detail: (
      <FindSurfacedDetail
        job={job}
        item={item}
        fitBucket={a.fitBucket}
        worksHereContacts={a.worksHereContacts}
        worksHereTotalCount={a.worksHereTotalCount}
        track={a.track}
        watched={a.watched}
      />
    ),
  }
}
