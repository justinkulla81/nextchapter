import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { startOfUTCDay } from '@/lib/daily/mood'
import { getAccountActivityAdminEmail } from '@/lib/admin/auth'
import { sendHomepageVisitorDigestEmail } from '@/lib/email/send-homepage-visitor-digest'
import { isLoopbackIp } from '@/lib/http/trusted-ips'
import { lookupIpLocation, formatIpLocation } from '@/lib/http/ip-geolocation'
import { classifyUserAgent, USER_AGENT_CLASS_SORT_ORDER } from '@/lib/http/user-agent'
import { candidateDisplayName } from '@/lib/messaging/threads'

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
    {
      visitCount: number
      firstSeen: Date
      links: Map<string, string>
      referrer: string | null
      userAgent: string | null
      candidateId: string | null
    }
  >()

  for (const event of events) {
    // Belt-and-suspenders — the beacon route already refuses to record
    // loopback traffic, but this also covers any rows written before that
    // filter existed.
    if (isLoopbackIp(event.ip)) continue
    const ip = event.ip ?? 'unknown'
    let entry = byIp.get(ip)
    if (!entry) {
      entry = {
        visitCount: 0,
        firstSeen: event.createdAt,
        links: new Map(),
        referrer: null,
        userAgent: event.userAgent,
        candidateId: null,
      }
      byIp.set(ip, entry)
    }
    if (event.eventType === 'PAGE_VIEW') {
      entry.visitCount += 1
      if (!entry.referrer && event.referrer) entry.referrer = event.referrer
    } else if (event.eventType === 'LINK_CLICK' && event.href) {
      const absoluteHref = event.href.startsWith('/') ? `${appUrl}${event.href}` : event.href
      entry.links.set(absoluteHref, event.href)
    }
    // A logged-in visit's own session-confirmed candidateId always wins —
    // never overwritten once set, and never guessed at when already known.
    if (!entry.candidateId && event.candidateId) entry.candidateId = event.candidateId
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

  // Same two-tier "who is this" resolution the Visitors admin page already
  // uses: a session-confirmed candidateId (set above) wins outright; failing
  // that, an unambiguous signupIp match (exactly one candidate ever signed
  // up from this IP — a shared network make this genuinely ambiguous, so it
  // stays unmatched rather than guessing).
  const confirmedIds = Array.from(byIp.values())
    .map((e) => e.candidateId)
    .filter((id): id is string => !!id)
  const unmatchedIps = Array.from(byIp.entries())
    .filter(([, e]) => !e.candidateId)
    .map(([ip]) => ip)

  const [confirmedCandidates, signupMatches] = await Promise.all([
    confirmedIds.length > 0
      ? prisma.candidateProfile.findMany({
          where: { id: { in: confirmedIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : Promise.resolve([]),
    unmatchedIps.length > 0
      ? prisma.candidateProfile.findMany({
          where: { signupIp: { in: unmatchedIps } },
          select: { id: true, firstName: true, lastName: true, signupIp: true },
        })
      : Promise.resolve([]),
  ])

  const candidateById = new Map(confirmedCandidates.map((c) => [c.id, c]))
  const candidatesBySignupIp = new Map<string, typeof signupMatches>()
  for (const c of signupMatches) {
    if (!c.signupIp) continue
    candidatesBySignupIp.set(c.signupIp, [...(candidatesBySignupIp.get(c.signupIp) ?? []), c])
  }
  // Ambiguous (more than one candidate ever signed up from this IP) is
  // worse than no match at all — same rule the admin page already applies.
  const inferredCandidateByIp = new Map(
    Array.from(candidatesBySignupIp.entries())
      .filter(([, candidates]) => candidates.length === 1)
      .map(([ip, candidates]) => [ip, candidates[0]])
  )

  const visitors = Array.from(byIp.entries())
    .map(([ip, entry]) => {
      const confirmed = entry.candidateId ? candidateById.get(entry.candidateId) : null
      const inferred = !confirmed ? inferredCandidateByIp.get(ip) : null
      const person = confirmed ?? inferred ?? null
      return {
        ip,
        location: locationsByIp.get(ip) ?? null,
        visitCount: entry.visitCount,
        firstSeen: entry.firstSeen.toLocaleTimeString(),
        links: Array.from(entry.links.entries()).map(([href, label]) => ({ href, label })),
        referrer: entry.referrer,
        userAgentClass: classifyUserAgent(entry.userAgent),
        personName: person ? candidateDisplayName(person) : null,
        personConfirmed: !!confirmed,
      }
    })
    .sort((a, b) => USER_AGENT_CLASS_SORT_ORDER[a.userAgentClass] - USER_AGENT_CLASS_SORT_ORDER[b.userAgentClass])

  const dateLabel = yesterdayStart.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })
  const result = await sendHomepageVisitorDigestEmail(adminEmail, dateLabel, visitors)

  return NextResponse.json({ visitors: visitors.length, sent: result.sent })
}
