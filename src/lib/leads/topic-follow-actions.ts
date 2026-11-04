'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { getClientIp } from '@/lib/http/client-ip'
import { allowByIp, HOUR_MS, RATE_LIMITED_MESSAGE } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { notifyNewLead } from '@/lib/leads/notify-new-lead'
import { jobAlertEmailsOn } from '@/lib/leads/job-alert-config'
import { isFollowable, topicFollowKey, topicSource } from '@/lib/leads/topic-follow'

export type TopicFollowState = { signedIn: boolean; following: boolean }
export type TopicFollowResult = { ok: true; following: boolean; emailsOn: boolean } | { ok: false; error: string }

/** The signed-in member behind this request, with the verified address on their account. Null for a visitor, an anonymous onboarding session, or anyone without a member profile. */
async function member() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.is_anonymous || !user.email) return null
  const profile = await prisma.candidateProfile.findUnique({ where: { userId: user.id }, select: { id: true } })
  return profile ? { id: profile.id, email: user.email } : null
}

/** For a cached public page: is the visitor a signed-in member, and do they already follow this topic? Reads only. */
export async function getTopicFollowState(q: string, loc: string): Promise<TopicFollowState> {
  try {
    const m = await member()
    if (!m) return { signedIn: false, following: false }
    const lead = await prisma.homepageLead.findUnique({
      where: { email_kind_situation_searchQ_searchLoc_searchRemote: topicFollowKey(m.email, q, loc) },
      select: { unsubscribedAt: true, confirmedAt: true },
    })
    return { signedIn: true, following: !!lead && !lead.unsubscribedAt && !!lead.confirmedAt }
  } catch {
    return { signedIn: false, following: false }
  }
}

/**
 * Follow or stop following a topic. The member's account address is already verified, so the saved search is confirmed at
 * once (no confirmation email): new-job emails start as the alerts cron finds matches.
 */
export async function setTopicFollowed(q: string, loc: string, source: string, follow: boolean): Promise<TopicFollowResult> {
  if (!isFollowable(q, loc)) return { ok: false, error: 'There is nothing to follow on this page.' }
  const m = await member()
  if (!m) return { ok: false, error: 'Sign in to follow this with one click.' }
  if (!(await allowByIp('topic-follow', 60, HOUR_MS))) return { ok: false, error: RATE_LIMITED_MESSAGE }

  const key = topicFollowKey(m.email, q, loc)
  const where = { email_kind_situation_searchQ_searchLoc_searchRemote: key }
  const src = topicSource(source)
  const existing = await prisma.homepageLead.findUnique({ where, select: { id: true, confirmedAt: true } })

  if (follow) {
    if (existing) {
      await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: null, confirmedAt: existing.confirmedAt ?? new Date() } })
    } else {
      await prisma.homepageLead.create({ data: { ...key, source: src, ip: await getClientIp(), confirmedAt: new Date() } })
      notifyNewLead({ email: m.email, channel: 'Job alert (member)', detail: src })
    }
    captureServerEvent(m.id, 'topic_followed', { source: src, q: key.searchQ, loc: key.searchLoc, returning: !!existing })
  } else if (existing) {
    await prisma.homepageLead.update({ where: { id: existing.id }, data: { unsubscribedAt: new Date() } })
    captureServerEvent(m.id, 'topic_unfollowed', { source: src, q: key.searchQ, loc: key.searchLoc })
  }
  return { ok: true, following: follow, emailsOn: jobAlertEmailsOn() }
}
