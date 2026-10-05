import 'server-only'
import * as cheerio from 'cheerio'
import { prisma } from '@/lib/prisma'
import { countyKey, STATE_NAMES } from './places'

const BASE = 'https://www.careeronestop.org/LocalHelp/WorkforceDevelopment'
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36'

export { STATE_NAMES } from './places'

async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': UA } })
  if (!res.ok) throw new Error(`CareerOneStop returned ${res.status}`)
  return res.text()
}

export interface BoardDetails {
  id: string; name: string; address: string | null; zip: string | null; website: string | null
  serviceArea: string | null; counties: string[]
  directorName: string | null; directorTitle: string | null; directorEmail: string | null; directorPhone: string | null
  chairName: string | null; chairEmail: string | null; chairPhone: string | null
}

const PLACE_PREFIX = /^(cities|city|towns?|townships?|municipalities|boroughs?):/i

const clean = (s: string | null | undefined) => (s ?? '').replace(/\s+/g, ' ').trim() || null

/** A cell's text with each <br> kept as a line break. */
function brLines(el: { html(): string | null }): string[] {
  const html = el.html() ?? ''
  return html.split(/<br\s*\/?>/i).map((part) => clean(cheerio.load(part).text())).filter((l): l is string => !!l)
}

/**
 * One board's page. The board block (#tblWdbYc) holds the name, address,
 * website and service area; the "WDB Contact Information" table holds one
 * row per role: a bold title, the person, then Email and Phone links.
 */
export function parseBoardDetails(id: string, html: string): BoardDetails | null {
  const $ = cheerio.load(html)
  const board = $('#tblWdbYc')
  if (!board.length) return null
  const cells = board.find('tr').first().find('td')
  const name = clean(cells.eq(0).text())
  if (!name) return null
  const addressLines = brLines(cells.eq(1).find('span.notranslate').first())
  const address = addressLines.join(', ') || null
  const zip = addressLines.at(-1)?.match(/\b(\d{5})(?:-\d{4})?\s*$/)?.[1] ?? null
  const website = board.find('.wrapurl a[href^="http"]').first().attr('href') ?? null

  // "Service Area:" is counties, or places where a state draws its areas by
  // town (Massachusetts: "Towns: Abington, Avon, …"), or both — a county
  // line then a "City:" line for a board that serves one city inside it.
  const areaCell = board.find('td').filter((_, td) => $(td).text().includes('Service Area:')).first()
  const areaLines = brLines(areaCell.find('span.notranslate').first())
  const isPlaces = (l: string) => PLACE_PREFIX.test(l)
  const countyLines = areaLines.filter((l) => !isPlaces(l)).map((l) => l.replace(/^(counties|county|parishes|parish):\s*/i, ''))
  const placeLines = areaLines.filter(isPlaces).map((l) => l.replace(/:\s+/, ': '))
  const serviceArea = [countyLines.join(', '), ...placeLines].filter(Boolean).join('; ') || null

  type Contact = { title: string; name: string | null; email: string | null; phone: string | null }
  const contacts: Contact[] = []
  const table = $('th').filter((_, th) => clean($(th).text()) === 'WDB Contact Information').first().closest('table')
  table.find('tbody > tr').each((_, tr) => {
    const td = $(tr).children('td').first()
    const title = clean(td.children('b').first().text())
    if (!title) return
    contacts.push({
      title,
      name: clean(td.children('span.notranslate').first().text()),
      email: td.find('a[href^="mailto:"]').first().attr('href')?.replace(/^mailto:/i, '').trim() || null,
      phone: clean(td.find('a[href^="tel:"]').first().text()),
    })
  })
  const isChair = (c: Contact) => /chair/i.test(c.title) && !/vice/i.test(c.title)
  const director = contacts.find((c) => !/chair/i.test(c.title)) ?? null
  const chair = contacts.find(isChair) ?? null

  return {
    id, name, address, zip, website,
    serviceArea,
    counties: countyLines.flatMap((l) => l.split(',')).map((c) => countyKey(c)).filter(Boolean),
    directorName: director?.name ?? null, directorTitle: director?.title ?? null,
    directorEmail: director?.email ?? null, directorPhone: director?.phone ?? null,
    chairName: chair?.name ?? null, chairEmail: chair?.email ?? null, chairPhone: chair?.phone ?? null,
  }
}

/** Every board in one state, with each board's own page read for its contacts. */
export async function syncBoardsForState(state: string): Promise<number> {
  const list = await getHtml(`${BASE}/find-workforce-development-boards.aspx?location=${state}&curPage=1&pagesize=500`)
  const ids = [...new Set([...list.matchAll(/find-workforce-development-boards-details\.aspx\?[^"]*?id=([A-Za-z0-9]+)/g)].map((m) => m[1]))]
  // Every state has at least one board; an empty list means CareerOneStop
  // has started turning requests away, which it does after a few hundred.
  if (ids.length === 0) throw new Error(`No boards listed for ${state} — CareerOneStop may be throttling`)
  const stateName = STATE_NAMES[state]
  let saved = 0
  for (const id of ids) {
    const detailsUrl = `${BASE}/find-workforce-development-boards-details.aspx?location=${state}&id=${id}`
    try {
      const b = parseBoardDetails(id, await getHtml(detailsUrl))
      if (!b) continue
      const statewide = !!stateName && (b.serviceArea ?? '').trim().toLowerCase() === stateName.toLowerCase()
      const data = { ...b, state, statewide, detailsUrl, updatedAt: new Date() }
      await prisma.workforceBoard.upsert({ where: { id: `${state}-${id}` }, create: { ...data, id: `${state}-${id}` }, update: { ...data, id: undefined } })
      saved++
    } catch (e) {
      console.error('Workforce board could not be read', state, id, e)
    }
  }
  return saved
}

/**
 * Refreshes the directory, the states read longest ago first, until the
 * time budget is spent. Boards and their directors change a few times a
 * year; a weekly pass over part of the country keeps all of it current
 * within a month or so.
 */
export async function syncWorkforceBoards(budgetMs = 240_000, states = Object.keys(STATE_NAMES)) {
  const started = Date.now()
  const last = await prisma.workforceBoard.groupBy({ by: ['state'], _max: { updatedAt: true } })
  const lastAt = new Map(last.map((l) => [l.state, l._max.updatedAt?.getTime() ?? 0]))
  const order = [...states].sort((a, b) => (lastAt.get(a) ?? 0) - (lastAt.get(b) ?? 0))
  const done: Record<string, number> = {}
  for (const state of order) {
    if (Date.now() - started > budgetMs) break
    try {
      done[state] = await syncBoardsForState(state)
    } catch (e) {
      console.error('Workforce boards could not be listed for', state, e)
      done[state] = -1
      // The rest would fail the same way; they are first in line next time.
      break
    }
  }
  return done
}

/** CareerOneStop's list of every board in a state — the fallback when a notice has no board. */
export function stateBoardsUrl(state: string): string {
  return `${BASE}/find-workforce-development-boards.aspx?location=${encodeURIComponent(state)}&curPage=1&pagesize=500`
}

/** The American Job Centers near a board — its WIOA partners on the ground. */
export function jobCentersUrl(zip: string | null, state: string): string {
  return `https://www.careeronestop.org/LocalHelp/AmericanJobCenters/find-american-job-centers.aspx?location=${encodeURIComponent(zip ?? state)}&radius=25`
}
