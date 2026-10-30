import { prisma } from '@/lib/prisma'

// A tracked outbound email link (/api/crm/outreach/click/<linkId>) redirects to the real page. For a page on our own
// site the redirect adds utm_source=email and nc_e=<linkId>, so the visit that follows can be traced back to the
// person the email went to. The link id is an opaque cuid; no name or address ever appears in the URL.
export const EMAIL_VISIT_PARAM = 'nc_e'

const OWN_HOSTS = new Set(['launchyournextchapter.com', 'www.launchyournextchapter.com'])

function isOwnSite(url: URL): boolean {
  if (OWN_HOSTS.has(url.hostname.toLowerCase())) return true
  try {
    const app = process.env.NEXT_PUBLIC_APP_URL
    return !!app && new URL(app).hostname.toLowerCase() === url.hostname.toLowerCase()
  } catch {
    return false
  }
}

/** The destination with the email tags added. Other sites and unparseable URLs come back unchanged. An existing utm_source is kept. */
export function withEmailAttribution(destination: string, linkId: string): string {
  let url: URL
  try {
    url = new URL(destination)
  } catch {
    return destination
  }
  if (!/^https?:$/.test(url.protocol) || !isOwnSite(url)) return destination
  if (!url.searchParams.has('utm_source')) {
    url.searchParams.set('utm_source', 'email')
    url.searchParams.set('utm_medium', 'outreach')
  }
  url.searchParams.set(EMAIL_VISIT_PARAM, linkId)
  return url.toString()
}

/** The email link id on a stored landing path, or null. */
export function extractEmailLinkId(path: string | null): string | null {
  if (!path) return null
  const q = path.indexOf('?')
  if (q === -1) return null
  const id = new URLSearchParams(path.slice(q + 1).split('#')[0]).get(EMAIL_VISIT_PARAM)
  return id && /^[a-z0-9]{10,40}$/i.test(id) ? id : null
}

export interface EmailRecipient {
  personId: string
  name: string
  email: string | null
  subject: string | null
}

/** Link id -> the CRM person the email went to. Ids that match nothing are left out. */
export async function resolveEmailRecipients(linkIds: string[]): Promise<Map<string, EmailRecipient>> {
  const ids = Array.from(new Set(linkIds))
  if (ids.length === 0) return new Map()
  const links = await prisma.crmOutreachLink.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      tracking: { select: { activity: { select: { subject: true, person: { select: { id: true, fullName: true, email: true } } } } } },
    },
  })
  const out = new Map<string, EmailRecipient>()
  for (const l of links) {
    const person = l.tracking.activity.person
    if (!person) continue
    out.set(l.id, { personId: person.id, name: person.fullName, email: person.email, subject: l.tracking.activity.subject })
  }
  return out
}
