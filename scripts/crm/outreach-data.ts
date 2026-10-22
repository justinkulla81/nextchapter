/**
 * Ready-to-send cold emails, one row per recipient, written from real data. Reads only; writes nothing to the CRM.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/outreach-data.ts <out.csv> [examples.json]
 *
 * Each row has the recipient, the template for their kind of contact (scripts/crm/outreach-templates.json), the rendered subjects,
 * preview text, plain and HTML bodies, and the figures behind them: the recipient's own layoff or area, the state and county layoff
 * totals, county unemployment and white-collar share, the layoff's effective date, the local Rapid Response agency and workforce board,
 * the largest local employers and nearest college, and the open roles our crawler sees (all, manager-level, AI-titled, most common
 * functions). Only addresses that are published or verified are used, never a guess. A row is `ready` only when every figure its
 * template quotes is present; otherwise `missing` names what to fill in.
 */
import { degreeExposure } from '../../src/lib/crm/degree-ai-exposure'
import { readFileSync, writeFileSync } from 'node:fs'
import { prisma } from '../../src/lib/prisma'
import { isHrLeaderTitle } from '../../src/lib/crm/org-domains'
import { cityFromAddress } from '../../src/lib/workforce/places'

const STATES: Record<string, string> = { AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'the District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming' }
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const n0 = (v: number | null | undefined) => (v == null ? '' : Math.round(v).toLocaleString('en-US'))
const pct = (v: number | null | undefined, d = 1) => (v == null ? '' : `${v.toFixed(d)}%`)
const cleanName = (name: string) => name.replace(/&amp;/gi, '&').replace(/&#0?39;|&apos;/gi, "'").replace(/\*[^*]*\*/g, '').replace(/\s+-\s+.*$/, '').replace(/(?<=\S)\s+\d{3,}\b.*$/, '').replace(/,\s*[A-Z]{2},?\s*\d{5}.*$/, '')
const clean = (name: string) => cleanName(name).replace(/\([^)]*\)/g, '').replace(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d\d\b/gi, '').replace(/,?\s*et\s?al\.?/i, '').replace(/[’']s\b/g, '')
  .replace(/,?\s+(inc|llc|l\.l\.c|corp|corporation|co|company|ltd|plc|lp|llp)\.?\s*$/i, '').replace(/\s+/g, ' ').trim()
const q = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
const cityOf = (n: Notice | undefined, state: string) => {
  const c = n ? cityFromAddress(n.address, state) : null
  // A real city, not "Various locations in Washington" or the state's own name.
  return c && !/various|multiple|locations?|statewide|remote|nationwide|\bin\b|^n\/?a$/i.test(c) && c.toLowerCase() !== (STATES[state] ?? '').toLowerCase() ? c : null
}
const ARM_LABELS = ['C1a', 'C1b', 'C2a', 'C2b']
const countyBase = (c: string | null | undefined) => (c ?? '').replace(/\s+(county|parish)$/i, '').trim().toLowerCase()
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
// The greeting: the first name, with honorifics and initials dropped; a doctor, judge or reverend is greeted as "Dr. Last".
const HONOR = /^(dr|mr|mrs|ms|miss|mx|hon|rev|prof|sen|rep|sir|dame|judge|chief|capt|col|gen)\.?$/i
const FORMAL = /^(dr|hon|rev|prof|judge|sen|rep)\.?$/i
const salutation = (full: string): string => {
  const toks = full.replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim().split(/\s+/).filter(Boolean)
  let i = 0, formal: string | null = null
  while (i < toks.length && HONOR.test(toks[i])) { if (FORMAL.test(toks[i])) formal = toks[i].replace(/\.?$/, '.'); i++ }
  const rest = toks.slice(i).filter((t) => !/^[A-Za-z]\.?$/.test(t))
  if (formal) return rest.length ? `${formal} ${rest[rest.length - 1]}` : ''
  return rest[0] ?? ''
}
const validGreeting = (g: string) => g === 'team' || /^([A-Z][a-z]{0,6}\. )?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]+$/.test(g)
const monthYear = (ym: string | null | undefined) => { const m = /^(\d{4})-(\d{2})$/.exec(ym ?? ''); return m ? `${MONTHS[Number(m[2]) - 1]} ${m[1]}` : ym ?? '' }
const poss = (n: string) => (/s$/i.test(n) ? `${n}'` : `${n}'s`)
const list = (a: string[]) => (a.length <= 1 ? a.join('') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`)

interface Area { id: string; name: string; state: string; unemp: number | null; unempPrior: number | null; wcUnemp: number | null; asOf: string | null; wc: number | null; j90: number; j12: number; majors: string[]; college: string | null }
interface Notice { industry?: string | null; key?: string; employer: string; employees: number; county: string | null; address: string | null; state: string; effective: Date | null; noticeDate: Date; board: string | null }

// Employer emails go only to layoffs of 50 or more in professional-heavy work. An explicit allowlist, never "everything except": a filing whose industry
// is blank, or in an industry not listed, stays out unless the employer is named below (reviewed by hand; add a name only after checking the filing).
const MIN_EMPLOYER_LAYOFF = 50
const PROFESSIONAL_INDUSTRY = /^(tech:|51\b|52\b|54\b|55\b)/i
const PROFESSIONAL_KEYS = new Set(Object.keys((JSON.parse(readFileSync(new URL('./professional-employers.json', import.meta.url), 'utf8')) as { employers: Record<string, string> }).employers))
const PROFESSIONAL_EMPLOYERS = new Set(['hasbro', 'conifer health solutions', "conifer's health solutions", 'tscan therapeutics', 'truist bank', 'bechtel power corporation', 'bechtel power'])
const EMPLOYER_TEMPLATES = ['head_hr', 'rewards', 'er', 'ta']
function professionalHeavy(n: Notice | undefined): boolean {
  if (!n || n.employees < MIN_EMPLOYER_LAYOFF) return false
  const name = n.employer.toLowerCase().replace(/[.,]|\b(inc|llc|corp|corporation|co)\b/g, '').replace(/\s+/g, ' ').trim()
  return PROFESSIONAL_INDUSTRY.test(n.industry ?? '') || PROFESSIONAL_EMPLOYERS.has(name) || (!!n.key && PROFESSIONAL_KEYS.has(n.key))
}
type Row = Record<string, string>

const tpl = JSON.parse(readFileSync(new URL('./outreach-templates.json', import.meta.url), 'utf8')) as {
  signature: string; footer: string[]; templates: { id: string; subjects: string[]; subject_fallback: string; preview: string; body: string; ps: string; fu1: string; fu2: string }[]
}
const T = new Map(tpl.templates.map((t) => [t.id, t]))
const FOOT_STYLE = 'display:block;margin-top:14px;font-size:11px;line-height:1.5;color:#8a919c'
const fill = (s: string, row: Row) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => row[k] ?? '').replace(/ +([.,;])/g, '$1').replace(/[ \t]+\n/g, '\n').replace(/ {2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
const tokens = (s: string) => [...s.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])

/** Roughly two significant figures, so an estimate does not read as a count: 30,625 becomes 31,000. */
const roughly = (n: number) => { const m = 10 ** Math.max(0, String(Math.round(n)).length - 2); return (Math.round(n / m) * m).toLocaleString('en-US') }

/**
 * The job-market paragraph for a college email: the county's unemployment (and the white-collar estimate), how many alumni the college
 * has, and how exposed its biggest fields of study are to AI. Each sentence is dropped when its data is missing; nothing is invented.
 */
function collegeMarketContext(col: { name: string; alumniEstimate: number | null; alumniReported: number | null; topMajors: unknown }, area: Area): string {
  const out: string[] = []
  if (area.unemp != null) {
    const trend = area.unempPrior != null && Math.abs(area.unemp - area.unempPrior) >= 0.2 ? `, ${area.unemp > area.unempPrior ? 'up' : 'down'} from ${area.unempPrior.toFixed(1)}% a year ago` : ''
    const wc = area.wcUnemp != null ? `; our estimate for white-collar workers there is ${area.wcUnemp.toFixed(1)}%` : ''
    out.push(`${area.name}'s unemployment rate is ${area.unemp.toFixed(1)}%${trend}${wc}.`)
  }
  const alumni = col.alumniReported ?? col.alumniEstimate
  if (alumni && alumni >= 1000) out.push(`With an estimated ${roughly(alumni)} alumni, a share of the people now looking for work are likely to be yours.`)
  const ex = degreeExposure(col.topMajors as { field: string; share: number }[] | null)
  const high = ex.majors.filter((m) => m.band === 'HIGH')
  if (ex.coveredShare >= 0.5 && ex.highShare >= 0.15) {
    const names = high.slice(0, 2).map((m) => (m.field === 'Computer & information sciences' ? 'computer science' : m.field.replace(/ & management$/, '').toLowerCase()))
    out.push(`About ${Math.round(ex.highShare * 100)}% of ${clean(col.name)}'s degrees, including ${names.join(' and ')}, lead into occupations where AI could already do much of the work.`)
  }
  return out.join(' ')
}

async function main() {
  const [out, examplesOut] = process.argv.slice(2)
  // OPENINGS_FILE: {"<template>|<email>": "<opening line>"} written by opening-lines.ts; the line goes right after the greeting.
  const openings = new Map<string, string>(Object.entries(process.env.OPENINGS_FILE ? (JSON.parse(readFileSync(process.env.OPENINGS_FILE, 'utf8')) as Record<string, string>) : {}))
  if (!out) { console.log('usage: <out.csv> [examples.json]'); return }
  const since = new Date(Date.now() - 90 * 86_400_000), now = new Date()
  // Employer emails look back further than the 90-day local statistics the other emails quote.
  const employerSince = new Date(Date.now() - Number(process.env.EMPLOYER_DAYS ?? 180) * 86_400_000)

  const areaRows = await prisma.geoArea.findMany({ where: { level: 'COUNTY' }, select: { id: true, name: true, state: true, unemploymentRate: true, unemploymentRatePrior: true, wcUnemploymentEst: true, unemploymentAsOf: true, whiteCollarShare: true, layoffs90d: true, layoffs12mo: true, majorEmployers: true, higherEd: true } })
  const areas: Area[] = areaRows.map((a) => ({
    id: a.id, name: a.name, state: a.state, unemp: a.unemploymentRate, unempPrior: a.unemploymentRatePrior, wcUnemp: a.wcUnemploymentEst, asOf: a.unemploymentAsOf, wc: a.whiteCollarShare, j90: a.layoffs90d, j12: a.layoffs12mo,
    majors: ((a.majorEmployers as { workers: number; employer: string }[] | null) ?? []).slice(0, 4).map((m) => clean(m.employer)).filter((n) => n.length > 2 && n.length < 40).slice(0, 2),
    college: ((a.higherEd as { name: string; size?: string; level?: string }[] | null) ?? []).filter((c) => c.name && /4-year|2-year/i.test(c.level ?? '4-year'))[0]?.name ?? null,
  }))
  const areaById = new Map(areas.map((a) => [a.id, a]))
  const areaByName = new Map(areas.map((a) => [`${a.state}|${countyBase(a.name)}`, a]))

  // Metro growth for the workforce-board city test: boards of 0.5 to 2.5 million people, growing (up 4%+ since 2020) or flat (up 2.5% or less).
  const boardGrowth = new Map<string, { pop: number; growth: number }>()
  try { for (const x of JSON.parse(readFileSync('/Users/salitkulla/nc-hunter-results/board-growth.json', 'utf8')) as { id: string; pop: number; growth: number }[]) boardGrowth.set(x.id, x) } catch { /* no growth file: no city test */ }
  const boardNames = new Map((await prisma.workforceBoard.findMany({ select: { id: true, name: true } })).map((b) => [b.id, b.name]))
  const notices = await prisma.warnNotice.findMany({
    where: { source: 'WARN_FILING', state: { not: null }, dismissedAt: null, noticeDate: { gte: employerSince, lte: now }, employees: { not: null } },
    select: { industry: true, normalizedEmployer: true, employer: true, employees: true, county: true, address: true, state: true, effectiveDate: true, noticeDate: true, promotedOrgId: true, workforceBoardId: true },
  })
  const bigger = (a: Notice | undefined, b: Notice) => (!a || b.employees > a.employees ? b : a)
  const byOrg = new Map<string, Notice>(), byBoard = new Map<string, Notice>(), byCounty = new Map<string, Notice>(), byState = new Map<string, Notice>()
  let top: Notice | undefined
  const stateAll = new Map<string, Notice[]>()
  const countyAgg = new Map<string, { employers: Set<string>; jobs: number }>()
  const stateTotals = new Map<string, { notices: number; jobs: number }>()
  for (const w of notices) {
    const nt: Notice = { industry: w.industry, key: w.normalizedEmployer, employer: clean(w.employer), employees: w.employees!, county: w.county, address: w.address, state: w.state!, effective: w.effectiveDate, noticeDate: w.noticeDate, board: w.workforceBoardId ? boardNames.get(w.workforceBoardId) ?? null : null }
    if (w.promotedOrgId) byOrg.set(w.promotedOrgId, bigger(byOrg.get(w.promotedOrgId), nt))
    if (w.noticeDate! < since) continue // older than 90 days: only the employer list uses it
    if (w.workforceBoardId) byBoard.set(w.workforceBoardId, bigger(byBoard.get(w.workforceBoardId), nt))
    if (w.county) { const k = `${w.state}|${countyBase(w.county)}`; byCounty.set(k, bigger(byCounty.get(k), nt)) }
    byState.set(w.state!, bigger(byState.get(w.state!), nt))
    stateAll.set(w.state!, [...(stateAll.get(w.state!) ?? []), nt])
    if (w.county) { const k = `${w.state}|${countyBase(w.county)}`; const g = countyAgg.get(k) ?? { employers: new Set<string>(), jobs: 0 }; g.employers.add(nt.employer.toLowerCase()); g.jobs += w.employees!; countyAgg.set(k, g) }
    top = bigger(top, nt)
    const t = stateTotals.get(w.state!) ?? { notices: 0, jobs: 0 }
    t.notices++; t.jobs += w.employees!; stateTotals.set(w.state!, t)
  }

  // Open roles our crawler sees, by state and overall.
  type Open = { roles: number; mgr: number; ai: number; pay: number | null; fns: string[] }
  const AI = `title ~* '(\\mai\\M|a\\.i\\.|machine learning|generative|\\mllm\\M|data scientist|prompt engineer|\\mml\\M)'`
  const openRows = await prisma.$queryRawUnsafe<{ state: string | null; roles: bigint; mgr: bigint; ai: bigint; pay: number | null }[]>(`
    select s as state, count(*) roles, count(*) filter (where "seniorityGroup" in ('EXECUTIVE','VP','DIRECTOR','SENIOR_MANAGER','MANAGER')) mgr,
      count(*) filter (where ${AI}) ai, percentile_cont(0.5) within group (order by "payAnnualMid") filter (where "payAnnualMid" is not null) pay
    from "CompanyJobOpening", unnest(states) s where "closedAt" is null and "lastSeenAt" >= now() - interval '14 days' group by s`)
  const fnRows = await prisma.$queryRawUnsafe<{ state: string; fn: string; n: bigint }[]>(`
    select s as state, function fn, count(*) n from "CompanyJobOpening", unnest(states) s
    where "closedAt" is null and "lastSeenAt" >= now() - interval '14 days' and function is not null and "seniorityGroup" in ('EXECUTIVE','VP','DIRECTOR','SENIOR_MANAGER','MANAGER') group by s, function`)
  const natRow = (await prisma.$queryRawUnsafe<{ roles: bigint; mgr: bigint; ai: bigint }[]>(`
    select count(*) roles, count(*) filter (where "seniorityGroup" in ('EXECUTIVE','VP','DIRECTOR','SENIOR_MANAGER','MANAGER')) mgr, count(*) filter (where ${AI}) ai
    from "CompanyJobOpening" where "closedAt" is null and "lastSeenAt" >= now() - interval '14 days'`))[0]
  const nat: Open = { roles: Number(natRow.roles), mgr: Number(natRow.mgr), ai: Number(natRow.ai), pay: null, fns: [] }
  const fnBy = new Map<string, Map<string, number>>()
  for (const f of fnRows) { const m = fnBy.get(f.state) ?? new Map(); m.set(f.fn, Number(f.n)); fnBy.set(f.state, m) }
  const nice = (fn: string) => fn.toLowerCase().replace(/_/g, ' ')
  const topFns = (m: Map<string, number> | undefined) => (m ? [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([f]) => nice(f)) : [])
  const openBy = new Map<string, Open>(openRows.filter((o) => o.state).map((o) => [o.state!, { roles: Number(o.roles), mgr: Number(o.mgr), ai: Number(o.ai), pay: o.pay, fns: topFns(fnBy.get(o.state!)) }]))
  const natFns = new Map<string, number>()
  for (const m of fnBy.values()) for (const [f, n] of m) natFns.set(f, (natFns.get(f) ?? 0) + n)
  nat.fns = topFns(natFns)

  // The Rapid Response agency per state (from the coordinators we added).
  const rrAgency = new Map<string, string>()
  for (const p of await prisma.crmPerson.findMany({ where: { deletedAt: null, notes: { contains: 'State Rapid Response Coordinators page' } }, select: { affiliations: { where: { isCurrent: true }, select: { org: { select: { name: true, usState: true } } }, take: 1 } } })) {
    const o = p.affiliations[0]?.org; if (o?.usState && !rrAgency.has(o.usState)) rrAgency.set(o.usState, o.name.replace(/^.*?(Department|Commission|Division|Agency|Authority|Services|Council)/i, (m) => m).replace(/\s*-\s*.*$/, ''))
  }

  const rows: Row[] = []
  const counts: Record<string, { rows: number; ready: number }> = {}
  const examples: Record<string, Row[]> = {}

  const add = (template: string, who: { first: string; email: string; org: string; title: string }, ctx: { notice?: Notice; area?: Area; state?: string; board?: string; center?: string; extra?: Record<string, string> }) => {
    const t = T.get(template)!
    const state = ctx.state ?? ctx.notice?.state ?? ''
    const area = ctx.area ?? (ctx.notice?.county && state ? areaByName.get(`${state}|${countyBase(ctx.notice.county)}`) : undefined)
    const st = stateTotals.get(state), op = state ? openBy.get(state) : undefined
    const stateName = STATES[state] ?? state
    const effDays = ctx.notice?.effective ? Math.ceil((ctx.notice.effective.getTime() - now.getTime()) / 86_400_000) : null
    const row: Row = {
      template, first_name: who.first, email: who.email, recipient_org: who.org, recipient_title: who.title, org: who.org,
      company: ctx.notice && ctx.notice.employer.length <= 45 ? ctx.notice.employer : '', employees: ctx.notice ? n0(ctx.notice.employees) : '',
      county: area?.name ?? ctx.notice?.county ?? (cityOf(ctx.notice, state) ? `${cityOf(ctx.notice, state)}, ${stateName}` : stateName), state: stateName, state_code: state,
      state_poss: poss(stateName),
      company_poss: ctx.notice && ctx.notice.employer.length <= 45 ? poss(ctx.notice.employer) : '',
      state_notices_phrase: st ? `${n0(st.notices)} ${st.notices === 1 ? 'notice' : 'notices'} covering ${n0(st.jobs)} jobs` : '',
      state_jobs_90d: n0(st?.jobs), state_notices_90d: n0(st?.notices), state_open_roles: n0((op ?? nat).roles), state_open_mgr_roles: n0((op ?? nat).mgr),
      county_unemp: pct(area?.unemp), county_unemp_as_of: monthYear(area?.asOf), county_wc_share: area?.wc != null ? pct(area.wc * 100, 0) : '',
      county_jobs_90d: n0(area?.j90), county_jobs_12mo: area && area.j12 > 0 ? n0(area.j12) : '',
      board: ctx.board ?? ctx.notice?.board ?? '', center: ctx.center ?? '', rr_agency: state ? rrAgency.get(state) ?? '' : '',
      effective_date: ctx.notice?.effective ? `${MONTHS[ctx.notice.effective.getUTCMonth()]} ${ctx.notice.effective.getUTCDate()}` : '', days_to_effective: effDays != null ? String(effDays) : '',
    }
    if (ctx.notice) { row.notice_date = ctx.notice.noticeDate.toISOString().slice(0, 10); row.effective_iso = ctx.notice.effective ? ctx.notice.effective.toISOString().slice(0, 10) : '' }
    if (ctx.extra) Object.assign(row, ctx.extra)
    const region = op ?? nat
    const scope = op ? `in ${stateName}` : 'nationally'
    row.line_timing = effDays != null && effDays >= 1 && effDays <= 150 ? `The notice takes effect on ${row.effective_date}, ${effDays} days from now.` : ''
    // All the open jobs we hold: the national total, plus the state's when it is at least three times the layoff beside it.
    const layoffSize = Number(String(row.employees ?? '').replace(/,/g, '')) || st?.jobs || 0
    row.line_open_roles = op && op.roles >= 3 * layoffSize
      ? `Our database holds ${n0(nat.roles)} open jobs, ${n0(op.roles)} of them in ${stateName}.`
      : `Our database holds ${n0(nat.roles)} open jobs.`
    row.line_top_functions = region.fns.length ? `The most common functions are ${list(region.fns)}.` : ''
    row.line_ai_roles = region.ai ? `${n0(region.ai)} open roles ${scope} mention AI in the title.` : ''
    row.line_board = row.board && row.rr_agency ? `Rapid Response (${row.rr_agency}) and ${row.board} typically meet employers soon after a notice.` : row.board ? `${row.board} typically meets employers soon after a notice.` : ''
    // The state's three largest notices, one per employer, as a proof point that we watch their state.
    const seenEmp = new Set<string>()
    const tops = [...(stateAll.get(state ?? '') ?? [])].sort((a, b) => b.employees - a.employees).filter((x) => { const k = x.employer.toLowerCase(); if (seenEmp.has(k)) return false; seenEmp.add(k); return true }).slice(0, 3)
    row.line_top_notices = tops.length >= 2 ? `The largest were ${list(tops.map((x) => `${poss(x.employer)} ${n0(x.employees)}`))}.` : ''
    row.line_local = area && area.j12 > 0
      ? (area.j12 === area.j90 || area.j90 === 0
        ? `${area.name} employers filed notices for ${n0(area.j12)} jobs ${area.j90 === 0 ? 'over the last 12 months' : 'in the last 90 days'}, and unemployment there is ${pct(area.unemp)} (${monthYear(area.asOf)}).`
        : `${area.name} employers filed notices for ${n0(area.j12)} jobs over the last 12 months (${n0(area.j90)} in the last 90 days), and unemployment there is ${pct(area.unemp)} (${monthYear(area.asOf)}).`)
      : st ? `${stateName} employers filed notices for ${n0(st.jobs)} jobs in the last 90 days.` : ''
    // When the company is most of the state's notices, restating the state total just repeats the layoff.
    const own = Number(String(row.employees ?? '').replace(/,/g, '')) || 0
    if (own && (st?.jobs ?? 0) < 2 * own) row.line_local = ''
    row.line_majors = area?.majors.length ? `The largest local employers include ${list(area.majors)}.` : ''
    const cName = area?.name ?? ctx.notice?.county ?? ''
    row.line_company = row.company ? `That includes ${poss(row.company)} ${n0(ctx.notice!.employees)} jobs.` : ''
    // The largest layoff is named only when the state or area has more than that one notice.
    row.line_largest = row.company && st && ctx.notice!.employees < st.jobs ? `, the largest being ${poss(row.company)} ${n0(ctx.notice!.employees)}${cName ? ` in ${cName}` : ''}` : ''
    row.line_researcher_hook = /labor|employment|unemployment|workforce|economist|future of work|\bAI\b|artificial|insurance|job/i.test(who.title)
      ? `Your work at ${who.org} on work and the labor market is the kind I would like the method checked against.`
      : `If someone at ${who.org} studies layoffs, AI and the labor market, I would like them to check the method.`
    row.line_college = area?.college ? `${area.college} is nearby, and its career services could use it too.` : ''

    row.facts = JSON.stringify({ local: row.line_local, layoff: row.line_company, timing: row.line_timing, board: row.line_board, roles: row.line_open_roles, ai_roles: row.line_ai_roles, functions: row.line_top_functions, majors: row.line_majors, college: row.line_college })
    const opening = openings.get(`${template}|${who.email.toLowerCase()}`) ?? ''
    row.opening_line = opening
    const bodyBase = fill(t.body, row)
    const bodyText = opening ? bodyBase.replace('\n\n', `\n\n${opening}\n\n`) : bodyBase
    const text = [bodyText, tpl.signature, fill(t.ps, row), tpl.footer.join('\n')].filter(Boolean).join('\n\n')
    const html = '<div style="font:14px/1.5 Arial,Helvetica,sans-serif;color:#111">' + esc([bodyText, tpl.signature, fill(t.ps, row)].filter(Boolean).join('\n\n')).replace(/\n/g, '<br>')
      + `<span style="${FOOT_STYLE}">${esc(tpl.footer.join('\n')).replace(/\n/g, '<br>')}</span></div>`
    // Subjects: the first one whose figures are all present leads; a template is ready when at least one subject can be filled.
    const subjOk = t.subjects.map((x) => tokens(x).filter((k) => !k.startsWith('line_') && !row[k]).length === 0)
    const order = [0, 1].sort((a, b) => Number(subjOk[b]) - Number(subjOk[a]))
    const bodyNeeded = [...new Set([...tokens(t.body), ...tokens(t.preview), ...tokens(t.fu1), ...tokens(t.fu2)])].filter((k) => !k.startsWith('line_'))
    const missing = [...(EMPLOYER_TEMPLATES.includes(template) && !professionalHeavy(ctx.notice) ? ['professional_heavy_layoff_50_plus'] : []), ...(validGreeting(row.first_name) ? [] : ['first_name']), ...bodyNeeded.filter((k) => !row[k] && k !== 'first_name'), ...(subjOk.some(Boolean) ? [] : ['subject'])]
    // Subjects: at most 62 characters. The first that fits leads; if neither does, the shorter generic one with no name in it.
    const cand = [t.subjects[order[0]], t.subjects[order[1]], t.subject_fallback].map((x) => fill(x, row)).filter((x, i) => i === 2 || tokens([t.subjects[order[0]], t.subjects[order[1]]][i]).every((k) => k.startsWith('line_') || row[k]))
    const fits = cand.filter((x) => x.length <= 62)
    row.subject_a = fits[0] ?? cand[cand.length - 1]; row.subject_b = fits[1] ?? fits[0] ?? cand[cand.length - 1]; row.preview_text = fill(t.preview, row)
    // Four subjects = two concepts with two wordings each (C1a, C1b: outcome; C2a, C2b: market data). Keep each that is complete and short.
    if (t.subjects.length === 4) ARM_LABELS.forEach((lab, i) => {
      const sbj = fill(t.subjects[i], row)
      row['arm_' + lab] = tokens(t.subjects[i]).every((k) => k.startsWith('line_') || row[k]) && sbj.length <= 62 ? sbj : ''
    })
    row.followup_1 = fill(t.fu1, row); row.followup_2 = fill(t.fu2, row)
    row.email_text = text; row.email_html = html
    row.ready = missing.length ? 'no' : 'yes'; row.missing = missing.join(' ')
    const c = counts[template] ?? (counts[template] = { rows: 0, ready: 0 }); c.rows++; if (!missing.length) c.ready++
    rows.push(row)
    if (!missing.length && (examples[template]?.length ?? 0) < 3) (examples[template] ??= []).push(row)
  }
  const first = (full: string, _f: string | null) => salutation(full)

  // 1. Employer HR people at recent WARN filers.
  for (const a of await prisma.crmAffiliation.findMany({
    where: { isCurrent: true, orgId: { in: [...byOrg.keys()] }, person: { deletedAt: null, mergedIntoId: null, email: { not: null } } },
    select: { title: true, orgId: true, org: { select: { name: true } }, person: { select: { fullName: true, firstName: true, email: true } } },
  })) {
    const t = a.title ?? ''
    const template = isHrLeaderTitle(t) ? 'head_hr' : /total rewards|compensation|benefits/i.test(t) ? 'rewards' : /employee relations|labor relations|business partner|hrbp|human resources (director|manager)|hr (director|manager)/i.test(t) ? 'er' : /talent acquisition|recruit/i.test(t) ? 'ta' : null
    const n0 = byOrg.get(a.orgId)
    const notice = n0 ? { ...n0, employer: clean(a.org.name) } : undefined
    if (template && notice) add(template, { first: first(a.person.fullName, a.person.firstName), email: a.person.email!, org: a.org.name, title: t }, { notice })
  }

  // 2. Workforce board directors and chairs.
  for (const b of await prisma.workforceBoard.findMany({ select: { id: true, name: true, state: true, counties: true, directorName: true, directorTitle: true, directorEmail: true, chairName: true, chairEmail: true } })) {
    const notice = byBoard.get(b.id)
    const area = b.counties.map((c) => areaByName.get(`${b.state}|${countyBase(c)}`)).filter(Boolean).sort((x, y) => y!.j12 - x!.j12)[0]
    let pilotDone = false
    for (const p of [{ n: b.directorName, t: b.directorTitle || 'Executive Director', e: b.directorEmail }, { n: b.chairName, t: 'Board Chair', e: b.chairEmail }]) {
      if (p.n && p.e && p.n.trim().split(/\s+/).length >= 2) {
        const g = boardGrowth.get(b.id)
        const grp = g && g.pop >= 500_000 && g.pop <= 2_500_000 ? (g.growth >= 4 ? 'GROW' : g.growth <= 2.5 ? 'FLAT' : '') : ''
        // The city-type pilot writes to one person per board, the director when there is one.
        if (grp && pilotDone) continue
        if (grp) pilotDone = true
        add('board', { first: first(p.n.trim(), null), email: p.e, org: b.name, title: p.t }, { notice, area, state: b.state, board: b.name, extra: { board_group: grp, board_growth: g ? `${g.growth}%` : '' } })
      }
    }
  }

  // 3. American Job Centers: the business-services inbox when there is one, else the general inbox.
  for (const c of await prisma.americanJobCenter.findMany({ select: { name: true, state: true, countyFips: true, generalEmail: true, businessEmail: true, workforceBoardId: true } })) {
    const EMAIL_OK = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
    const email = [c.businessEmail, c.generalEmail].map((e) => (e ?? '').trim()).find((e) => EMAIL_OK.test(e)) ?? ''
    if (!email) continue
    const area = c.countyFips ? areaById.get(c.countyFips) : undefined
    const notice = area ? byCounty.get(`${c.state}|${countyBase(area.name)}`) : undefined
    add('ajc', { first: 'team', email, org: c.name, title: email === (c.businessEmail ?? '').trim() ? 'Business services' : 'General inbox' }, { notice, area, state: c.state, center: c.name, board: c.workforceBoardId ? boardNames.get(c.workforceBoardId) : undefined })
  }

  // 3b. Colleges in a county with two or more employers in layoff notices (300+ jobs in all): the career, continuing-education and alumni contacts.
  //     Community colleges and four-year colleges get the same email; the variant is the level, so the two can be compared.
  const triggerCounties = [...countyAgg.entries()].filter(([, g]) => g.employers.size >= 2 && g.jobs >= 300)
  const triggerAreas = triggerCounties.map(([k, g]) => ({ area: areaByName.get(k), g })).filter((x): x is { area: Area; g: { employers: Set<string>; jobs: number } } => !!x.area)
  if (triggerAreas.length) {
    const byFips = new Map(triggerAreas.map((x) => [x.area.id, x]))
    const colleges = await prisma.collegeProfile.findMany({ where: { countyFips: { in: [...byFips.keys()] } }, select: { unitid: true, name: true, level: true, countyFips: true, state: true, alumniEstimate: true, alumniReported: true, topMajors: true, careerContactName: true, careerContactEmail: true, alumniContactName: true, alumniContactEmail: true } })
    const contacts = await prisma.collegeContact.findMany({ where: { collegeId: { in: colleges.map((c) => c.unitid) }, email: { not: null } }, select: { collegeId: true, role: true, name: true, title: true, email: true } })
    const ROLE_ORDER = ['execEd', 'career', 'alumni', 'development']
    for (const col of colleges) {
      const t = byFips.get(col.countyFips!)!
      const mine = contacts.filter((c) => c.collegeId === col.unitid).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role))
      const pick = mine[0] ?? (col.careerContactEmail ? { name: col.careerContactName, title: 'Career services', email: col.careerContactEmail } : col.alumniContactEmail ? { name: col.alumniContactName, title: 'Alumni relations', email: col.alumniContactEmail } : null)
      if (!pick?.email) continue
      add('college', { first: pick.name ? first(pick.name, null) : 'Hello', email: pick.email, org: col.name, title: pick.title ?? 'Career services' }, {
        area: t.area, state: col.state,
        extra: { college: clean(col.name.replace(/\s*[-–(]\s*Main Campus\)?/i, '')), college_level: col.level ?? '', employers_in_county: String(t.g.employers.size), college_county_jobs: n0(t.g.jobs), market_context: collegeMarketContext(col, t.area) },
      })
    }
  }

  // 4. People in the CRM with a published or verified address, by the kind of organization they are at.
  const ppl = await prisma.crmPerson.findMany({
    where: { deletedAt: null, mergedIntoId: null, email: { not: null }, OR: [
      { notes: { contains: 'State Rapid Response Coordinators page' } }, { notes: { contains: 'Found by web search' } }, { notes: { contains: 'buys, funds, refers or advises' } },
    ] },
    select: { fullName: true, firstName: true, email: true, notes: true, affiliations: { where: { isCurrent: true }, select: { title: true, org: { select: { name: true, usState: true, orgTypes: true } } }, take: 1 } },
  })
  for (const p of ppl) {
    const a = p.affiliations[0]; if (!a) continue
    const notes = p.notes ?? '', title = a.title ?? '', state = a.org.usState ?? ''
    const who = { first: first(p.fullName, p.firstName), email: p.email!, org: a.org.name, title }
    if (/State Rapid Response Coordinators page/.test(notes)) { if (state) add('rr', who, { notice: byState.get(state), state }); continue }
    if (/Found by web search/.test(notes) && a.org.orgTypes.includes('GOVERNMENT') && state && !/which filed a WARN/.test(notes)) {
      const template = /unemployment|reemployment|\bRESEA\b/i.test(title) ? 'state_ui' : /labor market|information|career|pathway|adult learner|research/i.test(title) ? 'state_career' : 'state_agency'
      add(template, who, { notice: byState.get(state), state }); continue
    }
    const m = /a ([^.]+?) that buys, funds, refers or advises/.exec(notes)?.[1] ?? ''
    if (!m) continue
    const template = /^funder/.test(m) ? 'funder' : /research or policy/.test(m) ? 'researcher' : /outplacement|benefits|restructuring/.test(m) ? 'partner' : 'career_dev'
    add(template, who, { notice: template === 'funder' ? top : undefined, state: template === 'funder' ? top?.state : undefined })
  }

  // 5. Chambers, economic development and workforce groups with a named contact.
  for (const l of await prisma.geoOrgLead.findMany({ where: { dismissedAt: null, contactEmail: { not: null }, contactName: { not: null } }, select: { name: true, kind: true, state: true, geoAreaId: true, contactName: true, contactTitle: true, contactEmail: true } })) {
    if (!l.geoAreaId && l.kind !== 'WORKFORCE') continue
    const area = l.geoAreaId ? areaById.get(l.geoAreaId) : undefined
    const notice = area ? byCounty.get(`${l.state}|${countyBase(area.name)}`) : undefined
    add(l.kind === 'WORKFORCE' ? 'career_dev' : 'edo', { first: first(l.contactName!, null), email: l.contactEmail!, org: l.name, title: l.contactTitle ?? '' }, { notice, area, state: l.state })
  }

  // People we have already written to, who replied, or whom you passed on, and anyone in ~/nc-hunter-results/suppress.txt (one address a line).
  const suppress = new Map<string, string>()
  for (const p of await prisma.crmPerson.findMany({ where: { deletedAt: null, OR: [{ passedAt: { not: null } }, { touchCount: { gt: 0 } }, { firstRepliedAt: { not: null } }] }, select: { email: true, emails: true, passedAt: true, firstRepliedAt: true } })) {
    const why = p.passedAt ? 'passed' : p.firstRepliedAt ? 'replied' : 'already contacted'
    for (const e of [p.email, ...p.emails]) if (e) suppress.set(e.toLowerCase(), why)
  }
  for (const m of await prisma.mailingSuppression.findMany({ select: { email: true, reason: true } })) suppress.set(m.email.toLowerCase(), m.reason === 'COMPLAINED' ? 'spam complaint' : 'bounced')
  try { for (const l of readFileSync('/Users/salitkulla/nc-hunter-results/suppress.txt', 'utf8').split('\n')) if (l.trim()) suppress.set(l.trim().toLowerCase(), 'do not contact') } catch { /* no list yet */ }
  // One address, one email: later rows for an address already used are flagged, so a mail merge can skip them.
  const seen = new Set<string>()
  for (const r of rows) { const k = r.email.toLowerCase(); r.duplicate = seen.has(k) ? 'yes' : ''; seen.add(k); const h = [...k].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
    if (r.template === 'board' && r.board_group) {
      // City-type pilot: the metro's growth, not a random split. The subject is held fixed (concept 1) so the comparison is clean.
      r.variant = r.board_group; r.concept = 'C1'; r.subject = r.arm_C1a || r.subject_a
    } else if (r.template === 'college') {
      // The comparison is the college's level, not a random split.
      r.variant = r.college_level === '2-year' ? 'CC' : '4YR'; r.concept = ''; r.subject = r.subject_a
    } else if (r.arm_C1a !== undefined) {
      // Two concepts by two wordings; an arm whose subject does not fit falls back to the other wording of the same concept.
      const lab = ARM_LABELS[h % 4], mate = ARM_LABELS[(h % 4) ^ 1]
      const pick = r['arm_' + lab] ? lab : r['arm_' + mate] ? mate : null
      r.variant = pick ?? 'F'; r.concept = pick ? pick.slice(0, 2) : ''; r.subject = pick ? r['arm_' + pick] : r.subject_a
    } else { r.variant = h % 2 ? 'B' : 'A'; r.concept = ''; r.subject = r.variant === 'B' ? r.subject_b : r.subject_a }
    // Timing test (employer emails only): right after the filing (0 to 1 days), delayed (about 14 days), right before the effective date, after it.
    // Each recipient is randomised among the windows still open today; the test is clean only when all four are open (a filing from the last day).
    r.timing = ''; r.send_on = ''; r.timing_test = ''
    if (['head_hr', 'rewards', 'er', 'ta'].includes(r.template) && r.notice_date) {
      const DAY = 86_400_000, today = Date.parse(now.toISOString().slice(0, 10)), nd = Date.parse(r.notice_date)
      // Many filings carry no effective date. WARN law requires about 60 days' notice, so the windows assume that; the email itself never states an estimated date (line_timing uses only a real one).
      const ef = r.effective_iso ? Date.parse(r.effective_iso) : nd + 60 * DAY
      const wins: { k: string; start: number; end: number; on: number }[] = [
        { k: 'T1', start: nd, end: nd + DAY, on: nd },
        { k: 'T2', start: nd + 12 * DAY, end: nd + 16 * DAY, on: nd + 14 * DAY },
        ...(Number.isNaN(ef) ? [] : [{ k: 'T3', start: ef - 7 * DAY, end: ef - 3 * DAY, on: ef - 5 * DAY }, { k: 'T4', start: ef + 7 * DAY, end: ef + 14 * DAY, on: ef + 10 * DAY }]),
      ]
      const open = wins.filter((w) => w.end >= today)
      if (open.length) {
        const w = open[(h >>> 3) % open.length]
        r.timing = w.k; r.send_on = new Date(Math.max(w.on, today)).toISOString().slice(0, 10); r.timing_test = open.length === 4 ? 'yes' : 'no'
      } else if (!Number.isNaN(ef) && ef <= today && ef >= today - 120 * DAY) {
        // Every window has passed, but the layoff took effect recently and those people are still looking: send now (T5), outside the timing test.
        r.timing = 'T5'; r.send_on = new Date(today).toISOString().slice(0, 10); r.timing_test = 'no'
      }
    }
     r.suppressed = suppress.get(k) ?? ''; r.send = r.ready === 'yes' && !r.duplicate && !r.suppressed ? 'yes' : '' }
  const HEAD = ['template', 'variant', 'concept', 'board_group', 'college_level', 'timing', 'timing_test', 'send_on', 'subject', 'send', 'ready', 'duplicate', 'suppressed', 'missing', 'first_name', 'email', 'recipient_org', 'recipient_title', 'subject_a', 'subject_b', 'preview_text', 'opening_line', 'email_text', 'email_html', 'followup_1', 'followup_2', 'facts',
    'company', 'employees', 'county', 'state', 'state_jobs_90d', 'state_notices_90d', 'state_open_roles', 'state_open_mgr_roles', 'county_unemp', 'county_unemp_as_of', 'county_wc_share', 'county_jobs_90d', 'county_jobs_12mo', 'board', 'center', 'rr_agency', 'effective_date', 'days_to_effective']
  writeFileSync(out, [HEAD.map(q).join(','), ...rows.map((r) => HEAD.map((h) => q(r[h] ?? '')).join(','))].join('\n') + '\n')
  // The send list: only rows that are ready, unique and not suppressed, with just what a mail merge needs.
  const SEND = ['template', 'variant', 'concept', 'board_group', 'college_level', 'timing', 'timing_test', 'send_on', 'subject', 'email', 'first_name', 'subject_a', 'subject_b', 'preview_text', 'email_html', 'email_text', 'followup_1', 'followup_2', 'recipient_org', 'recipient_title']
  const sendRows = rows.filter((r) => r.send === 'yes')
  writeFileSync(out.replace(/\.csv$/, '') + '.send.csv', [SEND.map(q).join(','), ...sendRows.map((r) => SEND.map((h) => q(r[h] ?? '')).join(','))].join('\n') + '\n')
  console.log(`send list: ${sendRows.length} rows`)
  if (examplesOut) writeFileSync(examplesOut, JSON.stringify(examples, null, 1))
  console.log(counts, `${rows.length} rows (${rows.filter((r) => r.ready === 'yes').length} ready) -> ${out}`)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
