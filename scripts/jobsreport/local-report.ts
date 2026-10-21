/**
 * Local jobs report for any city, county or state defined in geos.json, with peer comparisons.
 *
 *   npx tsx --env-file=.env.local scripts/jobsreport/local-report.ts --geo louisville-metro
 *   npx tsx --env-file=.env.local scripts/jobsreport/local-report.ts --geo kentucky --peers louisville-metro,lexington-ky
 *
 * Writes scripts/jobsreport/out/<geo>.json and <geo>.md. Reads ExclusiveJobPosting (the feed) for
 * the postings analysis and jobsreport_posting (crawler history) for functions gaining and losing.
 *
 * Scope rule (CLAUDE.md): reports cover all white-collar jobs at every level. The feed holds
 * mid-level and above only, so the report states that; jobsreport_posting keeps every level.
 * Comparisons across places are always made within source type (aggregator vs direct), because
 * aggregator rows carry short text extracts and different pay disclosure.
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '@/lib/prisma'

const HERE = path.dirname(new URL(import.meta.url).pathname)
type Geo = { label: string; include: string; exclude: string; countyFips: string[]; peers?: string[] }
type Row = Record<string, unknown>

const FAMILY_CASE = `case
  when title ~* 'software|developer|devops|cloud|cyber|security engineer|network|systems admin|\\mit\\M|information technology|data engineer|machine learning|architect' then 'Technology and IT'
  when title ~* 'data scientist|data analyst|business intelligence|analytics' then 'Data and analytics'
  when title ~* 'nurse|\\mrn\\M|clinical|physician|therap|pharmac|patient|medical|health' then 'Healthcare and clinical'
  when title ~* 'financ|account|audit|tax|controller|treasur|actuar|underwrit|bank|credit|loan' then 'Finance and accounting'
  when title ~* 'supply chain|logistic|procure|purchasing|warehouse|transport|distribution|planner|inventory' then 'Supply chain and logistics'
  when title ~* 'manufactur|plant|production|quality|maintenance|mechanical|electrical|industrial|process engineer|engineer' then 'Manufacturing and engineering'
  when title ~* 'sales|account executive|business development|marketing|brand|customer success' then 'Sales and marketing'
  when title ~* 'human resources|recruit|talent|benefits|\\mhr\\M' then 'HR and recruiting'
  when title ~* 'attorney|counsel|legal|paralegal|compliance' then 'Legal and compliance'
  when title ~* 'project manager|program manager|operations manager|general manager|director of operations' then 'Operations and program management'
  else 'Other' end`

const CTE = `with l0 as (
  select p."companyName" c, p.title, p."salaryMin" smin, p."salaryMax" smax, (p.url ilike '%jooble%') agg,
    lower(coalesce(p.title,'')||' '||coalesce(left(p.description,6000),'')) d,
    case when p.level='ENTRY' then '0 Entry-level'
         when p.level='MID_IC' then '1 Mid-level IC' when p.level in ('SENIOR_IC','PRINCIPAL') then '2 Senior IC'
         when p.level in ('MANAGER','SR_MANAGER') then '3 Manager' when p.level is null then '9 Unknown' else '4 Director and above' end lg,
    ${FAMILY_CASE.replace(/title/g, 'p.title')} fam
  from "ExclusiveJobPosting" p where p."archivedAt" is null and p.location ~* $1 and p.location !~* $2),
l as (select *, d ~ '\\m(ai|artificial intelligence|machine learning|generative|llm|copilot)\\M' is_ai from l0)`

function loadQueries(): Record<string, string> {
  const text = fs.readFileSync(path.join(HERE, 'local_report.sql'), 'utf8')
  const out: Record<string, string> = {}
  for (const part of text.split(/^-- name: /m).slice(1)) {
    const nl = part.indexOf('\n')
    out[part.slice(0, nl).trim()] = part.slice(nl + 1).replace(/^--.*$/gm, '').trim().replace(/;\s*$/, '')
  }
  return out
}

const json = (v: unknown) => JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? Number(x) : x)))

async function runGeo(geo: Geo, queries: Record<string, string>) {
  const res: Record<string, Row[]> = {}
  for (const [name, sql] of Object.entries(queries)) {
    const full = sql.trimStart().toLowerCase().startsWith('with ')
      ? CTE.replace(/\)\s*$/, ')') + ',\n' + sql.replace(/^with\s+/i, '')
      : `${CTE}\n${sql}`
    res[name] = json(await prisma.$queryRawUnsafe<Row[]>(full, geo.include, geo.exclude))
  }
  return res
}

/** Functions gaining and losing: needs at least two months of crawler history. */
async function functionTrend(geo: Geo) {
  const rows = await prisma.$queryRawUnsafe<Row[]>(
    `select to_char(date_trunc('month', coalesce(posted_at, first_seen)), 'YYYY-MM') month,
            ${FAMILY_CASE.replace(/title/g, 'title')} fam, count(*)::int postings
     from jobsreport_posting where location_raw ~* $1 and location_raw !~* $2
     group by 1, 2 order by 1, 2`, geo.include, geo.exclude)
  const months = [...new Set(rows.map((r) => String(r.month)))].sort()
  if (months.length < 2) return { available: false, reason: `${months.length} month(s) of history; at least 2 needed`, rows: [] }
  const [prev, cur] = months.slice(-2)
  const by = (m: string) => Object.fromEntries(rows.filter((r) => r.month === m).map((r) => [String(r.fam), Number(r.postings)]))
  const a = by(prev), b = by(cur)
  const change = Object.keys({ ...a, ...b }).map((f) => ({
    fam: f, prev: a[f] ?? 0, cur: b[f] ?? 0, change: (b[f] ?? 0) - (a[f] ?? 0),
    pct: a[f] ? Math.round((1000 * ((b[f] ?? 0) - a[f])) / a[f]) / 10 : null,
  })).sort((x, y) => y.change - x.change)
  return { available: true, prev, cur, rows: change }
}

const fmt = (v: unknown) => (v === null || v === undefined ? '' : typeof v === 'number' ? (Number.isInteger(v) ? v.toLocaleString('en-US') : String(v)) : String(v))
function table(rows: Row[]) {
  if (!rows.length) return '_No rows._\n'
  const cols = Object.keys(rows[0])
  return [`| ${cols.join(' | ')} |`, `| ${cols.map(() => '---').join(' | ')} |`, ...rows.map((r) => `| ${cols.map((c) => fmt(r[c])).join(' | ')} |`)].join('\n') + '\n'
}

async function main() {
  const arg = (n: string) => { const i = process.argv.indexOf(`--${n}`); return i > -1 ? process.argv[i + 1] : undefined }
  const geos: Record<string, Geo> = JSON.parse(fs.readFileSync(path.join(HERE, 'geos.json'), 'utf8'))
  const key = arg('geo')
  if (!key || !geos[key]) throw new Error(`--geo required; one of: ${Object.keys(geos).join(', ')}`)
  const peers = (arg('peers') ?? (geos[key].peers ?? []).join(',')).split(',').filter(Boolean)
  const queries = loadQueries()

  const main = await runGeo(geos[key], queries)
  const trend = await functionTrend(geos[key])
  const comparison: Record<string, { label: string; by_source: Row[] }> = {}
  for (const p of [key, ...peers]) {
    if (!geos[p]) throw new Error(`unknown peer ${p}`)
    comparison[p] = { label: geos[p].label, by_source: json(await prisma.$queryRawUnsafe(`${CTE}\n${queries.overview_by_source}`, geos[p].include, geos[p].exclude)) }
  }

  const outDir = path.join(HERE, 'out')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, `${key}.json`), JSON.stringify({ geo: key, label: geos[key].label, generatedAt: new Date().toISOString(), main, trend, comparison }, null, 2))

  const md: string[] = [`# ${geos[key].label}: local jobs report data (${new Date().toISOString().slice(0, 10)})`, '',
    'Scope: postings in the feed are mid-level and above; entry-level white-collar postings are not yet included. Shares from aggregator rows are lower bounds (short text extracts).', '']
  for (const [name, rows] of Object.entries(main)) md.push(`## ${name.replace(/_/g, ' ')}`, '', table(rows))
  md.push('## functions gaining and losing', '', trend.available ? table(trend.rows as Row[]) : `Not available: ${trend.reason}.\n`)
  md.push('## comparison with peers (within source type)', '')
  for (const [p, c] of Object.entries(comparison)) md.push(`### ${c.label}${p === key ? ' (this place)' : ''}`, '', table(c.by_source))
  fs.writeFileSync(path.join(outDir, `${key}.md`), md.join('\n'))
  console.log(`wrote ${path.join(outDir, key)}.json and .md`)
}

main().finally(() => prisma.$disconnect())
