import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { orgBasePath, orgHostKindOf } from '@/lib/higher-ed/workspaces'
import { MAIN_SITE_SEGMENTS, ORG_SUBDOMAINS_ON, mainOrigin, orgAppUrl, orgKindForHost } from '@/lib/org-hosts'

// Sends each request to the portal's public address (src/lib/org-hosts.ts):
// old /i/<slug> links, a portal page opened on the main site, a main-site
// page opened on a portal host, or an org opened on the wrong portal host.
export default async function OrgSlugLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const h = await headers()
  const path = h.get('x-pathname') ?? ''
  const search = h.get('x-search') ?? ''
  const hostKind = orgKindForHost(h.get('host'))
  const { slug } = await params

  if (!ORG_SUBDOMAINS_ON) {
    if (path.startsWith('/i/')) {
      const inst = await prisma.institution.findUnique({ where: { slug }, select: { orgType: true } })
      if (inst) redirect(`${orgBasePath(slug, inst.orgType)}${path.slice(`/i/${slug}`.length)}${search}`)
    }
    return children
  }

  const inst = await prisma.institution.findUnique({ where: { slug }, select: { orgType: true } })
  // On a portal host, /<anything> that isn't an org is a main-site page (a
  // link to /dashboard/... from a card): send it there.
  if (hostKind && !inst) redirect(`${mainOrigin()}${path.replace(/^\/i(?=\/)/, '')}${search}`)
  if (!inst) return children
  const kind = orgHostKindOf(inst.orgType)
  const rest = path.replace(new RegExp(`^(/i)?/${slug}`), '')
  const segment = rest.split('/')[1] ?? ''
  if (MAIN_SITE_SEGMENTS.has(segment)) return children // job-seeker pages stay on the main site
  // Portal pages: on their own host, at /<slug>/...
  if (hostKind !== kind) redirect(`${orgAppUrl(slug, kind, rest)}${search}`)
  if (path.startsWith('/i/')) redirect(`/${slug}${rest}${search}`)
  return children
}
