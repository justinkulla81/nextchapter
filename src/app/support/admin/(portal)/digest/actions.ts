'use server'

import { revalidatePath } from 'next/cache'
import type { DigestAudience } from '@prisma/client'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { prisma } from '@/lib/prisma'
import { fetchArticle } from '@/lib/research/fetch-article'
import { classifyResearchItem } from '@/lib/research/classify'
import { sendProductPositioningFlagEmail } from '@/lib/email/send-product-positioning-flag'
import { fetchNewsMetadata, isReadyToPublish } from '@/lib/news/metadata'
import { embedsItself, safeImageUrl } from '@/lib/news/kind'
import { cleanNewsTags } from '@/lib/news/tags'
import { runNewsDiscovery } from '@/lib/news/discover'

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
  /** Set when something just went live: what to offer for the LinkedIn page. */
  share?: { itemId: string; url: string; caption: string }
}

const AUDIENCE_LABEL: Record<DigestAudience, string> = {
  CANDIDATE: 'candidates', COACH: 'coaches', RECRUITER: 'recruiters', EMPLOYER: 'employers',
}
const AUDIENCES = Object.keys(AUDIENCE_LABEL) as DigestAudience[]

/**
 * The one way a link is added by hand: into Market Pulse, and from there to
 * the homepage, the Tuesday email digest, both, or neither.
 *
 * Each destination is a choice on the form, not a default. A link sent to
 * the homepage is published at once when the page shares a headline (or the
 * post embeds itself), and saved as a draft when it doesn't. A link queued
 * for the digest gets the one-or-two-sentence summary the email prints
 * beside it — the only step here that calls the model, and only for
 * articles. A link already in Market Pulse is updated, never duplicated.
 */
export async function addLink(_prev: NewsFormState | undefined, formData: FormData): Promise<NewsFormState> {
  const admin = await requireAdmin()
  const url = String(formData.get('url') ?? '').trim()
  if (!/^https?:\/\//i.test(url)) {
    return { error: 'Enter a full link starting with https://.' }
  }
  const toHomepage = formData.get('homepage') === 'on'
  const audiences = AUDIENCES.filter((a) => formData.getAll('audiences').includes(a))
  const newsTags = cleanNewsTags(formData.getAll('tags'))

  const existing = await prisma.researchLibraryItem.findFirst({
    where: { url }, select: { id: true, newsKind: true, title: true, summary: true, digestAudiences: true },
  })
  if (existing?.newsKind && toHomepage && audiences.length === 0) {
    return { error: 'That link is already in News — edit it in the Homepage News list below.' }
  }

  const meta = await fetchNewsMetadata(url)
  const addToNews = toHomepage && !existing?.newsKind
  const publish = addToNews && isReadyToPublish({ newsKind: meta.kind, newsTitle: meta.title, url })
  const news = addToNews
    ? {
        newsKind: meta.kind, newsTitle: meta.title, newsBlurb: meta.blurb, newsImageUrl: meta.imageUrl,
        newsSource: meta.source, newsTags, newsPublishedAt: publish ? new Date() : null,
      }
    : {}

  // What the digest email prints after the headline. Written by the model
  // from the article text when it can be read; the publisher's own
  // description when it can't.
  let summary = existing?.summary ?? null
  let classification: Awaited<ReturnType<typeof classifyResearchItem>> | null = null
  if (audiences.length > 0 && !summary && meta.kind === 'article') {
    const fetched = await fetchArticle(url)
    if (fetched.status === 'success' && fetched.text) {
      classification = await classifyResearchItem(url, fetched.title ?? meta.title, fetched.text).catch(() => null)
    }
    summary = classification?.summary ?? meta.blurb
  }
  const research = classification
    ? {
        bucket: classification.bucket, confidenceScore: classification.confidenceScore,
        credibilityTier: classification.credibilityTier, suggestedAction: classification.suggestedAction,
        contradictsLockedDecision: classification.contradictsLockedDecision, personaTag: classification.personaTag,
      }
    : {}

  const item = existing
    ? await prisma.researchLibraryItem.update({
        where: { id: existing.id },
        data: {
          ...news, ...research, summary,
          title: existing.title ?? meta.title,
          digestAudiences: [...new Set([...existing.digestAudiences, ...audiences])],
        },
      })
    : await prisma.researchLibraryItem.create({
        data: {
          url, ingestionSource: 'manual', title: meta.title, status: 'reviewed',
          summary: summary ?? meta.blurb, digestAudiences: audiences, ...news, ...research,
        },
      })

  captureServerEvent(admin?.email ?? 'admin', 'market_pulse_link_added', {
    itemId: item.id, kind: meta.kind, toHomepage, published: publish, audiences, tags: newsTags, summarized: !!classification,
  })
  revalidateNews()

  const parts = [existing ? 'Already in Market Pulse — updated.' : 'Added to Market Pulse.']
  if (addToNews) {
    parts.push(publish ? 'Live on the homepage.' : 'Saved as a homepage draft — the page would not share a headline. Add one in the list below, then publish.')
  }
  if (audiences.length > 0) {
    parts.push(
      item.title
        ? `Queued for the Tuesday email to ${audiences.map((a) => AUDIENCE_LABEL[a]).join(', ')}.`
        : 'Queued for the Tuesday email, but it has no headline yet, so it will not be sent until you add one.',
    )
  }
  return {
    message: parts.join(' '),
    ...(publish ? { share: { itemId: item.id, url, caption: [meta.title, url].filter(Boolean).join('\n\n') } } : {}),
  }
}

/** The same, for a row already sitting in the Market Pulse table. */
export async function addExistingItemToNews(id: string) {
  const admin = await requireAdmin()
  const item = await prisma.researchLibraryItem.findUniqueOrThrow({
    where: { id },
    select: { url: true, newsKind: true, title: true, summary: true, ingestionSource: true, newsSource: true },
  })
  if (item.newsKind) return
  const meta = await fetchNewsMetadata(item.url)
  // A link the topic search found already carries the publisher's own
  // headline and snippet, which covers a publisher that blocks the fetch.
  // Only for those rows: on every other row `summary` is our internal note.
  const found = item.ingestionSource === 'discovery'
  const news = {
    newsKind: meta.kind,
    newsTitle: meta.title ?? item.title,
    newsBlurb: meta.blurb ?? (found ? item.summary?.slice(0, 280) ?? null : null),
    newsImageUrl: meta.imageUrl,
    newsSource: (found ? item.newsSource : null) ?? meta.source,
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
  const newsTags = cleanNewsTags(formData.getAll('tags'))
  // A post that draws itself has no headline or picture to edit — only its topics.
  if (current.newsKind === 'instagram' || current.newsKind === 'linkedin') {
    await prisma.researchLibraryItem.update({ where: { id }, data: { newsTags } })
  } else {
    const title = text('title')
    if (current.newsPublishedAt && !embedsItself(current.newsKind, current.url) && !title) {
      return { error: 'A live item needs a headline. Add one, or unpublish it first.' }
    }
    await prisma.researchLibraryItem.update({
      where: { id },
      data: { newsTitle: title, newsBlurb: text('blurb'), newsImageUrl: imageUrl, newsSource: text('source'), newsTags },
    })
  }
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

/** The daily topic search, on demand — same run the cron does. */
export async function runNewsDiscoveryNow(_prev: NewsFormState | undefined): Promise<NewsFormState> {
  const admin = await requireAdmin()
  const result = await runNewsDiscovery()
  captureServerEvent(admin?.email ?? 'admin', 'news_discovery_run', { trigger: 'manual', created: result.created, failed: result.failed.length })
  revalidatePath('/support/admin/digest')
  const failed = result.failed.length > 0 ? ` The search did not answer for: ${result.failed.join(', ')}.` : ''
  return {
    message: (result.created > 0
      ? `Found ${result.created} new ${result.created === 1 ? 'article' : 'articles'} — they are in the table below.`
      : 'Nothing new since the last search.') + failed,
  }
}
