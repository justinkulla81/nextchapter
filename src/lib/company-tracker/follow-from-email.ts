import 'server-only'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { addCompanyToWatchlist } from '@/lib/company-tracker/watchlist'

// "Get new <employer> openings by email" on an employer page is a follow: once the email belongs to a member, the
// company is on their watchlist (the profile's company list). The lead stores the name lower-cased, so the display
// name comes from the Company row when there is one.

const EMPLOYER_SOURCE = 'page:employer'

async function displayName(searchQ: string): Promise<string> {
  const normalized = normalizeOrgName(searchQ)
  if (!normalized) return searchQ
  const company = await prisma.company.findUnique({ where: { canonicalNameNormalized: normalized }, select: { name: true } }).catch(() => null)
  return company?.name ?? searchQ
}

async function follow(candidateId: string, searchQ: string, via: 'confirm_click' | 'registration'): Promise<boolean> {
  const name = await displayName(searchQ)
  const r = await addCompanyToWatchlist(candidateId, name)
  if (r.error) return false
  captureServerEvent(candidateId, 'company_followed', { companyName: name, source: 'employer_email_signup', via })
  return true
}

/** The email was just confirmed by its link. If a member has that email, they now follow the company. Never throws. */
export async function followFromConfirmedLead(lead: { email: string; kind: string; source: string | null; searchQ: string }): Promise<boolean> {
  if (lead.kind !== 'job_alert' || lead.source !== EMPLOYER_SOURCE || !lead.searchQ) return false
  try {
    const member = await prisma.candidateProfile.findFirst({ where: { email: { equals: lead.email, mode: 'insensitive' } }, select: { id: true } })
    return member ? await follow(member.id, lead.searchQ, 'confirm_click') : false
  } catch (error) {
    console.error('follow from confirmed lead failed:', error instanceof Error ? error.message : error)
    return false
  }
}

/** Registration finished with a verified email: every employer-page signup made with it becomes a follow. Returns how many. */
export async function claimEmployerFollows(candidateId: string, email: string | null): Promise<number> {
  if (!email) return 0
  const leads = await prisma.homepageLead.findMany({
    where: { email: email.toLowerCase(), kind: 'job_alert', source: EMPLOYER_SOURCE, unsubscribedAt: null },
    select: { searchQ: true },
    orderBy: { createdAt: 'asc' },
    take: 25,
  })
  let followed = 0
  for (const lead of leads) {
    if (lead.searchQ && (await follow(candidateId, lead.searchQ, 'registration'))) followed++
  }
  return followed
}
