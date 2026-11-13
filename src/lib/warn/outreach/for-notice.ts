import 'server-only'
import { prisma } from '@/lib/prisma'
import { inferHq } from '@/lib/warn/layoff-hq-state'
import { buildLocalPicture, classifyLayoffIndustry } from '@/lib/warn/layoff-context'
import { placeFromHeadlines } from '@/lib/warn/layoff-picture'
import { layoffPeople } from '@/lib/warn/layoff-alert-people'
import { draftContext } from '@/lib/warn/layoff-alert-links'
import { queueLayoffOutreach, type OutreachResult, type QueueOptions } from './queue'

/**
 * The outreach for a layoff whose alert went out in a digest (past the run's cap of full alerts), so it has no contact search
 * behind it. Finds the place, the industry, the local picture and the contacts the way the full alert does, from what is already
 * in the database (no new Hunter search, no model call), then queues the emails. Never throws.
 */
export async function queueOutreachForNotice(noticeId: string, opts?: QueueOptions): Promise<OutreachResult> {
  try {
    const n = await prisma.warnNotice.findUnique({
      where: { id: noticeId },
      select: { employer: true, normalizedEmployer: true, employees: true, state: true, county: true, address: true, workforceBoardId: true, promotedOrgId: true, companyId: true, industry: true },
    })
    if (!n) return { editions: 0, recipients: 0, skipped: 'notice missing' }
    const org = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: n.normalizedEmployer }, select: { id: true, usState: true } })
    const orgId = org?.id ?? n.promotedOrgId ?? null
    const headlines = (await prisma.layoffNewsMention.findMany({ where: { noticeId }, select: { headline: true }, take: 20 }).catch(() => [])).map((m) => m.headline)
    const company = n.companyId ? await prisma.company.findUnique({ where: { id: n.companyId }, select: { industry: true } }).catch(() => null) : null

    let state = n.state
    let city: string | null = null
    if (!state) { const h = placeFromHeadlines(headlines); if (h) { state = h.state; city = h.city } }
    if (!state && org?.usState) state = org.usState
    const needHq = !state || (!company?.industry && !n.industry)
    const hq = needHq ? await inferHq(n.normalizedEmployer) : null
    if (!state && hq?.state) { state = hq.state; city = hq.city }
    const industry = await classifyLayoffIndustry({
      employer: n.employer, companyIndustry: company?.industry ?? null, naics: n.industry ?? null, sicDescription: hq?.sicDescription ?? null, allowModel: false,
    })
    const picture = await buildLocalPicture({ employer: n.employer, employees: n.employees, state, county: n.county, industryKey: industry?.key ?? null })
    const related = await layoffPeople(orgId, { state, county: n.county, city, address: n.address, workforceBoardId: n.workforceBoardId, industryKey: industry?.key ?? null })
    const ctx = await draftContext(picture, n.employer, state, n.county, noticeId)
    return await queueLayoffOutreach({ noticeId, employer: n.employer, groups: related.groups, ctx: { ...ctx, track: undefined }, opts })
  } catch (e) {
    console.error('Layoff outreach for notice failed', noticeId, e)
    return { editions: 0, recipients: 0, skipped: 'error' }
  }
}
