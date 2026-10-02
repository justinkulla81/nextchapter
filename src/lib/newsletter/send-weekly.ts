import 'server-only'
import { Resend } from 'resend'
import { prisma } from '@/lib/prisma'
import NewsletterWeeklyEmail from '@/emails/newsletter-weekly'

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
  const resend = new Resend(process.env.RESEND_API_KEY)
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
          unsubscribeUrl: `${appUrl}/api/unsubscribe/newsletter/${s.unsubscribeToken}`,
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
