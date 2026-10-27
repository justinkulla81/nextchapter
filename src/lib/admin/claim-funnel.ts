import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'

// The claim funnel: the public organization pages (college, workforce board, job center, economic development, employer)
// carry a "Claim your page" button that leads to the organization's page under /prepared/<name>. Where do people drop?
//
//   public page visitors  ->  reached the claim page from that kind of page  ->  asked to claim  ->  verified
//
// Visitors are distinct IPs with a human page view (the same dedupe as the rest of the funnel page). "Reached the claim page
// from" uses the referrer of the claim-page view; a same-site referrer carries the full address, a cross-site one only the host,
// so only same-site arrivals are attributed to a kind. Claim requests are not split by kind (the claim row does not say which
// kind of page it came from), so they are one total.

export interface ClaimKindRow {
  key: string
  label: string
  /** Path prefix, in words. */
  where: string
  visitors: number
  toClaimPage: number
}

export interface ClaimFunnelData {
  kinds: ClaimKindRow[]
  claimPageVisitors: number
  claimRequests: number
  verified: number
  needsReview: number
}

const KINDS: { key: string; label: string; where: string; path: string; referrer: string }[] = [
  { key: 'college', label: 'Colleges', where: '/higher-education/<state>/<school>', path: '^/higher-education/[^/]+/[^/?]+', referrer: '/higher-education/[^/]+/[^/?]+' },
  { key: 'board', label: 'Workforce boards', where: '/workforce-boards/<state>/<board>', path: '^/workforce-boards/[^/]+/[^/?]+', referrer: '/workforce-boards/[^/]+/[^/?]+' },
  { key: 'center', label: 'Job centers', where: '/job-centers/<state>/<center>', path: '^/job-centers/[^/]+/[^/?]+', referrer: '/job-centers/[^/]+/[^/?]+' },
  { key: 'edo', label: 'Economic development', where: '/economic-development/<state>/<org>', path: '^/economic-development/[^/]+/[^/?]+', referrer: '/economic-development/[^/]+/[^/?]+' },
  { key: 'employer', label: 'Employers', where: '/employers/<employer>', path: '^/employers/[^/?]+', referrer: '/employers/[^/?]+' },
]

const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)
const humanOnly = () => Prisma.sql`"userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))`

async function distinctIps(query: Prisma.Sql): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(query)
  return Number(rows[0]?.n ?? 0)
}

export async function computeClaimFunnel(since: Date): Promise<ClaimFunnelData> {
  const kinds = await Promise.all(
    KINDS.map(async (k): Promise<ClaimKindRow> => {
      const [visitors, toClaimPage] = await Promise.all([
        distinctIps(Prisma.sql`
          SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
          WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" ~ ${k.path} AND "createdAt" >= ${since} AND ${humanOnly()}`),
        distinctIps(Prisma.sql`
          SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
          WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" ~ '^/prepared/' AND "referrer" ~ ${'^https?://[^/]*launchyournextchapter\\.com' + k.referrer}
            AND "createdAt" >= ${since} AND ${humanOnly()}`),
      ])
      return { key: k.key, label: k.label, where: k.where, visitors, toClaimPage }
    }),
  )
  const [claimPageVisitors, claimRequests, verified, needsReview] = await Promise.all([
    distinctIps(Prisma.sql`
      SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
      WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" ~ '^/prepared/' AND "createdAt" >= ${since} AND ${humanOnly()}`),
    prisma.orgClaim.count({ where: { createdAt: { gte: since } } }),
    prisma.orgClaim.count({ where: { createdAt: { gte: since }, verifiedAt: { not: null } } }),
    prisma.orgClaim.count({ where: { createdAt: { gte: since }, needsReview: true } }),
  ])
  return { kinds, claimPageVisitors, claimRequests, verified, needsReview }
}
