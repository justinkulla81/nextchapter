/**
 * The HR people at layoff employers, from Hunter. Two steps, so nothing is paid for twice:
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/hunter-hr.ts search <maxSearches> <out.json>
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/hunter-hr.ts import <out.json> [--apply]
 *
 * search: for the U.S. WARN filers of the last 90 days (100+ jobs) and the A-grade outplacement
 * leads, one Domain Search each (by the organization's domain, else its name), HR department,
 * senior and executive people only. Stops at <maxSearches>. An address whose status is not given
 * is checked with the Email Verifier (up to HUNTER_VERIFY_MAX, default 300).
 *
 * import: a `valid` address becomes the person's email; anything else with confidence of 85 or
 * more is kept as a guess (never written into email). A name already at the organization is
 * matched, not duplicated; a name that matches someone elsewhere goes to the Review List.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'
import { isHrLeaderTitle } from '../../src/lib/crm/org-domains'

const KEY = process.env.HUNTER_API_KEY
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

type Kind = 'head_hr' | 'total_rewards' | 'employee_relations' | 'talent_acquisition' | 'hr_business_partner' | 'learning_development' | 'other_hr'
function kindOf(title: string): Kind | null {
  // U.S. only, and company-wide: a country or regional title is not the person to write to about a U.S. layoff.
  if (/\b(emea|apac|apj|latam|europe|asia|india|china|uk|u\.k\.|germany|france|spain|italy|japan|australia|canada|mexico|brazil|singapore|israel|country|international)\b/i.test(title)) return null
  if (/analytics|information systems|technology|payroll|\bit\b/i.test(title)) return 'other_hr'
  if (isHrLeaderTitle(title)) return 'head_hr'
  if (/total rewards|compensation|benefits/i.test(title)) return 'total_rewards'
  if (/employee relations|labor relations|labour relations/i.test(title)) return 'employee_relations'
  if (/talent acquisition|recruit|staffing/i.test(title)) return 'talent_acquisition'
  if (/learning|training|development/i.test(title) && /human|hr|people|talent|learning/i.test(title)) return 'learning_development'
  if (/business partner|hrbp|hr (director|manager|generalist)|human resources (director|manager|business)/i.test(title)) return 'hr_business_partner'
  if (/human resources|\bhr\b|people (operations|partner|team|&|and culture|experience)|workforce|talent|culture|payroll|organizational/i.test(title)) return 'other_hr'
  return null
}
const ROLES: Record<Kind, CrmPersonRole[]> = {
  head_hr: ['HIRING_MANAGER', 'OUTPLACEMENT_BUYER'],
  total_rewards: ['OUTPLACEMENT_BUYER'], employee_relations: ['OUTPLACEMENT_BUYER'], talent_acquisition: ['OUTPLACEMENT_BUYER'],
  hr_business_partner: ['OUTPLACEMENT_BUYER'], learning_development: ['LEARNING_DEV_HEAD'], other_hr: ['OUTPLACEMENT_BUYER'],
}

interface Hit { first: string; last: string; title: string; kind: Kind; email: string; confidence: number; status: string | null; linkedin: string | null }
interface Row { orgId: string; org: string; employees: number | null; mode: 'warn' | 'leads'; domain: string | null; viaName: boolean; hits: Hit[]; error?: string }

/** A company name Hunter can search: no "(at ...)", "*Updated*", ", Etal", or legal ending. */
function searchName(name: string): string {
  return name.replace(/\*[^*]*\*/g, '').replace(/\(.*?\)/g, '').replace(/,?\s*et\s?al\.?/i, '').replace(/[’']s\b/g, '')
    .replace(/,?\s+(inc|llc|l\.l\.c|corp|corporation|co|company|ltd|plc|lp|llp)\.?\s*$/i, '').trim()
}
const hostOf = (site: string | null) => (site ? site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase() : null)

async function hunter(path: string, params: Record<string, string>): Promise<any> {
  const qs = new URLSearchParams({ ...params, api_key: KEY! })
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await fetch(`https://api.hunter.io/v2/${path}?${qs}`, { signal: AbortSignal.timeout(30_000) }).catch(() => null)
    if (!res) { await sleep(3000); continue }
    if (res.status === 429 || res.status === 202) { await sleep(6000 * (attempt + 1)); continue }
    if (res.status === 401 || res.status === 403) throw new Error(`Hunter refused the request (${res.status})`)
    return res.json().catch(() => null)
  }
  return null
}

async function search(max: number, out: string) {
  if (!KEY) throw new Error('HUNTER_API_KEY is not set')
  const since = new Date(Date.now() - Number(process.env.WARN_DAYS ?? 90) * 86_400_000)
  const warn = await prisma.warnNotice.groupBy({
    by: ['promotedOrgId'],
    where: { promotedOrgId: { not: null }, source: 'WARN_FILING', state: { not: null }, dismissedAt: null, noticeDate: { gte: since } },
    _sum: { employees: true },
  })
  const targets = new Map<string, { employees: number; mode: 'warn' | 'leads' }>()
  for (const w of warn) if ((w._sum.employees ?? 0) >= Number(process.env.WARN_MIN ?? 100)) targets.set(w.promotedOrgId!, { employees: w._sum.employees ?? 0, mode: 'warn' })
  // PROFESSIONAL_ONLY=1: keep only filers in a professional-heavy industry or on the reviewed list (scripts/crm/professional-employers.json), so no searches go to farms and plants.
  if (process.env.PROFESSIONAL_ONLY) {
    const keys = new Set(Object.keys((JSON.parse(readFileSync(new URL('./professional-employers.json', import.meta.url), 'utf8')) as { employers: Record<string, string> }).employers))
    const ok = new Set<string>()
    for (const n of await prisma.warnNotice.findMany({ where: { promotedOrgId: { in: [...targets.keys()] }, source: 'WARN_FILING', dismissedAt: null, noticeDate: { gte: since } }, select: { promotedOrgId: true, industry: true, normalizedEmployer: true } })) {
      if (/^(tech:|51\b|52\b|54\b|55\b)/i.test(n.industry ?? '') || keys.has(n.normalizedEmployer)) ok.add(n.promotedOrgId!)
    }
    for (const id of [...targets.keys()]) if (!ok.has(id)) targets.delete(id)
  }
  const leads = await prisma.crmOrganization.findMany({
    where: { leadQuality: 'A', outplacementProfile: { isNot: null }, usState: { not: null } },
    select: { id: true, outplacementProfile: { select: { headcountAffected: true } } },
  })
  for (const l of leads) if (!targets.has(l.id)) targets.set(l.id, { employees: l.outplacementProfile?.headcountAffected ?? 0, mode: 'leads' })
  const orgs = await prisma.crmOrganization.findMany({ where: { id: { in: [...targets.keys()] } }, select: { id: true, name: true, emailDomain: true, website: true } })
  const queue = orgs.map((o) => ({ o, t: targets.get(o.id)! })).sort((a, b) => b.t.employees - a.t.employees)
  // ONLY_NO_LEADER=1: skip any organization that already has a head of HR in the CRM.
  if (process.env.ONLY_NO_LEADER) {
    const aff = await prisma.crmAffiliation.findMany({ where: { orgId: { in: orgs.map((o) => o.id) }, person: { deletedAt: null } }, select: { orgId: true, title: true } })
    const has = new Set(aff.filter((a) => a.title && isHrLeaderTitle(a.title)).map((a) => a.orgId))
    for (let i = queue.length - 1; i >= 0; i--) if (has.has(queue[i].o.id)) queue.splice(i, 1)
  }
  console.log(`${queue.length} organizations; up to ${max} searches`)

  const rows: Row[] = []
  let searches = 0, verifies = 0
  const verifyMax = Number(process.env.HUNTER_VERIFY_MAX ?? 300)
  const worker = async () => {
    for (let q = queue.shift(); q; q = queue.shift()) {
      if (searches >= max) return
      searches++
      const domain = q.o.emailDomain ?? hostOf(q.o.website)
      const params: Record<string, string> = { limit: '10', department: 'hr', seniority: 'senior,executive', type: 'personal' }
      if (domain) params.domain = domain; else params.company = searchName(q.o.name)
      const row: Row = { orgId: q.o.id, org: q.o.name, employees: q.t.employees || null, mode: q.t.mode, domain: null, viaName: !domain, hits: [] }
      try {
        const j = await hunter('domain-search', params)
        const data = j?.data
        row.domain = data?.domain ?? domain
        for (const e of data?.emails ?? []) {
          const kind = e.position ? kindOf(e.position) : null
          if (!kind || !e.first_name || !e.last_name || (e.confidence ?? 0) < 70) continue
          let status: string | null = e.verification?.status ?? null
          if (!status && verifies < verifyMax) {
            verifies++
            const v = await hunter('email-verifier', { email: e.value })
            status = v?.data?.status ?? null
          }
          row.hits.push({ first: e.first_name, last: e.last_name, title: e.position, kind, email: e.value, confidence: e.confidence, status, linkedin: e.linkedin ?? null })
        }
        if (!data && j?.errors) row.error = JSON.stringify(j.errors).slice(0, 160)
      } catch (e) { row.error = e instanceof Error ? e.message : String(e) }
      rows.push(row)
      if (rows.length % 10 === 0) console.log(`${rows.length} done, ${searches} searches, ${verifies} verifications, ${rows.reduce((s, r) => s + r.hits.length, 0)} people`)
      await sleep(250)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(`done: ${rows.length} organizations, ${searches} searches, ${verifies} verifications, ${rows.reduce((s, r) => s + r.hits.length, 0)} people, ${rows.filter((r) => r.error).length} errors. Saved ${out}`)
  const acct = await hunter('account', {})
  const rq = acct?.data?.requests
  if (rq) console.log(`Hunter left: ${rq.searches?.remaining} searches, ${rq.verifications?.remaining} verifications`)
}

async function importFile(file: string, apply: boolean) {
  const rows = JSON.parse(readFileSync(file, 'utf8')) as Row[]
  const tally = { people: 0, withEmail: 0, guessed: 0, added: 0, matched: 0, review: 0, removed: 0, domains: 0 }
  for (const r of rows) {
    const org = await prisma.crmOrganization.findUnique({ where: { id: r.orgId }, select: { id: true, name: true, emailDomain: true } })
    if (!org) continue
    if (apply && r.domain && !org.emailDomain && !r.viaName) { await prisma.crmOrganization.update({ where: { id: org.id }, data: { emailDomain: r.domain, emailDomainSource: 'Hunter' } }); tally.domains++ }
    else if (apply && r.domain && !org.emailDomain) { await prisma.crmOrganization.update({ where: { id: org.id }, data: { emailDomain: r.domain, emailDomainSource: 'Hunter (by name)' } }); tally.domains++ }
    for (const h of r.hits) {
      tally.people++
      const valid = h.status === 'valid'
      const guess = !valid && h.confidence >= 85 && h.status !== 'invalid' && h.status !== 'disposable'
      if (valid) tally.withEmail++; else if (guess) tally.guessed++
      if (!apply) { console.log(`would add: ${h.first} ${h.last} | ${h.title} | ${org.name} | ${valid ? 'valid' : guess ? 'guess' : 'no email'}`); continue }
      const roles = ROLES[h.kind]
      const why = r.mode === 'leads' ? 'an outplacement lead (recent layoff)' : 'which filed a WARN layoff notice'
      const res = await addContactToCrm({
        fullName: `${h.first} ${h.last}`.trim(), title: h.title, linkedinUrl: h.linkedin,
        email: valid ? h.email : null,
        guessedEmail: !valid && guess ? h.email : null, guessedEmailBasis: !valid && guess ? `Hunter domain search, status ${h.status ?? 'unknown'}, confidence ${h.confidence}` : null,
        orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: h.kind === 'head_hr' ? 'P1' : 'P2',
        note: `${h.title} at ${org.name}, ${why}${r.employees ? ` (${r.employees} employees)` : ''}. Found by Hunter domain search (${r.domain ?? 'by company name'}), email status ${h.status ?? 'unchecked'}.`,
      })
      if (res.outcome === 'removed') tally.removed++
      else tally[res.outcome]++
    }
  }
  console.log(tally)
}

async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  if (cmd === 'search') await search(Number(a ?? 100), b ?? 'hunter-hr.json')
  else if (cmd === 'import') await importFile(a, b === '--apply')
  else console.log('usage: search <maxSearches> <out.json> | import <out.json> [--apply]')
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
