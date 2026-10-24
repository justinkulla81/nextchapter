import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { extractDateRanges, pickNewDates } from '@/lib/events/refresh'
import { diffAgainstCatalog, type PendingChange, type SeenOpportunity } from './changes'
import { extractWithModel, fetchPublicPage } from './extract'
import { rollEditions } from './editions'

// Weekly. 1) roll finished editions to next year as "Dates TBA", 2) re-read each followed series' page.
// Cost: the page fetch and date reading are free. A model call happens only when a page's text changed since last week
// AND we already had a baseline for it (the first visit only records the baseline), capped per run.
const PER_RUN = 150
const MODEL_CAP_PER_RUN = 40
const DAY = 86_400_000

export async function runConferenceRecheck(now = new Date(), opts: { limit?: number; modelCap?: number } = {}) {
  const rolled = await rollEditions(now)
  const followed = await prisma.userConference.findMany({ distinct: ['seriesId'], select: { seriesId: true } })
  const followedIds = new Set(followed.map((f) => f.seriesId))
  const rows = await prisma.conferenceEvent.findMany({
    where: { url: { not: null }, OR: [{ published: true }, { id: { in: [...followedIds] } }], linkStatus: { not: 'BROKEN' } },
    orderBy: [{ recheckedAt: { sort: 'asc', nulls: 'first' } }],
    take: opts.limit ?? PER_RUN,
    include: { opportunities: { select: { type: true, url: true, deadline: true, title: true } } },
  })
  // One request at a time per host.
  const byHost = new Map<string, typeof rows>()
  for (const r of rows) {
    let host = r.id
    try { host = new URL(r.url!).host } catch { /* own group */ }
    byHost.set(host, [...(byHost.get(host) ?? []), r])
  }
  const stats = { checked: 0, unchanged: 0, baselined: 0, changed: 0, modelCalls: 0, flagged: 0, rolled }
  let modelLeft = opts.modelCap ?? MODEL_CAP_PER_RUN

  await Promise.all([...byHost.values()].map(async (group) => {
    for (const s of group) {
      const page = await fetchPublicPage(s.url!)
      if (!page) { await prisma.conferenceEvent.update({ where: { id: s.id }, data: { recheckedAt: now } }); continue }
      stats.checked++
      if (s.contentHash === page.hash) { stats.unchanged++; await prisma.conferenceEvent.update({ where: { id: s.id }, data: { recheckedAt: now } }); continue }
      if (!s.contentHash) { stats.baselined++; await prisma.conferenceEvent.update({ where: { id: s.id }, data: { contentHash: page.hash, recheckedAt: now } }); continue }
      stats.changed++
      const dates = pickNewDates(extractDateRanges(page.text, now))
      let opportunities: SeenOpportunity[] = []
      if (modelLeft > 0) {
        modelLeft--; stats.modelCalls++
        const r = await extractWithModel(page)
        if (r) opportunities = r.extraction.opportunities
      }
      const changes = diffAgainstCatalog(
        { dates, opportunities },
        { startDate: s.startDate, endDate: s.endDate, datesConfirmed: s.datesConfirmed, opportunities: s.opportunities },
      )
      stats.flagged += await flag(s.id, changes, now)
      await prisma.conferenceEvent.update({ where: { id: s.id }, data: { contentHash: page.hash, recheckedAt: now } })
    }
  }))
  return stats
}

/** Store changes as pending, skipping any identical to one already waiting or dismissed in the last 60 days. */
async function flag(seriesId: string, changes: PendingChange[], now: Date): Promise<number> {
  if (changes.length === 0) return 0
  const recent = await prisma.conferenceChange.findMany({ where: { seriesId, createdAt: { gt: new Date(now.getTime() - 60 * DAY) } }, select: { kind: true, payload: true } })
  const seen = new Set(recent.map((r) => r.kind + JSON.stringify(r.payload)))
  let n = 0
  for (const c of changes) {
    const { kind, ...payload } = c
    if (seen.has(kind + JSON.stringify(payload))) continue
    await prisma.conferenceChange.create({ data: { seriesId, kind, payload: payload as Prisma.InputJsonValue } })
    n++
  }
  return n
}
