import 'server-only'
import { prisma } from '@/lib/prisma'
import { getMessageContent, listMessagesForSearch } from '@/lib/google/gmail'
import { fetchArticle } from './fetch-article'
import { routeNewsItem } from './route-news'
import { unwrapFeedLink } from '@/lib/news/discover'
import { sourceFromUrl, stripSourceSuffix } from '@/lib/news/kind'
import { cleanNewsTags } from '@/lib/news/tags'
import { revalidatePath } from 'next/cache'
import { canAutoPublish, extractNewsLinks, noteBeforeFirstLink, type NewsTone } from './news-inbox-text'

export const NEWS_ADDRESS = 'news@launchyournextchapter.com'
// Gmail ignores dots, so the same mailbox shows up as justin.kulla@ or justinkulla@ depending on how it was typed.
const DEFAULT_SENDERS = ['justin.kulla@gmail.com', 'justinkulla@gmail.com', 'justin@launchyournextchapter.com', 'jkulla@launchyournextchapter.com']

/** Each run reads at most this many emails and this many articles per email: the ceiling on what the AI step can cost. */
const MAX_EMAILS = 10
const MAX_LINKS_PER_EMAIL = 5
/** An email with no link but this much text is the article itself, pasted in. */
const PASTED_ARTICLE_MIN_CHARS = 400
/** The sweep shares a cron bundle with other jobs: stop starting new emails after this long; unrecorded ones are retried next run. */
const TIME_BUDGET_MS = 75_000

export interface NewsInboxResult {
  emails: number
  articles: number
  forReport: number
  forWebsite: number
  forWeekly: number
  published: number
  political: number
  notRelevant: number
  failed: number
}

/** Who may send to news@: anyone else is spam, not a news tip. */
export function newsInboxSenders(): string[] {
  const configured = process.env.NEWS_INBOX_SENDERS?.split(/[\s,]+/).map((s) => s.trim().toLowerCase()).filter(Boolean)
  return configured?.length ? configured : DEFAULT_SENDERS
}

/**
 * Reads what Justin sent to news@launchyournextchapter.com (an alias on the
 * connected justin@ mailbox) and files each article in Market Pulse with the
 * AI's judgement on where it belongs:
 * - monthly report: marked in suggestedAction, bucket MARKET_BRIEF;
 * - website News: filled in but NOT live (newsPublishedAt stays empty), so it
 *   waits in the News admin until Justin publishes it;
 * - weekly news email: queued for the audiences it is for (digestAudiences).
 * An article that belongs nowhere is still filed, flagged needsReview with the
 * reason, so a mistaken "not relevant" can be overruled. Each email is handled
 * once (NewsletterMessage); a failure leaves it unrecorded so the next run retries.
 */
export async function sweepNewsInbox(accessToken: string): Promise<NewsInboxResult> {
  const result: NewsInboxResult = { emails: 0, articles: 0, forReport: 0, forWebsite: 0, forWeekly: 0, published: 0, political: 0, notRelevant: 0, failed: 0 }
  if (!process.env.ANTHROPIC_API_KEY) return result

  const senders = newsInboxSenders().join(' OR ')
  const listed = await listMessagesForSearch(accessToken, `to:${NEWS_ADDRESS} from:(${senders}) newer_than:7d`, MAX_EMAILS)
  const ids = listed.map((m) => `news-inbox:${m.id}`)
  const done = new Set(
    (await prisma.newsletterMessage.findMany({ where: { messageId: { in: ids } }, select: { messageId: true } })).map((m) => m.messageId)
  )

  const startedAt = Date.now()
  for (const message of listed) {
    if (Date.now() - startedAt > TIME_BUDGET_MS) break
    const key = `news-inbox:${message.id}`
    if (done.has(key)) continue
    try {
      const { body } = await getMessageContent(accessToken, message.id, 30_000)
      const text = body ?? ''
      const links = extractNewsLinks(text, unwrapFeedLink).slice(0, MAX_LINKS_PER_EMAIL)
      const note = noteBeforeFirstLink(text)
      const sources = links.length
        ? links.map((url) => ({ url, pasted: null as string | null }))
        : text.trim().length >= PASTED_ARTICLE_MIN_CHARS
          ? [{ url: `gmail-message:${message.id}`, pasted: text }]
          : []

      let events = 0
      for (const source of sources) {
        if (await prisma.researchLibraryItem.findFirst({ where: { url: source.url }, select: { id: true } })) continue
        await fileOne(source.url, source.pasted, links.length > 1 ? null : note, result)
        events++
      }
      await prisma.newsletterMessage.createMany({ data: [{ messageId: key, events }], skipDuplicates: true })
      result.emails++
    } catch (err) {
      result.failed++
      console.error('Failed to process news@ email:', message.id, err)
    }
  }
  if (result.published > 0) {
    // Same pages the News admin clears when Justin publishes by hand.
    for (const [path, type] of [['/', undefined], ['/news', undefined], ['/news/[slug]', 'page']] as const) {
      try { revalidatePath(path, type) } catch { /* outside a request the timer (5 min) covers it */ }
    }
  }
  return result
}

async function fileOne(url: string, pasted: string | null, note: string | null, result: NewsInboxResult): Promise<void> {
  const fetched = pasted ? { status: 'success' as const, title: null, text: pasted, image: null } : await fetchArticle(url)
  const base = { url, ingestionSource: 'inbox', discoveryTopic: 'Sent to news@', status: 'new', digestAudiences: [] as never[] }

  if (fetched.status !== 'success' || !fetched.text) {
    // Never drop what Justin sent: file it for a person to read.
    await prisma.researchLibraryItem.create({
      data: { ...base, title: fetched.title, fetchFailed: true, needsReview: true, suggestedAction: 'Sent to news@, but the page could not be read (paywall or blocked). Read it and decide.' },
    })
    result.articles++
    return
  }

  try {
    const routed = await routeNewsItem({ url, title: fetched.title, text: fetched.text, note })
    // Politics stays out of News and the weekly email whatever the model chose.
    const route = routed.political ? { ...routed, website: false, weekly: false, audiences: [] } : routed
    const source = pasted ? null : sourceFromUrl(url)
    const where = [route.report && 'monthly report', route.website && 'website News', route.weekly && 'weekly email'].filter(Boolean)
    const audiences = route.weekly ? route.audiences : []
    const recent = await prisma.researchLibraryItem.findMany({
      where: { discoveryTopic: { startsWith: 'Sent to news@ · ' }, newsPublishedAt: { not: null } },
      orderBy: { newsPublishedAt: 'desc' },
      take: 5,
      select: { discoveryTopic: true },
    })
    const recentTones = recent.map((r) => r.discoveryTopic!.slice('Sent to news@ · '.length) as NewsTone)
    const live = canAutoPublish(
      { website: route.website, political: route.political, tone: route.tone, credibilityTier: route.credibilityTier, confidenceScore: route.confidenceScore, hasTitle: !!route.newsTitle.trim() },
      recentTones,
    )
    await prisma.researchLibraryItem.create({
      data: {
        ...base,
        title: fetched.title,
        fetchedContent: fetched.text,
        summary: route.summary,
        bucket: route.bucket,
        confidenceScore: route.confidenceScore,
        credibilityTier: route.credibilityTier,
        discoveryTopic: `Sent to news@ · ${route.tone}`,
        status: live ? 'reviewed' : 'new',
        needsReview: !route.relevant || route.confidenceScore < 0.6,
        suggestedAction: route.political
          ? `Sent to news@. Kept out because it is political${route.report ? ', except for the monthly report' : ''}. ${route.reason}`
          : route.relevant
            ? `Sent to news@. ${live ? 'Published to News automatically. ' : ''}Goes to: ${where.join(', ')}${audiences.length ? ` (${audiences.join(', ').toLowerCase()})` : ''}. ${route.reason}`
            : `Sent to news@. Not used: ${route.reason}`,
        digestAudiences: audiences,
        ...(route.website
          ? {
              newsKind: 'article',
              newsTitle: stripSourceSuffix(route.newsTitle, source) ?? route.newsTitle,
              newsBlurb: route.newsBlurb,
              newsSource: source,
              newsImageUrl: fetched.image ?? null,
              newsTags: cleanNewsTags(route.newsTags),
              newsPublishedAt: live ? new Date() : null,
            }
          : {}),
      },
    })
    result.articles++
    if (live) result.published++
    if (route.political) result.political++
    if (route.report) result.forReport++
    if (route.website) result.forWebsite++
    if (route.weekly) result.forWeekly++
    if (!route.relevant) result.notRelevant++
  } catch (err) {
    // A routing failure still files the article, unrouted, for a person.
    console.error('News routing failed:', url, err)
    await prisma.researchLibraryItem.create({
      data: { ...base, title: fetched.title, fetchedContent: fetched.text, needsReview: true, suggestedAction: 'Sent to news@, but the automatic routing failed. Read it and decide.' },
    })
    result.articles++
    result.failed++
  }
}
