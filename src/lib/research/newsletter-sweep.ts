import 'server-only'
import { prisma } from '@/lib/prisma'
import { getAnthropicClient } from '@/lib/anthropic'
import { getMessageHtml, listNewsletterMessages, markMessageRead } from '@/lib/google/gmail'
import { getOrCreateCompany } from '@/lib/companies/company-lookup'
import { discoverAtsBoards } from '@/lib/market/ats-discovery'
import { sourceFromUrl } from '@/lib/news/kind'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { EVENT_LABELS, extractNewsletterEvents, newsletterText } from './newsletter-events'

export interface NewsletterSweepResult {
  emails: number
  events: number
  layoffMentions: number
  boardsFound: number
  failed: number
}

/** "techcrunch.com" and "TechCrunch" are one publisher, so a story is not counted as two sources. */
function publisherName(url: string): string {
  return sourceFromUrl(url).replace(/^www\./, '').replace(/\.(com|org|net|io|co|news)$/i, '') || 'newsletter'
}

/**
 * Reads the unread newsletters matching NEWSLETTER_SENDER_QUERY (a Gmail
 * search, e.g. "from:(newsletter@example.com)") and files what job seekers
 * could act on:
 * - every event lands in Market Pulse as a lead (source "newsletter"), like a
 *   topic-search result, for a person to decide on;
 * - a layoff with a story link is also a layoff-news mention, so it counts as
 *   a report in the daily layoff check (two publishers add it to the tracker);
 * - each company gets a Company row and a look for its public job board.
 * An email is marked read only once it was processed; a failure leaves it for
 * tomorrow. With no query set the sweep does nothing.
 */
export async function sweepNewsletters(accessToken: string): Promise<NewsletterSweepResult> {
  const result: NewsletterSweepResult = { emails: 0, events: 0, layoffMentions: 0, boardsFound: 0, failed: 0 }
  const query = process.env.NEWSLETTER_SENDER_QUERY?.trim()
  if (!query || !process.env.ANTHROPIC_API_KEY) return result

  const client = getAnthropicClient()
  const companyIds = new Set<string>()

  for (const message of await listNewsletterMessages(accessToken, query)) {
    try {
      const html = await getMessageHtml(accessToken, message.id)
      if (html) {
        const parsed = newsletterText(html)
        const events = parsed.text ? await extractNewsletterEvents(client, parsed) : []
        for (const [i, e] of events.entries()) {
          // The story's own link when there is one; otherwise an address that is unique to this event.
          const url = e.url ?? `gmail-message:${message.id}#${i}`
          if (await prisma.researchLibraryItem.findFirst({ where: { url }, select: { id: true } })) continue
          await prisma.researchLibraryItem.create({
            data: {
              url, ingestionSource: 'newsletter', discoveryTopic: EVENT_LABELS[e.kind],
              title: `${e.company}: ${e.summary}`.slice(0, 300), summary: e.summary,
              newsSource: e.url ? publisherName(e.url) : null,
              status: 'new', digestAudiences: [],
            },
          })
          result.events++
          if (e.kind === 'layoff' && e.url) {
            await prisma.layoffNewsMention.upsert({
              where: { url: e.url }, update: {},
              create: {
                companyKey: normalizeOrgName(e.company), company: e.company, headline: e.summary.slice(0, 300),
                url: e.url, publisher: publisherName(e.url), employees: e.employees, publishedAt: new Date(),
              },
            })
            result.layoffMentions++
          }
          companyIds.add((await getOrCreateCompany(e.company)).id)
        }
      }
      await markMessageRead(accessToken, message.id)
      result.emails++
    } catch (err) {
      result.failed++
      console.error('Failed to process newsletter:', message.id, err)
    }
  }

  const boards = await discoverAtsBoards([...companyIds])
  result.boardsFound = boards.found.length
  return result
}
