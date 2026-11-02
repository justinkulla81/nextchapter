/**
 * Named leaders at the organizations in ~/nc-hunter-results/2026-10-30-categories/orgs2.json, by Hunter Domain Search with a
 * job-title filter (one search per organization), then imported with a contact type and a kind that say what each person is.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/categories-hunter.ts search <out.json>
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/categories-hunter.ts import <out.json> [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { CrmOrgType, CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const KEY = process.env.HUNTER_API_KEY
const DIR = `${process.env.HOME}/nc-hunter-results/2026-10-30-categories`
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const LEAD = /director|head\b|vice president|\bvp\b|chief|officer|president|lead\b|partner|chair|manager of|managing/i
const IC = /assistant|associate(?! partner)|analyst|coordinator|specialist|representative|account (manager|executive)|sales|intern|sourcer|administrative|engineer|designer|counsel(?!.*chief)|marketing|finance|public relations|operations|technology|administration|client success|legal|security/i

interface Cat { label: string; kind: string; role: CrmPersonRole; orgType: CrmOrgType; titles: string; keep: RegExp; perOrg: number }
const CATS: Record<string, Cat> = {
  funder_ai: { label: 'funder: AI, tech and economic-mobility philanthropy', kind: 'funder', role: 'GRANTS', orgType: 'FOUNDATION', perOrg: 3, titles: 'program officer,program director,economic mobility,future of work,workforce,education,grants,partnerships,policy,opportunity', keep: /program|economic|future of work|workforce|opportunit|grant|partnership|policy|education|impact|strategy|initiative|research|social/i },
  community_funder: { label: 'funder: community foundation or United Way', kind: 'community funder', role: 'GRANTS', orgType: 'FOUNDATION', perOrg: 3, titles: 'program officer,community investment,impact,grants,workforce,economic mobility,programs', keep: /program|community|impact|grant|workforce|economic|investment|partnership|initiative/i },
  training: { label: 'training and AI-course provider', kind: 'training partner', role: 'GTM_PARTNER', orgType: 'VENDOR', perOrg: 2, titles: 'partnerships,business development,workforce,enterprise,government,alliances,channel', keep: /partnership|business development|workforce|enterprise|government|alliance|channel|public sector/i },
  fractional: { label: 'interim and fractional work marketplace', kind: 'fractional marketplace', role: 'GTM_PARTNER', orgType: 'VENDOR', perOrg: 2, titles: 'partnerships,talent,supply,expert network,community,business development', keep: /partnership|talent|supply|expert|community|business development|network/i },
  immigration: { label: 'immigration law firm or visa-holder network', kind: 'immigration', role: 'ADVISOR', orgType: 'VENDOR', perOrg: 2, titles: 'partner,practice,business immigration,chair,managing partner', keep: /immigration|practice|partner|chair|managing|membership|executive director/i },
  credit_union: { label: 'credit union or credit union association', kind: 'credit union', role: 'BD_PARTNER', orgType: 'OTHER', perOrg: 2, titles: 'member benefits,financial wellness,community,partnerships,member experience,corporate relations,business development', keep: /member|financial wellness|community|partnership|corporate relations|business development|financial health/i },
  planner: { label: 'financial planner or CPA association', kind: 'financial planners', role: 'BD_PARTNER', orgType: 'NONPROFIT', perOrg: 2, titles: 'executive director,membership,partnerships,programs,chief', keep: /executive|membership|partnership|program|chief|director|member/i },
  buy_business: { label: 'buy-a-business partner: broker, lender or acquisition investor', kind: 'buy-a-business', role: 'GTM_PARTNER', orgType: 'VENDOR', perOrg: 2, titles: 'partnerships,business development,brokerage,sba,community,director', keep: /partnership|business development|brokerage|sba|community|franchise|acquisition|lending|program|director/i },
  hiring_employer: { label: 'hiring employer: talent acquisition', kind: 'hiring employer', role: 'HIRING_MANAGER', orgType: 'EMPLOYER', perOrg: 2, titles: 'talent acquisition,executive recruiting,experienced hire,senior recruiting,head of talent', keep: /talent acquisition|recruit|talent|hiring|staffing/i },
}

async function search(out: string) {
  const orgs = JSON.parse(readFileSync(`${DIR}/orgs2.json`, 'utf8')) as Record<string, [string, string][]>
  const seen = new Set<string>()
  const jobs = Object.entries(orgs).flatMap(([cat, l]) => l.map(([org, domain]) => ({ cat, org, domain }))).filter((j) => CATS[j.cat] && !seen.has(`${j.cat}|${j.domain}`) && seen.add(`${j.cat}|${j.domain}`))
  const rows: any[] = []; let i = 0
  async function worker() {
    for (;;) {
      const j = jobs[i++]; if (!j) return
      const qs = new URLSearchParams({ domain: j.domain, limit: '10', type: 'personal', job_titles: CATS[j.cat].titles, api_key: KEY! })
      let r: any = null
      for (let a = 0; a < 5; a++) {
        const res = await fetch(`https://api.hunter.io/v2/domain-search?${qs}`).catch(() => null)
        if (!res) { await sleep(3000); continue }
        if (res.status === 429 || res.status === 202) { await sleep(6000); continue }
        r = await res.json().catch(() => null); break
      }
      rows.push({ ...j, people: (r?.data?.emails ?? []).map((e: any) => ({ first: e.first_name, last: e.last_name, title: e.position, email: e.value, confidence: e.confidence, status: e.verification?.status ?? null, linkedin: e.linkedin ?? null })) })
      await sleep(200)
    }
  }
  await Promise.all(Array.from({ length: 3 }, worker))
  writeFileSync(out, JSON.stringify(rows, null, 1))
  console.log(`searched ${rows.length} organizations, ${rows.reduce((s, r) => s + r.people.length, 0)} people returned. Saved ${out}`)
}

async function importFile(file: string, apply: boolean) {
  const rows = JSON.parse(readFileSync(file, 'utf8')) as any[]
  const t: Record<string, number> = { orgs: 0, people: 0, withEmail: 0, guessed: 0, added: 0, matched: 0, review: 0, removed: 0 }
  const byCat: Record<string, number> = {}
  for (const r of rows) {
    const c = CATS[r.cat]
    const picked = r.people.filter((p: any) => p.first && p.last && p.title && (p.confidence ?? 0) >= 70 && c.keep.test(p.title) && LEAD.test(p.title) && !IC.test(p.title)).sort((a: any, b: any) => (b.confidence ?? 0) - (a.confidence ?? 0)).slice(0, c.perOrg)
    if (!picked.length) continue
    t.orgs++
    const org = apply ? await ensureOrg({ name: r.org, type: c.orgType as never, website: `https://${r.domain}` }) : { id: '', name: r.org }
    for (const p of picked) {
      t.people++; byCat[r.cat] = (byCat[r.cat] ?? 0) + 1
      const valid = p.status === 'valid'; const guess = !valid && p.confidence >= 85 && p.status !== 'invalid' && p.status !== 'disposable'
      if (valid) t.withEmail++; else if (guess) t.guessed++
      if (!apply) continue
      const roles: CrmPersonRole[] = [c.role]
      const res = await addContactToCrm({
        fullName: `${p.first} ${p.last}`, title: `${p.title} [${c.kind}]`, linkedinUrl: p.linkedin, email: valid ? p.email : null,
        guessedEmail: !valid && guess ? p.email : null, guessedEmailBasis: !valid && guess ? `Hunter domain search, status ${p.status ?? 'unknown'}, confidence ${p.confidence}` : null,
        orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
        note: `${p.title} at ${r.org}: ${c.label}. Found by Hunter domain search (${r.domain}) on 2026-10-30; email status ${p.status ?? 'unchecked'}.`,
      })
      if (res.outcome === 'removed') t.removed++; else t[res.outcome]++
    }
  }
  console.log(t, byCat); await prisma.$disconnect()
}
async function main() {
  const [cmd, a, b] = process.argv.slice(2)
  if (cmd === 'search') await search(a); else if (cmd === 'import') await importFile(a, b === '--apply'); else console.log('usage: search <out.json> | import <out.json> [--apply]')
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
