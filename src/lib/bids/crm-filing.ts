import 'server-only'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { CrmOrgType } from '@prisma/client'
import { awardIsWorkforce, bidFitsUs } from './relevance'
import { bidNote, winNote } from './crm-core'
import { orgFor, recordWin } from '@/lib/vision/competitor-sync'
import { winsFromAwards } from '@/lib/vision/competitor-sync-core'

// Files what the bid finder reads into the CRM, so each bid and each competitor win sits on the right organization
// with its date, size and a link, and is reachable from both ends:
//   board bid        -> note + due date on the workforce board's organization
//   competitor win   -> note on the competitor's organization, note + re-bid date on the buyer (agency)
// Both ids are stored on the finder's own rows so the CRM pages can link across. Idempotent: every note is keyed by
// a sourceRef, so a re-run adds nothing twice.

async function orgByName(name: string): Promise<string | null> {
  const key = normalizeOrgName(name)
  if (!key) return null
  return (await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: key }, select: { id: true } }))?.id ?? null
}

/** The board's CRM organization: the one with its name, or a new GOVERNMENT one built from the board directory. */
export async function orgForBoard(board: { name: string; state: string; website: string | null }): Promise<string | null> {
  const found = await orgByName(board.name)
  if (found) return found
  const key = normalizeOrgName(board.name)
  if (!key) return null
  return (await prisma.crmOrganization.create({
    data: { name: board.name, canonicalNameNormalized: key, orgTypes: ['GOVERNMENT'], usState: board.state.length === 2 ? board.state : null, website: board.website, notes: 'Workforce board from the CareerOneStop directory (added by the bid finder).' },
    select: { id: true },
  })).id
}

const TYPE_BY_CATEGORY: Record<string, CrmOrgType> = {
  outplacement: 'OUTPLACEMENT_FIRM', coaching: 'COACHING_FIRM', nonprofit_providers: 'WORKFORCE_PROVIDER', workforce_gov: 'WORKFORCE_PROVIDER', retraining: 'WORKFORCE_PROVIDER',
  higher_ed: 'UNIVERSITY',
}

/** The competitor's CRM organization, found by the card's link or its name, else created and linked back to the card. */
export async function orgForCompetitor(name: string): Promise<string | null> {
  const card = await prisma.productCompetitor.findFirst({ where: { name }, select: { id: true, crmOrgId: true, category: true, url: true } })
  if (card?.crmOrgId) return card.crmOrgId
  let id = await orgByName(name)
  if (!id) {
    const key = normalizeOrgName(name)
    if (!key) return null
    id = (await prisma.crmOrganization.create({
      data: { name, canonicalNameNormalized: key, orgTypes: [TYPE_BY_CATEGORY[card?.category ?? ''] ?? 'VENDOR'], website: card?.url ?? null, notes: 'Competitor (added by the bid finder).' },
      select: { id: true },
    })).id
  }
  if (card && !card.crmOrgId) await prisma.productCompetitor.update({ where: { id: card.id }, data: { crmOrgId: id } })
  return id
}

export interface FileResult { filed: number; skipped: number; stoppedEarly: boolean }

/** Open bids that look like our work, as a note and a due date on the board's organization. */
export async function fileBidsToCrm(opts: { max?: number; deadlineMs?: number; now?: Date } = {}): Promise<FileResult> {
  const started = Date.now()
  const now = opts.now ?? new Date()
  const res: FileResult = { filed: 0, skipped: 0, stoppedEarly: false }
  const bids = await prisma.boardBid.findMany({
    where: { status: 'OPEN', filedAt: null, OR: [{ deadline: null }, { deadline: { gte: new Date(now.getTime() - 86_400_000) } }] },
    orderBy: { firstSeenAt: 'desc' }, take: 1000,
  })
  const boards = new Map((await prisma.workforceBoard.findMany({ where: { id: { in: [...new Set(bids.map((b) => b.boardId))] } }, select: { id: true, name: true, state: true, website: true } })).map((b) => [b.id, b]))
  for (const b of bids) {
    if (res.filed >= (opts.max ?? 150)) break
    if (opts.deadlineMs && Date.now() - started > opts.deadlineMs) { res.stoppedEarly = true; break }
    if (!bidFitsUs(b.title)) { res.skipped++; continue }
    const board = boards.get(b.boardId)
    if (!board) continue
    const orgId = await orgForBoard(board)
    if (!orgId) continue
    const ref = `board-bid:${b.id}`
    const dup = await prisma.crmActivity.findFirst({ where: { sourceRef: ref }, select: { id: true } })
    if (!dup) {
      const n = bidNote({ title: b.title, boardName: board.name, state: board.state, deadline: b.deadline, url: b.url, pageUrl: b.pageUrl })
      await prisma.crmActivity.create({ data: { type: 'NOTE', direction: 'INBOUND', occurredAt: b.firstSeenAt, orgId, subject: n.subject, body: n.body, isAutoLogged: true, sourceRef: ref } })
      if (b.deadline && b.deadline.getTime() > now.getTime()) {
        const label = `Bid due: ${b.title}`.slice(0, 200)
        if (!(await prisma.crmDeadline.findFirst({ where: { orgId, label }, select: { id: true } }))) {
          await prisma.crmDeadline.create({ data: { orgId, label, kind: 'APPLICATION_CLOSE', dueAt: b.deadline, sourceUrl: b.url, rawText: b.deadlineText } })
        }
      }
    }
    await prisma.boardBid.update({ where: { id: b.id }, data: { orgId, filedAt: now } })
    res.filed++
  }
  return res
}

/** Confident competitor wins: a note on the competitor, and the buyer's note and re-bid date. */
export async function fileAwardsToCrm(opts: { max?: number; deadlineMs?: number; now?: Date } = {}): Promise<FileResult> {
  const started = Date.now()
  const now = opts.now ?? new Date()
  const res: FileResult = { filed: 0, skipped: 0, stoppedEarly: false }
  const awards = await prisma.competitorAward.findMany({ where: { confidence: 'EXACT', filedAt: null }, orderBy: { amount: 'desc' }, take: 1000 })
  const compOrg = new Map<string, string | null>()
  for (const a of awards) {
    if (res.filed >= (opts.max ?? 150)) break
    if (opts.deadlineMs && Date.now() - started > opts.deadlineMs) { res.stoppedEarly = true; break }
    if (!compOrg.has(a.competitorName)) compOrg.set(a.competitorName, await orgForCompetitor(a.competitorName))
    const competitorOrgId = compOrg.get(a.competitorName)
    if (!competitorOrgId) { res.skipped++; continue }

    const buyerName = (a.subAgency && a.subAgency.length < 80 ? a.subAgency : a.agency)?.trim() ?? null
    const kind = a.kind === 'GRANT' ? 'GRANT' : 'CONTRACT'
    const n = winNote({ competitor: a.competitorName, buyer: buyerName ?? 'unknown', kind, description: a.description, amount: a.amount, startDate: a.startDate, endDate: a.endDate, url: a.url }, now)
    const ref = `competitor-win-on-org:${a.awardKey}:${competitorOrgId}`
    if (!(await prisma.crmActivity.findFirst({ where: { sourceRef: ref }, select: { id: true } }))) {
      await prisma.crmActivity.create({ data: { type: 'NOTE', direction: 'INBOUND', occurredAt: a.startDate && a.startDate.getTime() <= now.getTime() ? a.startDate : now, orgId: competitorOrgId, subject: n.subject, body: n.body, isAutoLogged: true, sourceRef: ref } })
    }
    // The buyer's side uses the competitor-sync writer (same note key and re-bid date rule), so neither path doubles it.
    let buyerOrgId: string | null = null
    // Only workforce-relevant awards reach the buyer's organization: a competitor's contract with the FBI is not a lead for us
    // (the notes for such awards were cleaned out of the CRM on 2026-10-26, so they must not be written again).
    if (awardIsWorkforce(a)) {
      for (const w of winsFromAwards(a.competitorName, [{ awardKey: a.awardKey, description: a.description, agency: a.agency, subAgency: a.subAgency, amount: a.amount, startDate: a.startDate, endDate: a.endDate, url: a.url }], now)) {
        await recordWin(w, true, now)
        buyerOrgId = await orgFor(w.buyer, true)
      }
    }
    await prisma.competitorAward.update({ where: { id: a.id }, data: { competitorOrgId, buyerOrgId, filedAt: now } })
    res.filed++
  }
  return res
}
