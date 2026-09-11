/**
 * Imports the five legacy spreadsheets into the admin CRM (Phase 2).
 *
 * DRY RUN BY DEFAULT — prints the merge report and writes nothing. Pass
 * --commit to actually write. Idempotent: organisations upsert on
 * canonicalNameNormalized, people on linkedinSlug (falling back to a
 * normalizedKey lookup), affiliations on (person, org, title), and an
 * opportunity is skipped when one already exists for the same pipeline and
 * counterparty. Re-running after fixing a source file updates in place.
 *
 *   npm run crm:import            # dry run
 *   npm run crm:import -- --commit
 *   npm run crm:import -- --dir /path/to/csvs
 *
 * The four .xlsx sources are converted to CSV before this runs (see
 * scripts/crm/README.md) so the repo needs no spreadsheet dependency.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { PrismaClient, type CrmPersonRole, type CrmOrgType, type CrmEligibility } from '@prisma/client'
import { normalizeOrgName } from '../src/lib/text/org-name-match'
import {
  parseCsv, toRows, linkedinSlug, cleanEmail, cleanPersonName, isRealOrgName,
  parseCheckSize, parseDateish, type SourceRow,
} from './crm/parse'

const prisma = new PrismaClient()

const COMMIT = process.argv.includes('--commit')
const DIR = (() => {
  const i = process.argv.indexOf('--dir')
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : join(process.cwd(), '.crm-sources')
})()

// ── in-memory graph ──────────────────────────────────────────────────────────

interface OrgDraft {
  name: string
  key: string
  types: Set<CrmOrgType>
  website?: string | null
  hqRegion?: string | null
  industry?: string | null
  focus?: string | null
  sources: Set<string>
  rows: { file: string; sheet: string; row: number; raw: Record<string, string> }[]
  investor?: { checkMin: number | null; checkMax: number | null; checkNote: string | null; thesis: string | null; responsiveness: string | null; eligibility: CrmEligibility }
  outplacement?: { headcount: number | null; pctWhiteCollar: string | null; announcedAt: Date | null; incumbent: string | null; sourceUrl: string | null; angle: string | null }
  partner?: { partnershipType: string | null; valueExchange: string | null }
  research?: { engagementType: string[]; flagship: string | null; notablePeople: string | null; primaryFocus: string | null }
  deadlines: { label: string; dueAt: Date | null; rawText: string | null; kind: 'APPLICATION_CLOSE' | 'ROLLING_NO_DATE'; sourceUrl: string | null }[]
  opportunity?: { pipeline: string; title: string; eligibility: CrmEligibility; quality: string | null; amountMin: number | null; amountMax: number | null; nextStep: string | null }
}

interface PersonDraft {
  fullName: string
  slug: string | null
  linkedinUrl: string | null
  email: string | null
  title: string | null
  orgKey: string | null
  normalizedKey: string | null
  roles: Set<CrmPersonRole>
  connectedAt: Date | null
  sources: Set<string>
  rows: { file: string; sheet: string; row: number; raw: Record<string, string> }[]
  matchTier: string
  needsCompletion: boolean
}

const orgs = new Map<string, OrgDraft>()
const people: PersonDraft[] = []
const bySlug = new Map<string, PersonDraft>()
const byEmail = new Map<string, PersonDraft>()
const byNameKey = new Map<string, PersonDraft>()
const byName = new Map<string, PersonDraft>()
const reviewQueue: { name: string; org: string; source: string; collidesWith: string; existingSources: string }[] = []
const conflicts: { entity: string; name: string; field: string; kept: string; rejected: string; source: string }[] = []
const researchItems: { title: string; url: string | null; year: number | null; keyClaim: string | null; orgKey: string | null }[] = []

function nameKeyOf(name: string, orgKey: string | null): string | null {
  const n = name.toLowerCase().replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ').trim()
  return orgKey ? `${n}|${orgKey}` : null
}

function upsertOrg(rawName: string | null, source: string, type: CrmOrgType, prov: { file: string; sheet: string; row: number; raw: Record<string, string> } | null, fields: Partial<OrgDraft> = {}): OrgDraft | null {
  if (!isRealOrgName(rawName)) return null
  const key = normalizeOrgName(rawName!)
  if (!key) return null
  let o = orgs.get(key)
  if (!o) {
    o = { name: rawName!.trim(), key, types: new Set(), sources: new Set(), rows: [], deadlines: [] }
    orgs.set(key, o)
  }
  o.types.add(type)
  o.sources.add(source)
  if (prov) o.rows.push(prov)
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined || v === '') continue
    const cur = (o as Record<string, unknown>)[k]
    if (cur === undefined || cur === null || cur === '') (o as Record<string, unknown>)[k] = v
    else if (typeof cur === 'string' && typeof v === 'string' && cur.trim() !== v.trim()) {
      conflicts.push({ entity: 'org', name: o.name, field: k, kept: cur.slice(0, 160), rejected: v.slice(0, 160), source })
    }
  }
  return o
}

function upsertPerson(rawName: string | null, source: string, opts: {
  linkedin?: string | null; email?: string | null; title?: string | null
  orgName?: string | null; roles?: CrmPersonRole[]; connectedAt?: Date | null
  prov?: { file: string; sheet: string; row: number; raw: Record<string, string> } | null
}): PersonDraft | null {
  const name = cleanPersonName(rawName)
  if (!name) return null
  const slug = linkedinSlug(opts.linkedin)
  const email = cleanEmail(opts.email)
  const orgKey = isRealOrgName(opts.orgName) ? normalizeOrgName(opts.orgName!) : null
  const nk = nameKeyOf(name, orgKey)
  const lowerName = name.toLowerCase()

  let hit: PersonDraft | undefined
  let tier = 'CREATE'
  if (slug && bySlug.has(slug)) { hit = bySlug.get(slug); tier = 'MERGE · 1 linkedin slug' }
  else if (email && byEmail.has(email)) { hit = byEmail.get(email); tier = 'MERGE · 2 email' }
  else if (nk && byNameKey.has(nk)) { hit = byNameKey.get(nk); tier = 'MERGE · 3 name+org' }
  else if (byName.has(lowerName)) {
    const other = byName.get(lowerName)!
    reviewQueue.push({ name, org: opts.orgName ?? '', source, collidesWith: other.fullName, existingSources: [...other.sources].sort().join(' + ') })
    // deliberately NOT merged — a shared name is not evidence of a shared person
  }

  if (hit) {
    hit.sources.add(source)
    for (const r of opts.roles ?? []) hit.roles.add(r)
    if (opts.prov) hit.rows.push(opts.prov)
    const assign = (field: keyof PersonDraft, val: string | null) => {
      if (!val) return
      const cur = hit![field] as string | null
      if (!cur) (hit as Record<string, unknown>)[field] = val
      else if (cur.trim().toLowerCase() !== val.trim().toLowerCase()) {
        conflicts.push({ entity: 'person', name: hit!.fullName, field: String(field), kept: cur.slice(0, 160), rejected: val.slice(0, 160), source })
      }
    }
    assign('title', opts.title ?? null)
    assign('email', email)
    if (slug && !hit.slug) { hit.slug = slug; bySlug.set(slug, hit) }
    if (!hit.linkedinUrl && opts.linkedin) hit.linkedinUrl = opts.linkedin
    if (!hit.orgKey && orgKey) { hit.orgKey = orgKey; const k = nameKeyOf(hit.fullName, orgKey); if (k) { hit.normalizedKey = k; byNameKey.set(k, hit) } }
    if (email && !byEmail.has(email)) byEmail.set(email, hit)
    if (!hit.connectedAt && opts.connectedAt) hit.connectedAt = opts.connectedAt
    hit.needsCompletion = !hit.title || !hit.orgKey
    return hit
  }

  const p: PersonDraft = {
    fullName: name, slug, linkedinUrl: opts.linkedin ?? null, email, title: opts.title ?? null,
    orgKey, normalizedKey: nk, roles: new Set(opts.roles ?? []), connectedAt: opts.connectedAt ?? null,
    sources: new Set([source]), rows: opts.prov ? [opts.prov] : [], matchTier: tier,
    needsCompletion: !opts.title || !orgKey,
  }
  people.push(p)
  if (slug) bySlug.set(slug, p)
  if (email) byEmail.set(email, p)
  if (nk) byNameKey.set(nk, p)
  if (!byName.has(lowerName)) byName.set(lowerName, p)
  return p
}

// ── source readers ───────────────────────────────────────────────────────────

function read(file: string): SourceRow[] {
  const path = join(DIR, file)
  if (!existsSync(path)) { console.error(`  MISSING: ${path}`); return [] }
  return toRows(readFileSync(path, 'utf8'))
}

function eligibilityOf(v: string | null): CrmEligibility {
  const s = (v ?? '').toLowerCase()
  if (!s.trim()) return 'UNKNOWN'
  if (s.startsWith('yes')) return 'FOR_PROFIT_ELIGIBLE'
  if (s.includes('partner') || s.includes('research')) return 'PARTNER_OR_RESEARCH'
  return 'NONPROFIT_ONLY'
}

/** Networking CRM "Segment(s)" strings → CRM roles. Unmapped values become OTHER. */
const SEGMENT_ROLES: Record<string, CrmPersonRole> = {
  'vc/gp': 'INVESTOR_VC', 'sr recruiter': 'RECRUITER_PROSPECT', 'senior hr': 'CHRO_HR',
  coach: 'COACH_PROSPECT', 'sr advisor': 'ADVISOR', 'indie consultant': 'ADVISOR',
  fractional: 'ADVISOR', workforce: 'BD_PARTNER', 'platforms/l&d': 'BD_PARTNER',
  'education/edtech': 'BD_PARTNER', 'bd/partnerships': 'BD_PARTNER', 'biz school': 'ALUMNI_OFFICE',
  'alumni dir': 'ALUMNI_OFFICE', 'lead-gen': 'CONNECTOR', connector: 'CONNECTOR',
  entrepreneurship: 'CONNECTOR', unemployed: 'JOB_SEEKER', 'product/eng talent': 'EMPLOYEE_CANDIDATE',
  outplacement: 'OUTPLACEMENT_BUYER', 'hiring manager': 'HIRING_MANAGER',
  'philanthropy / impact': 'OTHER', other: 'OTHER',
}

function loadFunding() {
  const rows = read('funding.csv')
  for (const r of rows) {
    const prov = { file: 'FUNDING_SHEET', sheet: 'All Funding', row: r.rowNumber, raw: r.raw }
    const elig = eligibilityOf(r.get('For-Profit'))
    const cs = parseCheckSize(r.get('Check Size') ?? r.get('Money / Value'))
    const o = upsertOrg(r.get('Organization'), 'funding', 'FUNDER_GRANT', prov, {
      website: r.get('Link'), hqRegion: r.get('Geography'), focus: r.get('Why it fits / Positioning'),
    })
    if (o) {
      if (/vc|venture|capital|partners|fund/i.test(r.get('Category') ?? '')) o.types.add('VC_FUND')
      if (/angel/i.test(r.get('Category') ?? '')) o.types.add('ANGEL_SYNDICATE')
      o.investor ??= {
        checkMin: cs.min, checkMax: cs.max, checkNote: r.get('Check Size'),
        thesis: r.get('Why it fits / Positioning'), responsiveness: r.get('Responsiveness (est.)'), eligibility: elig,
      }
      o.opportunity ??= {
        pipeline: 'fundraising', title: `${o.name} — ${r.get('Program') ?? 'funding'}`.slice(0, 180),
        eligibility: elig, quality: r.get('Priority'), amountMin: cs.min, amountMax: cs.max,
        nextStep: r.get('Recommended Ask / Next Step'),
      }
      for (const label of ['Deadline', 'Next Deadline']) {
        const raw = r.get(label)
        if (!raw) continue
        const d = parseDateish(raw)
        o.deadlines.push({
          label, dueAt: d, rawText: d ? null : raw,
          kind: d ? 'APPLICATION_CLOSE' : 'ROLLING_NO_DATE', sourceUrl: r.get('Link'),
        })
      }
    }
    upsertPerson(r.get('Warm Connection'), 'funding', {
      linkedin: r.get('Conn. LinkedIn'), email: r.get('Conn. Email'), title: r.get('Conn. Title'),
      orgName: r.get('Organization'), roles: ['INVESTOR_VC'], prov,
    })
    // Secondary contacts are buried in prose in the verification column — recover
    // them rather than losing a real warm path to a formatting decision.
    const note = r.get('Verification / Note') ?? ''
    const re = /([A-Z][a-zA-Z.'-]+(?: [A-Z][a-zA-Z.'-]+){1,2})\s*\((https:\/\/www\.linkedin\.com\/in\/[^)]+)\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(note)) !== null) {
      upsertPerson(m[1], 'funding-note', { linkedin: m[2], orgName: r.get('Organization'), roles: ['INVESTOR_VC'], prov })
    }
  }
  return rows.length
}

function loadBd() {
  const rows = read('bd.csv')
  for (const r of rows) {
    const prov = { file: 'BD_PARTNERSHIPS_SHEET', sheet: 'All Partnerships', row: r.rowNumber, raw: r.raw }
    const o = upsertOrg(r.get('Organization'), 'bd', 'VENDOR', prov, {
      website: r.get('Link'), hqRegion: r.get('Geography'), focus: r.get('Why it fits / Positioning'),
    })
    if (o) {
      o.partner ??= { partnershipType: r.get('Category'), valueExchange: r.get('Money / Value') }
      o.opportunity ??= {
        pipeline: 'bd_partnerships', title: `${o.name} — ${r.get('Program') ?? 'partnership'}`.slice(0, 180),
        eligibility: 'NOT_APPLICABLE', quality: r.get('Priority'), amountMin: null, amountMax: null,
        nextStep: r.get('Recommended Ask / Next Step'),
      }
    }
    upsertPerson(r.get('Warm Connection'), 'bd', {
      linkedin: r.get('Conn. LinkedIn'), email: r.get('Conn. Email'), title: r.get('Conn. Title'),
      orgName: r.get('Organization'), roles: ['BD_PARTNER'], prov,
    })
  }
  return rows.length
}

function loadPolicy() {
  const rows = read('policy.csv')
  for (const r of rows) {
    const prov = { file: 'RESEARCH_POLICY_SHEET', sheet: 'Landscape', row: r.rowNumber, raw: r.raw }
    const type = r.get('Type') ?? ''
    const orgType: CrmOrgType = /academic|universit/i.test(type) ? 'UNIVERSITY'
      : /think tank|policy/i.test(type) ? 'THINK_TANK'
      : /government|public data/i.test(type) ? 'GOVERNMENT'
      : /nonprofit|intermediar/i.test(type) ? 'NONPROFIT' : 'VENDOR'
    const o = upsertOrg(r.get('Organization'), 'policy', orgType, prov, {
      website: r.get('Website'), hqRegion: r.get('Geography'), focus: r.get('Primary Focus'),
    })
    if (o) {
      o.research ??= {
        engagementType: (r.get('Engagement Type') ?? '').split('·').map((s) => s.trim()).filter(Boolean),
        flagship: r.get('Flagship Output / Why Known'), notablePeople: r.get('Notable People'),
        primaryFocus: r.get('Primary Focus'),
      }
      o.opportunity ??= {
        pipeline: 'policy_advisers', title: `${o.name} — ${r.get('Center / Program') ?? 'research'}`.slice(0, 180),
        eligibility: 'NOT_APPLICABLE', quality: r.get('Relevance'), amountMin: null, amountMax: null,
        nextStep: r.get('How NextChapter should engage'),
      }
    }
    upsertPerson(r.get('Warm Connection'), 'policy', {
      linkedin: r.get('Conn. LinkedIn'), email: r.get('Conn. Email'), title: r.get('Conn. Title'),
      orgName: r.get('Conn. Company') ?? r.get('Organization'), roles: ['POLICY_ANALYST'], prov,
    })
    const second = r.get('2nd Warm Connection')
    if (second) {
      upsertPerson(second.split(/\s+[—-]\s+/)[0], 'policy', { orgName: r.get('Organization'), roles: ['POLICY_ANALYST'], prov })
    }
    for (const nb of (r.get('Notable People') ?? '').split(',')) {
      if (nb.trim()) upsertPerson(nb, 'policy-notable', { orgName: r.get('Organization'), roles: ['ACADEMIC'], prov })
    }
  }
  // Key studies → research items, stance left UNSET on purpose.
  for (const r of read('studies.csv')) {
    const t = r.get('Title')
    if (!t) continue
    const orgName = r.get('Author / Organization')
    researchItems.push({
      title: t, url: r.get('Link'),
      year: r.get('Year') ? parseInt(r.get('Year')!, 10) || null : null,
      keyClaim: r.get('Key finding / stat you can quote'),
      orgKey: isRealOrgName(orgName) ? normalizeOrgName(orgName!) : null,
    })
  }
  return rows.length
}

function loadOutplacement() {
  const rows = read('outplacement.csv')
  for (const r of rows) {
    const prov = { file: 'OUTPLACEMENT_SHEET', sheet: 'Lead Tracker', row: r.rowNumber, raw: r.raw }
    const o = upsertOrg(r.get('Company'), 'outplacement', 'OUTPLACEMENT_LEAD', prov, {
      industry: r.get('Industry'), focus: r.get('Outreach Angle'),
    })
    if (o) {
      const hc = r.get('Headcount Affected')?.replace(/[^\d]/g, '')
      o.outplacement ??= {
        headcount: hc ? parseInt(hc, 10) : null, pctWhiteCollar: r.get('% White-Collar'),
        announcedAt: parseDateish(r.get('Date Announced')), incumbent: r.get('Existing Provider'),
        sourceUrl: r.get('Source Link(s)'), angle: r.get('Outreach Angle'),
      }
      o.opportunity ??= {
        pipeline: 'outplacement', title: `${o.name} — ${r.get('Headcount Affected') ?? 'reduction'}`.slice(0, 180),
        eligibility: 'NOT_APPLICABLE', quality: null, amountMin: null, amountMax: null,
        nextStep: r.get('Outreach Angle'),
      }
    }
    const c = r.get('HR/People Contact')
    if (c && !/not listed/i.test(c)) {
      upsertPerson(c, 'outplacement', { orgName: r.get('Company'), roles: ['CHRO_HR'], prov })
    }
  }
  return rows.length
}

function loadNetworking() {
  const rows = read('networking.csv')
  for (const r of rows) {
    const prov = { file: 'NETWORKING_CRM_SHEET', sheet: 'Contacts', row: r.rowNumber, raw: {} }
    const name = `${r.get('First Name') ?? ''} ${r.get('Last Name') ?? ''}`.trim()
    if (!name) continue
    const roles = (r.get('Segment(s)') ?? '').split(',')
      .map((s) => SEGMENT_ROLES[s.trim().toLowerCase()])
      .filter((x): x is CrmPersonRole => Boolean(x))
    upsertPerson(name, 'networking', {
      linkedin: r.get('LinkedIn URL'), email: r.get('Email'), title: r.get('Position'),
      orgName: r.get('Company'), roles: roles.length ? roles : ['OTHER'],
      connectedAt: parseDateish(r.get('Connected On')), prov,
    })
    upsertOrg(r.get('Company'), 'networking', 'EMPLOYER', null, { industry: r.get('Industry') })
  }
  return rows.length
}

// ── report + write ───────────────────────────────────────────────────────────

async function main() {
  console.log('='.repeat(72))
  console.log(`  CRM SOURCE IMPORT — ${COMMIT ? 'COMMIT (writing)' : 'DRY RUN (no writes)'}`)
  console.log(`  source dir: ${DIR}`)
  console.log('='.repeat(72))

  const counts = {
    funding: loadFunding(), bd: loadBd(), policy: loadPolicy(),
    outplacement: loadOutplacement(), networking: loadNetworking(),
  }
  console.log('\nINPUT ROWS')
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(16)}${String(v).padStart(7)}`)

  const multiRole = people.filter((p) => p.roles.size > 1).length
  const multiType = [...orgs.values()].filter((o) => o.types.size > 1).length
  const needsCompletion = people.filter((p) => p.needsCompletion).length
  const withOpp = [...orgs.values()].filter((o) => o.opportunity).length
  const allDeadlines = [...orgs.values()].flatMap((o) => o.deadlines)

  console.log(`\nWOULD CREATE`)
  console.log(`  people          ${String(people.length).padStart(7)}`)
  console.log(`  organizations   ${String(orgs.size).padStart(7)}`)
  console.log(`  opportunities   ${String(withOpp).padStart(7)}   (curated sources only; networking rows stay people-not-leads)`)
  console.log(`  research items  ${String(researchItems.length).padStart(7)}   stance UNSET`)
  console.log(`  deadlines       ${String(allDeadlines.length).padStart(7)}   ${allDeadlines.filter((d) => d.dueAt).length} with a real date, ${allDeadlines.filter((d) => !d.dueAt).length} prose-only`)
  console.log(`\nMODEL VALIDATION`)
  console.log(`  people with 2+ roles  ${String(multiRole).padStart(5)}`)
  console.log(`  orgs with 2+ types    ${String(multiType).padStart(5)}`)
  console.log(`\nNEEDS REVIEW`)
  console.log(`  review queue    ${String(reviewQueue.length).padStart(7)}   name-only collisions, never auto-merged`)
  console.log(`  field conflicts ${String(conflicts.length).padStart(7)}   existing value kept`)
  console.log(`  needs completion${String(needsCompletion).padStart(7)}   missing title or organization`)

  if (!COMMIT) {
    console.log('\nDry run complete. Nothing written. Re-run with --commit to apply.')
    return
  }

  console.log('\nWriting...')

  // Batched writes throughout: the naive per-row upsert loop is ~7,400
  // sequential round-trips over the pooler for this dataset. Existing rows are
  // loaded once into maps, new rows go out via createManyAndReturn.
  const BATCH = 500
  const chunk = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / BATCH) }, (_, i) => xs.slice(i * BATCH, i * BATCH + BATCH))

  // ── organizations ──
  const companies = await prisma.company.findMany({ select: { id: true, canonicalNameNormalized: true } })
  const companyByKey = new Map(companies.map((c) => [c.canonicalNameNormalized, c.id]))
  const existingOrgs = await prisma.crmOrganization.findMany({ select: { id: true, canonicalNameNormalized: true } })
  const orgIdByKey = new Map(existingOrgs.map((o) => [o.canonicalNameNormalized, o.id]))

  const newOrgs = [...orgs.values()].filter((o) => !orgIdByKey.has(o.key))
  let linkedToCompany = 0
  for (const part of chunk(newOrgs)) {
    const created = await prisma.crmOrganization.createManyAndReturn({
      data: part.map((o) => {
        const companyId = companyByKey.get(o.key) ?? null
        if (companyId) linkedToCompany++
        return {
          name: o.name, canonicalNameNormalized: o.key, orgTypes: [...o.types],
          website: o.website ?? null, hqRegion: o.hqRegion ?? null,
          industry: o.industry ?? null, focus: o.focus ?? null, companyId,
        }
      }),
      select: { id: true, canonicalNameNormalized: true },
      skipDuplicates: true,
    })
    for (const c of created) orgIdByKey.set(c.canonicalNameNormalized, c.id)
  }
  console.log(`  organizations   ${newOrgs.length} created, ${orgs.size - newOrgs.length} already present (${linkedToCompany} linked to a Company row)`)

  // ── people ──
  const existingPeople = await prisma.crmPerson.findMany({
    select: { id: true, linkedinSlug: true, normalizedKey: true, fullName: true },
  })
  const exBySlug = new Map(existingPeople.filter((p) => p.linkedinSlug).map((p) => [p.linkedinSlug!, p.id]))
  const exByKey = new Map(existingPeople.filter((p) => p.normalizedKey).map((p) => [p.normalizedKey!, p.id]))
  const exByName = new Map(existingPeople.map((p) => [p.fullName.toLowerCase(), p.id]))

  const personIds = new Map<PersonDraft, string>()
  const toCreate: PersonDraft[] = []
  for (const p of people) {
    const hit = (p.slug && exBySlug.get(p.slug)) || (p.normalizedKey && exByKey.get(p.normalizedKey)) || exByName.get(p.fullName.toLowerCase())
    if (hit) personIds.set(p, hit)
    else toCreate.push(p)
  }
  for (const part of chunk(toCreate)) {
    const created = await prisma.crmPerson.createManyAndReturn({
      data: part.map((p) => ({
        fullName: p.fullName,
        firstName: p.fullName.split(' ')[0] ?? null,
        lastName: p.fullName.split(' ').slice(1).join(' ') || null,
        linkedinSlug: p.slug, linkedinUrl: p.linkedinUrl, email: p.email,
        emails: p.email ? [p.email] : [], normalizedKey: p.normalizedKey,
        roles: [...p.roles], connectedAt: p.connectedAt, needsCompletion: p.needsCompletion,
      })),
      select: { id: true, fullName: true, linkedinSlug: true },
      skipDuplicates: true,
    })
    // createManyAndReturn preserves input order for the rows it inserted.
    created.forEach((c, i) => personIds.set(part[i], c.id))
    console.log(`  people          ${personIds.size}/${people.length}`)
  }

  // ── affiliations ──
  const affRows = people
    .map((p) => {
      const pid = personIds.get(p); const oid = p.orgKey ? orgIdByKey.get(p.orgKey) : null
      return pid && oid ? { personId: pid, orgId: oid, title: p.title ?? '' } : null
    })
    .filter((x): x is { personId: string; orgId: string; title: string } => x !== null)
  let affCount = 0
  for (const part of chunk(affRows)) {
    const r = await prisma.crmAffiliation.createMany({ data: part, skipDuplicates: true }); affCount += r.count
  }
  console.log(`  affiliations    ${affCount}`)

  // ── profiles ──
  const orgList = [...orgs.values()].filter((o) => orgIdByKey.has(o.key))
  const inv = orgList.filter((o) => o.investor).map((o) => ({ orgId: orgIdByKey.get(o.key)!, checkSizeMinUsd: o.investor!.checkMin, checkSizeMaxUsd: o.investor!.checkMax, checkSizeNote: o.investor!.checkNote, thesis: o.investor!.thesis, responsiveness: o.investor!.responsiveness, eligibility: o.investor!.eligibility }))
  const outp = orgList.filter((o) => o.outplacement).map((o) => ({ orgId: orgIdByKey.get(o.key)!, headcountAffected: o.outplacement!.headcount, pctWhiteCollar: o.outplacement!.pctWhiteCollar, announcedAt: o.outplacement!.announcedAt, incumbentProvider: o.outplacement!.incumbent, sourceUrl: o.outplacement!.sourceUrl, outreachAngle: o.outplacement!.angle }))
  const part_ = orgList.filter((o) => o.partner).map((o) => ({ orgId: orgIdByKey.get(o.key)!, partnershipType: o.partner!.partnershipType, valueExchange: o.partner!.valueExchange }))
  const res_ = orgList.filter((o) => o.research).map((o) => ({ orgId: orgIdByKey.get(o.key)!, engagementType: o.research!.engagementType, flagshipOutput: o.research!.flagship, notablePeople: o.research!.notablePeople, primaryFocus: o.research!.primaryFocus }))
  const p1 = await prisma.crmInvestorProfile.createMany({ data: inv, skipDuplicates: true })
  const p2 = await prisma.crmOutplacementProfile.createMany({ data: outp, skipDuplicates: true })
  const p3 = await prisma.crmPartnerProfile.createMany({ data: part_, skipDuplicates: true })
  const p4 = await prisma.crmResearchProfile.createMany({ data: res_, skipDuplicates: true })
  console.log(`  profiles        ${p1.count + p2.count + p3.count + p4.count}  (investor ${p1.count}, outplacement ${p2.count}, partner ${p3.count}, research ${p4.count})`)

  // ── deadlines ──
  const existingDl = await prisma.crmDeadline.findMany({ select: { orgId: true, label: true } })
  const dlSeen = new Set(existingDl.map((d) => `${d.orgId}|${d.label}`))
  const dlRows = orgList.flatMap((o) => o.deadlines
    .filter((d) => !dlSeen.has(`${orgIdByKey.get(o.key)}|${d.label}`))
    .map((d) => ({ orgId: orgIdByKey.get(o.key)!, label: d.label, dueAt: d.dueAt, rawText: d.rawText, kind: d.kind, sourceUrl: d.sourceUrl })))
  let dlCount = 0
  for (const part of chunk(dlRows)) { const r = await prisma.crmDeadline.createMany({ data: part, skipDuplicates: true }); dlCount += r.count }
  console.log(`  deadlines       ${dlCount}  (${dlRows.filter((d) => d.dueAt).length} with a real date)`)

  // ── opportunities ──
  const pipelines = await prisma.crmPipeline.findMany({ include: { stages: true } })
  const pipeByKey = new Map(pipelines.map((p) => [p.key, p]))
  const existingOpp = await prisma.crmOpportunity.findMany({ select: { pipelineId: true, orgId: true } })
  const oppSeen = new Set(existingOpp.map((o) => `${o.pipelineId}|${o.orgId}`))
  const oppRows = orgList.flatMap((o) => {
    if (!o.opportunity) return []
    const pipe = pipeByKey.get(o.opportunity.pipeline); if (!pipe) return []
    const orgId = orgIdByKey.get(o.key)!
    if (oppSeen.has(`${pipe.id}|${orgId}`)) return []
    const stage = pipe.stages.find((s) => s.key === 'identified')!
    return [{ pipelineId: pipe.id, stageId: stage.id, orgId, title: o.opportunity.title, eligibility: o.opportunity.eligibility, amountUsdMin: o.opportunity.amountMin, amountUsdMax: o.opportunity.amountMax, nextStep: o.opportunity.nextStep }]
  })
  let oppCount = 0
  for (const part of chunk(oppRows)) { const r = await prisma.crmOpportunity.createMany({ data: part, skipDuplicates: true }); oppCount += r.count }
  console.log(`  opportunities   ${oppCount}`)

  // ── research items ──
  const existingRi = new Set((await prisma.crmResearchItem.findMany({ select: { title: true } })).map((r) => r.title))
  const riRows = researchItems.filter((r) => !existingRi.has(r.title)).map((r) => ({ title: r.title, url: r.url, publishedYear: r.year, keyClaim: r.keyClaim, orgId: r.orgKey ? orgIdByKey.get(r.orgKey) ?? null : null }))
  const ri = await prisma.crmResearchItem.createMany({ data: riRows, skipDuplicates: true })
  console.log(`  research items  ${ri.count}`)

  // ── provenance ──
  const srExisting = await prisma.crmSourceRecord.count()
  let srCount = 0
  if (srExisting === 0) {
    const srRows = people.flatMap((p) => {
      const pid = personIds.get(p); if (!pid) return []
      return p.rows.slice(0, 4).map((row) => ({ sourceFile: row.file as never, sourceSheet: row.sheet, sourceRow: row.row, rawJson: row.raw, personId: pid, matchTier: p.matchTier }))
    })
    for (const part of chunk(srRows)) { const r = await prisma.crmSourceRecord.createMany({ data: part, skipDuplicates: true }); srCount += r.count }
  }
  // ── LinkedIn corpus for quick add ──
  //
  // Not CRM records: a lookup table. Quick add pastes a profile URL and needs
  // a name/title/company back, and LinkedIn cannot be fetched server-side —
  // profile pages return a login wall to anything that isn't a signed-in
  // browser, and working around that breaches their terms. So the prefill is
  // served from the admin's own data export instead.
  const liPath = join(DIR, 'linkedin.csv')
  let liCount = 0
  if (existsSync(liPath)) {
    const already = await prisma.crmLinkedInConnection.count()
    if (already === 0) {
      // LinkedIn puts a variable-length notes preamble above the real header,
      // so find the header row rather than assuming an offset — parseCsv also
      // drops the blank separator line, which shifts any hardcoded index.
      const liText = readFileSync(liPath, 'utf8')
      const headerIdx = parseCsv(liText).findIndex((r) => r[0] === 'First Name')
      if (headerIdx < 0) throw new Error('linkedin.csv: could not find the "First Name" header row')
      const liRows = toRows(liText, headerIdx)
      const seen = new Set<string>()
      const data = liRows.flatMap((r) => {
        const slug = linkedinSlug(r.get('URL'))
        if (!slug || seen.has(slug)) return []
        seen.add(slug)
        return [{
          slug,
          firstName: r.get('First Name'), lastName: r.get('Last Name'),
          company: r.get('Company'), position: r.get('Position'),
          email: cleanEmail(r.get('Email Address')),
          connectedOn: parseDateish(r.get('Connected On')),
        }]
      })
      for (const part of chunk(data)) {
        const res = await prisma.crmLinkedInConnection.createMany({ data: part, skipDuplicates: true })
        liCount += res.count
      }
    }
    console.log(`  linkedin corpus ${liCount}${already > 0 ? ' (skipped — already populated)' : ''}`)
  }

  console.log(`  source records  ${srCount}${srExisting > 0 ? ' (skipped — already populated)' : ''}`)
  console.log('\nDone.')
}

main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
