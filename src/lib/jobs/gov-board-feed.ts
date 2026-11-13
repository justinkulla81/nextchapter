import 'server-only'
import { prisma } from '@/lib/prisma'
import { linkPostingsToCompanies } from '@/lib/companies/posting-company'
import { boardRow, judge, THIRTY_DAYS_MS, type KeptJob } from '@/lib/jobs/gov-feed-core'
import type { BoardAdapter, BoardPost } from '@/lib/jobs/gov-board-core'

// Weekly run for government employers that run their own job system (Workday, Oracle Recruiting Cloud ...), one adapter each.
//
// Each run lists every board, re-confirms board rows still listed, archives rows that left a board (only when that board's
// list was read to the end), and fetches the detail of new jobs whose titles fit, up to maxNewPerRun within a time budget,
// through the board's own import screen.
//
// Database reads per run: one range read per board by url prefix (id, url and archivedAt only) and company links for new
// jobs. Writes: re-confirmations in batches of 1,000, then the inserts.

export interface BoardFeedResult {
  boards: number
  boardsRead: number
  openJobs: number
  confirmed: number
  archived: number
  candidates: number
  fetched: number
  created: number
  skippedByScreen: number
  stoppedAtBudget: boolean
}

export async function runBoardFeed<B>(adapter: BoardAdapter<B>, opts: { listBudgetMs: number; totalBudgetMs: number; maxNew: number }): Promise<BoardFeedResult> {
  const started = Date.now()
  const now = new Date()
  const expiresAt = new Date(now.getTime() + THIRTY_DAYS_MS)
  const src = { addedBy: adapter.addedBy, sourceName: adapter.sourceName }
  const boards = adapter.boards
  const res: BoardFeedResult = { boards: boards.length, boardsRead: 0, openJobs: 0, confirmed: 0, archived: 0, candidates: 0, fetched: 0, created: 0, skippedByScreen: 0, stoppedAtBudget: false }

  const todo: { board: B; post: BoardPost }[] = []
  let nextBoard = 0
  const boardWorker = async () => {
    while (nextBoard < boards.length) {
      const board = boards[nextBoard++]
      const { posts, complete } = await adapter.list(board, started + opts.listBudgetMs)
      res.openJobs += posts.length
      if (!complete) continue
      res.boardsRead += 1
      const prefix = adapter.prefix(board)
      const existing = await prisma.exclusiveJobPosting.findMany({
        where: { url: { gte: prefix, lt: prefix + '￿' }, addedBy: adapter.addedBy },
        select: { id: true, url: true, archivedAt: true },
      })
      const listed = new Set(posts.map((p) => adapter.urlOf(board, p)))
      const known = new Set(existing.map((e) => e.url))
      const stay = existing.filter((e) => !e.archivedAt && listed.has(e.url)).map((e) => e.id)
      const gone = existing.filter((e) => !e.archivedAt && !listed.has(e.url)).map((e) => e.id)
      for (let i = 0; i < stay.length; i += 1000) {
        await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: stay.slice(i, i + 1000) } }, data: { expiresAt, lastConfirmedAt: now, lastVerifiedAt: now } })
      }
      for (let i = 0; i < gone.length; i += 1000) {
        await prisma.exclusiveJobPosting.updateMany({ where: { id: { in: gone.slice(i, i + 1000) } }, data: { archivedAt: now } })
      }
      res.confirmed += stay.length
      res.archived += gone.length
      for (const post of posts) if (!known.has(adapter.urlOf(board, post)) && adapter.worth(post.title)) todo.push({ board, post })
    }
  }
  await Promise.all(Array.from({ length: 4 }, boardWorker))

  const candidates = todo.slice(0, opts.maxNew)
  res.candidates = candidates.length
  const kept: KeptJob[] = []
  let next = 0
  const worker = async () => {
    while (next < candidates.length) {
      if (Date.now() - started > opts.totalBudgetMs) { res.stoppedAtBudget = true; return }
      const { board, post } = candidates[next++]
      const posting = await adapter.detail(board, post)
      if (!posting) continue
      res.fetched += 1
      const v = judge(posting, now)
      if (!v.keep) { res.skippedByScreen += 1; continue }
      kept.push({ url: adapter.urlOf(board, post), posting, level: v.level, location: v.location })
    }
  }
  await Promise.all(Array.from({ length: 6 }, worker))

  if (kept.length > 0) {
    const companyIds = await linkPostingsToCompanies(kept.map((k) => k.posting.employer))
    const result = await prisma.exclusiveJobPosting.createMany({
      skipDuplicates: true,
      data: kept.map((k) => ({ ...boardRow(k, src, now, expiresAt), companyId: companyIds.get(k.posting.employer) ?? null })),
    })
    res.created = result.count
  }
  return res
}
