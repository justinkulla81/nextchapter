import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { ATS_COMPANIES, type AtsCompany, type AtsProvider } from './ats-companies'
import { slugCandidates, type BoardProbe } from './ats-slugs'

// A company named in a layoff report, an acquisition or a newsletter is only
// useful to a job seeker if we can see its openings. ATS_COMPANIES is a hand
// list, so this finds the board itself: it tries the company's likely board
// names against the public Greenhouse, Lever and Ashby APIs and records the
// first board that is really that company's on Company.atsToken. The nightly
// ATS feed then reads those boards along with the hand list (see
// getAtsCompanies) and applies the same fit gate to what it finds.

const PROBE_TIMEOUT_MS = 5000
/** A company with no board is looked for again after this long, not every run. */
const RECHECK_AFTER_MS = 30 * 86_400_000
const PROVIDERS: AtsProvider[] = ['greenhouse', 'lever', 'ashby']

async function getJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) })
    return res.ok ? await res.json() : null
  } catch {
    return null
  }
}

/** Whether `token` is a live board on `provider`, and the name the board gives itself if it has one. */
export const probeBoard: BoardProbe = async (provider, token) => {
  switch (provider) {
    case 'greenhouse': {
      // The board record carries the company's own name; the jobs list does not.
      const board = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${token}`)) as { name?: string } | null
      if (!board?.name) return null
      const jobs = (await getJson(`https://boards-api.greenhouse.io/v1/boards/${token}/jobs`)) as { jobs?: unknown[] } | null
      return { jobs: jobs?.jobs?.length ?? 0, boardName: board.name }
    }
    case 'lever': {
      const jobs = await getJson(`https://api.lever.co/v0/postings/${token}?mode=json`)
      return Array.isArray(jobs) ? { jobs: jobs.length, boardName: null } : null
    }
    case 'ashby': {
      const data = (await getJson(`https://api.ashbyhq.com/posting-api/job-board/${token}`)) as { jobs?: unknown[] } | null
      return data?.jobs ? { jobs: data.jobs.length, boardName: null } : null
    }
    default:
      return null
  }
}

export interface FoundBoard { provider: AtsProvider; token: string }

/**
 * The board for one company name, or null. Greenhouse is checked against the
 * name on the board itself; Lever and Ashby give no name, so only a board
 * named for the whole company is accepted there, never a guess at a first word.
 */
export async function findAtsBoard(companyName: string, probe: BoardProbe = probeBoard): Promise<FoundBoard | null> {
  const want = normalizeOrgName(companyName)
  for (const token of slugCandidates(companyName)) {
    for (const provider of PROVIDERS) {
      const hit = await probe(provider, token)
      if (!hit || hit.jobs === 0) continue
      if (hit.boardName && normalizeOrgName(hit.boardName) !== want) continue
      return { provider, token }
    }
  }
  return null
}

export interface AtsDiscoveryResult { checked: number; found: { company: string; provider: string; token: string }[] }

/**
 * Looks for the job board of each named company that has none recorded and
 * was not looked for recently. Never throws; one company failing does not
 * stop the rest. Companies already on the hand list are skipped.
 */
export async function discoverAtsBoards(companyIds: string[], limit = 15): Promise<AtsDiscoveryResult> {
  const result: AtsDiscoveryResult = { checked: 0, found: [] }
  if (companyIds.length === 0) return result
  const handListed = new Set(ATS_COMPANIES.map((c) => normalizeOrgName(c.name)))
  const stale = new Date(Date.now() - RECHECK_AFTER_MS)
  const companies = await prisma.company.findMany({
    where: {
      id: { in: companyIds }, atsToken: null,
      OR: [{ atsCheckedAt: null }, { atsCheckedAt: { lt: stale } }],
    },
    select: { id: true, name: true, canonicalNameNormalized: true },
    take: limit,
  })
  for (const c of companies) {
    if (handListed.has(c.canonicalNameNormalized)) continue
    result.checked++
    try {
      const board = await findAtsBoard(c.name)
      await prisma.company.update({
        where: { id: c.id },
        data: board
          ? { atsToken: board.token, atsCheckedAt: new Date(), atsPlatform: board.provider[0].toUpperCase() + board.provider.slice(1) }
          : { atsCheckedAt: new Date() },
      })
      if (board) {
        result.found.push({ company: c.name, ...board })
        captureServerEvent('cron', 'ats_board_found', { companyId: c.id, company: c.name, provider: board.provider, token: board.token })
      }
    } catch (e) {
      console.error('ATS board discovery failed for', c.name, e)
    }
  }
  return result
}

/** The hand-picked boards plus every board discovery has found. */
export async function getAtsCompanies(): Promise<AtsCompany[]> {
  const known = new Set(ATS_COMPANIES.map((c) => normalizeOrgName(c.name)))
  const found = await prisma.company.findMany({
    where: { atsToken: { not: null } }, select: { name: true, canonicalNameNormalized: true, atsPlatform: true, atsToken: true },
  })
  const discovered: AtsCompany[] = []
  for (const c of found) {
    const provider = c.atsPlatform?.toLowerCase() as AtsProvider | undefined
    if (!c.atsToken || !provider || !PROVIDERS.includes(provider) || known.has(c.canonicalNameNormalized)) continue
    discovered.push({ name: c.name, provider, token: c.atsToken })
  }
  return [...ATS_COMPANIES, ...discovered]
}
