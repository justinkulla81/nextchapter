import 'server-only'
import { prisma } from '@/lib/prisma'

// What has happened to each captured address since: filed in the CRM, emailed
// by the welcome/reminder system, opened, clicked, registered. Read-only.

export interface LeadStatus {
  personId: string | null
  registered: boolean
  sent: number
  opened: boolean
  clicked: boolean
}

export async function loadLeadStatuses(emails: string[]): Promise<Map<string, LeadStatus>> {
  const out = new Map<string, LeadStatus>()
  if (emails.length === 0) return out

  const persons = await prisma.crmPerson.findMany({
    where: { deletedAt: null, email: { in: emails } },
    select: { id: true, email: true, candidateId: true },
  })
  const byId = new Map(persons.map((p) => [p.id, p.email!]))
  for (const p of persons) out.set(p.email!, { personId: p.id, registered: !!p.candidateId, sent: 0, opened: false, clicked: false })

  if (persons.length > 0) {
    const sent = await prisma.crmActivity.findMany({
      where: { type: 'EMAIL', personId: { in: persons.map((p) => p.id) }, sourceRef: { startsWith: 'lifecycle:' } },
      select: { personId: true, outreachTracking: { select: { openCount: true, links: { select: { clickCount: true } } } } },
    })
    for (const a of sent) {
      const status = out.get(byId.get(a.personId!)!)
      if (!status) continue
      status.sent++
      if ((a.outreachTracking?.openCount ?? 0) > 0) status.opened = true
      if (a.outreachTracking?.links.some((l) => l.clickCount > 0)) status.clicked = true
    }
  }
  return out
}

const SEARCH_ENGINES = /google|bing|duckduckgo|yahoo|ecosia|baidu/i

/** The first page each address's network (IP) viewed, as "Google", "linkedin.com" or "Direct". Approximate: an IP can be shared. */
export async function loadOrigins(ips: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const unique = [...new Set(ips.filter(Boolean))]
  if (unique.length === 0) return out
  const views = await prisma.homepageVisitEvent.findMany({
    where: { ip: { in: unique }, eventType: 'PAGE_VIEW' },
    orderBy: { createdAt: 'asc' },
    select: { ip: true, referrer: true },
    take: 5000,
  })
  for (const v of views) {
    if (!v.ip || out.has(v.ip)) continue
    let label = 'Direct'
    if (v.referrer) {
      try {
        const host = new URL(v.referrer).hostname.replace(/^www\./, '')
        label = host.endsWith('launchyournextchapter.com') ? 'Direct' : SEARCH_ENGINES.test(host) ? 'Search' : host
      } catch {
        label = 'Direct'
      }
    }
    out.set(v.ip, label)
  }
  return out
}
