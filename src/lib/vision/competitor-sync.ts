import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { withAudienceHtml } from '@/lib/email/audience-tag'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { ProductCompetitor } from '@prisma/client'
import type { NamedEntry, WinEntry } from './competitor-areas'
import { addSeenAt, downloadEmail, gapIdeas, winsFromAwards, winsFromCard, type CrmWin } from './competitor-sync-core'

const SITE = 'https://launchyournextchapter.com'
const TO = 'justin@launchyournextchapter.com'

/** The first few features we lack that a DIRECT competitor has become product-list ideas (status SPARK). The card lists its most important gaps first; taking all of them from every card would put hundreds of near-duplicates on the list. Repeats add the competitor's name instead of a second idea. */
const GAPS_PER_CARD = 3
export async function syncProductGaps(c: ProductCompetitor): Promise<number> {
  if (c.relationship !== 'DIRECT') return 0
  if (c.status !== 'ACTIVE' || c.weNeed.length === 0) return 0
  const needs = c.weNeed.slice(0, GAPS_PER_CARD)
  const existing = await prisma.productItem.findMany({ where: { kind: 'FEATURE' }, select: { id: true, title: true, body: true } })
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const byKey = new Map(existing.map((e) => [key(e.title), e]))
  let created = 0
  for (const need of needs) {
    const title = need.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '').slice(0, 140)
    const seen = byKey.get(key(title))
    if (seen && seen.body?.startsWith('Seen at competitors:')) {
      const next = addSeenAt(seen.body, c.name)
      if (next !== seen.body) await prisma.productItem.update({ where: { id: seen.id }, data: { body: next } })
    }
  }
  for (const title of gapIdeas(needs, existing.map((e) => e.title))) {
    await prisma.productItem.create({ data: { kind: 'FEATURE', area: 'PRODUCT', title, status: 'SPARK', body: addSeenAt(null, c.name) } })
    created++
  }
  return created
}

async function orgFor(buyer: string, government: boolean): Promise<string | null> {
  const canonical = normalizeOrgName(buyer)
  if (!canonical) return null
  const found = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: canonical }, select: { id: true } })
  if (found) return found.id
  const made = await prisma.crmOrganization.create({
    data: { name: buyer, canonicalNameNormalized: canonical, orgTypes: government ? ['GOVERNMENT'] : [], notes: 'Added from a competitor win (Competitors page).' },
    select: { id: true },
  })
  return made.id
}

async function recordWin(w: CrmWin, government: boolean, now: Date): Promise<boolean> {
  const dup = await prisma.crmActivity.findFirst({ where: { sourceRef: w.ref }, select: { id: true } })
  if (dup) return false
  const orgId = await orgFor(w.buyer, government)
  if (!orgId) return false
  await prisma.crmActivity.create({
    data: {
      type: 'NOTE', direction: 'INBOUND', occurredAt: w.when && w.when.getTime() <= now.getTime() ? w.when : now, orgId, subject: w.title,
      body: [w.amount ? `Amount: $${Math.round(w.amount).toLocaleString('en-US')}` : null, w.url ? `Source: ${w.url}` : null].filter(Boolean).join('\n') || null,
      isAutoLogged: true, sourceRef: w.ref,
    },
  })
  if (w.rebidAt) {
    const label = `Likely re-bid: ${w.title.replace(/ won: /, "'s ")}`.slice(0, 200)
    const has = await prisma.crmDeadline.findFirst({ where: { orgId, label }, select: { id: true } })
    if (!has) await prisma.crmDeadline.create({ data: { orgId, label, kind: 'CONTRACT_RENEWAL', dueAt: w.rebidAt, sourceUrl: w.url, rawText: 'Contract end date from the award record; the buyer may re-bid around then.' } })
  }
  return true
}

/** Each competitor win becomes a note on the buyer's CRM organization (dated), and a contract that ends in the future becomes a re-bid date. Idempotent. */
export async function syncCrmWins(cards: Pick<ProductCompetitor, 'id' | 'name' | 'wins' | 'status'>[], now = new Date(), maxNew = 200): Promise<number> {
  const rows = await prisma.competitorAward.findMany({ where: { confidence: 'EXACT' }, take: 5000 })
  const byName = new Map(cards.map((c) => [c.name.toLowerCase().replace(/[^a-z0-9]+/g, ''), c]))
  let n = 0
  for (const a of rows) {
    if (n >= maxNew) break
    const c = (a.competitorId && cards.find((x) => x.id === a.competitorId)) || byName.get(a.competitorName.toLowerCase().replace(/[^a-z0-9]+/g, ''))
    if (!c) continue
    for (const w of winsFromAwards(c.name, [a], now)) if (await recordWin(w, true, now)) n++
  }
  for (const c of cards) {
    for (const w of winsFromCard(c.name, (c.wins as WinEntry[] | null) ?? [])) {
      if (n >= maxNew) break
      if (await recordWin(w, false, now)) n++
    }
  }
  return n
}

export async function sendCompetitorDownload(c: ProductCompetitor): Promise<boolean> {
  const { subject, html } = downloadEmail(
    { ...c, customers: (c.customers as NamedEntry[] | null) ?? [], wins: (c.wins as WinEntry[] | null) ?? [] },
    `${SITE}/support/admin/vision/competitors#c-${c.id}`,
  )
  const { error } = await createResend(process.env.RESEND_API_KEY, 'admin').emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>', to: TO, subject, html: withAudienceHtml('admin', html),
  })
  if (error) console.error('Competitor download not sent for', c.name, error)
  return !error
}

/** Everything that follows adding a competitor. Each step is separate so one failing never blocks the others. */
export async function syncNewCompetitor(c: ProductCompetitor): Promise<{ ideas: number; wins: number; emailed: boolean }> {
  const run = async <T,>(f: () => Promise<T>, fallback: T) => { try { return await f() } catch (e) { console.error('Competitor sync step failed for', c.name, e); return fallback } }
  return {
    ideas: await run(() => syncProductGaps(c), 0),
    wins: await run(() => syncCrmWins([c]), 0),
    emailed: await run(() => sendCompetitorDownload(c), false),
  }
}
