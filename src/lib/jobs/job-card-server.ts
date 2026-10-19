import 'server-only'
import type { CandidateProfile, ExclusiveJobPosting, SurfacedJob } from '@prisma/client'
import { computeFitAssessment, bucketFromAssessment } from '@/lib/jobs/job-fit-bucket'
import type { FitBucket } from '@/lib/jobs/fit-bucket-types'
import {
  CARD_VERDICT_LABEL,
  cardMetaParts,
  cardVerdict,
  isStillListed,
  levelPhrase,
  whyLineText,
  type JobCardText,
} from '@/lib/jobs/job-card'
import { fewerApplicantsHint, fewerApplicantsText, postedAgo, scoreCompetition } from '@/lib/jobs/competition'
import { classifyWorkType, payBasisLabel } from '@/lib/jobs/work-type'
import { whyThisJob } from '@/lib/personalization/why-this-job'
import { breadthReasonsFor } from '@/lib/jobs/search-breadth-server'
import type { MatchReason } from '@/lib/jobs/search-breadth'
import type { BoardShortlist } from '@/lib/jobs/board-shortlist'
import { subFunctionLabel } from '@/lib/jobs/sub-functions'
import { jobSkillGap } from '@/lib/jobs/job-skill-gap'
import { skillTerms } from '@/lib/profile/skill-matrix'
import { checkRequirements, parseRequirementFlags, requirementMemberOf } from '@/lib/jobs/requirements'
import { statesFromLocation } from '@/lib/pay/market-pay'
import { normalizeOrgName } from '@/lib/text/org-name-match'

// The job card's three lines (job-card.ts) for surfaces outside the board — the coach's
// client view, Job Search Daily, fresh-job alerts and the coach weekly digest — built
// from the same helpers the board's cards use (find-my-job/page.tsx), so a job reads
// the same everywhere: one verdict, one "Fits you … — Gap: …" line, one meta line.
// No AI, no extra queries: everything comes from the shortlist the caller already loaded.

const REMOTE = /\bremote\b/i

/**
 * Card text for board jobs from one loadBoardShortlist() call. `fitBucketFor` lets an
 * email keep the fit scoring that picked its jobs (email-fit-scoring.ts); without it the
 * verdict comes from fit scoring v2, like the board.
 */
export function boardJobCardTexts(opts: {
  candidate: CandidateProfile
  shortlist: Pick<BoardShortlist, 'breadth' | 'countByCompany'>
  postings: ExclusiveJobPosting[]
  fitBucketFor?: (p: ExclusiveJobPosting) => FitBucket
  now?: Date
}): Map<string, JobCardText> {
  const { candidate, shortlist, postings } = opts
  const now = opts.now ?? new Date()
  const c = shortlist.breadth.classifier
  const memberKeywords = skillTerms(candidate)
  // Why each job is on the board ("Your field", "Pivot: …"), with the ring notes a bridge job carries — as on the board.
  const reasons: Map<string, MatchReason> = c ? breadthReasonsFor(c, postings, memberKeywords) : new Map()
  for (const [id, info] of shortlist.breadth.bridges) {
    const r = reasons.get(id)
    if (r) reasons.set(id, { ...r, label: [info.kind === 'function' ? r.label : 'Your field', ...info.notes].join(' · ') })
  }
  const field = c ? (subFunctionLabel(c.member.subFunction) ?? c.member.functionLabel) : null
  const city = c?.member.geo?.anchor ? (candidate.currentCity?.trim() ?? null) : null
  const member = requirementMemberOf(candidate)

  const out = new Map<string, JobCardText>()
  for (const p of postings) {
    const assessment = computeFitAssessment(candidate, p)
    const bucket = opts.fitBucketFor ? opts.fitBucketFor(p) : bucketFromAssessment(assessment)
    const bridge = shortlist.breadth.bridges.has(p.id)
    const verdict = cardVerdict(bucket, { bridge })
    const gap = jobSkillGap({
      title: p.title,
      description: p.disclosure === 'CONFIDENTIAL' ? null : p.description,
      skills: p.skills,
      aiSkillItems: p.aiSkillItems,
      memberKeywords,
    })
    const blocker =
      checkRequirements(parseRequirementFlags(p.requirementFlags), member, { locationState: p.locationState }).find((r) => r.status === 'blocker')
        ?.label ?? null
    const remote = REMOTE.test(p.location ?? '') || (p.targetRemotePolicy ?? '').toLowerCase() === 'remote'
    const why = whyThisJob({
      reason: reasons.get(p.id),
      crit: c ? (c.place(p)?.crit ?? c.criteria(p).crit) : null,
      jobRemote: remote || statesFromLocation(p.location).isRemote,
      city,
      hasIndustries: (c?.member.industries.size ?? 0) > 0,
      have: gap.have,
      missing: gap.missing,
      blocker,
      level: levelPhrase(assessment.level),
      field,
    })
    const workType = classifyWorkType(p)
    const competition = scoreCompetition(p, shortlist.countByCompany.get(normalizeOrgName(p.companyName)) ?? 0, now)
    out.set(p.id, {
      verdict,
      verdictLabel: CARD_VERDICT_LABEL[verdict],
      fits: why.fits,
      gap: why.gap,
      whyLine: whyLineText(why),
      meta: cardMetaParts({
        posted: postedAgo(p, now),
        location: p.location,
        remote,
        pay: payBasisLabel({ ...p, workType }),
        workType,
        title: p.title,
        verifiedAt: p.lastVerifiedAt,
        stillListed: isStillListed(p, now),
        now,
      }),
      fewerApplicantsHint: fewerApplicantsHint(competition),
      fewerApplicants: fewerApplicantsText(competition),
    })
  }
  return out
}

/**
 * Card text for a partner-search job (SurfacedJob), as NextSurfacedJobCard shows it: the
 * verdict, and a meta line that says when we found it (it has no posting date). No why line —
 * a partner-search job carries no breadth reason or skills list to say it from.
 */
export function surfacedJobCardText(job: Pick<SurfacedJob, 'title' | 'location' | 'surfacedAt' | 'description'> & { employmentType?: string | null }, fitBucket: FitBucket): JobCardText {
  const verdict = cardVerdict(fitBucket)
  const found = postedAgo({ postedAt: null, createdAt: job.surfacedAt }).replace(/^Posted/, 'Found')
  return {
    verdict,
    verdictLabel: CARD_VERDICT_LABEL[verdict],
    fits: [],
    gap: null,
    whyLine: '',
    meta: cardMetaParts({ posted: found, location: job.location, pay: null, workType: classifyWorkType(job), title: job.title }),
    fewerApplicantsHint: null,
    fewerApplicants: null,
  }
}
