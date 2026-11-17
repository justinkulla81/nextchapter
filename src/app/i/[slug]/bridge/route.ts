import { NextResponse } from 'next/server'
import { getInstitutionAccess } from '@/lib/higher-ed/access'
import { bridgeOfferings, recordOpened } from '@/lib/higher-ed/skills-bridge'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// A skills-bridge link: record that the alum opened this offering for this
// skill (so a later job counts toward it), then send them to it. The target
// comes from the college's own offerings, never the URL. Staff previews are
// not recorded.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const url = new URL(request.url)
  const offeringKey = url.searchParams.get('o') ?? ''
  const skill = (url.searchParams.get('s') ?? '').slice(0, 80)
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out') return NextResponse.redirect(new URL(`/auth/login?next=/i/${slug}/candidate/programs`, request.url))
  if (!access || access.workspaces.length === 0) return NextResponse.redirect(new URL(`/i/${slug}`, request.url))

  const row = await prisma.institution.findUnique({ where: { id: access.institution.id }, select: { enabledFeatures: true } })
  const offering = (await bridgeOfferings({ id: access.institution.id, slug }, row?.enabledFeatures)).find((o) => o.key === offeringKey)
  if (!offering) return NextResponse.redirect(new URL(`/i/${slug}/candidate/programs`, request.url))

  const own = access.mode === 'own' && !!access.memberId
  if (own && skill) await recordOpened({ institutionId: access.institution.id, memberId: access.memberId!, skill, offeringKey }).catch((err) => console.error('[bridge] record', err))
  captureServerEvent(access.userId, 'he_bridge_opened', { institutionId: access.institution.id, offeringKey, kind: offering.kind, skill, memberId: access.memberId, preview: !own })
  return NextResponse.redirect(new URL(offering.href, request.url))
}
