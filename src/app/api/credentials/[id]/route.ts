import { createHash } from 'crypto'
import { NextResponse } from 'next/server'
import { credentialById } from '@/lib/higher-ed/programs'

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

// Open Badges 2.0 assertion, hosted verification. The recipient is a salted
// sha256 of their email, as the spec recommends, never the address itself.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const c = await credentialById(id)
  if (!c || c.status !== 'COMPLETED' || !c.completedAt) return NextResponse.json({ error: 'not found' }, { status: 404 })
  const salt = id.slice(0, 8)
  return NextResponse.json(
    {
      '@context': 'https://w3id.org/openbadges/v2',
      type: 'Assertion',
      id: `${appUrl()}/api/credentials/${id}`,
      recipient: { type: 'email', hashed: true, salt, identity: `sha256$${createHash('sha256').update(c.member.email.toLowerCase() + salt).digest('hex')}` },
      badge: `${appUrl()}/api/credentials/class/${c.cohort.program.id}`,
      verification: { type: 'hosted' },
      issuedOn: c.completedAt.toISOString(),
      evidence: `${appUrl()}/credentials/${id}`,
    },
    { headers: { 'content-type': 'application/ld+json' } },
  )
}
