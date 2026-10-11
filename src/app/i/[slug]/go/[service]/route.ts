import { NextResponse } from 'next/server'
import { getInstitutionAccess } from '@/lib/higher-ed/access'
import { getService, serviceSettingsFrom, serviceTarget } from '@/lib/higher-ed/services'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'

// Every service card on the Candidate home links here: count the open (the
// usage staff see in Admin › Services), then send the member on. Members and
// staff only; the target comes from the college's own settings, never the URL.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string; service: string }> }) {
  const { slug, service } = await params
  const access = await getInstitutionAccess(slug)
  if (access === 'signed-out') return NextResponse.redirect(new URL(`/auth/login?next=/i/${slug}/candidate`, request.url))
  if (!access || access.workspaces.length === 0) return NextResponse.redirect(new URL(`/i/${slug}`, request.url))

  const s = getService(service)
  const row = await prisma.institution.findUnique({ where: { id: access.institution.id }, select: { enabledFeatures: true } })
  const setting = s ? serviceSettingsFrom(row?.enabledFeatures)[s.key] : null
  const target = s && setting?.on ? serviceTarget(s, setting) : null
  if (!s || !target) return NextResponse.redirect(new URL(`/i/${slug}/candidate`, request.url))

  captureServerEvent(access.userId, 'he_service_opened', {
    institutionId: access.institution.id,
    service: s.key,
    memberId: access.memberId,
    preview: access.mode !== 'own',
  })
  return NextResponse.redirect(new URL(target, request.url))
}
