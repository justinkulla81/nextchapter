import 'server-only'
import { createHash } from 'crypto'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { skillDepth, topSkills } from './skill-matrix'
import { scoreStrengths, strengthHeadline, type StrengthProfile } from './strengths'

// Peers must be at least this many before "higher than N% of people in your field" shows.
const MIN_PEERS = 20
const MODEL = 'claude-haiku-5-5'

export type WhyHire = { statement: string; proofPoints: string[]; generatedAt: string }
export type Strengths = StrengthProfile & { headline: string; whyHire: WhyHire | null }

async function perfPercentile(candidateId: string, primaryFunction: string | null, mine: { execution: number; judgment: number; composure: number; influence: number }) {
  if (!primaryFunction) return null
  // Each peer's latest How I Perform, same primary function.
  const rows = await prisma.$queryRaw<{ n: number; execution: number; judgment: number; composure: number; influence: number }[]>`
    with latest as (
      select distinct on (r."candidateId") r."executionScore" e, r."judgmentScore" j, r."composureScore" c, r."influenceScore" i
      from public."PerformanceAssessmentResponse" r join public."CandidateProfile" p on p.id = r."candidateId"
      where p."primaryFunction" = ${primaryFunction} and r."candidateId" <> ${candidateId}
      order by r."candidateId", r."completedAt" desc
    )
    select count(*)::int n,
      count(*) filter (where e < ${mine.execution})::int execution,
      count(*) filter (where j < ${mine.judgment})::int judgment,
      count(*) filter (where c < ${mine.composure})::int composure,
      count(*) filter (where i < ${mine.influence})::int influence
    from latest`
  const r = rows[0]
  if (!r || r.n < MIN_PEERS) return null
  return { execution: r.execution / r.n, judgment: r.judgment / r.n, composure: r.composure / r.n, influence: r.influence / r.n }
}

const SIZE_RANK: Record<string, number> = { NONE: 0, ONE_TO_FIVE: 1, SIX_TO_TWENTY: 2, TWENTY_ONE_TO_FIFTY: 3, FIFTY_ONE_TO_TWO_HUNDRED: 4, TWO_HUNDRED_PLUS: 5 }
const MONEY_RANK: Record<string, number> = { NONE: 0, UNDER_100K: 1, ONE_HUNDRED_K_TO_1M: 2, ONE_M_TO_10M: 3, TEN_M_TO_100M: 4, OVER_100M: 5 }
const share = (mine: number, others: number[]) => (others.length >= MIN_PEERS ? others.filter((x) => x < mine).length / others.length : null)

// Track Record scale and skills depth against peers in the same primary
// function: the share of them below this person. Null under MIN_PEERS.
async function peerPercentiles(candidateId: string, primaryFunction: string | null, mine: { team: string | null; budget: string | null; initiative: string | null; skills: number }) {
  if (!primaryFunction) return null
  const [tracks, peers] = await Promise.all([
    prisma.trackRecordResponse.findMany({ where: { candidate: { primaryFunction }, candidateId: { not: candidateId } }, select: { largestTeamManaged: true, budgetOwned: true, largestInitiativeScope: true } }),
    prisma.candidateProfile.findMany({ where: { primaryFunction, id: { not: candidateId }, isSampleData: false }, select: { resumeKeywords: true, confirmedSkillsHave: true, certifications: true, skillLevels: true }, take: 3000 }),
  ])
  const scaleOf = (b: string | null, i: string | null) => Math.max(MONEY_RANK[b ?? ''] ?? 0, MONEY_RANK[i ?? ''] ?? 0)
  const depthOf = (d: { strong: number; expert: number; total: number }) => d.expert * 2 + d.strong + 0.3 * Math.max(0, d.total - d.strong - d.expert)
  return {
    team: mine.team ? share(SIZE_RANK[mine.team] ?? 0, tracks.map((t) => SIZE_RANK[t.largestTeamManaged ?? ''] ?? 0)) : null,
    scale: mine.budget || mine.initiative ? share(scaleOf(mine.budget, mine.initiative), tracks.map((t) => scaleOf(t.budgetOwned, t.largestInitiativeScope))) : null,
    skills: share(mine.skills, peers.map((p) => depthOf(skillDepth(p)))),
  }
}

const avg = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === 'number')
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
}

// The strengths read for one person. `writeUp`: also produce (or reuse) the
// AI "why hire me" statement. That is a per-person model call, made only when
// the inputs changed since the last one (strengthCacheKey), never on a plain
// page view with an unchanged profile.
export async function loadStrengths(candidateId: string, opts: { writeUp?: boolean } = {}): Promise<Strengths> {
  const safe = async <T,>(p: Promise<T>): Promise<T | null> => {
    try {
      return await p
    } catch {
      return null
    }
  }
  const [profile, perf, refs, track] = await Promise.all([
    prisma.candidateProfile.findUniqueOrThrow({
      where: { id: candidateId },
      select: {
        firstName: true,
        primaryFunction: true,
        targetRoleType: true,
        highestLevelReached: true,
        yearsExperience: true,
        topStrengths: true,
        resumeKeywords: true,
        confirmedSkillsHave: true,
        certifications: true,
        skillLevels: true,
        strengthCache: true,
        strengthCacheKey: true,
      },
    }),
    safe(prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, orderBy: { completedAt: 'desc' }, select: { executionScore: true, judgmentScore: true, composureScore: true, influenceScore: true } })),
    safe(
      prisma.reference.findMany({
        where: { candidateId, status: 'COMPLETED' },
        select: { traitAdaptabilityRating: true, traitFollowThroughRating: true, traitPresenceRating: true, traitCollaborationRating: true, traitComposureRating: true, superpowerText: true },
      }),
    ),
    safe(prisma.trackRecordResponse.findUnique({ where: { candidateId }, select: { largestTeamManaged: true, largestOrgIndirect: true, budgetOwned: true, pnlAccountability: true, largestInitiativeScope: true } })),
  ])
  const p = perf ? { execution: perf.executionScore, judgment: perf.judgmentScore, composure: perf.composureScore, influence: perf.influenceScore } : null
  const result = scoreStrengths({
    perf: p,
    perfPercentile: p ? await safe(perfPercentile(candidateId, profile.primaryFunction, p)) : null,
    refs: refs?.length
      ? {
          count: refs.length,
          adaptability: avg(refs.map((r) => r.traitAdaptabilityRating)),
          followThrough: avg(refs.map((r) => r.traitFollowThroughRating)),
          presence: avg(refs.map((r) => r.traitPresenceRating)),
          collaboration: avg(refs.map((r) => r.traitCollaborationRating)),
          composure: avg(refs.map((r) => r.traitComposureRating)),
          superpowers: refs.map((r) => r.superpowerText).filter((x): x is string => !!x?.trim()),
        }
      : null,
    track: track ? { team: track.largestTeamManaged, org: track.largestOrgIndirect, budget: track.budgetOwned, pnl: track.pnlAccountability, initiative: track.largestInitiativeScope } : null,
    skills: skillDepth(profile),
    peerPercentile: await safe(
      peerPercentiles(candidateId, profile.primaryFunction, {
        team: track?.largestTeamManaged ?? null,
        budget: track?.budgetOwned ?? null,
        initiative: track?.largestInitiativeScope ?? null,
        skills: (() => {
          const d = skillDepth(profile)
          return d.expert * 2 + d.strong + 0.3 * Math.max(0, d.total - d.strong - d.expert)
        })(),
      }),
    ),
    yearsExperience: profile.yearsExperience,
    picked: profile.topStrengths,
  })
  const headline = strengthHeadline(result)
  const cached = (profile.strengthCache as { whyHire?: WhyHire } | null)?.whyHire ?? null
  if (result.shape === 'emerging') return { ...result, headline, whyHire: null }

  const superpowers = refs?.map((r) => r.superpowerText).filter((x): x is string => !!x?.trim()) ?? []
  const skills = topSkills(profile, 8)
  const key = createHash('sha256')
    .update(JSON.stringify({ f: profile.primaryFunction, t: profile.targetRoleType, l: profile.highestLevelReached, peaks: result.peaks.map((x) => [x.key, x.evidence]), broad: result.broad.map((x) => x.key), skills, superpowers }))
    .digest('hex')
    .slice(0, 32)
  if (profile.strengthCacheKey === key && cached) return { ...result, headline, whyHire: cached }
  if (!opts.writeUp) return { ...result, headline, whyHire: cached }

  const whyHire = await writeWhyHire({ profile, result, skills, superpowers })
  if (whyHire) {
    await prisma.candidateProfile.update({ where: { id: candidateId }, data: { strengthCache: { whyHire }, strengthCacheKey: key } })
  }
  return { ...result, headline, whyHire: whyHire ?? cached }
}

const schema = z.object({
  statement: z.string(),
  proofPoints: z.array(z.string()).max(3),
})

async function writeWhyHire(args: {
  profile: { firstName: string | null; primaryFunction: string | null; targetRoleType: string | null; highestLevelReached: string | null; yearsExperience: number | null }
  result: StrengthProfile
  skills: string[]
  superpowers: string[]
}): Promise<WhyHire | null> {
  const { profile, result } = args
  const lead = result.shape === 'peaked' ? result.peaks : result.broad.slice(0, 4)
  try {
    const stream = getAnthropicClient().messages.stream({
      model: MODEL,
      max_tokens: 500,
      thinking: { type: 'disabled' },
      output_config: { format: zodOutputFormat(schema), effort: 'low' },
      messages: [
        {
          role: 'user',
          content: `Write the "why hire me" for a job seeker, in first person, plain and confident, no clichés ("results-driven", "passionate", "proven track record"), no claims beyond the evidence below.

Function: ${profile.primaryFunction ?? 'unknown'}; level: ${profile.highestLevelReached ?? 'unknown'}; years: ${profile.yearsExperience ?? 'unknown'}; targeting: ${profile.targetRoleType ?? 'not set'}
Shape: ${result.shape === 'peaked' ? 'clear standout strengths; lead with them' : 'no single standout, strong across several; sell range and reliability'}
Strengths with evidence:
${lead.map((s) => `- ${s.label}: ${s.evidence.join('; ')}`).join('\n')}
Strongest skills: ${args.skills.join(', ') || 'none listed'}
What references said they're best at: ${args.superpowers.slice(0, 3).join(' | ') || 'none yet'}

Return:
- statement: two sentences, under 45 words, that a hiring manager would remember. Name the strengths and the kind of role they make this person great at.
- proofPoints: up to three short lines, each a concrete piece of the evidence above, written as a fact (e.g. "Led a team of 21–50 and owned a $1M–$10M budget").`,
        },
      ],
    })
    const msg = await stream.finalMessage()
    const out = msg.parsed_output
    return out ? { statement: out.statement.trim(), proofPoints: out.proofPoints.map((x) => x.trim()).filter(Boolean), generatedAt: new Date().toISOString() } : null
  } catch (error) {
    console.error('Why hire me: generation failed', error)
    return null
  }
}
