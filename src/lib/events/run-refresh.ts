import 'server-only'
import { prisma } from '@/lib/prisma'
import { seedCatalogIfStale } from './store'
import { classifyHttp, extractDateRanges, HIDE_AFTER_FAILURES, pickNewDates, visibleText, type LinkStatus } from './refresh'

// Daily and free: no paid API, no model. Fetches a rotating slice of published event pages (oldest check first).
const PER_RUN = 150
const HOST_WORKERS = 8
const TIMEOUT_MS = 12_000

async function fetchPage(url: string): Promise<{ status: number | null; html: string }> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; NextChapterEventCheck/1.0; +https://launchyournextchapter.com)', accept: 'text/html,*/*' },
    })
    const type = res.headers.get('content-type') ?? ''
    return { status: res.status, html: res.ok && type.includes('html') ? (await res.text()).slice(0, 600_000) : '' }
  } catch {
    return { status: null, html: '' }
  }
}

export async function runEventsRefresh(now = new Date(), opts: { limit?: number } = {}) {
  // Load or update the bundled catalog without waiting for someone to open the CRM tab (locked rows are never overwritten).
  const seeded = await seedCatalogIfStale().catch((e) => { console.error('Events catalog seed failed', e); return -1 })
  // 1. Finished editions: keep the usual month, clear the dates, so nothing finished shows as upcoming.
  const rolled = await prisma.$executeRaw`
    UPDATE "ConferenceEvent"
       SET "typicalMonth" = COALESCE("typicalMonth", trim(to_char("startDate", 'FMMonth'))),
           "startDate" = NULL, "endDate" = NULL, "datesConfirmed" = false
     WHERE "startDate" IS NOT NULL AND COALESCE("endDate", "startDate") < ${new Date(now.getTime() - 86_400_000)}`

  // 2. Link check on a rotation.
  const rows = await prisma.$queryRaw<{ id: string; url: string; datesConfirmed: boolean; startDate: Date | null; linkFailures: number }[]>`
    SELECT "id", "url", "datesConfirmed", "startDate", "linkFailures" FROM "ConferenceEvent"
     WHERE "published" = true AND "url" IS NOT NULL
     ORDER BY "linkCheckedAt" ASC NULLS FIRST LIMIT ${opts.limit ?? PER_RUN}`
  const byHost = new Map<string, typeof rows>()
  for (const r of rows) {
    let host = ''
    try { host = new URL(r.url).host } catch { /* bad url: checked as its own group below */ }
    byHost.set(host || r.id, [...(byHost.get(host || r.id) ?? []), r])
  }
  const tally: Record<LinkStatus, number> = { OK: 0, BROKEN: 0, BLOCKED: 0, ERROR: 0 }
  let newDates = 0
  let hidden = 0
  const hostQueue = [...byHost.values()]

  async function checkHost(list: typeof rows) {
    for (const r of list) {
      const { status, html } = await fetchPage(r.url)
      const link = classifyHttp(status)
      tally[link]++
      const failures = link === 'BROKEN' || link === 'ERROR' ? r.linkFailures + 1 : link === 'OK' ? 0 : r.linkFailures
      await prisma.$executeRaw`UPDATE "ConferenceEvent" SET "linkStatus" = ${link}, "linkCheckedAt" = ${now}, "linkFailures" = ${failures} WHERE "id" = ${r.id}`
      if (link === 'BROKEN' && failures >= HIDE_AFTER_FAILURES) {
        await prisma.$executeRaw`UPDATE "ConferenceEvent" SET "published" = false, "adminNote" = 'JUMP BALL: the link has been dead on 3 checks; hidden automatically. Confirm the event still exists.' WHERE "id" = ${r.id}`
        hidden++
      }
      // 3. New dates: only when we hold none and the page names exactly one future range.
      const holdsDates = r.datesConfirmed && r.startDate && r.startDate >= now
      if (link === 'OK' && html && !holdsDates) {
        const pick = pickNewDates(extractDateRanges(visibleText(html), now))
        if (pick) {
          await prisma.$executeRaw`
            UPDATE "ConferenceEvent" SET "startDate" = ${new Date(pick.start)}, "endDate" = ${new Date(pick.end)}, "datesConfirmed" = true,
              "checkedAt" = ${now}, "typicalMonth" = COALESCE("typicalMonth", trim(to_char(${new Date(pick.start)}::timestamp, 'FMMonth')))
            WHERE "id" = ${r.id} AND "locked" = false`
          newDates++
        }
      }
      await new Promise((res) => setTimeout(res, 400))
    }
  }
  await Promise.all(Array.from({ length: HOST_WORKERS }, async () => { for (let l = hostQueue.shift(); l; l = hostQueue.shift()) await checkHost(l) }))
  return { seeded, rolled, checked: rows.length, ...tally, newDates, hidden }
}
