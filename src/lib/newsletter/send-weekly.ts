import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { prisma } from '@/lib/prisma'
import NewsletterWeeklyEmail from '@/emails/newsletter-weekly'
import { emailCtaVariant } from '@/lib/ab/email-cta'
import { getPublicNotices } from '@/lib/warn/layoff-pages'
import { buildLayoffWeekBrief } from './layoff-week'
import { buildJourneyWeekBrief } from './journey-week'
import { getPublishedNews } from '@/lib/news/published'
import { handwritingUrl } from '@/lib/email/handwriting'

/**
 * Sends this week's article to everyone on the newsletter list.
 *
 * Runs alongside the candidate Market Update, with the article it chose.
 * Skipped for an address that belongs to a candidate — they already get the
 * fuller version — and for anyone already sent to today, so a re-run of the
 * dispatcher can't send twice. One email per subscriber per week is the
 * whole cost of this list.
 */
export async function sendWeeklyNewsletter(
  article: { title: string | null; url: string; summary: string | null } | null,
  introCopy: string | null,
): Promise<{ sent: number }> {
  if (!article?.title) return { sent: 0 }
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY is not set — skipping the weekly newsletter.')
    return { sent: 0 }
  }

  const startOfDay = new Date()
  startOfDay.setUTCHours(0, 0, 0, 0)
  const subscribers = await prisma.newsletterSubscriber.findMany({
    where: { unsubscribedAt: null, OR: [{ lastSentAt: null }, { lastSentAt: { lt: startOfDay } }] },
    select: { id: true, email: true, unsubscribeToken: true },
  })
  if (subscribers.length === 0) return { sent: 0 }

  const candidates = await prisma.candidateProfile.findMany({
    where: { email: { in: subscribers.map((s) => s.email), mode: 'insensitive' } },
    select: { email: true },
  })
  const candidateEmails = new Set(candidates.map((c) => c.email?.toLowerCase()))

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://launchyournextchapter.com'
  const resend = createResend(process.env.RESEND_API_KEY)
  // The layoffs block is read once for the whole send; a failed read leaves it out and the email goes as before.
  const layoffs = buildLayoffWeekBrief(await getPublicNotices().catch(() => []))
  // The journey block is read once for the whole send too; getPublishedNews already returns [] on a failed read, so the block is simply left out.
  const journeys = buildJourneyWeekBrief(await getPublishedNews(200), appUrl)
  // The handwritten aside points at the biggest cut of the week, from the same notices the block lists. No notices, no aside.
  const biggest = layoffs?.top[0]
  const noteText = biggest ? `biggest cut: ${biggest.name}`.slice(0, 60) : null
  const marginNote = noteText ? { src: handwritingUrl(appUrl, noteText), text: noteText } : null
  let sent = 0
  for (const s of subscribers) {
    if (candidateEmails.has(s.email)) continue
    try {
      const { error } = await resend.emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>',
        replyTo: 'support@launchyournextchapter.com',
        to: s.email,
        subject: `This week on the job market: ${article.title}`.slice(0, 150),
        react: NewsletterWeeklyEmail({
          introCopy,
          articleTitle: article.title,
          articleUrl: article.url,
          articleSummary: article.summary,
          newsUrl: `${appUrl}/news`,
          signupUrl: `${appUrl}/onboarding/desire`,
          ctaVariant: emailCtaVariant(s.email),
          unsubscribeUrl: `${appUrl}/api/unsubscribe/newsletter/${s.unsubscribeToken}`,
          layoffs,
          layoffsUrl: `${appUrl}/layoffs/this-week`,
          journeys,
          marginNote,
        }),
        headers: { 'List-Unsubscribe': `<${appUrl}/api/unsubscribe/newsletter/${s.unsubscribeToken}>` },
      })
      if (error) {
        console.error('Newsletter send failed for subscriber', s.id, error)
        continue
      }
      await prisma.newsletterSubscriber.update({ where: { id: s.id }, data: { lastSentAt: new Date() } })
      sent++
    } catch (e) {
      console.error('Newsletter send failed for subscriber', s.id, e)
    }
  }
  return { sent }
}
