import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { orgBasePath } from '@/lib/higher-ed/workspaces'

// Old /i/<slug> addresses (links in sent emails, bookmarks) move to the
// portal's public one: /highered/<slug> or /workforce/<slug>. Pages under
// those addresses are this same app (next.config rewrites), so this only
// fires when the browser asked for /i itself.
export default async function OrgSlugLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const h = await headers()
  const path = h.get('x-pathname') ?? ''
  if (path.startsWith('/i/')) {
    const { slug } = await params
    const inst = await prisma.institution.findUnique({ where: { slug }, select: { orgType: true } })
    if (inst) redirect(`${orgBasePath(slug, inst.orgType)}${path.slice(`/i/${slug}`.length)}${h.get('x-search') ?? ''}`)
  }
  return children
}
