/**
 * The send calendar: six new emails a day per audience, three per arm, plus follow-ups on days 4 and 9, checked against the email plan's
 * daily cap. Reads the merge file and writes a schedule CSV. It sends nothing.
 *
 *   tsx scripts/crm/outreach-schedule.ts <merge.csv> <out.csv> [startDate YYYY-MM-DD]
 *
 * Audiences and arms (each sending day takes up to three of each arm, two a day on the first three days as warm-up):
 *   employers     early (right after or delayed) vs late (right before or after the effective date), one person per employer, not before its send_on date
 *   higher ed     community colleges vs four-year colleges
 *   boards        growing metros vs flat metros, one director per board
 *   job centers   support-offered vs new-data subject concepts, skipping centers whose board is in the pilot
 * Env: SENT_FILE, WARMUP_DAYS (default 0), PRODUCT_PER_DAY (the product's own email a day, default 28), DAILY_CAP (default 100), PER_ARM (default 3).
 */
import { readFileSync, writeFileSync } from 'node:fs'

type Row = Record<string, string>
function parseCsv(text: string): Row[] {
  const rows: string[][] = []
  let row: string[] = [], cell = '', quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++ } else quoted = false } else cell += ch }
    else if (ch === '"') quoted = true
    else if (ch === ',') { row.push(cell); cell = '' }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = '' }
    else if (ch !== '\r') cell += ch
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  const [head, ...rest] = rows
  return rest.filter((r) => r.length > 1).map((r) => Object.fromEntries(head.map((h, i) => [h.trim(), r[i] ?? ''])))
}
const q = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
const DAY = 86_400_000
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
const isWeekend = (t: number) => [0, 6].includes(new Date(t).getUTCDay())
const nextWeekday = (t: number) => { while (isWeekend(t)) t += DAY; return t }
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)

const [file, out, startArg] = process.argv.slice(2)
if (!file || !out) { console.log('usage: outreach-schedule.ts <merge.csv> <out.csv> [startDate]'); process.exit(0) }
const PER_ARM = Number(process.env.PER_ARM ?? 3), PRODUCT = Number(process.env.PRODUCT_PER_DAY ?? 28), CAP = Number(process.env.DAILY_CAP ?? 100)
const rows = parseCsv(readFileSync(file, 'utf8')).filter((r) => r.send === 'yes')
const start = nextWeekday(Date.parse(startArg ?? iso(Date.now() + DAY)))

type Aud = { noNew?: boolean; name: string; armOf: (r: Row) => string | null; pool: Row[]; arms: string[]; earliest?: (r: Row) => number }
const seenOrg = new Set<string>()
const employers = rows.filter((r) => ['head_hr', 'rewards', 'er', 'ta'].includes(r.template) && r.timing).sort((a, b) => a.send_on.localeCompare(b.send_on)).filter((r) => { const k = (r.company || r.recipient_org).toLowerCase(); if (seenOrg.has(k)) return false; seenOrg.add(k); return true })
const boards = rows.filter((r) => r.template === 'board' && r.board_group).sort((a, b) => hash(a.email) - hash(b.email))
const pilotBoards = new Set(boards.map((r) => r.recipient_org.toLowerCase()))
const colleges = rows.filter((r) => r.template === 'college').sort((a, b) => Number((b.college_county_jobs || '0').replace(/,/g, '')) - Number((a.college_county_jobs || '0').replace(/,/g, '')))
const rapidResponse = rows.filter((r) => r.template === 'rr').sort((a, b) => hash(a.email) - hash(b.email))
// Job centers (ajc) are off the calendar by Justin's call on 2026-10-21; set INCLUDE_AJC=1 to bring them back, after the other audiences.
// Already-sent centers keep their follow-ups; no new ones are started unless INCLUDE_AJC=1.
const centers = rows.filter((r) => r.template === 'ajc' && !pilotBoards.has((r.board ?? '').toLowerCase())).sort((a, b) => hash(a.email) - hash(b.email))
// Order is priority (Justin, 2026-10-21): state Rapid Response, employers (outplacement), workforce boards, higher ed, then job centers if enabled.
const audiences: Aud[] = [
  { name: 'rapid response', pool: rapidResponse, arms: ['C1', 'C2'], armOf: (r) => (r.variant.startsWith('C1') ? 'C1' : r.variant.startsWith('C2') ? 'C2' : null) },
  { name: 'employers', pool: employers, arms: ['early', 'late'], armOf: (r) => (['T1', 'T2'].includes(r.timing) ? 'early' : 'late'), earliest: (r) => Date.parse(r.send_on) },
  { name: 'boards', pool: boards, arms: ['GROW', 'FLAT'], armOf: (r) => r.variant },
  { name: 'higher ed', pool: colleges, arms: ['CC', '4YR'], armOf: (r) => r.variant },
  { noNew: process.env.INCLUDE_AJC !== '1', name: 'job centers', pool: centers, arms: ['C1', 'C2'], armOf: (r) => (r.variant.startsWith('C1') ? 'C1' : r.variant.startsWith('C2') ? 'C2' : null) },
]

type Out = { date: string; audience: string; arm: string; step: number; row: Row }
const sched: Out[] = []
// SENT_FILE (lines "email,YYYY-MM-DD"): emails already sent. They stay on the calendar on that date, so their follow-ups are scheduled, and they use no new slots.
const sentOn = new Map<string, string>()
if (process.env.SENT_FILE) for (const l of readFileSync(process.env.SENT_FILE, 'utf8').split('\n')) { const [e, d] = l.trim().split(','); if (e && d) sentOn.set(e.toLowerCase(), d) }
for (const a of audiences) for (const r of a.pool) {
  const d = sentOn.get(r.email.toLowerCase()); const arm = a.armOf(r)
  if (d && arm) { ;(r as Row & { _used?: string })._used = '1'; sched.push({ date: d, audience: a.name, arm, step: 1, row: r }) }
}
const WEEKS = Number(process.env.WEEKS ?? 6), WARMUP = Number(process.env.WARMUP_DAYS ?? 0)
for (let t = start, day = 0; t < start + WEEKS * 7 * DAY; t += DAY) {
  if (isWeekend(t)) continue
  const quota = day < WARMUP ? Math.max(1, PER_ARM - 1) : PER_ARM
  for (const a of audiences) for (const arm of a.arms) {
    if (a.noNew) continue
    let n = 0
    for (const r of a.pool) {
      if (n >= quota) break
      if ((r as Row & { _used?: string })._used || a.armOf(r) !== arm) continue
      if (a.earliest && a.earliest(r) > t) continue
      ;(r as Row & { _used?: string })._used = '1'
      sched.push({ date: iso(t), audience: a.name, arm, step: 1, row: r }); n++
    }
  }
  day++
}
// Follow-ups for anyone who has not replied: three and seven business days later (about day 4 and day 9), so weekends never stack a Monday.
const addBusiness = (t: number, n: number) => { for (let i = 0; i < n; i++) t = nextWeekday(t + DAY); return t }
for (const s of [...sched]) for (const [step, gap] of [[2, 3], [3, 7]] as const) sched.push({ ...s, step, date: iso(addBusiness(Date.parse(s.date), gap)) })
// Where the point is to compare two groups, drop the surplus from the larger arm so both have the same count.
for (const name of ['higher ed', 'boards']) {
  const mine = sched.filter((x) => x.audience === name && x.step === 1)
  const arms = [...new Set(mine.map((x) => x.arm))]
  const min = Math.min(...arms.map((a) => mine.filter((x) => x.arm === a).length))
  for (const a of arms) {
    const extra = mine.filter((x) => x.arm === a).slice(min)
    const gone = new Set(extra.map((e) => e.row))
    for (let i = sched.length - 1; i >= 0; i--) if (gone.has(sched[i].row)) sched.splice(i, 1)
  }
}
sched.sort((a, b) => a.date.localeCompare(b.date) || a.audience.localeCompare(b.audience) || a.step - b.step)

writeFileSync(out, ['date,audience,arm,step,template,variant,timing,email,recipient_org,subject', ...sched.map((s) => [s.date, s.audience, s.arm, s.step, s.row.template, s.row.variant, s.row.timing, s.row.email, s.row.recipient_org, s.step === 1 ? s.row.subject : s.step === 2 ? s.row.followup_1.slice(0, 60) : s.row.followup_2.slice(0, 60)].map(q).join(','))].join('\n') + '\n')

const byDate = new Map<string, { n: number; f: number }>()
for (const s of sched) { const d = byDate.get(s.date) ?? { n: 0, f: 0 }; if (s.step === 1) d.n++; else d.f++; byDate.set(s.date, d) }
let peak = 0, peakDate = ''
for (const [d, v] of byDate) if (v.n + v.f > peak) { peak = v.n + v.f; peakDate = d }
console.log(`Start ${iso(start)}; ${WEEKS} weeks; ${sched.filter((s) => s.step === 1).length} new emails scheduled.`)
for (const a of audiences) {
  const mine = sched.filter((s) => s.audience === a.name && s.step === 1)
  console.log(`  ${a.name}: ${mine.length} new (${a.arms.map((arm) => `${arm} ${mine.filter((s) => s.arm === arm).length}`).join(', ')}) from a pool of ${a.pool.length}`)
}
console.log(`Peak cold emails in a day: ${peak} on ${peakDate}; with the product's ${PRODUCT} a day that is ${peak + PRODUCT} against a cap of ${CAP}${peak + PRODUCT > CAP ? ' (OVER)' : ' (under)'}.`)
