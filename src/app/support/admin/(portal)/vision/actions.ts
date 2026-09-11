'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import type {
  ProductItemKind, ProductItemStatus, ProductRoadmapBucket, ProductEffort,
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

  const item = await prisma.productItem.create({
    data: {
      kind, title,
      body: String(formData.get('body') ?? '').trim() || null,
      status: (statusRaw || 'SPARK') as ProductItemStatus,
      visionSection: String(formData.get('visionSection') ?? '').trim() || null,
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_item_created', { itemId: item.id, kind, status: item.status })
  revalidatePath(`${V}/items`)
  revalidatePath(`${V}/brainstorm`)
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
      personLabel: String(formData.get('personLabel') ?? '').trim() || null,
      channel: String(formData.get('channel') ?? '').trim() || null,
      // When they SAID it, which is not when you got round to logging it.
      receivedAt: receivedRaw ? new Date(receivedRaw) : new Date(),
    },
  })
  captureServerEvent(admin.email ?? 'admin', 'vision_feedback_logged', { feedbackId: fb.id, source: fb.source })
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
  captureServerEvent(admin.email ?? 'admin', 'vision_feedback_addressed', { feedbackId })
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
  const num = (k: string) => {
    const v = String(formData.get(k) ?? '').replace(/[^\d]/g, '')
    return v ? parseInt(v, 10) : null
  }
  const data = {
    name,
    url: String(formData.get('url') ?? '').trim() || null,
    positioning: String(formData.get('positioning') ?? '').trim() || null,
    segment: String(formData.get('segment') ?? '').trim() || null,
    revenueNote: String(formData.get('revenueNote') ?? '').trim() || null,
    fundingRaisedUsd: num('fundingRaisedUsd'),
    headcount: num('headcount'),
    userCountNote: String(formData.get('userCountNote') ?? '').trim() || null,
    sourceUrl: String(formData.get('sourceUrl') ?? '').trim() || null,
    // Every firmographic edit re-dates the row: these go stale silently, and
    // an undated number in a deck is worse than no number.
    lastReviewedAt: new Date(),
  }
  if (id) await prisma.productCompetitor.update({ where: { id }, data })
  else await prisma.productCompetitor.create({ data })
  captureServerEvent(admin.email ?? 'admin', 'vision_competitor_saved', { name, isNew: !id })
  revalidatePath(`${V}/competitors`)
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
