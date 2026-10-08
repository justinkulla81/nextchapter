'use server'

import { cookies } from 'next/headers'
import { prisma } from '@/lib/prisma'
import { getClientIp } from '@/lib/http/client-ip'
import { captureServerEvent } from '@/lib/posthog/server'

export type NewsletterState = { error?: string; subscribed?: boolean; email?: string } | undefined

// Pages with a signup box. An allowlist: the value is stored, so it is never
// whatever the browser sent.
const SOURCES = new Set([
  'home', 'how-it-works', 'why-stuck', 'news', 'resources',
  'displacement-report', 'displacement-report-popup', 'displacement-report-pdf', 'site-footer',
])
const MAX_PER_HOUR_PER_IP = 5

// A non-HttpOnly cookie the pop-up and PDF gate read to tell who has already
// subscribed, so we never nag or gate them again. One year; not a secret.
const SUBSCRIBED_COOKIE = 'nc_sub'
async function markSubscribed() {
  try {
    ;(await cookies()).set(SUBSCRIBED_COOKIE, '1', {
      maxAge: 60 * 60 * 24 * 365, path: '/', sameSite: 'lax', httpOnly: false,
    })
  } catch {
    // cookies() can be read-only in some rendering contexts; non-fatal.
  }
}

export async function subscribeToNewsletter(_prev: NewsletterState, formData: FormData): Promise<NewsletterState> {
  const text = (k: string, max: number) => ((formData.get(k) as string | null) ?? '').trim().slice(0, max)

  // A field real people never see. Anything filled in here is a bot: answer
  // as if it worked and store nothing.
  if (text('website', 200)) return { subscribed: true }

  const email = text('email', 200).toLowerCase()
  const sourceRaw = text('source', 40)
  const source = SOURCES.has(sourceRaw) ? sourceRaw : null
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: 'Enter a valid email address.', email }

  const ip = await getClientIp()
  if (ip) {
    const recent = await prisma.newsletterSubscriber.count({
      where: { ip, createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) } },
    })
    if (recent >= MAX_PER_HOUR_PER_IP) return { error: 'Too many signups from this network in an hour. Try again later.', email }
  }

  // Signing up again after unsubscribing is a fresh yes.
  const existing = await prisma.newsletterSubscriber.findUnique({ where: { email }, select: { id: true, unsubscribedAt: true } })
  if (existing) {
    if (existing.unsubscribedAt) {
      await prisma.newsletterSubscriber.update({ where: { id: existing.id }, data: { unsubscribedAt: null, source } })
    }
  } else {
    await prisma.newsletterSubscriber.create({ data: { email, source, ip } })
  }

  await markSubscribed()
  captureServerEvent(email, 'newsletter_subscribed', { source, returning: !!existing })
  return { subscribed: true, email }
}
