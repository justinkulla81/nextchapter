import { NextResponse } from 'next/server'
import { memberForToken, suppressMember } from '@/lib/higher-ed/email-events'

// One-click unsubscribe (RFC 8058): mail apps POST here from the
// List-Unsubscribe header. No page, no confirmation; it just stops.
export async function POST(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const member = await memberForToken(token)
  if (member) await suppressMember(member.id, 'UNSUBSCRIBED')
  return NextResponse.json({ ok: true })
}
