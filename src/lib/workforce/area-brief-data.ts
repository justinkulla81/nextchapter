import 'server-only'
import { prisma } from '@/lib/prisma'
import { getPublicNotices } from '@/lib/warn/layoff-pages'
import { opportunitiesForKinds } from '@/lib/funding-opportunities/store'
import { effectiveJourney, effectiveStage } from '@/lib/journey/journey'
import { STATE_NAMES, placeKeys } from '@/lib/workforce/places'
import { countyForCity } from '@/lib/workforce/match'
import { inBoardArea } from '@/lib/workforce/board-area'
import { BOARD_MIN_GROUP, candidateStatus, stateCode, type CandidateStatus } from './area-brief'

export type AreaBrief = {
  area: { name: string; state: string; stateName: string; boardId: string | null }
  generatedAt: Date
  // NextChapter members, anonymous and counts only. 'area' counts members whose
  // city is in the board's counties; 'state' is the fallback while the area is
  // under the minimum group, or when it is a state brief.
  candidates: CandidateStatus
  candidatesScope: 'area' | 'state'
  // Members who told us they work with this board (board scope only).
  boardMembers: { connected: number | null; foundWork: number | null } | null
  layoffs: { windowDays: number; totalWorkers: number; companies: { employer: string; workers: number | null; notices: number; latestFiled: Date }[] }
  // Roles on the NextChapter job board in the state; not the whole market.
  hiring: { openRoles: number; companies: { name: string; roles: number }[] }
  news: { title: string; url: string; publisher: string | null; publishedAt: Date | null }[]
  funding: { id: string; title: string; agency: string; closesAt: Date | null; awardCeiling: number | null; url: string }[]
}

const DAY = 86_400_000
const LAYOFF_WINDOW_DAYS = 90

// The area brief for a workforce board or a state. Every figure about members is
// a count behind the minimum-group rule (./area-brief.ts); members in
// Confidential Search Mode, or whose privacy tier is Stealth or Locked, are
// not counted at all.
export async function getAreaBrief(
  scope: { boardId: string } | { state: string },
  now: Date = new Date(),
  // Looking up an unseen city's county calls the Census geocoder: for scheduled
  // jobs only, never a page request.
  options: { warmCounties?: boolean } = {}
): Promise<AreaBrief | null> {
  let board: { id: string; name: string; state: string; counties: string[]; placeCounties: string[]; statewide: boolean } | null = null
  let code: string | null
  if ('boardId' in scope) {
    board = await prisma.workforceBoard.findUnique({ where: { id: scope.boardId }, select: { id: true, name: true, state: true, counties: true, placeCounties: true, statewide: true } })
    if (!board) return null
    code = stateCode(board.state, STATE_NAMES)
  } else {
    code = stateCode(scope.state, STATE_NAMES)
  }
  if (!code) return null
  const stateName = STATE_NAMES[code]

  const [profiles, notices, postings, boardsInState] = await Promise.all([
    prisma.candidateProfile.findMany({
      where: {
        registrationCompletedAt: { not: null },
        isSampleData: false,
        deactivatedAt: null,
        confidentialSearchMode: false,
        privacyTier: { notIn: ['STEALTH', 'LOCKED'] },
        OR: [{ currentState: { equals: code, mode: 'insensitive' } }, { currentState: { equals: stateName, mode: 'insensitive' } }],
      },
      select: { journey: true, journeyStage: true, currentJobStatus: true, journeyStageChangedAt: true, currentCity: true },
    }),
    getPublicNotices(),
    prisma.exclusiveJobPosting.findMany({
      where: {
        status: 'approved',
        archivedAt: null,
        AND: [
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
          { OR: [{ location: { contains: `, ${code}` } }, { location: { contains: stateName, mode: 'insensitive' } }] },
        ],
      },
      select: { companyName: true },
      take: 2000,
    }),
    board ? Promise.resolve([{ id: board.id }]) : prisma.workforceBoard.findMany({ where: { state: code }, select: { id: true, name: true, state: true } }),
  ])

  const toMember = (p: (typeof profiles)[number]) => {
    const stage = effectiveStage(p)
    return { journey: effectiveJourney(p), stage, landedAt: stage === 'LANDED' ? p.journeyStageChangedAt : null }
  }
  let candidates = candidateStatus(profiles.map(toMember), now)
  let candidatesScope: 'area' | 'state' = 'state'
  if (board && !board.statewide) {
    const counties = await countiesOfCities(code, profiles.map((p) => p.currentCity), options.warmCounties === true)
    const inArea = profiles.filter((p) => p.currentCity && inBoardArea(counties.get(p.currentCity.trim().toLowerCase()) ?? null, board!))
    // Only an area that is itself big enough to show; otherwise the state.
    if (inArea.length >= BOARD_MIN_GROUP) {
      candidates = candidateStatus(inArea.map(toMember), now)
      candidatesScope = 'area'
    }
  }

  let boardMembers: AreaBrief['boardMembers'] = null
  if (board) {
    const conns = await prisma.workforceBoardConnection.findMany({
      where: { boardId: board.id, status: 'ACTIVE' },
      select: { shareOutcome: true, candidate: { select: { journey: true, journeyStage: true, currentJobStatus: true, journeyStageChangedAt: true } } },
    })
    const since = now.getTime() - LAYOFF_WINDOW_DAYS * DAY
    const foundWork = conns.filter(
      (c) => c.shareOutcome && effectiveStage(c.candidate) === 'LANDED' && (c.candidate.journeyStageChangedAt?.getTime() ?? 0) >= since
    ).length
    boardMembers = {
      connected: conns.length >= BOARD_MIN_GROUP ? conns.length : null,
      foundWork: conns.length >= BOARD_MIN_GROUP && foundWork >= BOARD_MIN_GROUP ? foundWork : null,
    }
  }

  const cutoff = now.getTime() - LAYOFF_WINDOW_DAYS * DAY
  const inArea = notices.filter((n) => n.state === code && n.noticeDate.getTime() >= cutoff && (!board || n.board?.id === board.id))
  const bySlug = new Map<string, { employer: string; workers: number | null; notices: number; latestFiled: Date }>()
  for (const n of inArea) {
    const cur = bySlug.get(n.slug)
    if (!cur) bySlug.set(n.slug, { employer: n.employer, workers: n.workers, notices: 1, latestFiled: n.noticeDate })
    else {
      cur.notices += 1
      cur.workers = n.workers === null && cur.workers === null ? null : (cur.workers ?? 0) + (n.workers ?? 0)
      if (n.noticeDate > cur.latestFiled) cur.latestFiled = n.noticeDate
    }
  }
  const companies = [...bySlug.values()].sort((a, b) => (b.workers ?? 0) - (a.workers ?? 0)).slice(0, 10)
  const layoffs = { windowDays: LAYOFF_WINDOW_DAYS, totalWorkers: inArea.reduce((s, n) => s + (n.workers ?? 0), 0), companies }

  const roleCounts = new Map<string, number>()
  for (const p of postings) roleCounts.set(p.companyName, (roleCounts.get(p.companyName) ?? 0) + 1)
  const hiring = {
    openRoles: postings.length,
    companies: [...roleCounts.entries()].map(([name, roles]) => ({ name, roles })).sort((a, b) => b.roles - a.roles).slice(0, 8),
  }

  const news = await prisma.workforceBoardNews.findMany({
    where: { boardId: { in: boardsInState.map((b) => b.id) } },
    orderBy: [{ publishedAt: 'desc' }, { foundAt: 'desc' }],
    take: 8,
    select: { title: true, url: true, publisher: true, publishedAt: true },
  })

  const funding = (await opportunitiesForKinds(['STATE_GOV', 'LOCAL_GOV'], { state: code, limit: 6, now })).map((o) => ({
    id: o.id,
    title: o.title,
    agency: o.agency,
    closesAt: o.closesAt,
    awardCeiling: o.awardCeiling,
    url: o.url,
  }))

  return {
    area: { name: board?.name ?? stateName, state: code, stateName, boardId: board?.id ?? null },
    generatedAt: now,
    candidates,
    candidatesScope,
    boardMembers,
    layoffs,
    hiring,
    news,
    funding,
  }
}

// County of each distinct city, from the cached Census place list. With
// `warm`, a city never looked up before is resolved through the geocoder.
async function countiesOfCities(state: string, cities: (string | null)[], warm: boolean): Promise<Map<string, string | null>> {
  const distinct = [...new Set(cities.filter((c): c is string => !!c?.trim()).map((c) => c.trim()))]
  const out = new Map<string, string | null>()
  if (distinct.length === 0) return out
  const places = await prisma.geoPlace.findMany({
    where: { state, nameKey: { in: distinct.flatMap((c) => placeKeys(c)) } },
    orderBy: { population: 'desc' },
    select: { nameKey: true, county: true, countyCheckedAt: true },
  })
  for (const city of distinct) {
    const keys = placeKeys(city)
    const hit = places.find((p) => keys.includes(p.nameKey))
    let county = hit?.countyCheckedAt ? hit.county : null
    if (hit && !hit.countyCheckedAt && warm) county = await countyForCity(city, state).catch(() => null)
    out.set(city.toLowerCase(), county)
  }
  return out
}
