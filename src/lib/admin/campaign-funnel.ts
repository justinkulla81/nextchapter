import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'
import { segmentLabel, splitCampaign } from '@/lib/marketing/campaign-tag'

// Paid and tagged traffic, followed to engagement. Two cuts:
//  - By campaign and segment: the utm_campaign on a person's first tagged visit before they registered
//    (visits from our own welcome and reminder emails are skipped, they say how someone came back, not
//    how they found us). A visit is matched to a person by their session when logged in, else by the IP
//    they signed up from, the same match lead-source.ts uses.
//  - By who they say they are: job status and level from the profile. This needs no tagging and works
//    for everyone who registered, however they arrived.
// Activated = onboarded, a résumé in, and a job saved or opened within 7 days of registering. The rate
// counts only people who registered at least 7 days ago, so a recent signup is not scored as a miss.

export interface CampaignRow {
  campaign: string
  segment: string
  segmentLabel: string
  channel: string
  visitors: number
  registered: number
  matured: number
  activated: number
}

export interface SegmentRow {
  segment: string
  label: string
  visitors: number
  registered: number
  matured: number
  activated: number
}

export interface ProfileCutRow {
  key: string
  label: string
  registered: number
  matured: number
  activated: number
}

export interface CampaignFunnelData {
  campaigns: CampaignRow[]
  segments: SegmentRow[]
  byStatus: ProfileCutRow[]
  byLevel: ProfileCutRow[]
  registeredTotal: number
}

const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)
const humanOnly = () => Prisma.sql`"userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))`

interface RegisteredRow {
  campaign: string | null
  status: string | null
  level: string | null
  matured: boolean
  activated: boolean
}

const STATUS_LABELS: Record<string, string> = {
  LAID_OFF: 'Laid off',
  RESIGNED: 'Resigned',
  CAREGIVER_LEAVE_SABBATICAL: 'Caregiver leave or sabbatical',
  EMPLOYED_CONSIDERING_MOVE: 'Employed, considering a move',
  CAREER_PIVOT: 'Career pivot',
}

function tally<T extends { registered: number; matured: number; activated: number }>(row: T, r: RegisteredRow): void {
  row.registered += 1
  if (r.matured) {
    row.matured += 1
    if (r.activated) row.activated += 1
  }
}

export async function computeCampaignFunnel(windowDays: number): Promise<CampaignFunnelData> {
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)

  const [visitorRows, registeredRows] = await Promise.all([
    prisma.$queryRaw<{ campaign: string; n: bigint }[]>(Prisma.sql`
      SELECT substring("path" from 'utm_campaign=([^&#]+)') AS campaign, COUNT(DISTINCT "ip")::bigint AS n
      FROM "HomepageVisitEvent"
      WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" LIKE '%utm_campaign=%'
        AND "path" NOT LIKE '%utm_source=lead_email%' AND "createdAt" >= ${since} AND ${humanOnly()}
      GROUP BY 1`),
    prisma.$queryRaw<RegisteredRow[]>(Prisma.sql`
      SELECT t.campaign AS campaign,
             p."currentJobStatus"::text AS status,
             p."levelRankLabel" AS level,
             (p."registrationCompletedAt" <= now() - interval '7 days') AS matured,
             (p."introCommittedAt" IS NOT NULL
               AND EXISTS (SELECT 1 FROM "Resume" r WHERE r."candidateId" = p."id")
               AND EXISTS (SELECT 1 FROM "TrackedJob" j WHERE j."candidateId" = p."id" AND (
                 (j."savedAt" IS NOT NULL AND j."savedAt" <= p."registrationCompletedAt" + interval '7 days')
                 OR (j."firstClickedAt" IS NOT NULL AND j."firstClickedAt" <= p."registrationCompletedAt" + interval '7 days')))
             ) AS activated
      FROM "CandidateProfile" p
      LEFT JOIN LATERAL (
        SELECT substring(v."path" from 'utm_campaign=([^&#]+)') AS campaign
        FROM "HomepageVisitEvent" v
        WHERE v."eventType" = 'PAGE_VIEW' AND v."path" LIKE '%utm_campaign=%' AND v."path" NOT LIKE '%utm_source=lead_email%'
          AND v."createdAt" <= p."registrationCompletedAt"
          AND (v."candidateId" = p."id" OR (p."signupIp" IS NOT NULL AND v."ip" = p."signupIp"))
        ORDER BY v."createdAt" ASC LIMIT 1
      ) t ON true
      WHERE p."registrationCompletedAt" >= ${since} AND p."userId" NOT LIKE 'demo-%'
        AND COALESCE(p."isSampleData", false) = false AND COALESCE(p."isSystemAccount", false) = false`),
  ])

  const campaigns = new Map<string, CampaignRow>()
  const row = (raw: string): CampaignRow => {
    const { segment, channel } = splitCampaign(raw)
    const key = raw.toLowerCase()
    let r = campaigns.get(key)
    if (!r) {
      r = { campaign: key, segment, segmentLabel: segmentLabel(segment), channel, visitors: 0, registered: 0, matured: 0, activated: 0 }
      campaigns.set(key, r)
    }
    return r
  }
  for (const v of visitorRows) if (v.campaign) row(decodeURIComponent(v.campaign)).visitors += Number(v.n)

  const status = new Map<string, ProfileCutRow>()
  const level = new Map<string, ProfileCutRow>()
  const cut = (map: Map<string, ProfileCutRow>, key: string, label: string) => {
    let r = map.get(key)
    if (!r) {
      r = { key, label, registered: 0, matured: 0, activated: 0 }
      map.set(key, r)
    }
    return r
  }
  for (const r of registeredRows) {
    if (r.campaign) tally(row(decodeURIComponent(r.campaign)), r)
    const statusKey = r.status ?? 'unknown'
    tally(cut(status, statusKey, STATUS_LABELS[statusKey] ?? 'Not answered'), r)
    const levelKey = r.level ?? 'unknown'
    tally(cut(level, levelKey, r.level ?? 'Not on file'), r)
  }

  const segments = new Map<string, SegmentRow>()
  for (const c of campaigns.values()) {
    let s = segments.get(c.segment)
    if (!s) {
      s = { segment: c.segment, label: c.segmentLabel, visitors: 0, registered: 0, matured: 0, activated: 0 }
      segments.set(c.segment, s)
    }
    s.visitors += c.visitors
    s.registered += c.registered
    s.matured += c.matured
    s.activated += c.activated
  }

  const byRegistered = <T extends { registered: number }>(a: T, b: T) => b.registered - a.registered
  return {
    campaigns: [...campaigns.values()].sort(byRegistered),
    segments: [...segments.values()].sort(byRegistered),
    byStatus: [...status.values()].sort(byRegistered),
    byLevel: [...level.values()].sort(byRegistered),
    registeredTotal: registeredRows.length,
  }
}
