import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { mobileUserId } from '@/lib/mobile/auth'
import { EXPO_TOKEN } from '@/lib/mobile/params'

// Registers this install's push token. Anonymous is fine; when the request carries a signed-in bearer token the device is tied
// to that user, so their saved searches can push to it.
export async function POST(request: NextRequest) {
  if (!(await allowByIp('mobile-device', 60, HOUR_MS))) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  const body = (await request.json().catch(() => null)) as { pushToken?: unknown; platform?: unknown } | null
  const pushToken = typeof body?.pushToken === 'string' ? body.pushToken : ''
  const platform = body?.platform === 'android' ? 'android' : body?.platform === 'ios' ? 'ios' : ''
  if (!EXPO_TOKEN.test(pushToken) || !platform) return NextResponse.json({ error: 'A valid push token and platform are required.' }, { status: 400 })
  const userId = await mobileUserId(request)
  try {
    await prisma.mobileDevice.upsert({
      where: { pushToken },
      create: { pushToken, platform, userId },
      update: { platform, lastSeenAt: new Date(), ...(userId ? { userId } : {}) },
    })
    captureServerEvent(userId ?? pushToken, 'mobile_device_registered', { platform, signedIn: !!userId })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('mobile device register failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Could not register right now.' }, { status: 503 })
  }
}
