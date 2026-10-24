'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { defaultAreaForKind } from '@/lib/vision/labels'
import { cleanAreas, cleanRelationship, cleanStatus, hostOf, homepageOf, parseCustomers, parseLines, parseWins, parseUsd } from '@/lib/vision/competitor-areas'
import { enrichCompetitor, type EnrichedCompetitor } from '@/lib/vision/competitor-enrich'
import { mergeRefresh } from '@/lib/vision/competitor-watch'
import { notifyCandidateFeedbackAddressed } from '@/lib/help/notify'
import type {
  ProductItemKind, ProductItemArea, ProductItemStatus, ProductRoadmapBucket, ProductEffort,
  ProductFeedbackSource, ProductCompetitorOverlap, CrmPortfolioOverlap,
} from '@prisma/client'

const V = '/support/admin/vision'

// ── Master vision document ───────────────────────────────────────────────────

/**
 * Saves a new version and makes it current.
 *
 * Never edits in place. "What did we believe in September" is a question you
 * will ask during a fundraise, and a document that was overwritten cannot
 * answer it — so every save is a new row and the old one becomes history.
 */
export async function saveVisionDoc(formData: FormData) {
  const admin = await requireAdmin()
  const title = String(formData.get('title') ?? '').trim() || 'NextChapter product vision'
  const bodyMarkdown = String(formData.get('body') ?? '')
  const changeNote = String(formData.get('changeNote') ?? '').trim() || null
  if (!bodyMarkdown.trim()) return

  const latest = await prisma.productVisionDoc.findFirst({ orderBy: { version: 'desc' }, select: { version: true, bodyMarkdown: true } })
  // Saving an unchanged document would create a version that says nothing.
  if (latest?.bodyMarkdown === bodyMarkdown) return

  await prisma.$transaction([
    prisma.productVisionDoc.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
    prisma.productVisionDoc.create({
      data: {
        title, bodyMarkdown, changeNote,
        version: (latest?.version ?? 0) + 1,
        isCurrent: true,
        createdByEmail: admin.email ?? null,
      },
    }),
  ])
  captureServerEvent(admin.email ?? 'admin', 'vision_doc_saved', { version: (latest?.version ?? 0) + 1 })
  revalidatePath(`${V}/doc`)
  revalidatePath(V)
}

/** Makes an older version current again, as a NEW version. */
export async function restoreVisionVersion(docId: string) {
  const admin = await requireAdmin()
  const old = await prisma.productVisionDoc.findUniqueOrThrow({ where: { id: docId } })
  const latest = await prisma.productVisionDoc.findFirst({ orderBy: { version: 'desc' }, select: { version: true } })

  // Restoring by flipping isCurrent backwards would lose whatever came after.
  // A restore is a new version whose body happens to match an old one.
  await prisma.$transaction([
    prisma.productVisionDoc.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } }),
    prisma.productVisionDoc.create({
      data: {
        title: old.title, bodyMarkdown: old.bodyMarkdown,
        changeNote: `Restored version ${old.version}`,
        version: (latest?.version ?? 0) + 1, isCurrent: true,
        createdByEmail: admin.email ?? null,
      },
    }),
  ])
  captureServerEvent(admin.email ?? 'admin', 'vision_doc_restored', { fromVersion: old.version })
  revalidatePath(`${V}/doc`)
}

// ── Items ────────────────────────────────────────────────────────────────────

/**
 * Capture. Title only is enough on purpose.
 *
 * A brainstorm dies the moment each idea has to be graded before you write the
 * next one, so a new item lands as a SPARK with no grade, owner or estimate.
 */
export async function createItem(formData: FormData) {
  const admin = await requireAdmin()
  const title = String(formData.get('title') ?? '').trim()
  if (!title) return
  const kind = (String(formData.get('kind') ?? 'IDEA') || 'IDEA') as ProductItemKind
  const statusRaw = String(formData.get('status') ?? '').trim()
  const areaRaw = String(formData.get('area') ?? '').trim()

  const item = await prisma.productItem.create({
    data: {
      kind, title,
      area: (areaRaw || defaultAreaForKind(kind)) as ProductItemArea,
      body: String(formData.get('body') ?? '').trim() || null,
      status: (statusRaw || 'SPARK') as ProductItemStatus,
      visionSection: String(formData.get('visionSection') ?? '').trim() || null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_item_created', {
    itemId: item.id, kind, area: item.area, status: item.status,
  })
  revalidatePath(`${V}/items`)
  revalidatePath(`${V}/brainstorm`)
  revalidatePath(V)
}

/**
 * One field, set straight from a list row.
 *
 * The full edit form lives on the item page, but prioritising and scheduling
 * are things you do to twenty rows in a sitting while looking at them next to
 * each other — and opening twenty pages to do it is how a roadmap stops
 * getting groomed. Deliberately narrow: it writes the one field named, so it
 * can never blank the rest of the row the way a partial form post would.
 */
export async function setItemField(
  itemId: string,
  field: 'kind' | 'area' | 'status' | 'bucket' | 'effort' | 'priority' | 'title',
  value: string,
) {
  const admin = await requireAdmin()
  const v = value.trim()

  let data: Record<string, unknown>
  switch (field) {
    case 'title':
      if (!v) return
      data = { title: v }
      break
    case 'priority':
      data = { priority: v ? Math.max(1, Math.min(5, parseInt(v, 10) || 3)) : null }
      break
    case 'status': {
      const status = v as ProductItemStatus
      // Same rule as the full form: shipping stamps the date, un-shipping clears it.
      data = { status, shippedAt: status === 'SHIPPED' ? new Date() : null }
      break
    }
    default:
      if (!v) return
      data = { [field]: v }
  }

  await prisma.productItem.update({ where: { id: itemId }, data })
  captureServerEvent(admin.email ?? 'admin', 'vision_item_field_set', { itemId, field, value: v || null })
  revalidatePath(`${V}/items`)
  revalidatePath(`${V}/items/${itemId}`)
  revalidatePath(`${V}/brainstorm`)
  revalidatePath(V)
}

export async function updateItem(itemId: string, formData: FormData) {
  const admin = await requireAdmin()
  const status = String(formData.get('status') ?? '').trim() as ProductItemStatus
  const priorityRaw = String(formData.get('priority') ?? '').trim()

  await prisma.productItem.update({
    where: { id: itemId },
    data: {
      title: String(formData.get('title') ?? '').trim() || undefined,
      body: String(formData.get('body') ?? '').trim() || null,
      kind: (String(formData.get('kind') ?? '').trim() || undefined) as ProductItemKind | undefined,
      area: (String(formData.get('area') ?? '').trim() || undefined) as ProductItemArea | undefined,
      status: status || undefined,
      bucket: (String(formData.get('bucket') ?? '').trim() || undefined) as ProductRoadmapBucket | undefined,
      effort: (String(formData.get('effort') ?? '').trim() || undefined) as ProductEffort | undefined,
      priority: priorityRaw ? Math.max(1, Math.min(5, parseInt(priorityRaw, 10) || 3)) : null,
      costDriver: String(formData.get('costDriver') ?? '').trim() || null,
      visionSection: String(formData.get('visionSection') ?? '').trim() || null,
      blockedById: String(formData.get('blockedById') ?? '').trim() || null,
      wontDoReason: String(formData.get('wontDoReason') ?? '').trim() || null,
      shippedAt: status === 'SHIPPED' ? new Date() : status ? null : undefined,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_item_updated', { itemId, status: status || null })
  revalidatePath(`${V}/items`)
  revalidatePath(`${V}/items/${itemId}`)
}

/** Graduates a spark into the judged backlog — never automatic. */
export async function promoteSpark(itemId: string) {
  const admin = await requireAdmin()
  await prisma.productItem.update({ where: { id: itemId }, data: { status: 'NEW' } })
  captureServerEvent(admin.email ?? 'admin', 'vision_spark_promoted', { itemId })
  revalidatePath(`${V}/brainstorm`)
  revalidatePath(`${V}/items`)
  revalidatePath(V)
}

export async function deleteItem(itemId: string) {
  const admin = await requireAdmin()
  await prisma.productItem.delete({ where: { id: itemId } })
  captureServerEvent(admin.email ?? 'admin', 'vision_item_deleted', { itemId })
  revalidatePath(`${V}/items`)
  revalidatePath(`${V}/brainstorm`)
}

// ── Feedback ─────────────────────────────────────────────────────────────────

/** Records what someone said, verbatim. Append-only from here on. */
export async function createFeedback(formData: FormData) {
  const admin = await requireAdmin()
  const rawText = String(formData.get('rawText') ?? '').trim()
  if (!rawText) return
  const receivedRaw = String(formData.get('receivedAt') ?? '').trim()

  const fb = await prisma.productFeedback.create({
    data: {
      rawText,
      source: (String(formData.get('source') ?? 'TESTER') || 'TESTER') as ProductFeedbackSource,
      personId: String(formData.get('personId') ?? '').trim() || null,
      candidateId: String(formData.get('candidateId') ?? '').trim() || null,
      personLabel: String(formData.get('personLabel') ?? '').trim() || null,
      channel: String(formData.get('channel') ?? '').trim() || null,
      // When they SAID it, which is not when you got round to logging it.
      receivedAt: receivedRaw ? new Date(receivedRaw) : new Date(),
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_feedback_logged', {
    feedbackId: fb.id, source: fb.source, hasCandidate: Boolean(fb.candidateId),
  })
  revalidatePath(`${V}/feedback`)
  revalidatePath(V)
}

/**
 * Attaches (or detaches) the candidate who said it.
 *
 * Kept separate from the CRM person link because most people using the
 * product have no CrmPerson row — and their feedback is the feedback that
 * matters most. Attributing it to a real account also means the item it
 * feeds can be read next to what that candidate was actually doing.
 */
export async function setFeedbackCandidate(feedbackId: string, candidateId: string) {
  const admin = await requireAdmin()
  await prisma.productFeedback.update({
    where: { id: feedbackId },
    data: { candidateId: candidateId.trim() || null },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_feedback_candidate_set', {
    feedbackId, candidateId: candidateId.trim() || null,
  })
  revalidatePath(`${V}/feedback`)
}

/** Links feedback to an item — the consolidation step. */
export async function linkFeedback(feedbackId: string, formData: FormData) {
  const admin = await requireAdmin()
  const itemId = String(formData.get('itemId') ?? '').trim()
  const newTitle = String(formData.get('newItemTitle') ?? '').trim()

  let targetId = itemId
  if (!targetId && newTitle) {
    const created = await prisma.productItem.create({
      data: { kind: 'GAP', title: newTitle, status: 'NEW' },
    })
    targetId = created.id
  }
  if (!targetId) return

  await prisma.productFeedbackLink.upsert({
    where: { feedbackId_itemId: { feedbackId, itemId: targetId } },
    create: { feedbackId, itemId: targetId },
    update: {},
  })
  await prisma.productFeedback.update({ where: { id: feedbackId }, data: { status: 'TRIAGED' } })
  captureServerEvent(admin.email ?? 'admin', 'vision_feedback_linked', { feedbackId, itemId: targetId, createdItem: !itemId })
  revalidatePath(`${V}/feedback`)
  revalidatePath(`${V}/items/${targetId}`)
}

/** Records that the person who raised it has been told what happened. */
export async function markFeedbackAddressed(feedbackId: string, formData: FormData) {
  const admin = await requireAdmin()
  await prisma.productFeedback.update({
    where: { id: feedbackId },
    data: {
      status: 'ADDRESSED', respondedAt: new Date(),
      responseNote: String(formData.get('responseNote') ?? '').trim() || null,
    },
  })
  // In-app ideas and feedback: tell the candidate what happened, when there's a note.
  const notified = await notifyCandidateFeedbackAddressed(feedbackId)
  captureServerEvent(admin.email ?? 'admin', 'vision_feedback_addressed', { feedbackId, candidateNotified: notified })
  revalidatePath(`${V}/feedback`)
}

export async function archiveFeedback(feedbackId: string) {
  await requireAdmin()
  await prisma.productFeedback.update({ where: { id: feedbackId }, data: { status: 'ARCHIVED' } })
  revalidatePath(`${V}/feedback`)
}

// ── Competitors ──────────────────────────────────────────────────────────────

export async function upsertCompetitor(formData: FormData) {
  const admin = await requireAdmin()
  const name = String(formData.get('name') ?? '').trim()
  if (!name) return
  const id = String(formData.get('id') ?? '').trim()
  const text = (k: string, max = 400) => String(formData.get(k) ?? '').trim().slice(0, max) || null
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').replace(/[^\d]/g, '')
    return v ? parseInt(v, 10) : null
  }
  const funding = parseUsd(String(formData.get('fundingRaisedUsd') ?? ''))
  const data = {
    name,
    url: homepageOf(String(formData.get('url') ?? '')) ?? (String(formData.get('url') ?? '').trim() || null),
    positioning: text('positioning', 800),
    segment: text('segment', 120),
    relationship: cleanRelationship(formData.get('relationship')),
    areas: cleanAreas(formData.getAll('areas').map(String)),
    keyFeatures: parseLines(formData.get('keyFeatures'), 15),
    customers: parseCustomers(formData.get('customers')) as unknown as object,
    wins: parseWins(formData.get('wins')) as unknown as object,
    weWin: parseLines(formData.get('weWin'), 8),
    theyWin: parseLines(formData.get('theyWin'), 8),
    weNeed: parseLines(formData.get('weNeed'), 8),
    pricingNote: text('pricingNote', 200),
    foundedYear: num('foundedYear'),
    hq: text('hq', 80),
    lastRound: text('lastRound', 120),
    investors: text('investors', 200),
    notes: text('notes', 1200),
    status: cleanStatus(formData.get('status')),
    statusNote: text('statusNote', 400),
    lessons: parseLines(formData.get('lessons'), 8),
    partnerIdea: text('partnerIdea', 300),
    category: text('category', 40),
    revenueNote: text('revenueNote', 160),
    fundingRaisedUsd: funding && funding <= 2_147_483_647 ? funding : null,
    headcount: num('headcount'),
    userCountNote: text('userCountNote', 160),
    sourceUrl: text('sourceUrl', 300),
    // A person saving the card is the review; every save re-dates it, since these go stale silently.
    filledBy: 'hand',
    needsReview: false,
    lastReviewedAt: new Date(),
  }
  if (id) await prisma.productCompetitor.update({ where: { id }, data })
  else await prisma.productCompetitor.create({ data })
  captureServerEvent(admin.email ?? 'admin', 'vision_competitor_saved', { name, isNew: !id, areas: data.areas.length, relationship: data.relationship })
  revalidatePath(`${V}/competitors`)
}

/** Most website reads in a day; each costs a few cents of model use, so a runaway paste cannot run up a bill. */
const QUICK_ADD_DAILY_CAP = 40

function cardData(e: EnrichedCompetitor) {
  return {
    name: e.name, segment: e.segment, positioning: e.positioning, relationship: e.relationship, areas: e.areas, keyFeatures: e.keyFeatures,
    customers: e.customers as unknown as object, wins: e.wins as unknown as object, weWin: e.weWin, theyWin: e.theyWin, weNeed: e.weNeed,
    pricingNote: e.pricingNote, foundedYear: e.foundedYear, hq: e.hq, lastRound: e.lastRound, investors: e.investors,
    fundingRaisedUsd: e.fundingRaisedUsd && e.fundingRaisedUsd <= 2_147_483_647 ? e.fundingRaisedUsd : null,
    headcount: e.headcount, revenueNote: e.revenueNote, userCountNote: e.userCountNote, sourceUrl: e.sourceUrl, notes: e.notes,
    status: e.status, statusNote: e.statusNote, lessons: e.lessons, partnerIdea: e.partnerIdea,
  }
}

/**
 * Paste a website, get a draft card: we read the site and a little public reporting and fill what they do, who
 * they sell to, features, customers, wins, and the numbers when they are public. The row is marked "check this"
 * until someone saves it by hand.
 */
export async function quickAddCompetitor(formData: FormData) {
  const admin = await requireAdmin()
  const url = homepageOf(String(formData.get('url') ?? ''))
  const back = (q: string) => redirect(`${V}/competitors?${q}`)
  if (!url) return back(`error=${encodeURIComponent('That does not look like a website. Paste something like example.com.')}`)
  const host = hostOf(url)!
  const all = await prisma.productCompetitor.findMany({ select: { id: true, url: true, name: true, updatedAt: true, filledBy: true } })
  const existing = all.find((c) => c.url && hostOf(c.url) === host)
  if (existing) return back(`added=${existing.id}&existing=1`)
  const today = all.filter((c) => c.filledBy === 'website' && Date.now() - c.updatedAt.getTime() < 86_400_000).length
  if (today >= QUICK_ADD_DAILY_CAP) return back(`error=${encodeURIComponent(`Daily limit of ${QUICK_ADD_DAILY_CAP} website reads reached. Add this one by hand, or try tomorrow.`)}`)

  let created: { id: string } | null = null
  let failure: string | null = null
  try {
    const { data, cost, searches } = await enrichCompetitor(url)
    const taken = all.some((c) => c.name.toLowerCase() === data.name.toLowerCase())
    created = await prisma.productCompetitor.create({
      data: { ...cardData(data), name: taken ? `${data.name} (${host})` : data.name, url, filledBy: 'website', needsReview: true, lastReviewedAt: new Date() },
      select: { id: true },
    })
    captureServerEvent(admin.email ?? 'admin', 'vision_competitor_quick_added', { host, ok: true, areas: data.areas.length, costUsd: Math.round(cost * 1000) / 1000, searches })
  } catch (e) {
    failure = e instanceof Error ? e.message : 'unknown error'
    captureServerEvent(admin.email ?? 'admin', 'vision_competitor_quick_added', { host, ok: false, error: failure.slice(0, 120) })
  }
  revalidatePath(`${V}/competitors`)
  if (created) return back(`added=${created.id}`)
  return back(`error=${encodeURIComponent(`Could not read ${host}: ${failure}. Try again, or add it by hand below.`)}`)
}

/** Reads the site again. Fills blanks, adds new customers and wins, refreshes the public numbers; never deletes what is there. */
export async function refreshCompetitorFromWebsite(competitorId: string) {
  const admin = await requireAdmin()
  const c = await prisma.productCompetitor.findUnique({ where: { id: competitorId } })
  if (!c?.url) return redirect(`${V}/competitors?error=${encodeURIComponent('This competitor has no website saved to read.')}`)
  let failure: string | null = null
  try {
    const { data: e, cost } = await enrichCompetitor(c.url)
    await prisma.productCompetitor.update({ where: { id: c.id }, data: mergeRefresh(c, e) })
    captureServerEvent(admin.email ?? 'admin', 'vision_competitor_refreshed', { name: c.name, costUsd: Math.round(cost * 1000) / 1000 })
  } catch (err) { failure = err instanceof Error ? err.message : 'unknown error' }
  revalidatePath(`${V}/competitors`)
  return redirect(`${V}/competitors?${failure ? `error=${encodeURIComponent(`Could not refresh ${c.name}: ${failure}`)}` : `added=${c.id}&refreshed=1`}`)
}

export async function deleteCompetitor(competitorId: string) {
  await requireAdmin()
  await prisma.productCompetitor.delete({ where: { id: competitorId } })
  revalidatePath(`${V}/competitors`)
}

/** Sets one cell of the matrix. */
export async function setCompetitorCell(competitorId: string, itemId: string, overlap: ProductCompetitorOverlap) {
  const admin = await requireAdmin()
  await prisma.productCompetitorFeature.upsert({
    where: { competitorId_itemId: { competitorId, itemId } },
    create: { competitorId, itemId, overlap, lastReviewedAt: new Date() },
    update: { overlap, lastReviewedAt: new Date() },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_matrix_cell_set', { competitorId, itemId, overlap })
  revalidatePath(`${V}/competitors`)
}

// ── Investor portfolio holdings ──────────────────────────────────────────────

/**
 * Records what a fund has backed, pasted one company per line.
 *
 * Not fetched: there is no free reliable portfolio API, a fund's own site is
 * the least likely place to list an investment going badly, and a paid data
 * subscription should be a deliberate purchase. The CHECK against competitors
 * is automatic, because that part is a join over data we own.
 */
export async function addPortfolioHoldings(investorOrgId: string, formData: FormData) {
  const admin = await requireAdmin()
  const raw = String(formData.get('companies') ?? '')
  const sourceUrl = String(formData.get('sourceUrl') ?? '').trim() || null
  const names = raw.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 500)
  if (names.length === 0) return

  const competitors = await prisma.productCompetitor.findMany({ select: { name: true } })
  const competitorKeys = new Set(competitors.map((c) => normalizeOrgName(c.name)))

  let added = 0
  let direct = 0
  for (const companyName of names) {
    const normalizedName = normalizeOrgName(companyName)
    if (!normalizedName) continue
    const overlap: CrmPortfolioOverlap = competitorKeys.has(normalizedName) ? 'DIRECT' : 'UNRELATED'
    if (overlap === 'DIRECT') direct++
    await prisma.crmPortfolioHolding.upsert({
      where: { investorOrgId_normalizedName: { investorOrgId, normalizedName } },
      create: { investorOrgId, companyName, normalizedName, overlap, sourceUrl },
      update: { companyName, overlap, sourceUrl },
    })
    added++
  }
  captureServerEvent(admin.email ?? 'admin', 'crm_portfolio_recorded', { investorOrgId, added, direct })
  revalidatePath(`/support/admin/crm/organizations/${investorOrgId}`)
}

export async function setHoldingOverlap(holdingId: string, overlap: CrmPortfolioOverlap) {
  await requireAdmin()
  const h = await prisma.crmPortfolioHolding.update({
    where: { id: holdingId }, data: { overlap }, select: { investorOrgId: true },
  })
  revalidatePath(`/support/admin/crm/organizations/${h.investorOrgId}`)
}

// ── Competitor watch ─────────────────────────────────────────────────────────

/** Master switch, per-job switches and the hard monthly cap for the competitor watch. */
export async function saveWatchSettings(formData: FormData) {
  const admin = await requireAdmin()
  const cap = Number(formData.get('monthlyCapUsd'))
  await prisma.competitorWatchSetting.upsert({
    where: { id: 'singleton' },
    create: { id: 'singleton' },
    update: {
      enabled: formData.get('enabled') === 'on',
      refreshEnabled: formData.get('refreshEnabled') === 'on',
      newsEnabled: formData.get('newsEnabled') === 'on',
      monthlyCapUsd: Number.isFinite(cap) && cap >= 0 && cap <= 500 ? cap : 50,
      updatedByEmail: admin.email ?? null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_competitor_watch_settings_saved', { enabled: formData.get('enabled') === 'on', cap })
  revalidatePath(`${V}/competitors`)
}

/** Accepting a proposal is what writes the matrix cell: with its evidence link, today's date and the person who confirmed it. */
export async function decideCellProposal(proposalId: string, accept: boolean) {
  const admin = await requireAdmin()
  const p = await prisma.competitorCellProposal.findUnique({ where: { id: proposalId } })
  if (!p || p.state !== 'PENDING') return
  const who = admin.email ?? 'admin'
  if (accept) {
    await prisma.competitorCapability.upsert({
      where: { competitorId_capabilityId: { competitorId: p.competitorId, capabilityId: p.capabilityId } },
      create: { competitorId: p.competitorId, capabilityId: p.capabilityId, status: p.status, note: p.note, evidenceUrl: p.evidenceUrl, checkedAt: new Date(), checkedBy: who },
      update: { status: p.status, note: p.note, evidenceUrl: p.evidenceUrl, checkedAt: new Date(), checkedBy: who },
    })
  }
  // Delete any earlier decision for the same cell so the (competitor, capability, state) key stays free.
  await prisma.competitorCellProposal.deleteMany({ where: { competitorId: p.competitorId, capabilityId: p.capabilityId, state: accept ? 'ACCEPTED' : 'REJECTED' } })
  await prisma.competitorCellProposal.update({ where: { id: p.id }, data: { state: accept ? 'ACCEPTED' : 'REJECTED', decidedBy: who, decidedAt: new Date() } })
  captureServerEvent(who, 'vision_cell_proposal_decided', { accept, status: p.status })
  revalidatePath(`${V}/competitors`)
}
