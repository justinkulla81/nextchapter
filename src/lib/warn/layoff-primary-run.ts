import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { addContactToCrm, ensureOrg } from '@/lib/crm/add-contact'
import { goalsForRoles } from '@/lib/crm/goals'
import { importP0Leads } from '@/lib/crm/p0-leads'
import { buildChroRequest, verifiedChro, readLeadershipPages } from '@/lib/crm/chro-finder'
import { hunterConfigured, hunterAccount, hunterDomainSearch, isTrustedEmail } from '@/lib/crm/hunter'
import { isHrLeaderTitle, lookupDomain } from '@/lib/crm/org-domains'
import { choosePrimary, hasChro, primaryWhy, type OrgPerson, type PrimaryChoice } from '@/lib/crm/layoff-primary'
import { contactStrength } from '@/lib/crm/contact-strength'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'

/** Hunter searches kept back for the people who already use them (email finding on P0–P2). */
const HUNTER_RESERVE = 25
/** Layoffs handled per daily run: each can cost a small model call and one Hunter search. */
const MAX_PER_RUN = 8
/** A notice this old is no longer news. */
const WINDOW_DAYS = 14
/** Without a relationship to protect, a layoff smaller than this is not worth the lookup. */
const MIN_EMPLOYEES = 100

const WARN_PAGE = 'https://launchyournextchapter.com/support/admin/crm/warn'

const hostOf = (website: string | null | undefined): string | null => {
  if (!website) return null
  try { return new URL(/^https?:/i.test(website) ? website : `https://${website}`).hostname.replace(/^www\./, '') } catch { return null }
}

async function orgPeople(orgId: string): Promise<OrgPerson[]> {
  const rows = await prisma.crmPerson.findMany({
    where: { deletedAt: null, affiliations: { some: { orgId, isCurrent: true } } },
    select: {
      id: true, fullName: true, warmth: true, connectedAt: true, linkedinDegree: true,
      firstRepliedAt: true, lastTouchedAt: true, touchCount: true, notes: true,
      affiliations: { where: { orgId }, select: { title: true } },
    },
  })
  return rows.map(({ affiliations, ...p }) => ({ ...p, title: affiliations[0]?.title || null }))
}

type Fallback = 'site' | 'hunter' | null

/**
 * No CHRO on file: read the company's own leadership pages first (one small
 * model call), then, only if that finds no one, Hunter's domain search, which
 * spends one search from a limited monthly quota. Returns where the CHRO came
 * from, or null when neither found them.
 */
async function addChro(org: { id: string; name: string; website: string | null }, employer: string, claude: Anthropic): Promise<Fallback> {
  const roles: ('HIRING_MANAGER')[] = ['HIRING_MANAGER']
  const note = (how: string) => `Head of HR at ${employer}, found ${how} because ${employer} is cutting jobs and no CHRO was on file. Confirm before outreach.`

  if (org.website) {
    const pages = await readLeadershipPages(org.website).catch(() => [])
    if (pages.length) {
      const msg = await claude.messages.create(buildChroRequest(org.name, pages)).catch(() => null)
      const chro = verifiedChro(msg?.content.find((b) => b.type === 'text')?.text ?? '', pages)
      if (chro) {
        const r = await addContactToCrm({
          fullName: chro.name, title: chro.title, email: null, linkedinUrl: chro.linkedinUrl,
          orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
          note: note(`on the company's leadership page (${chro.sourceUrl})`),
        })
        if (r.outcome !== 'removed') return 'site'
      }
    }
  }

  if (!hunterConfigured()) return null
  const domain = hostOf(org.website) ?? (await lookupDomain(org.name).catch(() => null))
  if (!domain) return null
  const acct = await hunterAccount().catch(() => null)
  if (!acct || acct.requests.searches.available - acct.requests.searches.used <= HUNTER_RESERVE) return null
  const found = await hunterDomainSearch(domain, 10, 'hr').catch(() => null)
  const hr = (found?.people ?? [])
    .filter((p) => p.firstName && p.lastName && isHrLeaderTitle(p.position))
    .sort((a, b) => (b.confidence ?? 0) - (a.confidence ?? 0))[0]
  if (!hr) return null
  const r = await addContactToCrm({
    fullName: `${hr.firstName} ${hr.lastName}`, title: hr.position,
    // Stored as their email only when Hunter verified it deliverable with a high score.
    email: isTrustedEmail(hr.status, hr.confidence) ? hr.email : null,
    guessedEmail: isTrustedEmail(hr.status, hr.confidence) ? null : hr.email,
    guessedEmailBasis: isTrustedEmail(hr.status, hr.confidence) ? null : 'Hunter domain search, not verified',
    orgId: org.id, orgName: org.name, roles, goals: goalsForRoles(roles), priority: 'P2',
    note: note(`by Hunter domain search on ${domain}`),
  })
  return r.outcome === 'removed' ? null : 'hunter'
}

export interface PrimaryResult {
  orgId: string
  chro: 'had' | 'site' | 'hunter' | 'none'
  primary: { personId: string; reason: PrimaryChoice['reason'] } | null
}

export interface LayoffForPrimary {
  orgId: string
  employer: string
  employees: number | null
  date: Date
  sourceUrl: string
  kind: 'WARN' | 'LAYOFF_NEWS'
}

/**
 * Settles who to contact first for one layoff: makes sure the company has a
 * CHRO (finding one when it has none), then flags the primary contact — a warm
 * relationship before anyone else — as P0 with a follow-up due now, and says
 * why on the organization. When no one qualifies, the P0 import leaves a
 * "Find a contact" task.
 */
export async function ensureLayoffPrimaryContact(l: LayoffForPrimary, claude: Anthropic = new Anthropic()): Promise<PrimaryResult> {
  const org = await prisma.crmOrganization.findUniqueOrThrow({ where: { id: l.orgId }, select: { id: true, name: true, website: true } })

  let people = await orgPeople(org.id)
  let chro: PrimaryResult['chro'] = hasChro(people) ? 'had' : 'none'
  if (chro === 'none') {
    const how = await addChro(org, l.employer, claude)
    if (how) {
      chro = how
      people = await orgPeople(org.id)
    }
  }

  const choice = choosePrimary(people)
  const size = l.employees ? `${l.employees.toLocaleString('en-US')} jobs` : 'jobs'
  await importP0Leads([{
    trigger: {
      kind: l.kind, headline: `${l.employer} layoff (${size}): primary contact`, sourceUrl: l.sourceUrl,
      publishedAt: l.date, state: null, county: null, city: null, employees: l.employees, deadline: null, summary: null,
    },
    org: { name: org.name, type: 'EMPLOYER', website: org.website, city: null, state: null },
    person: choice ? { fullName: choice.person.fullName, title: choice.person.title, linkedinUrl: null, email: null, role: null, quote: null, phone: null } : null,
    p0: true,
    why: choice ? primaryWhy(l.employer, choice) : `No named contact, warm relationship or CHRO found for the ${l.employer} layoff.`,
  }])

  captureServerEvent('cron', 'layoff_primary_contact_set', {
    orgId: org.id, employer: l.employer, chro, reason: choice?.reason ?? 'none', strength: choice?.strength ?? null,
  })
  return { orgId: org.id, chro, primary: choice ? { personId: choice.person.id, reason: choice.reason } : null }
}

export interface SweepResult { looked: number; handled: PrimaryResult[]; skipped: number }

/**
 * Daily, after the WARN sync and the news check: every recent layoff or WARN
 * notice that is big enough (or whose employer we already know someone at)
 * gets its primary contact settled, once. A note on the organization marks it
 * done so the lookups are not repeated.
 */
export async function runLayoffPrimarySweep(max = MAX_PER_RUN): Promise<SweepResult> {
  const result: SweepResult = { looked: 0, handled: [], skipped: 0 }
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000)
  const notices = await prisma.warnNotice.findMany({
    where: { dismissedAt: null, noticeDate: { gte: since } },
    orderBy: [{ employees: { sort: 'desc', nulls: 'last' } }, { noticeDate: 'desc' }],
    take: 200,
    select: { id: true, employer: true, normalizedEmployer: true, employees: true, noticeDate: true, sourceUrl: true, source: true, promotedOrgId: true },
  })
  if (!notices.length) return result

  const marks = await prisma.crmActivity.findMany({
    where: { type: 'NOTE', sourceRef: { in: notices.map((n) => `layoffprimary:${n.id}`) } },
    select: { sourceRef: true },
  })
  const done = new Set(marks.map((m) => m.sourceRef))
  const claude = new Anthropic()

  for (const n of notices) {
    if (result.handled.length >= max) break
    if (done.has(`layoffprimary:${n.id}`)) continue
    result.looked++

    let orgId = n.promotedOrgId
    if (!orgId) {
      const found = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: n.normalizedEmployer || normalizeOrgName(n.employer) }, select: { id: true } })
      orgId = found?.id ?? null
    }
    const big = (n.employees ?? 0) >= MIN_EMPLOYEES
    // Small layoffs only count when we already know someone warm there.
    let warm = false
    if (orgId && !big) {
      const people = await orgPeople(orgId)
      warm = people.some((p) => {
        const s = contactStrength(p)
        return s === 'hot' || s === 'warm'
      })
    }
    if (!big && !warm) { result.skipped++; continue }
    if (!orgId) {
      // A reported layoff has no organization yet; a state filing that was never promoted waits for a person to promote it.
      if (n.source !== 'MANUAL_ANNOUNCEMENT') { result.skipped++; continue }
      orgId = (await ensureOrg({ name: n.employer, type: 'EMPLOYER' })).id
    }

    try {
      const r = await ensureLayoffPrimaryContact({
        orgId, employer: n.employer, employees: n.employees, date: n.noticeDate ?? new Date(),
        sourceUrl: n.sourceUrl && /^https?:\/\//i.test(n.sourceUrl) ? n.sourceUrl : `${WARN_PAGE}#${n.id}`,
        kind: n.source === 'WARN_FILING' ? 'WARN' : 'LAYOFF_NEWS',
      }, claude)
      await prisma.crmActivity.create({
        data: {
          type: 'NOTE', direction: 'INTERNAL', orgId, isAutoLogged: true, sourceRef: `layoffprimary:${n.id}`, occurredAt: new Date(),
          subject: `Primary contact settled — ${n.employer} layoff (${r.primary ? r.primary.reason : 'none found'})`.slice(0, 300),
          body: `CHRO: ${r.chro === 'had' ? 'already on file' : r.chro === 'none' ? 'not found' : `found ${r.chro === 'site' ? 'on the company site' : 'by Hunter'}`}.`,
        },
      })
      result.handled.push(r)
    } catch (e) {
      console.error('Primary contact lookup failed for', n.employer, e)
    }
  }
  return result
}
