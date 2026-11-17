import { NextResponse } from 'next/server'
import { getInstitutionAccess } from '@/lib/higher-ed/access'
import { readProfile } from '@/lib/higher-ed/profile'
import { patentsSearchUrl } from '@/lib/higher-ed/research-feed'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// Research, patent and news links from the college portal: count the open,
// then send the member on. Only known destinations: a DOI, a Google Patents
// search for this college, the college's own tech-transfer page, or a Google
// News article link. Anything else goes back to the portal.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const q = new URL(request.url).searchParams
  const kind = q.get('k') ?? ''
  const back = NextResponse.redirect(new URL(`/i/${slug}/candidate/programs`, request.url))
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out') return NextResponse.redirect(new URL(`/auth/login?next=/i/${slug}/candidate/programs`, request.url))
  if (!access || access.workspaces.length === 0) return back

  let target: string | null = null
  if (kind === 'paper') {
    const doi = q.get('doi') ?? ''
    if (/^10\.\d{4,9}\/\S{1,300}$/.test(doi)) target = `https://doi.org/${doi}`
  } else if (kind === 'patents') {
    const field = (q.get('f') ?? '').trim().slice(0, 80)
    if (field) target = patentsSearchUrl(access.institution.name, field)
  } else if (kind === 'techtransfer') {
    const row = await prisma.institution.findUnique({ where: { id: access.institution.id }, select: { profile: true } })
    const url = readProfile(row?.profile).college?.techTransfer?.url
    if (url && /^https:\/\//.test(url)) target = url
  } else if (kind === 'news') {
    const u = q.get('u') ?? ''
    if (u.startsWith('https://news.google.com/')) target = u
  }
  if (!target) return back
  captureServerEvent(access.userId, `he_${kind === 'paper' ? 'research' : kind}_opened`, {
    institutionId: access.institution.id,
    memberId: access.memberId,
    preview: access.mode !== 'own',
    ...(kind === 'patents' ? { field: q.get('f') } : {}),
  })
  return NextResponse.redirect(target)
}
