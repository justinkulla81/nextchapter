import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readProfile } from '@/lib/higher-ed/profile'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Open Badges 2.0 Issuer profile: the college.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const i = await prisma.institution.findUnique({ where: { slug }, select: { name: true, profile: true } })
  if (!i) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json(
    {
      '@context': 'https://w3id.org/openbadges/v2',
      type: 'Issuer',
      id: `${appUrl()}/api/credentials/issuer/${slug}`,
      name: i.name,
      url: readProfile(i.profile).college?.websiteUrl ?? `${appUrl()}/i/${slug}/for-alumni`,
    },
    { headers: { 'content-type': 'application/ld+json' } },
  )
}
