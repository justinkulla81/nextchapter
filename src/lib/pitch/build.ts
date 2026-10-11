import type { Brand, Deck, DeckSlide, Demo, Fact, PersonCard, RuleSet, SlideRule } from './types'
import { NATIONAL } from './national'

// The generator turns a rule set plus (optionally) a local area into a Deck:
// plain data that the PPTX and PDF renderers both draw. Nothing here calls an
// LLM; every sentence comes from a rule, and every number from a data field.

export interface AreaInput {
  id: string; name: string; state: string; level: string
  population: number | null; unemploymentRate: number | null; unemploymentRatePrior: number | null; unemploymentAsOf: string | null
  medianHouseholdIncome: number | null; perCapitaIncome: number | null; whiteCollarShare: number | null
  wcUnemploymentEst: number | null; bcUnemploymentEst: number | null
  layoffs12mo: number; layoffEvents12mo: number; layoffs90d: number
  higherEdCount: number; higherEd: { name: string; control: string; level: string; size: string | null }[]
  dataCenterCount: number; dataCenters: { name: string; operator: string | null }[]
  wioaBoards: { name: string; website: string | null; directorName: string | null; directorTitle: string | null; directorEmail: string | null }[]
  majorEmployers: { employer: string; workers: number }[]
  initiatives: string | null
  news: { title: string; url: string; publisher?: string; publishedAt?: string }[]
}
export interface WarnInput { employer: string; employees: number | null; noticeDate: Date | null; effectiveDate: Date | null; industry: string | null }
export interface BuildInput {
  rules: RuleSet
  brand: Brand
  /** null = a generic deck: no local numbers, no local slides. */
  area: AreaInput | null
  warn?: WarnInput[]
  people?: PersonCard[]
  now?: Date
}

const cap1 = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
const pct = (n: number | null | undefined, d = 1) => (n == null ? 'n/a' : `${n.toFixed(d)}%`)
const money = (n: number | null | undefined) => (n == null ? 'n/a' : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1000)}K`)
const num = (n: number | null | undefined) => (n == null ? 'n/a' : n.toLocaleString('en-US'))
const dir = (d: number | null) => (d == null ? '' : Math.abs(d) < 0.15 ? 'flat' : d > 0 ? `up ${Math.abs(d).toFixed(1)} points` : `down ${Math.abs(d).toFixed(1)} points`)
const dateStr = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '')

export function tokens(i: BuildInput): Record<string, string> {
  const a = i.area
  const natChg = NATIONAL.whiteCollar.avg3 - NATIONAL.whiteCollar.yearAgo
  const board = a?.wioaBoards[0]?.name
  const t: Record<string, string> = {
    org: i.brand.orgName || 'your organization',
    natWc: pct(NATIONAL.whiteCollar.avg3, 2), natWcChange: dir(natChg), natAsOf: NATIONAL.asOf,
    natInfo: pct(NATIONAL.information.avg3, 1), natInfoChange: dir(NATIONAL.information.avg3 - NATIONAL.information.yearAgo),
    area: a ? (a.level === 'STATE' ? a.name : `${a.name}, ${a.state}`) : 'your region',
    state: a?.state ?? '', board: board ?? 'the local workforce board',
  }
  if (a) {
    const delta = a.unemploymentRate != null && a.unemploymentRatePrior != null ? a.unemploymentRate - a.unemploymentRatePrior : null
    Object.assign(t, {
      unemp: pct(a.unemploymentRate), unempChange: dir(delta), wcEst: pct(a.wcUnemploymentEst), bcEst: pct(a.bcUnemploymentEst),
      wcShare: a.whiteCollarShare == null ? 'n/a' : pct(a.whiteCollarShare * 100, 0), income: money(a.medianHouseholdIncome),
      layoffs12: num(a.layoffs12mo), layoffs90: num(a.layoffs90d), colleges: String(a.higherEdCount), dataCenters: String(a.dataCenterCount),
    })
  }
  return t
}

export function fill(s: string, t: Record<string, string>): string {
  return s.replace(/\{\{(\w+)\}\}/g, (_, k) => t[k] ?? '')
}

function statsFor(rule: SlideRule, i: BuildInput, t: Record<string, string>): Fact[] {
  const a = i.area
  if (rule.id === 'white-collar' || !a) {
    const w = NATIONAL.whiteCollar
    return [
      { label: 'White-collar unemployment', value: pct(w.avg3, 2), note: `3-month average, ${dir(w.avg3 - w.yearAgo)} from a year ago` },
      { label: 'Construction and maintenance', value: pct(NATIONAL.blueCollarConstruction.avg3, 2), note: 'Blue-collar comparison' },
      { label: 'Production and transportation', value: pct(NATIONAL.blueCollarProduction.avg3, 2), note: 'Blue-collar comparison' },
      { label: 'Information industry', value: pct(NATIONAL.information.avg3, 1), note: `${dir(NATIONAL.information.avg3 - NATIONAL.information.yearAgo)} from a year ago` },
    ]
  }
  if (rule.id === 'a-profile') {
    return [
      { label: 'Population', value: num(a.population) },
      { label: 'Unemployment rate', value: pct(a.unemploymentRate), note: a.unemploymentAsOf ? `As of ${a.unemploymentAsOf}` : undefined },
      { label: 'White-collar unemployment (estimate)', value: pct(a.wcUnemploymentEst) },
      { label: 'Blue-collar unemployment (estimate)', value: pct(a.bcUnemploymentEst) },
      { label: 'White-collar share of workers', value: t.wcShare },
      { label: 'Median household income', value: money(a.medianHouseholdIncome) },
      { label: 'Per-capita income', value: money(a.perCapitaIncome) },
      { label: 'Colleges / data centers', value: `${a.higherEdCount} / ${a.dataCenterCount}` },
    ]
  }
  return [
    { label: 'Unemployment rate', value: t.unemp, note: t.unempChange ? `${t.unempChange} from a year ago` : undefined },
    { label: 'White-collar unemployment (estimate)', value: t.wcEst, note: `Blue-collar ${t.bcEst}` },
    a.layoffs12mo === 0
      ? { label: 'Layoff notices, last 12 months', value: 'None on file', note: 'No filings located for this area; state data may be incomplete' }
      : { label: 'Layoffs named, last 12 months', value: t.layoffs12, note: `${a.layoffEvents12mo} filings; ${t.layoffs90} workers in the last 90 days` },
    { label: 'White-collar share of workers', value: t.wcShare, note: `Median household income ${t.income}` },
  ]
}

/** Demo slides are stored as editable text lines: FRAME|…, KPI|label|value, HEAD|a|b|c, ROW|a|b|c. */
export function parseDemo(lines: string[]): Demo {
  const d: Demo = { frame: '', kpis: [], head: [], rows: [] }
  for (const l of lines) {
    const [tag, ...rest] = l.split('|').map((x) => x.trim())
    if (tag === 'FRAME') d.frame = rest.join(' | ')
    else if (tag === 'KPI') d.kpis.push({ label: rest[0] ?? '', value: rest[1] ?? '' })
    else if (tag === 'HEAD') d.head = rest
    else if (tag === 'ROW') d.rows.push(rest)
  }
  return d
}

export function buildDeck(i: BuildInput): Deck {
  const generic = !i.area
  const t = tokens(i)
  const warnings: string[] = []
  const slides: DeckSlide[] = []
  const noLayoffData = !!i.area && i.area.layoffs12mo === 0

  for (const r of i.rules.slides) {
    if (!r.enabled) continue
    if (r.needsGeo && generic) continue
    const s: DeckSlide = {
      id: r.id, section: r.section, kind: r.kind, kicker: r.kicker ? fill(r.kicker, t) : undefined,
      title: fill(r.title, t),
      // A county with no filings on file is "no data", not "no layoffs": state sources are
      // incomplete and not every filing could be placed. Never print "0 workers" as a fact.
      bullets: r.bullets.filter((b) => !(noLayoffData && /\{\{layoffs(12|90)\}\}/.test(b))).map((b) => fill(b, t)),
      appendix: r.appendix, constituent: r.constituent,
    }
    if (noLayoffData && r.bullets.some((b) => /\{\{layoffs(12|90)\}\}/.test(b))) {
      warnings.push(`No layoff filings on file for ${t.area}: bullets that cite layoff counts were left out of "${fill(r.title, t)}". State data may be incomplete; add a layoff by hand or check the state's WARN page.`)
    }
    switch (r.kind) {
      case 'stats': s.facts = statsFor(r, i, t); break
      case 'offer': s.offer = i.rules.offer; break
      case 'packages': s.packages = i.rules.packages; if (!s.packages.length) continue; break
      case 'demo': s.demo = parseDemo(r.bullets); s.bullets = []; if (!s.demo.rows.length) continue; break
      case 'constituents': {
        // One row per audience slide that is switched on: name, what they need, what they get.
        const strip = (b: string | undefined) => (b ?? '').replace(/^(Needs|Gets|You will see):\s*/i, '')
        s.head = ['Audience', 'What they need', 'What they get']
        s.rows = i.rules.slides.filter((x) => x.enabled && x.constituent).map((x) => [cap1(x.constituent!), cap1(strip(fill(x.bullets[0], t))), cap1(strip(fill(x.bullets[1], t)))])
        if (!s.rows.length) continue
        break
      }
      case 'people': s.people = i.people ?? []; break
      case 'warn': {
        s.head = ['Employer', 'Workers', 'Notice date', 'Effective']
        s.rows = (i.warn ?? []).slice(0, r.appendix ? 15 : 6).map((w) => [w.employer, w.employees == null ? 'n/a' : num(w.employees), dateStr(w.noticeDate), dateStr(w.effectiveDate)])
        if (!s.rows.length) { if (!r.appendix) warnings.push('No layoff filings on file for this area; "Recent layoff announcements" slide is empty.'); continue }
        break
      }
      case 'employers': {
        s.head = ['Employer', 'Workers named in notices']
        s.rows = (i.area?.majorEmployers ?? []).slice(0, 10).map((e) => [e.employer, num(e.workers)])
        if (!s.rows.length) continue
        break
      }
      case 'colleges': {
        s.head = ['Institution', 'Level', 'Control', 'Size']
        s.rows = (i.area?.higherEd ?? []).slice(0, 12).map((c) => [c.name, c.level, c.control, c.size ?? ''])
        if (!s.rows.length) continue
        break
      }
      case 'datacenters': {
        s.head = ['Facility', 'Operator']
        s.rows = (i.area?.dataCenters ?? []).slice(0, 12).map((d) => [d.name, d.operator ?? ''])
        if (!s.rows.length) continue
        s.bullets = ['Mapped from OpenStreetMap; new and very large sites may be missing.']
        break
      }
      case 'board': {
        const b = i.area?.wioaBoards[0]
        if (!b) continue
        s.rows = [[b.name, [b.directorName, b.directorTitle].filter(Boolean).join(', ') || 'Director not listed', b.directorEmail ?? '', b.website ?? '']]
        s.head = ['Board', 'Director', 'Email', 'Website']
        break
      }
      case 'text': {
        if (!i.area?.initiatives) { continue }
        s.bullets = i.area.initiatives.split('\n').map((x) => x.trim()).filter(Boolean)
        break
      }
      case 'news': {
        const n = (i.area?.news ?? []).slice(0, 8)
        if (!n.length) continue
        s.bullets = n.map((x) => `${x.title}${x.publisher ? ` (${x.publisher}${x.publishedAt ? `, ${x.publishedAt.slice(0, 10)}` : ''})` : ''}`)
        break
      }
    }
    // Slides that need a summary but whose rule has no bullets of its own stay empty rather than invented.
    if (['bullets'].includes(r.kind) && s.bullets.length === 0) { warnings.push(`Slide "${s.title}" has no text; add bullets in the pitch rules.`) }
    for (const b of s.bullets) if (b.includes('[ADD:')) warnings.push(`Placeholder to replace before sending: "${b}"`)
    slides.push(s)
  }

  for (const n of i.rules.reviewNotes ?? []) warnings.push(n)
  if (slides.some((s) => s.kind === 'people') && !(i.people ?? []).length) { const k = slides.findIndex((s) => s.kind === 'people'); slides.splice(k, 1) }
  if (!generic && i.area && (i.area.wcUnemploymentEst != null)) warnings.push('County white-collar and blue-collar unemployment are estimates (labeled as such in the deck).')

  return {
    type: i.rules.type, generic, title: slides[0]?.title ?? 'NextChapter', brand: i.brand, slides, warnings: [...new Set(warnings)],
    builtAt: (i.now ?? new Date()).toISOString(),
  }
}
