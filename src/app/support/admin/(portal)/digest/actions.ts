'use server'

import { revalidatePath } from 'next/cache'
import type { DigestAudience } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'
import { ingestResearchUrl } from '@/lib/research/ingest'
import { sendProductPositioningFlagEmail } from '@/lib/email/send-product-positioning-flag'
import { fetchNewsMetadata, isReadyToPublish } from '@/lib/news/metadata'
import { safeImageUrl } from '@/lib/news/kind'

export async function markResearchItemStatus(id: string, status: 'reviewed' | 'actioned' | 'dismissed') {
  const admin = await requireAdmin()
  await prisma.researchLibraryItem.update({ where: { id }, data: { status } })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_status_updated', { itemId: id, status })
  revalidatePath('/support/admin/digest')
}

// Replaces the whole set at once — the admin UI submits every checked
// audience together, not one toggle per audience, since "which audiences"
// is a single decision made per article, not N independent ones.
export async function setDigestAudiences(id: string, audiences: DigestAudience[]) {
  const admin = await requireAdmin()
  await prisma.researchLibraryItem.update({ where: { id }, data: { digestAudiences: audiences } })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_digest_audiences_updated', { itemId: id, audiences })
  revalidatePath('/support/admin/digest')
}

export async function removeFromDigestQueue(id: string) {
  const admin = await requireAdmin()
  await prisma.researchLibraryItem.update({ where: { id }, data: { digestAudiences: [] } })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_digest_audiences_updated', { itemId: id, audiences: [] })
  revalidatePath('/support/admin/digest')
}

export async function flagProductPositioning(id: string) {
  const admin = await requireAdmin()
  const item = await prisma.researchLibraryItem.findUniqueOrThrow({ where: { id } })
  await sendProductPositioningFlagEmail({
    title: item.title,
    url: item.url,
    summary: item.summary,
    suggestedAction: item.suggestedAction,
  })
  captureServerEvent(admin?.email ?? 'admin', 'research_item_positioning_flagged', { itemId: id })
  revalidatePath('/support/admin/digest')
}

export async function disconnectGoogleInbox() {
  const admin = await requireAdmin()
  await prisma.googleInboxConnection.deleteMany({})
  captureServerEvent(admin?.email ?? 'admin', 'google_inbox_disconnected')
  revalidatePath('/support/admin/digest')
}

export async function addResearchItem(
  _prevState: { error?: string; success?: boolean } | undefined,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const admin = await requireAdmin()
  const url = String(formData.get('url') ?? '').trim()

  if (!url || !/^https?:\/\//i.test(url)) {
    return { error: 'Enter a valid URL starting with http:// or https://.' }
  }

  const item = await ingestResearchUrl(url, 'manual')

  captureServerEvent(admin?.email ?? 'admin', 'research_item_ingested', {
    itemId: item.id,
    source: 'manual',
    bucket: item.bucket,
    needsReview: item.needsReview,
  })

  revalidatePath('/support/admin/digest')
  return { success: true }
}

// ── Homepage News ────────────────────────────────────────────────────────────

// The public pages are cached; anything that changes what they show clears
// all three places it appears.
function revalidateNews() {
  revalidatePath('/support/admin/digest')
  revalidatePath('/')
  revalidatePath('/news')
}

export interface NewsFormState {
  error?: string
  message?: string
}

/**
 * Adds a link to News and, when it has what a card needs, publishes it.
 *
 * Deliberately not the Market Pulse ingest: no model call, no summary, and
 * no digest audience — an Instagram post pasted here should not land in
 * next Tuesday's candidate email. A link already in Market Pulse is reused
 * rather than duplicated.
 */
export async function addNewsItem(_prev: NewsFormState | undefined, formData: FormData): Promise<NewsFormState> {
  const admin = await requireAdmin()
  const url = String(formData.get('url') ?? '').trim()
  if (!/^https?:\/\//i.test(url)) {
    return { error: 'Enter a full link starting with https://.' }
  }

  const existing = await prisma.researchLibraryItem.findFirst({ where: { url }, select: { id: true, newsKind: true } })
  if (existing?.newsKind) return { error: 'That link is already in News — edit it in the list below.' }

  const meta = await fetchNewsMetadata(url)
  const news = {
    newsKind: meta.kind, newsTitle: meta.title, newsBlurb: meta.blurb,
    newsImageUrl: meta.imageUrl, newsSource: meta.source,
  }
  const publish = isReadyToPublish({ ...news, url })
  const data = { ...news, newsPublishedAt: publish ? new Date() : null }

  const item = existing
    ? await prisma.researchLibraryItem.update({ where: { id: existing.id }, data })
    : await prisma.researchLibraryItem.create({
        data: { url, ingestionSource: 'manual', title: meta.title, status: 'reviewed', digestAudiences: [], ...data },
      })

  captureServerEvent(admin?.email ?? 'admin', 'news_item_added', { itemId: item.id, kind: meta.kind, published: publish })
  revalidateNews()
  return {
    message: publish
      ? 'Added and live on the homepage.'
      : 'Added as a draft — the page would not share a headline. Add one below, then publish.',
  }
}

/** The same, for a row already sitting in the Market Pulse table. */
export async function addExistingItemToNews(id: string) {
  const admin = await requireAdmin()
  const item = await prisma.researchLibraryItem.findUniqueOrThrow({ where: { id }, select: { url: true, newsKind: true } })
  if (item.newsKind) return
  const meta = await fetchNewsMetadata(item.url)
  const news = {
    newsKind: meta.kind, newsTitle: meta.title, newsBlurb: meta.blurb,
    newsImageUrl: meta.imageUrl, newsSource: meta.source,
  }
  // A draft, not live: this row came from an alert, and nobody has looked at
  // how it will read in public yet.
  await prisma.researchLibraryItem.update({ where: { id }, data: news })
  captureServerEvent(admin?.email ?? 'admin', 'news_item_added', { itemId: id, kind: meta.kind, published: false })
  revalidateNews()
}

export async function updateNewsItem(_prev: NewsFormState | undefined, formData: FormData): Promise<NewsFormState> {
  const admin = await requireAdmin()
  const id = String(formData.get('id') ?? '')
  const text = (name: string) => String(formData.get(name) ?? '').replace(/\s+/g, ' ').trim() || null
  const rawImage = text('imageUrl')
  const imageUrl = safeImageUrl(rawImage)
  if (rawImage && !imageUrl) return { error: 'The picture link has to start with https://.' }

  const current = await prisma.researchLibraryItem.findUnique({ where: { id }, select: { url: true, newsKind: true, newsPublishedAt: true } })
  if (!current?.newsKind) return { error: 'That item is no longer in News.' }
  const title = text('title')
  if (current.newsPublishedAt && !isReadyToPublish({ newsKind: current.newsKind, newsTitle: title, url: current.url })) {
    return { error: 'A live item needs a headline. Add one, or unpublish it first.' }
  }

  await prisma.researchLibraryItem.update({
    where: { id },
    data: { newsTitle: title, newsBlurb: text('blurb'), newsImageUrl: imageUrl, newsSource: text('source') },
  })
  captureServerEvent(admin?.email ?? 'admin', 'news_item_updated', { itemId: id })
  revalidateNews()
  return { message: 'Saved.' }
}

export async function setNewsPublished(id: string, publish: boolean) {
  const admin = await requireAdmin()
  const item = await prisma.researchLibraryItem.findUniqueOrThrow({
    where: { id }, select: { url: true, newsKind: true, newsTitle: true },
  })
  // The button is not offered for an item that isn't ready; this is the
  // same rule held on the server.
  if (publish && !isReadyToPublish(item)) return
  await prisma.researchLibraryItem.update({ where: { id }, data: { newsPublishedAt: publish ? new Date() : null } })
  captureServerEvent(admin?.email ?? 'admin', publish ? 'news_item_published' : 'news_item_unpublished', { itemId: id, kind: item.newsKind })
  revalidateNews()
}
