import 'server-only'
import { createElement } from 'react'
import { prisma } from '@/lib/prisma'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { audienceUnsubscribeUrl } from '@/lib/email/signed-links'
import { buildEmailClickUrl } from '@/lib/email/click-link'
import { autoJoinRoleNetworks } from '@/lib/community/communities'
import { getRoleResources } from '@/lib/roles/resources'
import { roleBySlug } from '@/lib/seo/role-pages'
import { rolesForMember } from '@/lib/roles/resources-rules'
import { canParticipateInCommunity } from '@/lib/community/access'
import { resolveCommunityIdentity } from '@/lib/community/identity'
import { getRoleIndex } from '@/lib/seo/role-figures'
import { ROLE_MIN_PAY } from '@/lib/seo/role-pages'
import { getJobStats } from '@/lib/seo/topic-data'
import { industryBySlug } from '@/lib/seo/topics'
import { networkInfoForCommunity, type NetworkInfo } from '@/lib/community/peer-networks'
import { usd } from '@/lib/seo/job-title-rules'
import { SITE_URL } from '@/lib/seo/facts'
import { captureServerEvent } from '@/lib/posthog/server'
import NetworkDigestEmail, { type NetworkDigestPost } from '@/emails/network-digest'

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

const pagePath = (info: NetworkInfo) => (info.kind === 'role' ? `/roles/${info.key.slice(5)}` : info.kind === 'function' ? `/functions/${info.key.slice(9)}` : `/industries/${info.key.slice(9)}`)

/** Open jobs and median pay for the network's role, function or industry, from the figures the pages already store. Null when there are none. */
async function figuresFor(info: NetworkInfo, roleIndex: Awaited<ReturnType<typeof getRoleIndex>>): Promise<{ openJobs: number | null; medianPay: string | null }> {
  if (info.kind === 'role') {
    const stat = roleIndex.find((s) => s.slug === info.value) ?? null
    return { openJobs: stat?.jobs ?? null, medianPay: stat?.median != null && stat.payCount >= ROLE_MIN_PAY ? usd(stat.median) : null }
  }
  const stats =
    info.kind === 'function'
      ? await getJobStats({ fn: info.value }).catch(() => null)
      : await (async () => {
          const rule = industryBySlug(info.key.slice(9))?.rule
          return rule ? getJobStats({ rule }).catch(() => null) : null
        })()
  if (!stats) return { openJobs: null, medianPay: null }
  return { openJobs: stats.sample, medianPay: stats.p50 != null && stats.paid >= ROLE_MIN_PAY ? usd(stats.p50) : null }
}

/**
 * The weekly email for members of a role, function or industry network ("CRO network", "Sales network"): the verified
 * open jobs and pay for it, and what other members posted that week. A role network also lists what is new around the role:
 * recruiters, conferences, training and officer changes. Sent to members who clicked "Join the ... network" (joinedVia MANUAL)
 * and, for a ROLE network only, to members joined automatically from their title (owner decision 2026-11-04; the unsubscribe
 * link is in every email). Function and industry communities also hold everyone whose profile says so, and those members
 * never asked for an email. Posts are shown only to a member who can themselves take part in Community (the same gate
 * as the feed), so the email never opens a room the member has not unlocked. Members in Confidential Search Mode are
 * neither sent to nor quoted. Respects the Weekly Market Digest unsubscribe and the MINIMAL notification tier.
 */
export async function runNetworkDigest(now = new Date()) {
  if (!process.env.RESEND_API_KEY) return { enabled: false as const }
  const autoJoined = await autoJoinRoleNetworks(Date.now() + 60_000).catch((e) => {
    console.error('Role network auto-join failed', e)
    return 0
  })
  const memberships = await prisma.communityMembership.findMany({
    where: {
      leftAt: null,
      // A click joins any network; a role network is also joined automatically from the member's title (autoJoinRoleNetworks).
      // Function and industry auto-joins never got an email and still do not.
      OR: [{ joinedVia: 'MANUAL' }, { joinedVia: 'AUTO', community: { type: 'ROLE' } }],
      community: { type: { in: ['ROLE', 'FUNCTION', 'INDUSTRY'] } },
      AND: [{ OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now.getTime() - ALREADY_SENT_WINDOW_MS) } }] }],
      candidate: {
        confidentialSearchMode: false,
        marketDigestOptedOut: false,
        notificationTier: { not: 'MINIMAL' },
        deactivatedAt: null,
        isSampleData: false,
        isSystemAccount: false,
      },
    },
    // Never-sent first, then oldest-sent: the send loop stops at a deadline, so a fixed order would serve the same head of the list every week.
    orderBy: [{ lastDigestAt: { sort: 'asc', nulls: 'first' } }, { id: 'asc' }],
    select: {
      id: true,
      joinedVia: true,
      turnoverMutedAt: true,
      community: { select: { id: true, type: true, value: true } },
      candidate: { select: { id: true, userId: true, firstName: true, privacyTier: true, confidentialSearchMode: true, resumeLatestJobTitle: true, targetRoleType: true } },
    },
  })

  const stats = { autoJoined, checked: memberships.length, sent: 0, skipped: 0, failed: 0, skippedForTime: 0, staleRole: 0 }
  if (memberships.length === 0) return { enabled: true as const, ...stats }

  const [index, appUrl] = [await getRoleIndex().catch(() => []), process.env.NEXT_PUBLIC_APP_URL || SITE_URL]
  const resend = createResend(process.env.RESEND_API_KEY)
  const admin = createAdminClient()
  const postsByCommunity = new Map<string, NetworkDigestPost[]>()
  const postsFor = async (communityId: string, type: string) => {
    const cached = postsByCommunity.get(communityId)
    if (cached) return cached
    const rows = await prisma.communityPost.findMany({
      where: {
        isActive: true,
        moderationStatus: 'PUBLISHED',
        createdAt: { gte: new Date(now.getTime() - POST_WINDOW_MS) },
        candidate: {
          confidentialSearchMode: false,
          // In a role network only members who clicked to join are quoted; one joined from their title has not chosen to be seen.
          communityMemberships: { some: { communityId, leftAt: null, ...(type === 'ROLE' ? { joinedVia: 'MANUAL' as const } : {}) } },
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

  const highlightsByRole = new Map<string, string[]>()
  const highlightsFor = async (info: NetworkInfo, muted: boolean): Promise<string[]> => {
    if (info.kind !== 'role') return []
    const key = `${info.value}|${muted ? 'muted' : 'all'}`
    const cached = highlightsByRole.get(key)
    if (cached) return cached
    const role = roleBySlug(info.value)
    const out: string[] = []
    if (role) {
      const r = await getRoleResources(role).catch(() => null)
      if (r) {
        if (r.turnover && !muted) out.push(`${r.turnover.total} ${r.turnover.ownSeat ? info.name : r.turnover.label} change${r.turnover.total === 1 ? '' : 's'} filed or reported in the last 120 days`)
        if (r.conferences && r.conferences.upcoming > 0) out.push(`${r.conferences.upcoming} conference${r.conferences.upcoming === 1 ? '' : 's'} with dates announced for ${role.fn}`)
        if (r.firms.length > 0) out.push(`${r.firms.length} recruiting firms with live ${role.fn} searches at your level`)
        if (r.courses.total > 0) out.push(`${r.courses.total} ${role.fn} courses, with cost shown`)
      }
    }
    highlightsByRole.set(key, out)
    return out
  }

  const startedAt = Date.now()
  // A member with two role networks (the role held and the role aimed at) gets one email in a run, not two.
  const emailedThisRun = new Set<string>()
  for (const m of memberships) {
    if (Date.now() - startedAt > DEADLINE_MS) {
      stats.skippedForTime += 1
      continue
    }
    if (emailedThisRun.has(m.candidate.id)) {
      stats.skipped += 1
      continue
    }
    let claimedId: string | null = null
    try {
      const info = networkInfoForCommunity(m.community.type, m.community.value)
      if (!info) {
        stats.skipped += 1
        continue
      }
      // A role network joined from the member's title is sent only while the title still says so: "your profile says you work as ..."
      // must be true. Someone who has moved on keeps the row but is not emailed.
      if (m.joinedVia === 'AUTO' && info.kind === 'role' && !rolesForMember([m.candidate.resumeLatestJobTitle, m.candidate.targetRoleType]).some((r) => r.slug === info.value)) {
        stats.staleRole += 1
        continue
      }
      const figures = await figuresFor(info, index)
      const canSeePosts = await canParticipateInCommunity(m.candidate.id, m.candidate.privacyTier, m.candidate.confidentialSearchMode)
      const posts = canSeePosts ? await postsFor(m.community.id, m.community.type) : []
      // No count to give is no line, not "0 verified open jobs".
      const openJobs = figures.openJobs != null && figures.openJobs > 0 ? figures.openJobs : null
      const highlights = await highlightsFor(info, !!m.turnoverMutedAt)
      // Nothing real to say this week: no jobs figure, no posts and nothing new around the role.
      if (openJobs === null && posts.length === 0 && highlights.length === 0) {
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
      // The claim re-checks what the first read decided on, so a member who left or opted out since is not emailed.
      const claimed = await prisma.communityMembership.updateMany({
        where: {
          id: m.id,
          leftAt: null,
          candidate: { confidentialSearchMode: false, marketDigestOptedOut: false, notificationTier: { not: 'MINIMAL' }, deactivatedAt: null },
          OR: [{ lastDigestAt: null }, { lastDigestAt: { lt: new Date(now.getTime() - ALREADY_SENT_WINDOW_MS) } }],
        },
        data: { lastDigestAt: now },
      })
      if (claimed.count === 0) {
        stats.skipped += 1
        continue
      }
      claimedId = m.id
      const { error } = await resend.emails.send({
        from: 'NextChapter <support@launchyournextchapter.com>',
        replyTo: 'support@launchyournextchapter.com',
        to: email,
        subject: `This week in the ${info.name} network`,
        react: createElement(NetworkDigestEmail, {
          firstName: m.candidate.firstName,
          name: info.name,
          scope: info.spelled,
          openJobs,
          medianPay: figures.medianPay,
          posts,
          highlights,
          because: m.joinedVia === 'AUTO' ? `your profile says you work as, or aim for, ${info.spelled}` : `you joined the ${info.name} network`,
          pageUrl: buildEmailClickUrl(appUrl, m.candidate.id, 'MARKET_UPDATE', `${appUrl}${pagePath(info)}`),
          pageLabel: `See the ${info.name} page`,
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
      emailedThisRun.add(m.candidate.id)
      captureServerEvent(m.candidate.id, 'network_digest_sent', { networkKind: info.kind, networkKey: info.key, communityId: m.community.id, postCount: posts.length, openJobs, highlightCount: highlights.length, joinedVia: m.joinedVia })
    } catch (e) {
      // A send that threw (not one that returned an error) must not leave the claim set, or the member is dropped for the week.
      if (claimedId) await prisma.communityMembership.update({ where: { id: claimedId }, data: { lastDigestAt: null } }).catch(() => {})
      console.error('Role network digest failed for membership', m.id, e)
      stats.failed += 1
    }
  }
  captureServerEvent('cron', 'network_digest_run', stats)
  return { enabled: true as const, ...stats }
}
