import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfUTCDay } from '@/lib/daily/mood'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { sendHomepageVisitorDigestEmail } from '@/lib/email/send-homepage-visitor-digest'
import { isLoopbackIp } from '@/lib/http/trusted-ips'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const adminEmail = getAccountActivityAdminEmail()
  if (!adminEmail) {
    return NextResponse.json({ visitors: 0, sent: false, reason: 'no admin email configured' })
  }

  const todayStart = startOfUTCDay(new Date())
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000)

  // Capped, not just date-bounded — a bot-farm or scraper burst in one day
  // shouldn't build an unbounded email body from every row in the window.
  const events = await prisma.homepageVisitEvent.findMany({
    where: { createdAt: { gte: yesterdayStart, lt: todayStart } },
    orderBy: { createdAt: 'asc' },
    take: 2000,
  })

  if (events.length === 0) {
    return NextResponse.json({ visitors: 0, sent: false, reason: 'no visits' })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const byIp = new Map<
    string,
    { visitCount: number; firstSeen: Date; links: Map<string, string>; referrer: string | null; userAgent: string | null }
  >()

  for (const event of events) {
    // Belt-and-suspenders — the beacon route already refuses to record
    // loopback traffic, but this also covers any rows written before that
    // filter existed.
    if (isLoopbackIp(event.ip)) continue
    const ip = event.ip ?? 'unknown'
    let entry = byIp.get(ip)
    if (!entry) {
      entry = { visitCount: 0, firstSeen: event.createdAt, links: new Map(), referrer: null, userAgent: event.userAgent }
      byIp.set(ip, entry)
    }
    if (event.eventType === 'PAGE_VIEW') {
      entry.visitCount += 1
      if (!entry.referrer && event.referrer) entry.referrer = event.referrer
    } else if (event.eventType === 'LINK_CLICK' && event.href) {
      const absoluteHref = event.href.startsWith('/') ? `${appUrl}${event.href}` : event.href
      entry.links.set(absoluteHref, event.href)
    }
  }

  if (byIp.size === 0) {
    return NextResponse.json({ visitors: 0, sent: false, reason: 'no non-loopback visits' })
  }

  // One lookup per unique IP (not per event) — a busy visitor doesn't cost
  // more than a quiet one, and this comfortably stays under ip-api.com's
  // free-tier rate limit for a daily digest.
  const locationsByIp = new Map(
    await Promise.all(
      Array.from(byIp.keys()).map(async (ip) => [ip, formatIpLocation(await lookupIpLocation(ip))] as const)
    )
  )

  const visitors = Array.from(byIp.entries()).map(([ip, entry]) => ({
    ip,
    location: locationsByIp.get(ip) ?? null,
    visitCount: entry.visitCount,
    firstSeen: entry.firstSeen.toLocaleTimeString(),
    links: Array.from(entry.links.entries()).map(([href, label]) => ({ href, label })),
    referrer: entry.referrer,
    userAgent: entry.userAgent,
  }))

  const dateLabel = yesterdayStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const result = await sendHomepageVisitorDigestEmail(adminEmail, dateLabel, visitors)

  return NextResponse.json({ visitors: visitors.length, sent: result.sent })
}
