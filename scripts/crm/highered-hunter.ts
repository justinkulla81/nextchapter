/**
 * Career services, alumni, advancement/development and executive-education leaders at four-year colleges
 * (CollegeProfile, biggest alumni base first), through Hunter Domain Search with a job-title filter.
 * One Hunter search per college. Colleges that already have two or more named contacts are skipped.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/highered-hunter.ts search <out.json> [maxColleges] [reserve]
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/highered-hunter.ts import <out.json> [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const KEY = process.env.HUNTER_API_KEY
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const TITLES = 'career services,career center,career development,alumni relations,alumni engagement,advancement,executive education,continuing education,employer relations,corporate relations'
const host = (w: string | null) => { if (!w) return null; try { return new URL(/^https?:\/\//i.test(w) ? w : `https://${w}`).hostname.replace(/^www\./, '') } catch { return null } }

const KEEP = /career|employer (relations|engagement)|corporate (relations|engagement|partnership)|alumni|advancement|executive education|continuing (education|studies)|professional (education|studies)|workforce|external relations|(vice president|chief|executive director|senior director|director)[^,]*\bdevelopment\b/i
const DROP = /library|faculty|learning and|learning &|athletic|player|collection|program development|professional development|economic development|business development|community development|student (success|development)|talent development|organizational development|leadership development|curriculum|youth|campus (life|ministry)|real estate|sponsored/i
// Leaders, not support staff: a director or above, never an assistant, specialist, coordinator or events role.
const LEADER = /director|vice (president|chancellor|provost)|\bvp\b|\bavp\b|chief|\bdean\b|head of|president|executive manager|chancellor/i
const JUNIOR = /assistant director|assistant dean|specialist|coordinator|operations|program manager|events|intern\b|associate director|analyst|administrative/i
function roleOf(t: string): CrmPersonRole | null {
  if (!KEEP.test(t) || DROP.test(t) || !LEADER.test(t) || JUNIOR.test(t)) return null
  if (/career|employer/i.test(t)) return 'HIGHER_ED_CAREER'
  if (/executive education|continuing|professional (education|studies)|workforce|corporate/i.test(t)) return 'HIGHER_ED_EXEC_ED'
  if (/alumni/i.test(t)) return 'ALUMNI_OFFICE'
  if (/advancement|development/i.test(t)) return 'HIGHER_ED_DEVELOPMENT'
  return null
}

async function search(out: string, max: number, reserve: number) {
  const acct = (await (await fetch(`https://api.hunter.io/v2/account?api_key=${KEY}`)).json()).data.requests.searches
  const budget = Math.min(max, acct.available - acct.used - reserve)
  // EXCLUDE=a.json,b.json skips colleges already searched in earlier rounds, so no credit is spent twice.
  const done = new Set<string>((process.env.EXCLUDE ?? '').split(',').filter(Boolean).flatMap((f) => (JSON.parse(readFileSync(f, 'utf8')) as any[]).map((r) => String(r.unitid))))
  const colleges = (await prisma.$queryRawUnsafe<any[]>(`select p.unitid, p.name, p.website, p.state from "CollegeProfile" p
    where p.level='${process.env.LEVEL ?? '4-year'}' and p.website is not null
      ${process.env.GRAD ? '' : 'and (select count(*) from "CollegeContact" c where c."collegeId"=p.unitid and c.name is not null) < 2'}
    order by ${process.env.GRAD ? 'coalesce(p.endowment, 0)' : 'coalesce(p."alumniEstimate", p.enrollment*5, 0)'} desc`)).filter((c) => !done.has(String(c.unitid))).slice(0, budget)
  console.log(`budget ${budget}, colleges ${colleges.length}`)
  const rows: any[] = []; let i = 0
  async function worker() {
    for (;;) {
      const c = colleges[i++]; if (!c) return
      const domain = host(c.website); if (!domain) continue
      const qs = new URLSearchParams({ domain, limit: '10', type: 'personal', job_titles: process.env.TITLES ?? TITLES, api_key: KEY! })
      let j: any = null
      for (let a = 0; a < 5; a++) {
        const res = await fetch(`https://api.hunter.io/v2/domain-search?${qs}`).catch(() => null)
        if (!res) { await sleep(3000); continue }
        if (res.status === 429 || res.status === 202) { await sleep(6000); continue }
        j = await res.json().catch(() => null); break
      }
      rows.push({ unitid: c.unitid, college: c.name, domain, state: c.state, people: (j?.data?.emails ?? []).map((e: any) => ({ first: e.first_name, last: e.last_name, title: e.position, email: e.value, confidence: e.confidence, status: e.verification?.status ?? null, linkedin: e.linkedin ?? null })) })
      await sleep(200)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(`searched ${rows.length} colleges, ${rows.reduce((s, r) => s + r.people.length, 0)} people returned. Saved ${out}`)
}

async function importFile(file: string, apply: boolean) {
  const rows = JSON.parse(readFileSync(file, 'utf8')) as any[]
  const tally: Record<string, number> = { colleges: 0, people: 0, career: 0, alumni: 0, development: 0, execEd: 0, withEmail: 0, guessed: 0, added: 0, matched: 0, review: 0, removed: 0 }
  for (const r of rows) {
    const keep = r.people.filter((p: any) => p.first && p.last && p.title && (p.confidence ?? 0) >= 70 && roleOf(p.title))
    // at most 2 per role per college
    const per: Record<string, number> = {}; const picked: any[] = []
    for (const p of keep.sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0))) { const ro = roleOf(p.title)!; per[ro] = (per[ro] ?? 0) + 1; if (per[ro] <= 2) picked.push({ ...p, role: ro }) }
    if (!picked.length) continue
    tally.colleges++
    const org = apply ? await ensureOrg({ name: r.college, type: 'UNIVERSITY' as never, website: `https://${r.domain}` }) : { id: '', name: r.college }
    for (const p of picked) {
      tally.people++; tally[{ HIGHER_ED_CAREER: 'career', ALUMNI_OFFICE: 'alumni', HIGHER_ED_DEVELOPMENT: 'development', HIGHER_ED_EXEC_ED: 'execEd' }[p.role as string]!]++
      const valid = p.status === 'valid'; const guess = !valid && p.confidence >= 85 && p.status !== 'invalid' && p.status !== 'disposable'
      if (valid) tally.withEmail++; else if (guess) tally.guessed++
      if (!apply) continue
      const roles: CrmPersonRole[] = [p.role]
      const res = await addContactToCrm({
        fullName: `${p.first} ${p.last}`, title: p.title, linkedinUrl: p.linkedin, email: valid ? p.email : null,
        guessedEmail: !valid && guess ? p.email : null, guessedEmailBasis: !valid && guess ? `Hunter domain search, status ${p.status ?? 'unknown'}, confidence ${p.confidence}` : null,
        orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
        note: `${p.title} at ${r.college}. Higher-ed lead for career services, alumni, advancement or executive education. Found by Hunter domain search (${r.domain}) on 2026-10-30; email status ${p.status ?? 'unchecked'}.`,
      })
      if (res.outcome === 'removed') tally.removed++; else tally[res.outcome]++
    }
  }
  console.log(tally)
}

async function main() {
  const [cmd, a, b, c] = process.argv.slice(2)
  if (cmd === 'search') await search(a, +b || 470, +c || 60)
  else if (cmd === 'import') await importFile(a, b === '--apply')
  else console.log('usage: search <out.json> [max] [reserve] | import <out.json> [--apply]')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
