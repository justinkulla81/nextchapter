import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'
import { describe, expect, it } from 'vitest'

// Data budget guard (CLAUDE.md "Database egress: never read a big table whole"). A findMany on one of the big tables with neither a
// `where` nor a `take` reads the whole table every time it runs; such reads were most of the Supabase egress overruns of November 2026.
// A new one fails here. If it is really needed (a nightly job, a read held in sharedLoad), add it to REVIEWED with its rows a run, runs
// a day and where the result is held, and put the GB a day in the PR.

const BIG_TABLES = ['company', 'exclusiveJobPosting', 'boardLightRow', 'geoPlace', 'crmOrganization', 'crmPerson', 'mailingListMember', 'warnNotice', 'companySignal', 'surfacedJob', 'analyticsEvent']

/** file → big-table models it may read whole (reviewed 2026-11-21; each is a cron or a held/shared read). */
const REVIEWED: Record<string, string[]> = {
  'src/app/api/cron/company-signals/route.ts': ['company'],
  'src/app/support/admin/(portal)/crm/company-links/page.tsx': ['company'],
  'src/app/support/admin/(portal)/crm/duplicates/page.tsx': ['company', 'crmOrganization'],
  'src/lib/jobs/search-breadth-server.ts': ['geoPlace'],
  'src/lib/companies/find-company-by-name.ts': ['company'],
  'src/lib/companies/outplacement-signal.ts': ['company'],
  'src/lib/companies/company-graph-sync.ts': ['company'],
  'src/lib/companies/directory-rows.ts': ['company'],
  'src/lib/companies/company-ranking-data.ts': ['company'],
  'src/lib/crm/guess-emails.ts': ['crmOrganization'],
  'src/lib/crm/chro-sync.ts': ['crmOrganization'],
  'src/lib/warn/company-match.ts': ['company'],
  'src/lib/warn/sync.ts': ['warnNotice', 'crmOrganization'],
  'src/lib/events/sec-events.ts': ['company'],
  'src/lib/search-firms/sync.ts': ['crmOrganization'],
  'src/lib/workforce/college-crm.ts': ['crmOrganization'],
  'src/lib/workforce/college-rank.ts': ['crmOrganization'],
  'src/lib/mailing/tracking.ts': ['mailingListMember'],
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'test' || name === 'node_modules' ? [] : files(p)
    return /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

/** The argument text of the call that opens at `open` (the index of its '('), by balanced parentheses. */
function callArgs(src: string, open: number): string {
  let depth = 0
  for (let i = open; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')' && --depth === 0) return src.slice(open + 1, i)
  }
  return src.slice(open + 1)
}

/** Each unbounded findMany on a big table in `src`: the model and the line. Exported shape kept local; checked below. */
function wholeTableReads(src: string): { model: string; line: number }[] {
  const out: { model: string; line: number }[] = []
  const re = new RegExp(`prisma\\.(${BIG_TABLES.join('|')})\\.findMany\\(`, 'g')
  for (const m of src.matchAll(re)) {
    const args = callArgs(src, m.index! + m[0].length - 1)
    // Only the top level of the argument counts: a `where` inside a nested `select` does not bound the outer read.
    let depth = 0
    let top = ''
    for (const ch of args) {
      if (ch === '{') depth++
      if (depth <= 1) top += ch
      if (ch === '}') depth--
    }
    if (/\b(where|take|cursor)\b/.test(top)) continue
    out.push({ model: m[1], line: src.slice(0, m.index).split('\n').length })
  }
  return out
}

describe('no whole-table reads of big tables', () => {
  it('finds the unbounded form and lets a bounded one through', () => {
    expect(wholeTableReads('prisma.company.findMany({ select: { id: true } })')).toHaveLength(1)
    expect(wholeTableReads('prisma.company.findMany()')).toHaveLength(1)
    expect(wholeTableReads('prisma.company.findMany({ where: { id: { in: ids } }, select: { id: true } })')).toHaveLength(0)
    expect(wholeTableReads('prisma.company.findMany({ select: { id: true }, take: 50 })')).toHaveLength(0)
    expect(wholeTableReads('prisma.company.findMany({ where, select: { id: true } })')).toHaveLength(0)
    expect(wholeTableReads('prisma.geoPlace.findMany({ select: { id: true, things: { where: { a: 1 } } } })')).toHaveLength(1)
  })

  it('has no new unbounded findMany on a big table outside the reviewed list', () => {
    const root = process.cwd()
    const found: string[] = []
    for (const f of files(join(root, 'src'))) {
      const rel = relative(root, f)
      for (const r of wholeTableReads(readFileSync(f, 'utf8'))) {
        if (!(REVIEWED[rel] ?? []).includes(r.model)) found.push(`${rel}:${r.line} reads ${r.model} whole`)
      }
    }
    expect(found).toEqual([])
  })
})
