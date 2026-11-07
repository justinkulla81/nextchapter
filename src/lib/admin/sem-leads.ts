import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'
import { splitCampaign } from '@/lib/marketing/campaign-tag'
import { campaignOfPath, classifyPaidChannel, type PaidChannel } from '@/lib/admin/paid-channels'

// Paid leads and the accounts they turned into, for the Visitor activity chart, by ad channel.
// A visitor is "paid" when their first human page view in the window is a paid click (paid-channels.ts: a gclid or msclkid, or a
// link tagged with a paid medium for LinkedIn, Reddit, Facebook, Google or Bing). Leads and accounts are tied to that visit by IP,
// the same match lead-source.ts and the campaign funnel use, and counted only when they came within LEAD_WINDOW_DAYS after the click.
// B2B or B2C comes from the campaign tag: a segment starting "b2b-" (campaign-tag.ts SEGMENTS) is B2B,
// everything else, including a click with no campaign, is B2C.

const LEAD_WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface PaidLead {
  at: Date
  channel: PaidChannel
  b2b: boolean
}

export interface PaidAccount {
  at: Date
  channel: PaidChannel
}

export interface SemEvents {
  leads: PaidLead[]
  accounts: PaidAccount[]
}

export function isB2bCampaign(campaign: string | null): boolean {
  if (!campaign) return false
  let decoded = campaign
  try {
    decoded = decodeURIComponent(campaign)
  } catch {
    // keep the raw text
  }
  return splitCampaign(decoded).segment.startsWith('b2b-')
}

interface EventRow {
  at: Date
  path: string | null
}

// Fail-soft: the chart is a side panel, so a query error shows as an empty chart, never a broken page.
export async function loadSemEvents(windowDays: number): Promise<SemEvents> {
  try {
    return await querySemEvents(windowDays)
  } catch (error) {
    console.error('Paid leads chart query failed:', error)
    return { leads: [], accounts: [] }
  }
}

async function querySemEvents(windowDays: number): Promise<SemEvents> {
  const now = Date.now()
  const since = new Date(now - windowDays * DAY_MS)
  // The click can be up to LEAD_WINDOW_DAYS before a lead that falls inside the window.
  const clickSince = new Date(now - (windowDays + LEAD_WINDOW_DAYS) * DAY_MS)
  const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)

  // Loose filter in SQL (any click id or paid medium); classifyPaidChannel decides the channel, or drops the row, in code.
  const paid = Prisma.sql`
    SELECT DISTINCT ON ("ip") "ip", "createdAt" AS "clickedAt", "path"
    FROM "HomepageVisitEvent"
    WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "createdAt" >= ${clickSince}
      AND ("path" ~* '[?&](gclid|gbraid|wbraid|msclkid)=' OR "path" ~* '[?&]utm_medium=(cpc|ppc|paid)')
      AND "userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))
    ORDER BY "ip", "createdAt" ASC`

  const [leadRows, accountRows] = await Promise.all([
    prisma.$queryRaw<EventRow[]>(Prisma.sql`
      WITH paid AS (${paid}),
      leads AS (
        SELECT lower("email") AS "email", "ip", "createdAt" FROM "HomepageLead" WHERE "ip" IS NOT NULL AND "createdAt" >= ${since}
        UNION ALL
        SELECT lower("email"), "ip", "createdAt" FROM "NewsletterSubscriber" WHERE "ip" IS NOT NULL AND "createdAt" >= ${since}
      )
      SELECT DISTINCT ON (l."email") l."createdAt" AS "at", s."path"
      FROM leads l JOIN paid s ON s."ip" = l."ip"
        AND l."createdAt" >= s."clickedAt" AND l."createdAt" <= s."clickedAt" + make_interval(days => ${LEAD_WINDOW_DAYS}::int)
      ORDER BY l."email", l."createdAt" ASC`),
    prisma.$queryRaw<EventRow[]>(Prisma.sql`
      WITH paid AS (${paid})
      SELECT p."registrationCompletedAt" AS "at", s."path"
      FROM "CandidateProfile" p JOIN paid s ON s."ip" = p."signupIp"
        AND p."registrationCompletedAt" >= s."clickedAt" AND p."registrationCompletedAt" <= s."clickedAt" + make_interval(days => ${LEAD_WINDOW_DAYS}::int)
      WHERE p."registrationCompletedAt" >= ${since} AND p."userId" NOT LIKE 'demo-%'
        AND COALESCE(p."isSampleData", false) = false AND COALESCE(p."isSystemAccount", false) = false`),
  ])

  const leads: PaidLead[] = []
  for (const r of leadRows) {
    const channel = classifyPaidChannel(r.path)
    if (channel) leads.push({ at: r.at, channel, b2b: isB2bCampaign(campaignOfPath(r.path)) })
  }
  const accounts: PaidAccount[] = []
  for (const r of accountRows) {
    const channel = classifyPaidChannel(r.path)
    if (channel) accounts.push({ at: r.at, channel })
  }
  return { leads, accounts }
}
