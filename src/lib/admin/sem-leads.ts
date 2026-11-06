import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'
import { splitCampaign } from '@/lib/marketing/campaign-tag'

// Paid search (SEM) leads and the accounts they turned into, for the Visitor activity chart.
// A visitor is "SEM" when their first human page view in the window carried utm_medium=cpc or a gclid
// (the Google Ads click id). Leads and accounts are tied to that visit by IP, the same match lead-source.ts
// and the campaign funnel use, and counted only when they came within LEAD_WINDOW_DAYS after the click.
// B2B or B2C comes from the campaign tag: a segment starting "b2b-" (campaign-tag.ts SEGMENTS) is B2B,
// everything else, including a click with no campaign, is B2C.

const LEAD_WINDOW_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

export interface SemEvents {
  b2cLeads: Date[]
  b2bLeads: Date[]
  accounts: Date[]
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
  campaign: string | null
}

// Fail-soft: the chart is a side panel, so a query error shows as an empty chart, never a broken page.
export async function loadSemEvents(windowDays: number): Promise<SemEvents> {
  try {
    return await querySemEvents(windowDays)
  } catch (error) {
    console.error('Paid search chart query failed:', error)
    return { b2cLeads: [], b2bLeads: [], accounts: [] }
  }
}

async function querySemEvents(windowDays: number): Promise<SemEvents> {
  const now = Date.now()
  const since = new Date(now - windowDays * DAY_MS)
  // The click can be up to LEAD_WINDOW_DAYS before a lead that falls inside the window.
  const clickSince = new Date(now - (windowDays + LEAD_WINDOW_DAYS) * DAY_MS)
  const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)

  const sem = Prisma.sql`
    SELECT DISTINCT ON ("ip") "ip", "createdAt" AS "clickedAt", substring("path" from 'utm_campaign=([^&#]+)') AS "campaign"
    FROM "HomepageVisitEvent"
    WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "createdAt" >= ${clickSince}
      AND ("path" ~ '[?&]utm_medium=cpc' OR "path" ~ '[?&]gclid=')
      AND "userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))
    ORDER BY "ip", "createdAt" ASC`

  const [leadRows, accountRows] = await Promise.all([
    prisma.$queryRaw<EventRow[]>(Prisma.sql`
      WITH sem AS (${sem}),
      leads AS (
        SELECT lower("email") AS "email", "ip", "createdAt" FROM "HomepageLead" WHERE "ip" IS NOT NULL AND "createdAt" >= ${since}
        UNION ALL
        SELECT lower("email"), "ip", "createdAt" FROM "NewsletterSubscriber" WHERE "ip" IS NOT NULL AND "createdAt" >= ${since}
      )
      SELECT DISTINCT ON (l."email") l."createdAt" AS "at", s."campaign"
      FROM leads l JOIN sem s ON s."ip" = l."ip"
        AND l."createdAt" >= s."clickedAt" AND l."createdAt" <= s."clickedAt" + make_interval(days => ${LEAD_WINDOW_DAYS}::int)
      ORDER BY l."email", l."createdAt" ASC`),
    prisma.$queryRaw<EventRow[]>(Prisma.sql`
      WITH sem AS (${sem})
      SELECT p."registrationCompletedAt" AS "at", s."campaign"
      FROM "CandidateProfile" p JOIN sem s ON s."ip" = p."signupIp"
        AND p."registrationCompletedAt" >= s."clickedAt" AND p."registrationCompletedAt" <= s."clickedAt" + make_interval(days => ${LEAD_WINDOW_DAYS}::int)
      WHERE p."registrationCompletedAt" >= ${since} AND p."userId" NOT LIKE 'demo-%'
        AND COALESCE(p."isSampleData", false) = false AND COALESCE(p."isSystemAccount", false) = false`),
  ])

  return {
    b2cLeads: leadRows.filter((r) => !isB2bCampaign(r.campaign)).map((r) => r.at),
    b2bLeads: leadRows.filter((r) => isB2bCampaign(r.campaign)).map((r) => r.at),
    accounts: accountRows.map((r) => r.at),
  }
}
