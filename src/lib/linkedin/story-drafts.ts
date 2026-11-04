import 'server-only'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { captureServerEvent } from '@/lib/posthog/server'
import { factLink, type Fact } from '@/lib/social/facts'
import { HANDLES } from '@/lib/social/tags'
import { commentAsPage, postUrl, publishPagePost } from './page-posting'
import { MAX_WAITING_STORIES, nextStorySlot, STORY_MAX_LATE_MS, STORY_MIN_GAP_MS, storyDue, storyFirstComment } from './story-rules'
import { writeLinkedInStory } from './story-writer'

export type EnqueueResult = 'created' | 'exists' | 'skipped'

/**
 * Makes a LinkedIn draft for a non-layoff story the social stream just sent. Layoffs have their own pipeline (the sweep in
 * layoff-post-sweep.ts), so they are not drafted here. One draft per fact (the fact's key is unique); written by Claude in LinkedIn's
 * voice with the same number check; staged to the next weekday slot; and held for a click, never posted by itself.
 * Nothing is drafted while six are already waiting, so the queue never fills with stale posts. Never throws.
 */
export async function enqueueLinkedInStory(fact: Fact, now = new Date()): Promise<EnqueueResult> {
  if (fact.topic === 'layoff') return 'skipped'
  try {
    if (await prisma.linkedInStoryDraft.findUnique({ where: { factKey: fact.key }, select: { id: true } })) return 'exists'
    const waiting = await prisma.linkedInStoryDraft.findMany({ where: { status: { in: ['DRAFT', 'APPROVED'] } }, select: { scheduledFor: true } })
    if (waiting.length >= MAX_WAITING_STORIES) {
      captureServerEvent('cron', 'linkedin_story_draft_skipped', { factKey: fact.key, topic: fact.topic, reason: 'queue full' })
      return 'skipped'
    }
    const recent = (await prisma.linkedInStoryDraft.findMany({ orderBy: { createdAt: 'desc' }, take: 8, select: { body: true } })).map((r) => r.body)
    const written = await writeLinkedInStory(fact, recent)
    if (!written.ok) {
      captureServerEvent('cron', 'linkedin_story_draft_skipped', { factKey: fact.key, topic: fact.topic, reason: written.reason })
      return 'skipped'
    }
    const scheduledFor = nextStorySlot(now, waiting.map((w) => w.scheduledFor), fact.topic === 'press')
    const tags = (fact.cites ?? []).flatMap((k) => (HANDLES[k] ? [{ name: HANDLES[k].name, note: 'credit them when you post (type @ and pick their page)' }] : []))
    await prisma.linkedInStoryDraft.create({
      data: {
        factKey: fact.key, topic: fact.topic, body: written.body,
        firstComment: storyFirstComment(fact.topic, factLink(fact, 'linkedin')),
        scheduledFor, facts: { lines: fact.lines, path: fact.path, campaign: fact.campaign }, tags,
      },
    })
    captureServerEvent('cron', 'linkedin_story_draft_created', { factKey: fact.key, topic: fact.topic, scheduledFor: scheduledFor.toISOString() })
    return 'created'
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return 'exists'
    console.error('LinkedIn story draft failed for', fact.key, e)
    return 'skipped'
  }
}

export type PublishStoryResult =
  | { ok: true; postUrn: string; commented: boolean; topic: string }
  | { ok: false; reason: 'already-claimed' | 'failed'; error?: string }

/**
 * Publishes one story draft as the NextChapter page: the text, then the link as the first comment. The draft is claimed (set to
 * POSTED) before anything is sent, so a double click or an overlapping run can never post it twice; if LinkedIn refuses it goes
 * back to where it was. `from` is the statuses it may be posted from: an approved draft by the schedule, a draft or approved one by a click.
 */
export async function publishStoryDraftAsPage(
  id: string,
  conn: { accessToken: string; organizationUrn: string },
  from: ('DRAFT' | 'APPROVED')[] = ['APPROVED'],
): Promise<PublishStoryResult> {
  const before = await prisma.linkedInStoryDraft.findUnique({ where: { id }, select: { status: true } })
  const claimed = await prisma.linkedInStoryDraft.updateMany({ where: { id, status: { in: from } }, data: { status: 'POSTED', postedAt: new Date() } })
  if (claimed.count === 0 || !before) return { ok: false, reason: 'already-claimed' }
  const draft = await prisma.linkedInStoryDraft.findUniqueOrThrow({ where: { id }, select: { body: true, firstComment: true, topic: true } })

  let postUrnValue: string
  try {
    postUrnValue = await publishPagePost({ token: conn.accessToken, orgUrn: conn.organizationUrn, text: draft.body, altText: 'NextChapter' })
  } catch (e) {
    await prisma.linkedInStoryDraft.update({ where: { id }, data: { status: before.status, postedAt: null } })
    console.error('LinkedIn story post failed for draft', id, e)
    return { ok: false, reason: 'failed', error: e instanceof Error ? e.message.slice(0, 200) : 'unknown' }
  }
  await prisma.linkedInStoryDraft.update({ where: { id }, data: { postUrn: postUrnValue } })
  let commented = true
  if (draft.firstComment.trim()) {
    try {
      await commentAsPage(conn.accessToken, conn.organizationUrn, postUrnValue, draft.firstComment)
    } catch (e) {
      commented = false
      console.error('LinkedIn story first comment failed for draft', id, e)
    }
  }
  return { ok: true, postUrn: postUrnValue, commented, topic: draft.topic }
}

export interface DueStoryResult {
  status: 'nothing-due' | 'too-soon' | 'posted' | 'failed'
  postedDraftId?: string
  url?: string
  error?: string
}

/**
 * Posts the next approved story whose slot has come, as the page. Only an APPROVED draft is ever posted by the schedule: a person
 * clicked it. At least three hours after any other LinkedIn post (a layoff or a story), and a draft more than a day past its
 * slot is left alone.
 */
export async function runDueStoryPosting(conn: { accessToken: string; organizationUrn: string }, now = new Date()): Promise<DueStoryResult> {
  const since = new Date(now.getTime() - STORY_MIN_GAP_MS)
  const [layoff, story] = await Promise.all([
    prisma.linkedInPostDraft.findFirst({ where: { status: 'POSTED', postedAt: { gt: since } }, select: { id: true } }),
    prisma.linkedInStoryDraft.findFirst({ where: { status: 'POSTED', postedAt: { gt: since } }, select: { id: true } }),
  ])
  if (layoff || story) return { status: 'too-soon' }
  const candidates = await prisma.linkedInStoryDraft.findMany({
    where: { status: 'APPROVED', postUrn: null, scheduledFor: { lte: now, gte: new Date(now.getTime() - STORY_MAX_LATE_MS) } },
    orderBy: { scheduledFor: 'asc' }, take: 3,
    select: { id: true, status: true, scheduledFor: true, postUrn: true, topic: true },
  })
  const due = candidates.find((d) => storyDue(d, now))
  if (!due) return { status: 'nothing-due' }
  const r = await publishStoryDraftAsPage(due.id, conn)
  if (!r.ok) {
    if (r.reason === 'failed') captureServerEvent('cron', 'linkedin_story_post_failed', { draftId: due.id, error: r.error, source: 'schedule' })
    return { status: r.reason === 'failed' ? 'failed' : 'nothing-due', error: r.error }
  }
  captureServerEvent('cron', 'linkedin_story_posted', {
    draftId: due.id, topic: r.topic, as: 'page', commented: r.commented, source: 'schedule',
    minutesFromSlot: Math.round((now.getTime() - due.scheduledFor.getTime()) / 60000),
  })
  return { status: 'posted', postedDraftId: due.id, url: postUrl(r.postUrn) }
}
