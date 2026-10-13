import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Open Badges 2.0 BadgeClass: what the credential is.
export async function GET(_req: Request, { params }: { params: Promise<{ programId: string }> }) {
  const { programId } = await params
  const p = await prisma.program.findUnique({ where: { id: programId }, select: { name: true, credential: true, summary: true, skills: true, institution: { select: { slug: true, logoUrl: true } } } })
  if (!p) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(
    {
      '@context': 'https://w3id.org/openbadges/v2',
      type: 'BadgeClass',
      id: `${appUrl()}/api/credentials/class/${programId}`,
      name: p.credential ?? p.name,
      description: p.summary ?? p.name,
      image: p.institution.logoUrl ?? `${appUrl()}/icon.png`,
      criteria: { narrative: `Completed ${p.name}, meeting its attendance and project requirements.` },
      issuer: `${appUrl()}/api/credentials/issuer/${p.institution.slug}`,
      tags: p.skills,
    },
    { headers: { 'content-type': 'application/ld+json' } },
  )
}
