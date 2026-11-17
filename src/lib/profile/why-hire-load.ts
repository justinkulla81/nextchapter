import 'server-only'
import { prisma } from '@/lib/prisma'
import { memoTtl } from '@/lib/db/heavy'
import { getDefaultNarrative } from '@/lib/narrative/get-default-narrative'
import { loadMemberSkillGap } from '@/lib/jobs/skill-gap-data'
import type { AggregatedSkillGap } from '@/lib/jobs/job-skill-gap'
import { peerStanding, standingMarks, MIN_PEERS, type Mark, type MarkDistribution, type PeerStanding } from './why-hire-standing'

// Data for Why hire me beyond the strengths read (strengths-load.ts): the proof marks, how they compare with peers,
// the pitch, and what best-fit jobs ask for.
//
// Data budget: the person's own marks are five indexed single-row reads (~1 KB). The peer distribution is one
// aggregate returning at most six rows, held 12 hours per peer group on each instance. The skills read (Gaps part only)
// is the member's best-fit shortlist, held 6 hours per member. At 500 page views a day this stays well under 0.2 GB.

export interface Pitch {
  verbal30s: string
  conversationOpener: string
  emailOpening: string
  linkedinHeadline: string
}

export interface WhyHireExtras {
  marks: Mark[]
  standing: PeerStanding | null
  pitch: Pitch | null
  /** A core statement exists but its spoken versions are not written yet. */
  pitchStarted: boolean
}

type Dist = { dist: MarkDistribution; total: number }

// The same five marks as standingMarks(), counted for every real member in one group (null = everyone).
const markDistribution = memoTtl(12 * 60 * 60 * 1000, (fn: string | null) => fn ?? '*', async (fn: string | null): Promise<Dist> => {
  const rows = await prisma.$queryRaw<{ marks: number; n: number }[]>`
    select marks, count(*)::int n from (
      select
        (exists(select 1 from "PerformanceAssessmentResponse" r where r."candidateId" = p.id))::int
      + ((select count(*) from "Reference" f where f."candidateId" = p.id and f.status = 'COMPLETED') >= 2)::int
      + (exists(select 1 from "TrackRecordResponse" t where t."candidateId" = p.id))::int
      + coalesce((select (rs."resultsScore" >= 70)::int from "Resume" rs where rs."candidateId" = p.id order by rs."uploadedAt" desc limit 1), 0)
      + (exists(select 1 from "CandidateNarrative" n where n."candidateId" = p.id and n.adaptations <> '{}'::jsonb))::int
      as marks
      from "CandidateProfile" p
      where p."isSampleData" = false and (${fn}::text is null or p."primaryFunction" = ${fn})
    ) x group by marks`
  const dist: MarkDistribution = {}
  let total = 0
  for (const r of rows) {
    dist[Number(r.marks)] = Number(r.n)
    total += Number(r.n)
  }
  return { dist, total }
})

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

function pitchOf(adaptations: unknown): Pitch | null {
  const a = adaptations && typeof adaptations === 'object' ? (adaptations as Record<string, unknown>) : {}
  const verbal30s = str(a.verbal30s)
  if (!verbal30s) return null
  return {
    verbal30s,
    conversationOpener: str(a.conversationOpener) ?? '',
    emailOpening: str(a.emailOpening) ?? '',
    linkedinHeadline: str(a.linkedinHeadline) ?? '',
  }
}

export async function loadWhyHireExtras(candidateId: string, primaryFunction: string | null): Promise<WhyHireExtras> {
  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p
    } catch (error) {
      console.error('Why hire me: a read failed', error)
      return fallback
    }
  }
  const [refs, resume, perf, track, narrative] = await Promise.all([
    safe(prisma.reference.count({ where: { candidateId, status: 'COMPLETED' } }), 0),
    safe(prisma.resume.findFirst({ where: { candidateId }, orderBy: { uploadedAt: 'desc' }, select: { resultsScore: true } }), null),
    safe(prisma.performanceAssessmentResponse.findFirst({ where: { candidateId }, select: { id: true } }), null),
    safe(prisma.trackRecordResponse.findUnique({ where: { candidateId }, select: { id: true } }), null),
    safe(getDefaultNarrative(candidateId), null),
  ])
  const pitch = pitchOf(narrative?.adaptations)
  const marks = standingMarks({
    completedReferences: refs,
    resumeResultsScore: resume?.resultsScore ?? null,
    hasPerformance: !!perf,
    hasTrackRecord: !!track,
    hasPitch: !!pitch,
  })
  const mine = marks.filter((m) => m.done).length

  let standing: PeerStanding | null = null
  if (primaryFunction) {
    const d = await safe(markDistribution(primaryFunction), null)
    if (d && d.total > MIN_PEERS) standing = peerStanding(d.dist, mine, marks.length, `people in ${primaryFunction.toLowerCase()} on NextChapter`)
  }
  if (!standing) {
    const d = await safe(markDistribution(null), null)
    if (d) standing = peerStanding(d.dist, mine, marks.length, 'NextChapter members')
  }
  return { marks, standing, pitch, pitchStarted: !!narrative && !pitch }
}

// What the member's best-fit open jobs ask for: what they bring and what keeps coming up that they don't show.
export const loadBestFitSkills = memoTtl(6 * 60 * 60 * 1000, (candidateId: string) => candidateId, async (candidateId: string): Promise<AggregatedSkillGap | null> => loadMemberSkillGap(candidateId))
