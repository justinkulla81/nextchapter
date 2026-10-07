import { NextResponse } from 'next/server'
import { verifyResendSignature } from '@/lib/mailing/webhook-signature'
import { applyResendEvent, type ResendEvent } from '@/lib/mailing/tracking'

// Delivery, open, click, bounce and complaint events for list email (the
// Monthly Update and other editions). Configured in Resend → Webhooks with
// the signing secret in RESEND_WEBHOOK_SECRET. Events for any other email
// the account sends are acknowledged and ignored.
export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (!secret) return NextResponse.json({ error: 'not configured' }, { status: 503 })

  const payload = await request.text()
  const ok = verifyResendSignature(
    payload,
    {
      id: request.headers.get('svix-id'),
      timestamp: request.headers.get('svix-timestamp'),
      signature: request.headers.get('svix-signature'),
    },
    secret,
  )
  if (!ok) return NextResponse.json({ error: 'invalid signature' }, { status: 401 })

  let event: ResendEvent
  try {
    event = JSON.parse(payload) as ResendEvent
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 })
  }
  const result = await applyResendEvent(event)
  return NextResponse.json({ [result]: event.type })
}
