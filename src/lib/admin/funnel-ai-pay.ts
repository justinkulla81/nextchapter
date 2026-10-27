import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { BOT_SIGNATURES } from '@/lib/http/user-agent'
import type { OfferRow } from '@/lib/admin/funnel'

// Offers-table rows for the pay and AI-skill cluster (docs/PATTERN_PAY_AND_AI.md): the AI-skill pay premium explainer and the
// pay check. Kept in its own file so the shared funnel queries stay as they are; funnel.ts appends these to the offers list.

const botPatterns = BOT_SIGNATURES.map((s) => `%${s}%`)
const humanOnly = () => Prisma.sql`"userAgent" IS NOT NULL AND NOT ("userAgent" ILIKE ANY(${botPatterns}))`

async function reached(since: Date, pathRegex: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(DISTINCT "ip")::bigint AS n FROM "HomepageVisitEvent"
    WHERE "eventType" = 'PAGE_VIEW' AND "ip" IS NOT NULL AND "path" ~ ${pathRegex} AND "createdAt" >= ${since} AND ${humanOnly()}`)
  return Number(rows[0]?.n ?? 0)
}

/** Members who first came in through a lead of this kind (the lead_became_member event written at registration). */
async function becameMembers(since: Date, kind: string): Promise<number> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>(Prisma.sql`
    SELECT COUNT(*)::bigint AS n FROM "AnalyticsEvent"
    WHERE "event" = 'lead_became_member' AND "createdAt" >= ${since} AND "properties"->>'kind' = ${kind}`)
  return Number(rows[0]?.n ?? 0)
}

export async function computeAiPayOffers(since: Date): Promise<OfferRow[]> {
  const win = { createdAt: { gte: since } }
  const [rExplainer, rPayCheck, cExplainer, cPayCheck, mPayCheck] = await Promise.all([
    reached(since, '^/resources/ai-skills-pay-premium'),
    reached(since, '^/tools/pay-check'),
    prisma.newsletterSubscriber.count({ where: { ...win, source: 'ai-pay-premium' } }),
    prisma.homepageLead.count({ where: { ...win, kind: 'pay_check' } }),
    becameMembers(since, 'pay_check'),
  ])
  return [
    {
      key: 'aiPayExplainer',
      label: 'AI-skill pay premium explainer',
      where: '/resources/ai-skills-pay-premium',
      reached: rExplainer,
      captured: cExplainer,
      capturedMeans: 'emails (the weekly list, source ai-pay-premium)',
      becameMembers: null,
    },
    {
      key: 'payCheck',
      label: 'Pay check (with the AI-skill premium)',
      where: '/tools/pay-check',
      reached: rPayCheck,
      captured: cPayCheck,
      capturedMeans: 'emails (the result email, which is off until PAY_CHECK_EMAIL is on, so this is saved addresses)',
      becameMembers: mPayCheck,
    },
  ]
}
