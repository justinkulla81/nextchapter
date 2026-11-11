import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { classifyUserAgent } from '@/lib/http/user-agent'
import { isDatacenterIp } from '@/lib/http/datacenter-ip'
import { loadScannerIps } from '@/lib/marketing/mail-scanners'
import { extractEmailLinkId, extractUnsubscribeToken, resolveEmailRecipients, resolveMailingRecipients } from '@/lib/marketing/email-attribution'
import { userTypeFromCrm, userTypeFromLandingPath, type UserTypeBasis, type VisitorUserType } from '@/lib/admin/visitor-user-type'
import { perDaySeriesFromCounts, type BucketCount } from '@/lib/admin/visitor-time-buckets'

// A daily snapshot of who visited, by type. The visit log works a visitor's type out from the CRM, an account, or the first page of the
// visit, but only for the few hundred visitors on the page. This stores the same answer once per visitor per Eastern day (VisitorDayType),
// so the "Visitors by type" chart can cover all history with one small grouped read. It uses the strongest signals only (an email or
// unsubscribe link, a recorded click, an address they gave, a signed-in account); the log also infers a name from a nearby IP, so a few
// visitors the log names stay "Unknown" or landing-page guesses here.

const CHUNK = 1500

export interface VisitorDayInput {
  views: number
  firstPath: string | null
  /** CRM person from an email link, unsubscribe link, recorded click or address they gave, if any. */
  crmType: VisitorUserType | null
  hasAccount: boolean
}

/** The type and why, in the same order the visit log uses: CRM, then an account, then the landing page. */
export function decideVisitorType(v: Pick<VisitorDayInput, 'firstPath' | 'crmType' | 'hasAccount'>): { userType: VisitorUserType; basis: NonNullable<UserTypeBasis> | 'none' } {
  if (v.crmType) return { userType: v.crmType, basis: 'CRM' }
  if (v.hasAccount) return { userType: 'Candidate', basis: 'account' }
  const guess = userTypeFromLandingPath(v.firstPath)
  return guess ? { userType: guess, basis: 'landing page' } : { userType: 'Unknown', basis: 'none' }
}

const chunks = <T>(list: T[]): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK))
  return out
}

const dayStartUtc = (day: string) => Prisma.sql`(${day}::date::timestamp AT TIME ZONE 'America/New_York') AT TIME ZONE 'UTC'`

/**
 * Types every human visitor of one Eastern day and stores them, replacing that day's rows (safe to rerun).
 * Reads one day of visits grouped by IP and user agent (a few thousand rows), plus lookups by those IPs.
 */
export async function snapshotVisitorTypes(day: string): Promise<{ day: string; visitors: number }> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error(`Bad day ${day}`)
  const scannerIps = await loadScannerIps().catch(() => new Set<string>())
  const grouped = await prisma.$queryRaw<{ ip: string; userAgent: string | null; views: bigint; firstAt: Date; firstPath: string | null; tagged: string[] | null; candidateId: string | null }[]>(Prisma.sql`
    SELECT "ip", "userAgent", count(*) AS "views", min("createdAt") AS "firstAt",
      (array_agg("path" ORDER BY "createdAt"))[1] AS "firstPath",
      array_agg(DISTINCT "path") FILTER (WHERE "path" ~ 'nc_e=' OR "path" LIKE '/updates/unsubscribe/%') AS "tagged",
      max("candidateId") AS "candidateId"
    FROM "HomepageVisitEvent"
    WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL
      AND "createdAt" >= ${dayStartUtc(day)} AND "createdAt" < ${dayStartUtc(day)} + interval '1 day'
    GROUP BY "ip", "userAgent"`)

  type Acc = { views: number; firstAt: number; firstPath: string | null; paths: string[]; account: boolean }
  const byIp = new Map<string, Acc>()
  for (const g of grouped) {
    if (classifyUserAgent(g.userAgent) !== 'human' || isDatacenterIp(g.ip) || scannerIps.has(g.ip)) continue
    const acc = byIp.get(g.ip) ?? { views: 0, firstAt: Infinity, firstPath: null, paths: [], account: false }
    acc.views += Number(g.views)
    if (g.firstAt.getTime() < acc.firstAt) {
      acc.firstAt = g.firstAt.getTime()
      acc.firstPath = g.firstPath
    }
    acc.paths.push(...(g.tagged ?? []))
    acc.account = acc.account || !!g.candidateId
    byIp.set(g.ip, acc)
  }
  const ips = Array.from(byIp.keys())
  const dayStartApprox = new Date(`${day}T04:00:00Z`) // an Eastern day starts 04:00 or 05:00 UTC; the extra hour is harmless for click matching

  // Who each IP is, as CRM person ids.
  const personByIp = new Map<string, string>()
  const linkIds = new Set<string>()
  const tokens = new Set<string>()
  for (const acc of byIp.values())
    for (const p of acc.paths) {
      const l = extractEmailLinkId(p)
      const t = extractUnsubscribeToken(p)
      if (l) linkIds.add(l)
      if (t) tokens.add(t)
    }
  const [recipientByLink, mailing] = await Promise.all([resolveEmailRecipients(Array.from(linkIds)), resolveMailingRecipients(Array.from(tokens))])
  for (const [ip, acc] of byIp)
    for (const p of acc.paths) {
      const l = extractEmailLinkId(p)
      const t = extractUnsubscribeToken(p)
      const id = (l ? recipientByLink.get(l)?.personId : null) ?? (t ? mailing.unique.get(t)?.personId : null)
      if (id) personByIp.set(ip, id)
    }
  for (const part of chunks(ips)) {
    const clicks = await prisma.mailingClickEvent
      .findMany({
        where: { bot: false, ip: { in: part }, clickedAt: { gte: dayStartApprox, lt: new Date(dayStartApprox.getTime() + 25 * 3_600_000) } },
        select: { ip: true, recipient: { select: { personId: true } } },
      })
      .catch(() => [])
    for (const c of clicks) if (c.ip && c.recipient.personId && !personByIp.has(c.ip)) personByIp.set(c.ip, c.recipient.personId)
    const leads = await prisma.homepageLead.findMany({ where: { ip: { in: part } }, select: { ip: true, email: true } })
    const emails = Array.from(new Set(leads.map((l) => l.email.trim().toLowerCase())))
    if (emails.length > 0) {
      const crm = await prisma.$queryRaw<{ id: string; email: string }[]>(Prisma.sql`
        SELECT DISTINCT ON (lower(e)) p."id", lower(e) AS "email"
        FROM "CrmPerson" p, LATERAL unnest(array_append(p."emails", p."email")) AS e
        WHERE lower(e) = ANY(${emails})
        ORDER BY lower(e), p."createdAt" ASC`)
      const idByEmail = new Map(crm.map((r) => [r.email, r.id]))
      for (const l of leads) {
        const id = l.ip ? idByEmail.get(l.email.trim().toLowerCase()) : null
        if (l.ip && id && !personByIp.has(l.ip)) personByIp.set(l.ip, id)
      }
    }
  }

  const personIds = Array.from(new Set(personByIp.values()))
  const typeByPerson = new Map<string, VisitorUserType>()
  for (const part of chunks(personIds)) {
    const people = await prisma.crmPerson.findMany({
      where: { id: { in: part } },
      select: { id: true, roles: true, affiliations: { where: { isCurrent: true }, select: { org: { select: { orgTypes: true } } } } },
    })
    for (const p of people) typeByPerson.set(p.id, userTypeFromCrm(p.roles.map(String), p.affiliations.flatMap((a) => a.org.orgTypes.map(String))))
  }

  const rows = ips.map((ip) => {
    const acc = byIp.get(ip)!
    const personId = personByIp.get(ip)
    const { userType, basis } = decideVisitorType({ firstPath: acc.firstPath, crmType: personId ? (typeByPerson.get(personId) ?? null) : null, hasAccount: acc.account })
    return { day, ip, userType, basis, views: acc.views }
  })
  await prisma.$transaction([prisma.visitorDayType.deleteMany({ where: { day } }), prisma.visitorDayType.createMany({ data: rows, skipDuplicates: true })])
  return { day, visitors: rows.length }
}

/** Visitors per day per type, all history, as rows of (day, type, count). One grouped read over the snapshot table. */
export async function loadVisitorTypeCounts(): Promise<{ day: string; userType: string; visitors: number }[]> {
  const rows = await prisma.visitorDayType.groupBy({ by: ['day', 'userType'], _count: { _all: true } })
  return rows.map((r) => ({ day: r.day, userType: r.userType, visitors: r._count._all }))
}

/** Per-type daily series for the 7, 30 and all-time ranges. Types with no visitors in the data are left out. */
export function visitorTypeSeries(rows: { day: string; userType: string; visitors: number }[], now: Date, allTimeDays: number): { userType: string; total: number; series: Record<'7d' | '30d' | 'all', BucketCount[]> }[] {
  const byType = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const m = byType.get(r.userType) ?? new Map<string, number>()
    m.set(r.day, (m.get(r.day) ?? 0) + r.visitors)
    byType.set(r.userType, m)
  }
  return Array.from(byType, ([userType, counts]) => ({
    userType,
    total: Array.from(counts.values()).reduce((a, b) => a + b, 0),
    series: { '7d': perDaySeriesFromCounts(counts, now, 7), '30d': perDaySeriesFromCounts(counts, now, 30), all: perDaySeriesFromCounts(counts, now, allTimeDays) },
  })).sort((a, b) => b.total - a.total)
}
