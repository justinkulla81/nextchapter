/**
 * Imports the Hunter Discover + Domain Search passes of 2026-10-30 (~/nc-hunter-results/2026-10-30-discover).
 * Clear fits are added as contacts; uncertain fits are added flagged for the Review List (needsCompletion).
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/discover-import.ts [--apply]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import type { CrmOrgType, CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const DIR = `${process.env.HOME}/nc-hunter-results/2026-10-30-discover`
const apply = process.argv.includes('--apply')

type Cat = 'provider' | 'college' | 'advisers' | 'assoc' | 'eap'
const CAT: Record<Cat, { label: string; orgType: CrmOrgType; role: CrmPersonRole; cap: number }> = {
  provider: { label: 'workforce services provider', orgType: 'WORKFORCE_PROVIDER', role: 'BD_PARTNER', cap: 3 },
  college: { label: 'college workforce and career program', orgType: 'UNIVERSITY', role: 'HIGHER_ED_CAREER', cap: 3 },
  advisers: { label: 'employment law firm that advises employers on layoffs', orgType: 'VENDOR', role: 'ADVISOR', cap: 2 },
  assoc: { label: 'association or union', orgType: 'NONPROFIT', role: 'BD_PARTNER', cap: 3 },
  eap: { label: 'employee assistance and benefits firm', orgType: 'VENDOR', role: 'ADVISOR', cap: 3 },
}
// Org-level fit: 'yes' imports clean, 'maybe' goes to the Review List, 'no' is skipped.
function orgFit(cat: Cat, name: string): 'yes' | 'maybe' | 'no' {
  const n = name.toLowerCase()
  if (cat === 'provider') return /high school|academy|enterprises|artworks|caucus|university|city of|county of/.test(n) ? 'no' : /goodwill|urban league|vocational|catholic charities|eckerd|community action|easterseals|workforce|career|employment|training|job|works|ymca|lutheran|salvation/.test(n) ? 'yes' : 'maybe'
  if (cat === 'college') return /high school|regional vocational|center and|career center|academy|intellitec|intercoast|florida career|ftc /.test(n) ? 'no' : /community college|technical college|college system|state college/.test(n) ? 'yes' : 'maybe'
  if (cat === 'advisers') return /law|llp|legal|attorney|fensterman|baker|clark hill|archer|bodman|coblentz|crowley|davis|drew eckl|ellenoff|cullen|buckingham|chartwell|csg/.test(n) ? 'yes' : 'maybe'
  if (cat === 'assoc') return /credit union|realtor|bank|trucking|land title|equipment|musicians|association of state colleges/.test(n) ? 'no' : /afscme|union|federation|workers|engineer|accountant|nurs|human resource|workforce|talent|professional|faculty/.test(n) ? 'yes' : 'maybe'
  return /insurance|health dept|accident fund|actuar/.test(n) ? 'no' : /eap|employee assistance|behavioral|curalinc|beacon|benefit/.test(n) ? 'yes' : 'maybe'
}
const TITLE_OK: Record<Cat, RegExp> = {
  provider: /executive director|president|ceo|chief executive|program|workforce|career|business services|employment|training|partnership|development|vice president|\bvp\b|director/i,
  college: /workforce|career|continuing|corporate|training|dean|president|chancellor|executive|vice president|\bvp\b|director/i,
  advisers: /partner|chair|shareholder|principal|managing|labor|employment|founder/i,
  assoc: /executive director|president|ceo|chief executive|member|career|workforce|program|partnership|vice president|\bvp\b|director/i,
  eap: /president|ceo|chief executive|partnership|business development|client|account|vice president|\bvp\b|director|human resources/i,
}
const TITLE_BAD = /residence|student services|housing|athletic|account manager|(chief|vice president|director|vp) (of )?development(?! ?(program|services))(?<!workforce development)|security|donation|loss prevention|payroll|sustainab|investment|eligibility|retail|people operations|human resources|\bhr\b|account executive|employment specialist|professor|facilit|purchasing|procurement|safety|risk|compliance|clerk|treasur|controller|finance|volunteer|admission|scholarship|financial aid|registrar|intern\b|assistant|coordinator|accountant|actuar|audit|it director|information technology|marketing|communications|development director|fundrais|legal counsel|nurse|clinical|recruiter/i

const parse = (s: string) => { const rows: string[][] = []; let r: string[] = [], f = '', q = false
  for (let i = 0; i < s.length; i++) { const c = s[i]
    if (q) { if (c === '"' && s[i + 1] === '"') { f += '"'; i++ } else if (c === '"') q = false; else f += c }
    else if (c === '"') q = true; else if (c === ',') { r.push(f); f = '' } else if (c === '\n') { r.push(f); rows.push(r); r = []; f = '' } else f += c }
  return rows.filter((x) => x.length > 1) }
interface P { cat: Cat; org: string; domain: string; first: string; last: string; position: string; email: string; conf: number; ver: string; inCrm: boolean; src: string }
function load(file: string, src: string, only?: string): P[] {
  const [h, ...rows] = parse(readFileSync(`${DIR}/${file}`, 'utf8')); const ix = (k: string) => h.indexOf(k)
  return rows.map((r) => ({ cat: (r[ix('category')] === 'workforce' ? 'provider' : r[ix('category')]) as Cat, org: r[ix('org')], domain: r[ix('domain')], first: r[ix('first')], last: r[ix('last')], position: r[ix('position')], email: r[ix('email')], conf: +r[ix('confidence')] || 0, ver: r[ix('verification')], inCrm: r[ix('alreadyInCRM')] === 'yes', src }))
    .filter((p) => !only || p.cat === (only as Cat))
}

async function main() {
  // round 1 only contributes its workforce rows, and only if the org name is a clear provider/college
  const round = process.env.ROUND ?? 'round2'
  // round 1 only contributes its workforce rows, and only for the first import
  const r1 = round === 'round2' ? load('discover-people.csv', 'round 1', 'provider').filter((p) => orgFit('provider', p.org) === 'yes' || orgFit('college', p.org) === 'yes') : []
  const all = [...load(`${round}-people.csv`, round.replace('round', 'round ')), ...r1].filter((p) => p.cat in CAT && p.first && p.last && p.position && !p.inCrm && p.conf >= 70)
  const seen = new Set<string>(); const perOrg = new Map<string, number>()
  const tally = { orgs: new Set<string>(), added: 0, matched: 0, review: 0, removed: 0, skipped: 0, flagged: 0, withEmail: 0, guessed: 0 }
  const orgIds = new Map<string, { id: string; name: string }>()
  const skipped: string[] = []
  all.sort((a, b) => (/executive director|president|ceo|chief executive|managing|partner/i.test(b.position) ? 1 : 0) - (/executive director|president|ceo|chief executive|managing|partner/i.test(a.position) ? 1 : 0) || b.conf - a.conf)
  for (const p of all) {
    const cfg = CAT[p.cat]; const key = `${p.first} ${p.last}|${p.domain}`.toLowerCase()
    let fit = orgFit(p.cat, p.org)
    const ofX = /\b(of|for)\b/i.test(p.position) && !/(program|workforce|career|business|employment|training|partnership|community|education|strategy|services|client|development|operations|impact|learning|industry)/i.test(p.position)
    if (ofX || seen.has(key) || fit === 'no' || !TITLE_OK[p.cat].test(p.position) || TITLE_BAD.test(p.position)) { tally.skipped++; skipped.push(`${p.org} | ${p.first} ${p.last} | ${p.position}`); continue }
    if ((perOrg.get(p.domain) ?? 0) >= cfg.cap) { tally.skipped++; continue }
    seen.add(key); perOrg.set(p.domain, (perOrg.get(p.domain) ?? 0) + 1); tally.orgs.add(p.domain)
    const valid = p.ver === 'valid'; const guess = !valid && p.conf >= 85 && p.ver !== 'invalid' && p.ver !== 'disposable'
    if (valid) tally.withEmail++; else if (guess) tally.guessed++
    if (fit === 'maybe') tally.flagged++
    if (!apply) { if (tally.added + tally.matched < 400) console.log(`would add [${fit}]: ${p.first} ${p.last} | ${p.position} | ${p.org} | ${p.cat} | ${valid ? 'valid' : guess ? 'guess' : 'no email'}`); tally.added++; continue }
    let org = orgIds.get(p.domain)
    if (!org) { org = await ensureOrg({ name: p.org, type: cfg.orgType as never, website: `https://${p.domain}` }); orgIds.set(p.domain, org) }
    const roles: CrmPersonRole[] = [cfg.role]
    const res = await addContactToCrm({
      fullName: `${p.first} ${p.last}`, title: p.position, email: valid ? p.email : null,
      guessedEmail: !valid && guess ? p.email : null, guessedEmailBasis: !valid && guess ? `Hunter domain search, status ${p.ver || 'unknown'}, confidence ${p.conf}` : null,
      orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
      note: `${p.position} at ${p.org}, a ${cfg.label}. Found by Hunter Discover and domain search (${p.domain}) on 2026-10-30, ${p.src}; email status ${p.ver || 'unchecked'}.${fit === 'maybe' ? ' Fit uncertain: confirm this organization is a real buyer, referrer or adviser before outreach.' : ''}`,
    })
    if (res.outcome === 'removed') tally.removed++
    else {
      tally[res.outcome]++
      if (fit === 'maybe') await prisma.crmPerson.update({ where: { id: res.personId }, data: { needsCompletion: true } })
    }
  }
  writeFileSync(`${DIR}/import-skipped-${round}.txt`, skipped.join('\n'))
  console.log({ ...tally, orgs: tally.orgs.size })
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
