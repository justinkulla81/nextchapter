import 'server-only'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { withAudienceHtml } from '@/lib/email/audience-tag'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { ProductCompetitor } from '@prisma/client'
import type { NamedEntry, WinEntry } from './competitor-areas'
import { awardIsWorkforce } from '@/lib/bids/relevance'
import { addSeenAt, addWording, wordingsOf, downloadEmail, gapMatchPrompt, parseGapMatches, winsFromAwards, winsFromCard, type CrmWin, type GapMatches } from './competitor-sync-core'
import { getAnthropicClient } from '@/lib/anthropic'

const SITE = 'https://launchyournextchapter.com'
const TO = 'justin@launchyournextchapter.com'

/** The features we lack that an active competitor has become product-list ideas (status SPARK). The card lists its most important gaps first, so only the first few per card are taken: all of them from every card would put hundreds of near-duplicates on the list. A gap that restates an existing idea (same wording, or the same meaning) adds the competitor's name to it instead of making a second idea. */
const GAPS_PER_CARD = 3
/** New gaps compared against the list in one call; the rest wait for the next run. */
const MAX_NEW_PER_CALL = 200
const MATCH_MODEL = 'claude-haiku-4-5-20251001'
const MATCH_PRICE = { inPerM: 1, outPerM: 5 }

type GapCard = Pick<ProductCompetitor, 'name' | 'status' | 'weNeed'>

/** One model call: which new gaps restate an existing idea or each other. Fails soft (no matches) so the exact-wording path still runs. */
async function matchGapsByMeaning(existingTitles: string[], news: { title: string }[]): Promise<{ result: GapMatches; costUsd: number }> {
  const none = { result: { matches: new Map<number, number>(), groups: [] }, costUsd: 0 }
  if (news.length === 0 || existingTitles.length === 0) return none
  try {
    const r = await getAnthropicClient().messages.create({
      model: MATCH_MODEL, max_tokens: 4000, messages: [{ role: 'user', content: gapMatchPrompt(existingTitles, news) }],
    })
    const text = r.content.map((b) => (b.type === 'text' ? b.text : '')).join('')
    const costUsd = (r.usage.input_tokens * MATCH_PRICE.inPerM + r.usage.output_tokens * MATCH_PRICE.outPerM) / 1e6
    return { result: parseGapMatches(text, news.length, existingTitles.length), costUsd }
  } catch (e) {
    console.error('Gap matching by meaning failed; using exact wording only', e)
    return none
  }
}

export async function syncGapsFor(cards: GapCard[], perCard = GAPS_PER_CARD, maxNew = MAX_NEW_PER_CALL): Promise<{ created: number; matched: number; costUsd: number }> {
  const existing = await prisma.productItem.findMany({ where: { kind: 'FEATURE' }, select: { id: true, title: true, body: true } })
  const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const byKey = new Map(existing.map((e) => [key(e.title), e]))
  for (const e of existing) for (const w of wordingsOf(e.body)) if (!byKey.has(key(w))) byKey.set(key(w), e)
  const bodies = new Map(existing.map((e) => [e.id, e.body]))
  const seenIdeas = existing.filter((e) => e.body?.startsWith('Seen at competitors: '))
  const addName = async (id: string, names: string[], wordings: string[] = []) => {
    const was = bodies.get(id) ?? null
    const next = wordings.reduce((b, w) => addWording(b, w), names.reduce((b, n) => addSeenAt(b, n), was))
    if (next !== was) { await prisma.productItem.update({ where: { id }, data: { body: next } }); bodies.set(id, next) }
  }

  const pending = new Map<string, { title: string; names: string[] }>()
  let matched = 0
  for (const c of cards) {
    if (c.status !== 'ACTIVE') continue
    for (const need of c.weNeed.slice(0, perCard)) {
      const title = need.replace(/\s+/g, ' ').trim().replace(/[.;]+$/, '').slice(0, 140)
      if (title.length < 8) continue
      const k = key(title)
      const seen = byKey.get(k)
      if (seen) { if (seen.body?.startsWith('Seen at competitors: ')) await addName(seen.id, [c.name]); continue }
      const dup = pending.get(k)
      if (dup) { if (!dup.names.includes(c.name)) dup.names.push(c.name); continue }
      if (pending.size < maxNew) pending.set(k, { title, names: [c.name] })
    }
  }

  const news = [...pending.values()]
  const { result, costUsd } = await matchGapsByMeaning(seenIdeas.map((e) => e.title), news)
  const grouped = new Set(result.groups.flatMap((g) => g.members))
  let created = 0
  for (const [n, e] of result.matches) { await addName(seenIdeas[e].id, news[n].names, [news[n].title]); matched++ }
  for (const g of result.groups) {
    const names = [...new Set(g.members.flatMap((m) => news[m].names))]
    const clash = byKey.get(key(g.label))
    if (clash) { await addName(clash.id, names, g.members.map((m) => news[m].title)); matched++; continue }
    await prisma.productItem.create({ data: { kind: 'FEATURE', area: 'PRODUCT', title: g.label, status: 'SPARK', body: g.members.map((m) => news[m].title).filter((t) => key(t) !== key(g.label)).reduce((b, t) => addWording(b, t), names.reduce((b, n) => addSeenAt(b, n), null as string | null)) } })
    created++
  }
  for (const [n, item] of news.entries()) {
    if (result.matches.has(n) || grouped.has(n)) continue
    await prisma.productItem.create({ data: { kind: 'FEATURE', area: 'PRODUCT', title: item.title, status: 'SPARK', body: item.names.reduce((b, nm) => addSeenAt(b, nm), null as string | null) } })
    created++
  }
  if (news.length > 0) console.log(`[gap-match] new=${news.length} matched=${matched} created=${created} cost=$${costUsd.toFixed(4)}`)
  return { created, matched, costUsd }
}

export async function syncProductGaps(c: ProductCompetitor, perCard = GAPS_PER_CARD): Promise<number> {
  return (await syncGapsFor([c], perCard)).created
}

/** Every active competitor's gaps onto the product list in one pass (the Competitors page button). Idempotent. */
export async function syncAllGaps(perCard = 8): Promise<{ created: number; matched: number; costUsd: number }> {
  const cards = await prisma.productCompetitor.findMany({ where: { status: 'ACTIVE' }, select: { name: true, status: true, weNeed: true } })
  return syncGapsFor(cards, perCard)
}

export async function orgFor(buyer: string, government: boolean): Promise<string | null> {
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

export const rebidLabel = (w: CrmWin) => `Likely re-bid: ${w.title.replace(/ won: /, "'s ")}`.slice(0, 200)

/**
 * Each upcoming re-bid becomes a real item in the Grants & programs pipeline, at the first stage, with the buyer as the
 * organization, the incumbent competitor named in the title, the contract value, and the contract end date as the
 * next-step date. The matching "Likely re-bid" deadline is linked to it. Idempotent.
 */
export async function syncRebidOpportunities(cards: Pick<ProductCompetitor, 'id' | 'name'>[], now = new Date(), maxNew = 300): Promise<number> {
  const pipeline = await prisma.crmPipeline.findUnique({ where: { key: 'grants' }, include: { stages: { where: { key: 'identified' }, take: 1 } } })
  const stage = pipeline?.stages[0]
  if (!pipeline || !stage) return 0
  const rows = await prisma.competitorAward.findMany({ where: { confidence: 'EXACT', endDate: { gt: now } }, take: 5000 })
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, '')
  const byName = new Map(cards.map((c) => [norm(c.name), c]))
  let n = 0
  for (const a of rows) {
    if (n >= maxNew) break
    if (!awardIsWorkforce(a)) continue
    const c = (a.competitorId && cards.find((x) => x.id === a.competitorId)) || byName.get(norm(a.competitorName))
    if (!c) continue
    const [w] = winsFromAwards(c.name, [a], now)
    if (!w?.rebidAt) continue
    const org = await prisma.crmOrganization.findUnique({ where: { canonicalNameNormalized: normalizeOrgName(w.buyer) }, select: { id: true } })
    if (!org) continue
    const title = `Possible re-bid: ${w.title.replace(/ won: /, "'s contract: ")}`.slice(0, 200)
    const dup = await prisma.crmOpportunity.findFirst({ where: { pipelineId: pipeline.id, orgId: org.id, title }, select: { id: true } })
    let oppId = dup?.id
    if (!oppId) {
      const amount = w.amount ? Math.min(Math.round(w.amount), 2_147_483_647) : null
      const opp = await prisma.crmOpportunity.create({
        data: {
          pipelineId: pipeline.id, stageId: stage.id, orgId: org.id, title, url: w.url, amountUsdMin: amount, amountUsdMax: amount,
          nextStep: `${c.name} holds this contract until ${w.rebidAt.toISOString().slice(0, 10)}. Watch for the re-bid notice and decide whether to bid or partner.`,
          nextStepDueAt: new Date(Math.max(now.getTime() + 86_400_000, w.rebidAt.getTime() - 180 * 86_400_000)),
        },
        select: { id: true },
      })
      oppId = opp.id
      n++
    }
    await prisma.crmDeadline.updateMany({ where: { orgId: org.id, label: rebidLabel(w), opportunityId: null }, data: { opportunityId: oppId } })
  }
  return n
}

export async function recordWin(w: CrmWin, government: boolean, now: Date): Promise<boolean> {
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
    const label = rebidLabel(w)
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
    // Only workforce-relevant awards reach the CRM: a competitor's contract with the FBI is not a lead for us.
    if (!awardIsWorkforce(a)) continue
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
