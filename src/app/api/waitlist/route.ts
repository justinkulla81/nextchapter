import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'

export async function POST(request: NextRequest) {
  if (!(await allowByIp('waitlist', 20, HOUR_MS))) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  const body = await request.json().catch(() => null)

  if (!body || typeof body.audience !== 'string' || !body.audience) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Unauthenticated JSON sink: bound what a script can write into the table.
  if (body.audience.length > 64 || JSON.stringify(body).length > 4096) {
    return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
  }

  const { audience, ...payload } = body

  await prisma.waitlistSignup.create({
    data: { audience, payload },
  })
  if (typeof payload.email === 'string') notifyNewLead({ email: payload.email, name: typeof payload.name === 'string' ? payload.name : null, channel: 'Waitlist', detail: audience })

  return NextResponse.json({ ok: true })
}
