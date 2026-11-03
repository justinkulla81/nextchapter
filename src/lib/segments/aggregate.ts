// Turns one segment's open postings into a stored edition: the lists, the headline figures and the changes since last month.
// Pure, so the rules are unit-tested (src/test/segments.test.ts). The scan that feeds it is scan.ts.

import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { BoardRow, CutId, SegmentEdition, SegmentJob, SegmentRow } from '@/lib/segments/types'

export const LIST_SIZE = 25
/** What a list needs before it is published, in postings behind each figure. */
export const BARS = { employer: 3, role: 5, state: 5, city: 10, payRole: 8, payEmployer: 4, segmentPaid: 30, skill: 8 } as const
/** A city where one employer posts this share of the segment's openings is not ranked. */
const MAX_TOP_SHARE = 0.5
const NEW_DAYS = 7

const ENTRY_LEVELS = new Set(['ENTRY_IC', 'EARLY_IC'])

export const isPaid = (r: Pick<BoardRow, 'payMin' | 'payMax' | 'payPeriod' | 'currency'>) =>
  r.payMin != null && r.payMax != null && r.payMax >= r.payMin && r.payPeriod === 'year' && r.payMin >= 20_000 && r.payMax < 2_000_000 && (r.currency ?? 'USD') === 'USD'
const mid = (r: BoardRow) => ((r.payMin ?? 0) + (r.payMax ?? 0)) / 2

export function median(xs: number[]): number | null {
  if (!xs.length) return null
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export const usdK = (n: number) => `$${Math.round(n / 1000)}k`
export const count = (n: number) => n.toLocaleString('en-US')

const payText = (r: BoardRow) => (isPaid(r) ? (r.payMin === r.payMax ? usdK(r.payMin!) : `${usdK(r.payMin!)}–${usdK(r.payMax!)}`) : null)
const where = (r: BoardRow) => (r.city && r.st ? `${titleCase(r.city)}, ${r.st}` : r.st)
export const titleCase = (s: string) => s.replace(/\b([a-z])([a-z']*)/g, (_, a: string, b: string) => a.toUpperCase() + b)

interface Group { key: string; names: Map<string, number>; rows: BoardRow[] }

function groupBy(rows: BoardRow[], keyOf: (r: BoardRow) => string | null, nameOf: (r: BoardRow) => string): Group[] {
  const map = new Map<string, Group>()
  for (const r of rows) {
    const key = keyOf(r)
    if (!key) continue
    const g: Group = map.get(key) ?? { key, names: new Map<string, number>(), rows: [] }
    g.rows.push(r)
    const n = nameOf(r)
    g.names.set(n, (g.names.get(n) ?? 0) + 1)
    map.set(key, g)
  }
  return [...map.values()]
}

const commonest = (g: Group) => [...g.names].sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)[0][0]
const payMedOf = (rows: BoardRow[]) => median(rows.filter(isPaid).map(mid))
const paidCount = (rows: BoardRow[]) => rows.filter(isPaid).length

function topState(rows: BoardRow[]): string {
  const c = new Map<string, number>()
  for (const r of rows) if (r.st) c.set(r.st, (c.get(r.st) ?? 0) + 1)
  return [...c].sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
}

/** Ranks entries by a value, highest first (ties by name), and shapes them into rows with the change since the last edition. */
function rank(
  entries: { key: string; name: string; sub: string; value: number; valueLabel: string; stats: { label: string; value: string }[] }[],
  prevRanks: Map<string, number> | null,
): SegmentRow[] {
  const top = entries.sort((a, b) => b.value - a.value || a.name.localeCompare(b.name)).slice(0, LIST_SIZE)
  const max = top[0]?.value || 1
  return top.map((e, i) => {
    const before = prevRanks?.get(e.key)
    return { rank: i + 1, ...e, change: before != null ? before - (i + 1) : null, bar: Math.max(0.04, e.value / max) }
  })
}

const asJob = (r: BoardRow): SegmentJob => ({ id: r.id, title: r.title, company: r.company, location: where(r), pay: payText(r), postedAt: r.postedAt ?? r.createdAt })

export interface PrevEdition { edition: string; total: number; payMed: number | null; ranks: Partial<Record<CutId, Map<string, number>>> }

/** The previous edition's ranks per cut, from its stored rows, for the "up/down since last month" figures. */
export function prevFrom(e: SegmentEdition | null): PrevEdition | null {
  if (!e) return null
  const ranks: PrevEdition['ranks'] = {}
  for (const [cut, rows] of Object.entries(e.cuts) as [CutId, SegmentRow[]][]) ranks[cut] = new Map(rows.map((r) => [r.key, r.rank]))
  return { edition: e.edition, total: e.total, payMed: e.payMed, ranks }
}

export function buildEdition(slug: string, edition: string, rows: BoardRow[], prev: PrevEdition | null, now: Date): SegmentEdition {
  const paidRows = rows.filter(isPaid)
  const cuts: SegmentEdition['cuts'] = {}
  const put = (cut: CutId, list: SegmentRow[]) => { if (list.length) cuts[cut] = list }

  // Employers: one count for every spelling of a name.
  const employers = groupBy(rows, (r) => normalizeOrgName(r.company) || r.company.toLowerCase(), (r) => r.company)
  const employerEntries = employers.filter((g) => g.rows.length >= BARS.employer).map((g) => {
    const pm = paidCount(g.rows) >= BARS.payEmployer ? payMedOf(g.rows) : null
    return { key: g.key, name: commonest(g), sub: topState(g.rows), value: g.rows.length, valueLabel: `${count(g.rows.length)} open`, stats: pm ? [{ label: 'Median pay', value: usdK(pm) }] : [] }
  })
  put('top-employers', rank(employerEntries, prev?.ranks['top-employers'] ?? null))
  if (paidRows.length >= BARS.segmentPaid) {
    const payEntries = employers.filter((g) => paidCount(g.rows) >= BARS.payEmployer).map((g) => {
      const pm = payMedOf(g.rows)!
      return { key: g.key, name: commonest(g), sub: topState(g.rows), value: pm, valueLabel: usdK(pm), stats: [{ label: 'Open', value: count(g.rows.length) }, { label: 'With pay', value: count(paidCount(g.rows)) }] }
    })
    put('highest-paying-employers', rank(payEntries, prev?.ranks['highest-paying-employers'] ?? null))
  }

  // Roles: the occupation the crawler matched each title to.
  const roles = groupBy(rows, (r) => r.soc, (r) => r.soc ?? '')
  put('top-roles', rank(roles.filter((g) => g.rows.length >= BARS.role).map((g) => {
    const pm = paidCount(g.rows) >= BARS.payRole ? payMedOf(g.rows) : null
    return { key: g.key, name: g.key, sub: `${count(new Set(g.rows.map((r) => normalizeOrgName(r.company))).size)} employers`, value: g.rows.length, valueLabel: `${count(g.rows.length)} open`, stats: pm ? [{ label: 'Median pay', value: usdK(pm) }] : [] }
  }), prev?.ranks['top-roles'] ?? null))
  if (paidRows.length >= BARS.segmentPaid) {
    put('highest-paying-roles', rank(roles.filter((g) => paidCount(g.rows) >= BARS.payRole).map((g) => {
      const pm = payMedOf(g.rows)!
      return { key: g.key, name: g.key, sub: `${count(g.rows.length)} open`, value: pm, valueLabel: usdK(pm), stats: [{ label: 'With pay', value: count(paidCount(g.rows)) }] }
    }), prev?.ranks['highest-paying-roles'] ?? null))
  }

  // Places.
  const states = groupBy(rows, (r) => r.st, (r) => r.st ?? '')
  put('top-states', rank(states.filter((g) => g.rows.length >= BARS.state).map((g) => {
    const pm = paidCount(g.rows) >= BARS.payRole ? payMedOf(g.rows) : null
    return { key: g.key, name: g.key, sub: '', value: g.rows.length, valueLabel: `${count(g.rows.length)} open`, stats: pm ? [{ label: 'Median pay', value: usdK(pm) }] : [] }
  }), prev?.ranks['top-states'] ?? null))
  const cities = groupBy(rows.filter((r) => r.st && r.city), (r) => `${r.st}|${r.city!.toLowerCase()}`, (r) => r.city!)
  put('top-cities', rank(cities.filter((g) => {
    if (g.rows.length < BARS.city) return false
    const byEmployer = new Map<string, number>()
    for (const r of g.rows) { const k = normalizeOrgName(r.company); byEmployer.set(k, (byEmployer.get(k) ?? 0) + 1) }
    return Math.max(...byEmployer.values()) / g.rows.length < MAX_TOP_SHARE
  }).map((g) => {
    const [st, city] = g.key.split('|')
    return { key: g.key, name: `${titleCase(city)}, ${st}`, sub: '', value: g.rows.length, valueLabel: `${count(g.rows.length)} open`, stats: [] }
  }), prev?.ranks['top-cities'] ?? null))

  // Skills named in the postings' own text.
  const skillCount = new Map<string, { name: string; n: number }>()
  for (const r of rows) for (const s of new Set(r.skills.map((x) => x.trim()).filter(Boolean))) {
    const k = s.toLowerCase()
    const cur = skillCount.get(k) ?? { name: s, n: 0 }
    cur.n++
    skillCount.set(k, cur)
  }
  put('top-skills', rank([...skillCount].filter(([, v]) => v.n >= BARS.skill).map(([k, v]) => ({
    key: k, name: v.name, sub: '', value: v.n, valueLabel: `${Math.round((v.n / rows.length) * 100)}% of jobs`, stats: [{ label: 'Jobs', value: count(v.n) }],
  })), prev?.ranks['top-skills'] ?? null))

  // Newest this week, and the on-ramps.
  const cutoff = now.getTime() - NEW_DAYS * 86_400_000
  const when = (r: BoardRow) => new Date(r.postedAt ?? r.createdAt).getTime()
  const newest = rows.filter((r) => when(r) >= cutoff).sort((a, b) => when(b) - when(a)).slice(0, LIST_SIZE).map(asJob)
  const entryRows = rows.filter((r) => (r.level && ENTRY_LEVELS.has(r.level)) || r.noExperience)
  const entryByEmployer = groupBy(entryRows, (r) => normalizeOrgName(r.company) || r.company.toLowerCase(), (r) => r.company)
  put('entry-level', rank(entryByEmployer.filter((g) => g.rows.length >= BARS.employer).map((g) => ({
    key: g.key, name: commonest(g), sub: topState(g.rows), value: g.rows.length, valueLabel: `${count(g.rows.length)} entry-level`, stats: [],
  })), prev?.ranks['entry-level'] ?? null))

  return {
    slug, edition, builtAt: now.toISOString(),
    total: rows.length, paid: paidRows.length, payMed: paidRows.length >= BARS.segmentPaid ? payMedOf(rows) : null,
    employers: employers.length,
    prev: prev ? { edition: prev.edition, total: prev.total, payMed: prev.payMed } : null,
    cuts, newest,
    entry: { total: entryRows.length, jobs: entryRows.sort((a, b) => when(b) - when(a)).slice(0, LIST_SIZE).map(asJob) },
  }
}

/** The cuts a page may link to: lists with rows, plus the two job lists when they have jobs. */
export function publishedCuts(e: SegmentEdition): CutId[] {
  const out = (Object.entries(e.cuts) as [CutId, SegmentRow[]][]).filter(([c, r]) => c !== 'entry-level' && r.length > 0).map(([c]) => c)
  if (e.entry.jobs.length) out.push('entry-level')
  if (e.newest.length) out.push('newest')
  return out
}
