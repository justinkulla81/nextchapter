import 'server-only'
import { prisma } from '@/lib/prisma'
import { careerOf } from '@/lib/journey/career'
import { parseRelocation } from '@/lib/journey/relocation'
import { ownedFunctionsFrom } from '@/lib/journey/pathway'
import { activeTargets, pivotInterestsOf, pivotOf } from '@/lib/journey/pivot'
import { buildDoors, type Door } from './doors'
import { deriveStory, iso, type MemberRow, type StoryEvent } from './events'
import { peerView, type PeerView } from './peers'

type Profile = {
  id: string
  journeyDetails: unknown
  primaryFunction: string | null
  industryContext: string | null
  levelRankScore: number | null
  openToRelocation: boolean
  resumeKeywords: string[]
  confirmedSkillsHave: string[]
  skillsToBuild: string[]
}

export type CareerStory = {
  now: string
  events: StoryEvent[]
  main: Door[]
  more: Door[]
  cushionMonths: number | null
  hideYears: boolean
  peers: PeerView
  hasAnyHistory: boolean
}

const asRecord = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {})

export function cushionOf(details: unknown): number | null {
  const v = asRecord(details).cushionMonths
  return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 60 ? v : null
}
export const hideYearsOf = (details: unknown): boolean => asRecord(details).storyHideYears === true

// Others in the same function who have a field on their radar. Real members only, and never anyone
// in confidential search mode. Only counts leave this function.
async function loadPeers(profile: Profile): Promise<PeerView> {
  if (!profile.primaryFunction) return peerView(0, [])
  try {
    const total = await prisma.candidateProfile.count({
      where: { primaryFunction: profile.primaryFunction, isSampleData: false, confidentialSearchMode: false, id: { not: profile.id } },
    })
    if (total < 30) return peerView(total, [])
    const rows = await prisma.$queryRaw<{ fn: string; people: bigint }[]>`
      SELECT t->>'function' AS fn, COUNT(DISTINCT c.id) AS people
      FROM "CandidateProfile" c, jsonb_array_elements(COALESCE(c."journeyDetails"->'pivot'->'targets', '[]'::jsonb)) t
      WHERE c."primaryFunction" = ${profile.primaryFunction}
        AND c."isSampleData" = false AND c."confidentialSearchMode" = false AND c.id <> ${profile.id}
        AND COALESCE(t->>'stance', '') <> 'SET_ASIDE'
      GROUP BY 1`
    return peerView(total, rows.map((r) => ({ function: r.fn, people: Number(r.people) })))
  } catch (error) {
    console.error('Career story: peers unavailable', error)
    return peerView(0, [])
  }
}

export async function loadCareerStory(profile: Profile, now = new Date()): Promise<CareerStory> {
  const [work, education, badges, member, tr, peers] = await Promise.all([
    prisma.workHistoryEntry.findMany({
      where: { candidateId: profile.id },
      select: { id: true, roleTitle: true, companyName: true, companyNameNormalized: true, startDate: true, endDate: true, isCurrent: true, engagementType: true, keyAchievement: true },
    }),
    prisma.educationEntry.findMany({ where: { candidateId: profile.id }, select: { id: true, schoolName: true, degree: true, fieldOfStudy: true, startDate: true, graduationDate: true } }),
    prisma.learningBadge.findMany({ where: { candidateId: profile.id }, select: { id: true, title: true, completedAt: true } }),
    // The table arrives with its SQL file; until then the story is just what we derive.
    prisma.careerEvent.findMany({ where: { candidateId: profile.id } }).catch((error) => {
      console.error('Career story: member events unavailable', error)
      return []
    }),
    prisma.trackRecordResponse.findUnique({ where: { candidateId: profile.id }, select: { functionsOwnedOutsideCore: true, sectorHistory: true } }),
    loadPeers(profile),
  ])
  const rows: MemberRow[] = member.map((m) => ({
    id: m.id, kind: m.kind, label: m.label, detail: m.detail, start: iso(m.startDate), end: m.endDate ? iso(m.endDate) : null, reason: m.reason, sourceRef: m.sourceRef, hidden: m.hidden,
  }))
  const events = deriveStory({ work: work.map((w) => ({ ...w, engagementType: String(w.engagementType) })), education, badges, member: rows, now })

  const pivot = pivotOf(profile.journeyDetails)
  const interests = pivotInterestsOf(profile.journeyDetails)
  const doors = buildDoors({
    from: profile.primaryFunction,
    keywords: [...profile.resumeKeywords, ...profile.confirmedSkillsHave],
    ownedFunctions: ownedFunctionsFrom(tr?.functionsOwnedOutsideCore),
    seniorLevel: (profile.levelRankScore ?? 0) >= 60,
    currentIndustry: profile.industryContext,
    sectorHistory: tr?.sectorHistory ?? [],
    onRadar: (pivot?.targets ?? []).map((t) => t.function),
    industriesOnRadar: interests.industries.map((i) => i.name),
    skillsToBuild: profile.skillsToBuild,
    radar: activeTargets(pivot),
    career: careerOf(profile.journeyDetails),
    relocation: parseRelocation(profile.journeyDetails, profile.openToRelocation),
  })
  return {
    now: iso(now),
    events,
    main: doors.main,
    more: doors.more,
    cushionMonths: cushionOf(profile.journeyDetails),
    hideYears: hideYearsOf(profile.journeyDetails),
    peers,
    hasAnyHistory: work.length + education.length + rows.length > 0,
  }
}
