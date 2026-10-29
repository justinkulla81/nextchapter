import 'server-only'
import { prisma } from '@/lib/prisma'
import { alertBody, type AlertInput, type LayoffKind } from './layoff-alert-rules'
import { layoffPeople } from './layoff-alert-people'
import { withComposeLinks } from './layoff-alert-drafts'
import { draftContext } from './layoff-alert-links'
import { inferHq } from './layoff-hq-state'
import { buildLocalPicture, classifyLayoffIndustry } from './layoff-context'
import { pictureRows, placeFromHeadlines, talkingPoints, type Audience } from './layoff-picture'
import { contactStrength } from '@/lib/crm/contact-strength'

const SITE = 'https://launchyournextchapter.com'
const PARTNER: Record<string, Audience> = { rapid_response: 'rapid_response', workforce_board: 'workforce_board', job_centers: 'job_centers', economic_development: 'economic_development' }

/**
 * The same page the layoff alert email shows (the layoff, the local picture, who to contact with a Write email button on each), for any
 * notice, built on demand. It reads only what is already stored: no Hunter search and no model call, so a layoff with no contacts found yet
 * shows fewer people, not a bill. Nothing is sent.
 */
export async function layoffAlertView(noticeId: string): Promise<{ employer: string; html: string } | null> {
  const n = await prisma.warnNotice.findUnique({
    where: { id: noticeId },
    select: {
      id: true, employer: true, normalizedEmployer: true, employees: true, source: true, sourceUrl: true, state: true, county: true, address: true, workforceBoardId: true,
      promotedOrgId: true, companyId: true, industry: true, costLowUsd: true, costHighUsd: true, costNote: true, outplacementProvider: true, outplacementNote: true,
    },
  })
  if (!n) return null
  const org = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: n.normalizedEmployer }, select: { id: true, usState: true } })
  const orgId = org?.id ?? n.promotedOrgId ?? null
  const people = orgId
    ? await prisma.crmPerson.findMany({
        where: { deletedAt: null, affiliations: { some: { orgId, isCurrent: true } } },
        select: { warmth: true, connectedAt: true, linkedinDegree: true, firstRepliedAt: true, lastTouchedAt: true, touchCount: true, notes: true },
      })
    : []
  const warm = people.filter((p) => ['hot', 'warm'].includes(contactStrength(p) ?? '')).length
  const headlines = (await prisma.layoffNewsMention.findMany({ where: { noticeId }, select: { headline: true } }).catch(() => [])).map((m) => m.headline)
  const company = n.companyId ? await prisma.company.findUnique({ where: { id: n.companyId }, select: { industry: true } }).catch(() => null) : null
  let state = n.state
  let city: string | null = null
  let placeNote: string | null = null
  if (!state) {
    const h = placeFromHeadlines(headlines)
    if (h) { state = h.state; city = h.city; placeNote = 'from news coverage' }
  }
  if (!state && org?.usState) { state = org.usState; placeNote = 'from the CRM record' }
  const hq = !state || (!company?.industry && !n.industry) ? await inferHq(n.normalizedEmployer) : null
  if (!state && hq?.state) {
    state = hq.state; city = hq.city
    placeNote = hq.source === 'sec' ? 'company headquarters, from SEC filings' : 'where it has filed WARN notices'
  }
  const industry = await classifyLayoffIndustry({ employer: n.employer, companyIndustry: company?.industry ?? null, naics: n.industry, sicDescription: hq?.sicDescription ?? null, allowModel: false })
  const picture = await buildLocalPicture({ employer: n.employer, employees: n.employees, state, county: n.county, industryKey: industry?.key ?? null })
  const related = await layoffPeople(orgId, { state, county: n.county, city, address: n.address, workforceBoardId: n.workforceBoardId, industryKey: industry?.key ?? null }).catch(() => null)
  const groups = related?.groups.map((g) => (PARTNER[g.key] ? { ...g, pitch: talkingPoints(picture, PARTNER[g.key]) ?? undefined } : g)) ?? []
  const kind: LayoffKind = n.source === 'WARN_FILING' ? 'warn' : /sec\.gov/i.test(n.sourceUrl ?? '') ? 'sec' : 'news'
  const input: AlertInput = {
    employer: n.employer, employees: n.employees, percent: null, kind, confirmed: n.source === 'WARN_FILING' || kind === 'sec',
    inCrm: !!org, people: people.length, warm, contactsFound: 0,
    costs: n,
    picture: { rows: pictureRows(picture, { industryLabel: industry?.label ?? null, industrySource: industry?.source ?? null }) },
  }
  if (related) {
    input.groups = await draftContext(picture, n.employer, state, n.county, n.id).then((x) => withComposeLinks(groups, x)).catch(() => groups)
    const where = [city ?? n.county, state].filter(Boolean).join(', ')
    input.place = where ? `${where}${placeNote ? ` (${placeNote})` : ''}` : related.placeLabel
  }
  return {
    employer: n.employer,
    html: alertBody(input, { source: n.sourceUrl, org: orgId ? `${SITE}/support/admin/crm/organizations/${orgId}` : null, notices: `${SITE}/support/admin/crm/warn` }),
  }
}
