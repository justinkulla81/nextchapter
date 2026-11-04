import 'server-only'
import { createElement } from 'react'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { audienceUnsubscribeUrl } from '@/lib/email/signed-links'
import { buildEmailClickUrl } from '@/lib/email/click-link'
import { canParticipateInCommunity } from '@/lib/community/access'
import { resolveCommunityIdentity } from '@/lib/community/identity'
import { getRoleIndex } from '@/lib/seo/role-figures'
import { ROLE_MIN_PAY, roleForAddress } from '@/lib/seo/role-pages'
import { usd } from '@/lib/seo/job-title-rules'
import { SITE_URL } from '@/lib/seo/facts'
import { captureServerEvent } from '@/lib/posthog/server'
import RoleNetworkDigestEmail, { type RoleNetworkDigestPost } from '@/emails/role-network-digest'

const DAY = 86_400_000
/** The job is weekly; a membership sent within this window is not sent again, so a re-run only reaches who was missed. */
const ALREADY_SENT_WINDOW_MS = 5 * DAY
const POST_WINDOW_MS = 7 * DAY
const MAX_POSTS = 3
const DEADLINE_MS = 240_000

const excerpt = (text: string) => {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > 200 ? `${t.slice(0, 197).trimEnd()}…` : t
}

/**
 * The weekly email for members of a role network ("CRO network"): the role's verified open jobs and pay, and what other
 * members posted that week. Posts are shown only to a member who can themselves take part in Community (the same gate
 * as the feed), so the email never opens a room the member has not unlocked. Members in Confidential Search Mode are
 * neither sent to nor quoted. Respects the Weekly Market Digest unsubscribe and the MINIMAL notification tier.
 */
export async function runRoleNetworkDigest(now = new Date()) {
  if (!process.env.RESEND_API_KEY) return { enabled: false as const }
  const memberships = await prisma.communityMembership.findMany({
    where: {
      leftAt: null,
      community: { type: 'ROLE' },
      OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now.getTime() - ALREADY_SENT_WINDOW_MS) } }],
      candidate: {
        confidentialSearchMode: false,
        marketDigestOptedOut: false,
        notificationTier: { not: 'MINIMAL' },
        deactivatedAt: null,
        isSampleData: false,
        isSystemAccount: false,
      },
    },
    select: {
      id: true,
      community: { select: { id: true, value: true } },
      candidate: { select: { id: true, userId: true, firstName: true, privacyTier: true, confidentialSearchMode: true } },
    },
  })

  const stats = { checked: memberships.length, sent: 0, skipped: 0, failed: 0, skippedForTime: 0 }
  if (memberships.length === 0) return { enabled: true as const, ...stats }

  const [index, appUrl] = [await getRoleIndex().catch(() => []), process.env.NEXT_PUBLIC_APP_URL || SITE_URL]
  const resend = createResend(process.env.RESEND_API_KEY)
  const admin = createAdminClient()
  const postsByCommunity = new Map<string, RoleNetworkDigestPost[]>()
  const postsFor = async (communityId: string) => {
    const cached = postsByCommunity.get(communityId)
    if (cached) return cached
    const rows = await prisma.communityPost.findMany({
      where: {
        isActive: true,
        moderationStatus: 'PUBLISHED',
        createdAt: { gte: new Date(now.getTime() - POST_WINDOW_MS) },
        candidate: {
          confidentialSearchMode: false,
          communityMemberships: { some: { communityId, leftAt: null } },
        },
      },
      select: { description: true, candidate: { select: { id: true, firstName: true, lastName: true, profilePictureUrl: true, confidentialSearchMode: true } } },
      orderBy: { createdAt: 'desc' },
      take: MAX_POSTS,
    })
    const posts = rows.map((r) => ({ author: resolveCommunityIdentity(r.candidate).displayName ?? 'A member', excerpt: excerpt(r.description) }))
    postsByCommunity.set(communityId, posts)
    return posts
  }

  const startedAt = Date.now()
  for (const m of memberships) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      stats.skippedForTime += 1
      continue
    }
    try {
      const slug = m.community.value
      const role = roleForAddress(slug)
      if (!role) {
        stats.skipped += 1
        continue
      }
      const stat = index.find((s) => s.slug === role.slug) ?? null
      const canSeePosts = await canParticipateInCommunity(m.candidate.id, m.candidate.privacyTier, m.candidate.confidentialSearchMode)
      const posts = canSeePosts ? await postsFor(m.community.id) : []
      const openJobs = stat?.jobs ?? null
      // Nothing real to say this week: no jobs figure and no posts.
      if (openJobs === null && posts.length === 0) {
        stats.skipped += 1
        continue
      }
      const { data: userData } = await admin.auth.admin.getUserById(m.candidate.userId)
      const email = userData.user?.email
      if (!email) {
        stats.skipped += 1
        continue
      }
      // Claim before sending, so a retry or a duplicate fire cannot send twice.
      const claimed = await prisma.communityMembership.updateMany({
        where: { id: m.id, OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now.getTime() - ALREADY_SENT_WINDOW_MS) } }] },
        data: { lastDigestAt: now },
      })
      if (claimed.count === 0) {
        stats.skipped += 1
        continue
      }
      const { error } = await resend.emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>',
        replyTo: 'support@launchyournextchapter.com',
        to: email,
        subject: `This week in the ${role.short} network`,
        react: createElement(RoleNetworkDigestEmail, {
          firstName: m.candidate.firstName,
          short: role.short,
          spelled: role.spelled,
          openJobs,
          medianPay: stat?.median != null && stat.payCount >= ROLE_MIN_PAY ? usd(stat.median) : null,
          posts,
          rolePageUrl: buildEmailClickUrl(appUrl, m.candidate.id, 'MARKET_UPDATE', `${appUrl}/roles/${role.slug}`),
          networkUrl: buildEmailClickUrl(appUrl, m.candidate.id, 'MARKET_UPDATE', `${appUrl}/dashboard/community`),
          unsubscribeUrl: audienceUnsubscribeUrl(appUrl, 'candidate', m.candidate.id),
        }),
      })
      if (error) {
        // Release the claim so the next run retries this member.
        await prisma.communityMembership.update({ where: { id: m.id }, data: { lastDigestAt: null } }).catch(() => {})
        console.error('Role network digest: send failed', m.id, error)
        stats.failed += 1
        continue
      }
      stats.sent += 1
      captureServerEvent(m.candidate.id, 'role_network_digest_sent', { roleSlug: role.slug, communityId: m.community.id, postCount: posts.length, openJobs })
    } catch (e) {
      console.error('Role network digest failed for membership', m.id, e)
      stats.failed += 1
    }
  }
  captureServerEvent('cron', 'role_network_digest_run', stats)
  return { enabled: true as const, ...stats }
}
