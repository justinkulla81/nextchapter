import 'server-only'
import { prisma } from '@/lib/prisma'
import { extractBids, procurementLinkCandidates, type ParsedBid } from './parse'
import { PoliteFetcher } from './polite-fetch'

// Weekly: read each workforce board's own procurement / RFP page and record the bids on it.
// No AI, no paid API — plain page reads, one request at a time (see polite-fetch.ts). Boards are
// taken stalest-first and the run stops at its own deadline, so ~560 boards fill in over a few
// nightly runs and each is re-read about once a week. Boards with no known procurement page get one
// light discovery pass (home page, then its best three procurement-looking links) per month.
const RECHECK_MS = 6.5 * 86_400_000
const DISCOVER_MS = 30 * 86_400_000
/**
 * Boards whose real procurement page is not on the website the directory stores for them. KY-243's stored site
 * is the BRADD fiscal agent; the South Central Workforce Development Board posts its RFPs on its own site.
 */
export const EXTRA_BID_PAGES: Record<string, string[]> = {
  'KY-243': ['https://southcentralworkforce.com/request-for-proposals'],
}

const SOLICITATION_KINDS = ['solicitations', 'procurement_page']

export interface BoardCrawlResult {
  considered: number
  read: number
  withBids: number
  newBids: number
  noPage: number
  unreachable: number
  blocked: number
  robots: number
  requests: number
  stoppedEarly: boolean
  newBidList: { board: string; state: string; title: string; deadline: string | null; url: string }[]
}

async function readBoard(f: PoliteFetcher, board: { id: string; website: string | null; procurementUrl: string | null }, now: Date) {
  let pageUrl = board.procurementUrl
  let bids: ParsedBid[] = []
  let outcome: 'ok' | 'no_page' | 'unreachable' | 'blocked' | 'robots' = 'ok'
  let discovered: string | null = null

  const tryPage = async (url: string) => {
    const r = await f.get(url)
    if (!r.ok) return r
    return { ok: true as const, url: r.url, bids: extractBids(r.html, r.url, board.id, now), html: r.html }
  }

  const pages = [pageUrl, ...(EXTRA_BID_PAGES[board.id] ?? [])].filter((u): u is string => !!u)
  let anyOk = false
  for (const url of pages) {
    const r = await tryPage(url)
    if (r.ok) {
      anyOk = true
      const seen = new Set(bids.map((b) => b.id))
      bids = [...bids, ...r.bids.filter((b) => !seen.has(b.id))]
    } else if (!anyOk) outcome = r.reason === 'blocked' ? 'blocked' : r.reason === 'robots' ? 'robots' : 'unreachable'
  }
  if (anyOk) outcome = 'ok'
  if (pages.length === 0 && board.website) {
    const site = board.website.startsWith('http') ? board.website : `https://${board.website}`
    const home = await f.get(site)
    if (!home.ok) outcome = home.reason === 'blocked' ? 'blocked' : home.reason === 'robots' ? 'robots' : 'unreachable'
    else {
      outcome = 'no_page'
      for (const cand of procurementLinkCandidates(home.html, home.url)) {
        const r = await tryPage(cand)
        if (!r.ok) { if (r.reason === 'blocked') { outcome = 'blocked'; break } continue }
        if (r.bids.length > 0 || /procure|rfp|bid|solicit/i.test(cand)) { pageUrl = r.url; bids = r.bids; discovered = r.url; outcome = 'ok'; break }
      }
    }
  }
  return { pageUrl, bids, outcome, discovered }
}

export async function crawlBoardBids(opts: { limit?: number; deadlineMs?: number; dryRun?: boolean; boardIds?: string[]; force?: boolean } = {}): Promise<BoardCrawlResult> {
  const started = Date.now()
  const now = new Date()
  const f = new PoliteFetcher()
  const res: BoardCrawlResult = { considered: 0, read: 0, withBids: 0, newBids: 0, noPage: 0, unreachable: 0, blocked: 0, robots: 0, requests: 0, stoppedEarly: false, newBidList: [] }

  const boards = await prisma.workforceBoard.findMany({
    where: opts.boardIds ? { id: { in: opts.boardIds } } : { website: { not: null } },
    select: { id: true, name: true, state: true, website: true, procurementUrl: true },
  })
  const checks = new Map((await prisma.boardBidCheck.findMany()).map((c) => [c.boardId, c]))

  const due = boards
    .filter((b) => {
      if (opts.force) return true
      const c = checks.get(b.id)
      if (!c) return true
      const age = now.getTime() - c.checkedAt.getTime()
      return age > (b.procurementUrl ? RECHECK_MS : DISCOVER_MS)
    })
    // Known procurement pages first (they can hold bids), never-read before stale.
    .sort((a, b) => Number(!!b.procurementUrl) - Number(!!a.procurementUrl) || (checks.get(a.id)?.checkedAt.getTime() ?? 0) - (checks.get(b.id)?.checkedAt.getTime() ?? 0))
  res.considered = due.length

  for (const board of due.slice(0, opts.limit ?? due.length)) {
    if (opts.deadlineMs && Date.now() - started > opts.deadlineMs) { res.stoppedEarly = true; break }
    const r = await readBoard(f, board, now)
    res.read++
    if (r.outcome === 'no_page') res.noPage++
    else if (r.outcome === 'unreachable') res.unreachable++
    else if (r.outcome === 'blocked') res.blocked++
    else if (r.outcome === 'robots') res.robots++
    if (r.bids.length > 0) res.withBids++
    if (opts.dryRun) {
      for (const b of r.bids.filter((x) => x.status === 'OPEN')) res.newBidList.push({ board: board.name, state: board.state, title: b.title, deadline: b.deadline?.toISOString().slice(0, 10) ?? null, url: b.url })
      continue
    }

    const existing = new Map((await prisma.boardBid.findMany({ where: { boardId: board.id }, select: { id: true } })).map((e) => [e.id, true]))
    for (const b of r.bids) {
      const isNew = !existing.has(b.id)
      await prisma.boardBid.upsert({
        where: { id: b.id },
        create: { id: b.id, boardId: board.id, title: b.title, url: b.url, pageUrl: r.pageUrl ?? b.url, deadline: b.deadline, deadlineText: b.deadlineText, status: b.status },
        update: { title: b.title, url: b.url, pageUrl: r.pageUrl ?? b.url, deadline: b.deadline, deadlineText: b.deadlineText, status: b.status, lastSeenAt: now },
      })
      if (isNew) {
        res.newBids++
        if (b.status === 'OPEN') res.newBidList.push({ board: board.name, state: board.state, title: b.title, deadline: b.deadline?.toISOString().slice(0, 10) ?? null, url: b.url })
      }
    }
    // A bid that was on the page last time and is not now has been taken down.
    if (r.outcome === 'ok') {
      const seen = r.bids.map((b) => b.id)
      await prisma.boardBid.updateMany({ where: { boardId: board.id, status: 'OPEN', id: { notIn: seen } }, data: { status: 'GONE' } })
    }
    await prisma.boardBidCheck.upsert({
      where: { boardId: board.id },
      create: { boardId: board.id, outcome: r.outcome, bidsFound: r.bids.length },
      update: { checkedAt: now, outcome: r.outcome, bidsFound: r.bids.length },
    })
    if (r.discovered) {
      await prisma.workforceBoard.update({ where: { id: board.id }, data: { procurementUrl: r.discovered, procurementKind: r.bids.length ? 'solicitations' : 'procurement_page' } })
    } else if (r.outcome === 'ok' && board.procurementUrl) {
      await prisma.workforceBoard.update({
        where: { id: board.id },
        data: { procurementKind: r.bids.length ? SOLICITATION_KINDS[0] : SOLICITATION_KINDS[1], procurementItems: r.bids.filter((b) => b.status === 'OPEN').slice(0, 6).map((b) => ({ title: b.title, date: b.deadlineText })), procurementCheckedAt: now },
      })
    }
  }
  res.requests = f.requests
  return res
}
