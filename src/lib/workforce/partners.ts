import 'server-only'
import * as cheerio from 'cheerio'
import { prisma } from '@/lib/prisma'
import { areaPlaces, cityFromAddress, placeKey } from './places'
import { countyForCity, incorporatedPlaceAt, pickBoard } from './match'

const AJC = 'https://www.careeronestop.org/LocalHelp/AmericanJobCenters'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export interface JobCenter {
  centerId: string
  name: string
  kind: string | null
  address: string | null
  city: string | null
  state: string | null
  phone: string | null
  email: string | null
  businessEmail: string | null
  hours: string | null
  distanceMiles: number | null
  detailsUrl: string | null
}

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim() || null
const firstEmail = (s: string | undefined) => s?.split(',').map((e) => e.trim()).find((e) => e.includes('@')) ?? null

/** The job centers on one page of CareerOneStop's finder. */
export function parseJobCenters(html: string): JobCenter[] {
  const $ = cheerio.load(html)
  const out: JobCenter[] = []
  $('#AJCTable tbody tr').each((_, tr) => {
    const cells = $(tr).children('td')
    const link = cells.eq(0).find('a[href*="centerID="]').first()
    const name = clean(link.text())
    const href = link.attr('href') ?? ''
    const centerId = href.match(/centerID=(\d+)/)?.[1]
    if (!name || !centerId) return
    const box = cells.eq(0).find('input.EmailCheckbox').first()
    const addressLines = (cells.eq(1).find('span.notranslate').first().html() ?? '')
      .split(/<\/?br\s*\/?>/i).map((l) => clean(cheerio.load(l).text())).filter((l): l is string => !!l)
    const last = addressLines.at(-1) ?? ''
    const place = last.match(/^(.*?),\s*([A-Z]{2})\s+\d{5}/)
    const info = cells.eq(2).text()
    out.push({
      centerId,
      name,
      kind: clean(cells.eq(0).children('span.notranslate').first().text()),
      address: addressLines.join(', ') || null,
      city: place?.[1]?.trim() ?? null,
      state: place?.[2] ?? null,
      phone: clean(cells.eq(2).find('a[href^="tel:"]').first().text()),
      email: firstEmail(box.attr('data-generalemail')),
      businessEmail: firstEmail(box.attr('data-busemail')),
      hours: clean(info.match(/Hours:\s*([^\n]*?)(?:Business Rep:|Veterans Rep:|Youth Services|Last Updated:|$)/)?.[1]),
      distanceMiles: Number(cells.eq(1).text().match(/Distance:\s*([\d.]+)/)?.[1]) || null,
      detailsUrl: href ? `https://www.careeronestop.org${href.startsWith('/') ? '' : '/'}${href.replace(/^https?:\/\/[^/]+/, '')}` : null,
    })
  })
  return out
}

type BoardRef = { id: string; name: string; state: string; zip: string | null; counties: string[]; serviceArea: string | null; statewide: boolean }

/**
 * Each board's American Job Centers: the centers near its office that sit in
 * its own area (a center's city is placed by county, then given to the
 * board that serves that county). A board whose centers cannot be placed
 * keeps the three nearest, so it is never shown with none.
 */
export async function syncBoardPartners(budgetMs = 60_000): Promise<{ boards: number; centers: number; stopped?: string }> {
  const started = Date.now()
  const all = await prisma.workforceBoard.findMany({
    select: { id: true, name: true, state: true, zip: true, counties: true, serviceArea: true, statewide: true, partnersCheckedAt: true },
    orderBy: { partnersCheckedAt: { sort: 'asc', nulls: 'first' } },
  })
  const byState = new Map<string, BoardRef[]>()
  for (const b of all) byState.set(b.state, [...(byState.get(b.state) ?? []), b])
  const cache = new Map<string, string | null>()
  // Neighbouring boards' searches return many of the same centers.
  const legalCache = new Map<string, string | null>()
  let boards = 0
  let centers = 0
  for (const board of all) {
    if (Date.now() - started > budgetMs) break
    const stateBoards = byState.get(board.state) ?? []
    // A state board above local ones has no centers of its own.
    if (board.statewide && stateBoards.some((b) => !b.statewide)) {
      await prisma.workforceBoard.update({ where: { id: board.id }, data: { partnersCheckedAt: new Date() } })
      continue
    }
    const url = `${AJC}/find-american-job-centers.aspx?location=${encodeURIComponent(board.zip ?? board.state)}&radius=50&sortcolumns=Distance&sortdirections=ASC&curPage=1&pagesize=100`
    const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': UA } }).catch(() => null)
    const html = res?.ok ? await res.text() : ''
    // CareerOneStop answers with an empty page once it starts turning requests away.
    if (!html.includes('AJCTable') && !/no (results|centers)/i.test(html)) return { boards, centers, stopped: board.id }
    const found = parseJobCenters(html)
    const local = stateBoards.filter((b) => !b.statewide)
    const candidates = local.length ? local : stateBoards
    const mine: JobCenter[] = []
    for (const c of found) {
      if (c.state !== board.state || !c.city) continue
      const key = `${c.state}|${c.city.toLowerCase()}`
      if (!cache.has(key)) cache.set(key, await countyForCity(cityFromAddress(c.city, c.state) ?? c.city, c.state).catch(() => null))
      // A mailing city that names a city's own board is checked against the
      // city limits before the center is given to that board.
      let city: string | null = c.city
      const namesCityBoard = candidates.some((b) => areaPlaces(b.serviceArea).includes(placeKey(c.city!)))
      if (namesCityBoard && c.address) {
        if (!legalCache.has(c.address)) legalCache.set(c.address, await incorporatedPlaceAt(c.address).catch(() => null))
        const legal = legalCache.get(c.address) ?? null
        if (legal !== null) city = legal || null
      }
      if (pickBoard(candidates, cache.get(key) ?? null, city)?.id === board.id) mine.push(c)
    }
    const keep = mine.length ? mine : found.filter((c) => c.state === board.state).slice(0, 3)
    await prisma.$transaction([
      prisma.workforceBoardPartner.deleteMany({ where: { boardId: board.id } }),
      prisma.workforceBoardPartner.createMany({
        data: keep.map((c) => ({
          id: `${board.id}-${c.centerId}`, boardId: board.id, name: c.name, kind: c.kind, address: c.address,
          phone: c.phone, email: c.email, businessEmail: c.businessEmail, hours: c.hours,
          website: c.detailsUrl, distanceMiles: c.distanceMiles,
        })),
        skipDuplicates: true,
      }),
      prisma.workforceBoard.update({ where: { id: board.id }, data: { partnersCheckedAt: new Date() } }),
    ])
    boards++
    centers += keep.length
  }
  return { boards, centers }
}
