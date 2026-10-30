/**
 * Imports researched journalists, academics and creators (~/nc-hunter-results/2026-10-30-media/*.json).
 * Each gets the contact type that says what they are (Press/Media, Policy Analyst, Connector), the kind in
 * brackets after the title so the list can be searched by it, and a note with the evidence that qualified them.
 * Only publicly published emails are used, and a published address is dropped if Hunter says it is undeliverable.
 *
 *   npx tsx --conditions=react-server --env-file=.env.local scripts/crm/media-import.ts [--apply]
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs'
import type { CrmOrgType, CrmPersonRole } from '@prisma/client'
import { prisma } from '../../src/lib/prisma'
import { addContactToCrm, ensureOrg } from '../../src/lib/crm/add-contact'
import { goalsForRoles } from '../../src/lib/crm/goals'

const DIR = `${process.env.HOME}/nc-hunter-results/2026-10-30-media`
const apply = process.argv.includes('--apply')
const KEY = process.env.HUNTER_API_KEY

interface Rec { name: string; org: string; domain: string; title: string; kind: string; email: string; contactUrl: string; evidence: string[]; note: string; role: CrmPersonRole; orgType: CrmOrgType; group: string; extra: string }
const COMPETITOR = /\b(resume writ\w*|resume services?|career coach\w*|job coach\w*|interview coach\w*|lhh|right management|risesmart|intoo|careerminds|the ladders|jobscan|zety|topresume)\b/i
const COMPETITOR_ORG = /outplacement|\b(lhh|right management|risesmart|intoo|careerminds|challenger,? gray)\b/i

function load(): Rec[] {
  const out: Rec[] = []
  const read = (f: string) => (existsSync(`${DIR}/${f}`) ? (JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8')) as any[]) : [])
  for (const j of read('journalists.json')) out.push({ name: j.name, org: j.outlet, domain: j.outlet_domain, title: j.title_or_beat, kind: j.kind, email: j.email, contactUrl: j.contact_url, evidence: j.evidence_urls ?? [], note: j.evidence_note, role: 'PRESS', orgType: 'MEDIA', group: 'journalist', extra: j.state ? `State ${j.state}. ` : '' })
  for (const a of read('academics.json')) out.push({ name: a.name, org: a.institution, domain: a.institution_domain, title: a.title, kind: a.kind, email: a.email, contactUrl: a.contact_url, evidence: a.evidence_urls ?? [], note: a.evidence_note, role: 'POLICY_ANALYST', orgType: /fed|policy/.test(a.kind) ? 'THINK_TANK' : 'UNIVERSITY', group: 'academic', extra: a.research_focus ? `Research: ${a.research_focus}. ` : '' })
  for (const c of read('creators.json')) out.push({ name: c.name, org: c.handle_or_publication, domain: '', title: `${c.platform} · ${c.audience}`, kind: c.kind, email: c.email, contactUrl: c.contact_url, evidence: c.evidence_urls ?? [], note: c.evidence_note, role: /newsletter|youtube|podcast/.test(c.kind) ? 'PRESS' : 'CONNECTOR', orgType: 'MEDIA', group: 'creator', extra: `Topic: ${c.topic}. ` })
  return out
}

async function verify(email: string): Promise<string> {
  if (!KEY) return 'unchecked'
  for (let a = 0; a < 3; a++) {
    const res = await fetch(`https://api.hunter.io/v2/email-verifier?email=${encodeURIComponent(email)}&api_key=${KEY}`).catch(() => null)
    if (!res) continue
    if (res.status === 202 || res.status === 429) { await new Promise((r) => setTimeout(r, 4000)); continue }
    const j: any = await res.json().catch(() => null)
    return j?.data?.status ?? 'unchecked'
  }
  return 'unchecked'
}

async function main() {
  const recs = load()
  const drop: string[] = []; const keep: Rec[] = []; const seen = new Set<string>()
  for (const r of recs) {
    const why =
      !r.name || r.name.trim().split(/\s+/).length < 2 ? 'single-word name'
      : !r.org ? 'no organization'
      : (COMPETITOR_ORG.test(`${r.org} ${r.title}`) || COMPETITOR.test(`${r.title}`)) ? 'competitor-like'
      : r.group === 'journalist' && r.evidence.length < 2 ? 'fewer than 2 evidence links'
      : r.evidence.length < 1 ? 'no evidence link'
      : seen.has(r.name.toLowerCase()) ? 'duplicate'
      : ''
    if (why) { drop.push(`${r.name} | ${r.org} | ${why}`); continue }
    seen.add(r.name.toLowerCase()); keep.push(r)
  }
  const tally: Record<string, number> = { kept: keep.length, dropped: drop.length, added: 0, matched: 0, review: 0, removed: 0, withEmail: 0, emailDropped: 0 }
  const byKind: Record<string, number> = {}
  for (const r of keep) {
    byKind[`${r.role}/${r.kind}`] = (byKind[`${r.role}/${r.kind}`] ?? 0) + 1
    // A published email must be at the outlet or institution (or a close variant), else it is dropped, not guessed at.
    let email = (r.email || '').trim().toLowerCase()
    const dom = r.domain.replace(/^www\./, '').toLowerCase()
    if (email && dom && !email.split('@')[1]?.endsWith(dom.split('.').slice(-2).join('.'))) { email = ''; tally.emailDropped++ }
    if (!apply) { if (email) tally.withEmail++; continue }
    if (email) { const s = await verify(email); if (s === 'invalid' || s === 'disposable') { email = ''; tally.emailDropped++ } }
    if (email) tally.withEmail++
    const org = await ensureOrg({ name: r.org, type: r.orgType as never, website: r.domain ? `https://${r.domain}` : undefined })
    const roles: CrmPersonRole[] = [r.role]
    const res = await addContactToCrm({
      fullName: r.name, title: `${r.title} [${r.kind}]`, email: email || null, linkedinUrl: /linkedin\.com/.test(r.contactUrl) ? r.contactUrl : null,
      orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
      note: `${r.kind} (${r.group}). ${r.extra}${r.note} Evidence: ${r.evidence.slice(0, 3).join(' ; ')}.${r.contactUrl ? ` Public contact: ${r.contactUrl}.` : ''} Found by web research 2026-10-30; a reach-for-citation contact, not a buyer.`,
    })
    if (res.outcome === 'removed') tally.removed++; else tally[res.outcome]++
  }
  writeFileSync(`${DIR}/import-dropped.txt`, drop.join('\n'))
  console.log(tally, byKind)
  await prisma.$disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
