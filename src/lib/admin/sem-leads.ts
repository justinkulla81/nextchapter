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

// --- Conversions by channel -------------------------------------------------------------------------------------
// One cohort: visitors whose first paid click was inside the window. Each is checked for an email left, and for an account
// created, within LEAD_WINDOW_DAYS of that click (same IP match as above), so the rates divide like by like.

export interface FunnelVisitor {
  channel: PaidChannel
  leftEmail: boolean
  createdAccount: boolean
}

export interface ChannelFunnel {
  channel: PaidChannel
  visitors: number
  emails: number
  accounts: number
  /** Share of paid visitors who left an email / created an account; null when there are no visitors. */
  emailRate: number | null
  accountRate: number | null
}

export function summarizeFunnel(visitors: FunnelVisitor[]): ChannelFunnel[] {
  const by = new Map<PaidChannel, { visitors: number; emails: number; accounts: number }>()
  for (const v of visitors) {
    const t = by.get(v.channel) ?? { visitors: 0, emails: 0, accounts: 0 }
    t.visitors += 1
    if (v.leftEmail) t.emails += 1
    if (v.createdAccount) t.accounts += 1
    by.set(v.channel, t)
  }
  return Array.from(by, ([channel, t]) => ({
    channel,
    ...t,
    emailRate: t.visitors ? t.emails / t.visitors : null,
    accountRate: t.visitors ? t.accounts / t.visitors : null,
  })).sort((a, b) => b.visitors - a.visitors)
}

export async function loadPaidFunnel(windowDays: number): Promise<ChannelFunnel[]> {
  try {
    const now = Date.now()
    const since = new Date(now - windowDays * DAY_MS)
    const clickSince = new Date(now - (windowDays + LEAD_WINDOW_DAYS) * DAY_MS)
    const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)
    const rows = await prisma.$queryRaw<{ path: string | null; left_email: boolean; created_account: boolean }[]>(Prisma.sql`
      WITH paid AS (
        SELECT DISTINCT ON ("ip") "ip", "createdAt" AS "clickedAt", "path"
        FROM "HomepageVisitEvent"
        WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "createdAt" >= ${clickSince}
          AND ("path" ~* '[?&](gclid|gbraid|wbraid|msclkid)=' OR "path" ~* '[?&]utm_medium=(cpc|ppc|paid)')
          AND "userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))
        ORDER BY "ip", "createdAt" ASC)
      SELECT s."path",
        (EXISTS (SELECT 1 FROM "HomepageLead" l WHERE l."ip" = s."ip" AND l."createdAt" >= s."clickedAt" AND l."createdAt" <= s."clickedAt" + make_interval(days => ${LEAD_WINDOW_DAYS}::int))
         OR EXISTS (SELECT 1 FROM "NewsletterSubscriber" n WHERE n."ip" = s."ip" AND n."createdAt" >= s."clickedAt" AND n."createdAt" <= s."clickedAt" + make_interval(days => ${LEAD_WINDOW_DAYS}::int))) AS "left_email",
        EXISTS (SELECT 1 FROM "CandidateProfile" p WHERE p."signupIp" = s."ip" AND p."registrationCompletedAt" >= s."clickedAt"
          AND p."registrationCompletedAt" <= s."clickedAt" + make_interval(days => ${LEAD_WINDOW_DAYS}::int)
          AND p."userId" NOT LIKE 'demo-%' AND COALESCE(p."isSampleData", false) = false AND COALESCE(p."isSystemAccount", false) = false) AS "created_account"
      FROM paid s WHERE s."clickedAt" >= ${since}`)
    const visitors: FunnelVisitor[] = []
    for (const r of rows) {
      const channel = classifyPaidChannel(r.path)
      if (channel) visitors.push({ channel, leftEmail: r.left_email, createdAccount: r.created_account })
    }
    return summarizeFunnel(visitors)
  } catch (error) {
    console.error('Paid conversions query failed:', error)
    return []
  }
}
