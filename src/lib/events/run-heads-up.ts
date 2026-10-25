import 'server-only'
import { prisma } from '@/lib/prisma'
import { NOT_CASUAL_WHERE } from '@/lib/journey/intensity'
import { listEvents } from './store'
import { checkInDue, dueStages, sendCap, editionKey, nextEditionDue, STAGE_PRIORITY, URGENT_STAGES, type InterestStatus, type Stage } from './headsup'
import { factsFor } from './member'
import { matchEvents, newEventsFor, NEW_EVENT_SINCE_DEFAULT, type EventMatch } from './match'
import { sendConferenceHeadsUp, sendNewEventsDigest, type FollowUp } from './send-heads-up'
import type { ConferenceRow } from './types'

// Daily, at most one email a week per member (urgent stages excepted). Two audiences: members who saved, are going to, or are speaking at an event get every stage; the
// rest get at most one EXPLORE note about their single best-fit flagship, no more than one every 14 days.
// Off until CONFERENCE_HEADSUP_ENABLED=1, because these are real emails to real members.
const MATCH_MIN_SCORE = 8
const MATCH_GAP_DAYS = 14
const WEEKLY_GAP_DAYS = 6
/** A ramp, not a blast: at most CONFERENCE_HEADSUP_MAX_PER_RUN emails per daily run (default 25; 0 pauses). Urgent stages go first. */

export interface PlannedSend {
  member: { id: string; userId: string; firstName: string | null }
  event: ConferenceRow
  stage: Stage
  source: 'interest' | 'match'
  edition: string
  followUp?: FollowUp
  /** NEW_EVENT only: the events (up to 3) the one email names. */
  newMatches?: EventMatch[]
}

export async function runConferenceHeadsUp(now = new Date(), opts: { dryRun?: boolean } = {}) {
  const enabled = process.env.CONFERENCE_HEADSUP_ENABLED === '1'
  if (!enabled && !opts.dryRun) return { enabled: false as const, sent: 0, due: 0, members: 0, planned: 0, cap: 0, byStage: {} as Record<string, number>, plan: undefined as PlannedSend[] | undefined }
  const events = (await listEvents({ publishedOnly: true })).filter((e) => e.url)
  const byId = new Map(events.map((e) => [e.id, e]))
  const members = await prisma.candidateProfile.findMany({
    where: {
      AND: [NOT_CASUAL_WHERE],
      registrationCompletedAt: { not: null },
      isSampleData: false,
      weeklyReportOptedOut: false,
      notificationTier: { not: 'MINIMAL' },
    },
    select: {
      id: true, userId: true, firstName: true, primaryFunction: true, targetFunction: true, industryContext: true, secondaryIndustryContext: true,
      targetIndustries: true, industryBuckets: true, currentState: true, levelRankScore: true, journey: true, resumeLatestJobTitle: true, targetRoleType: true,
      conferenceInterests: { select: { id: true, eventId: true, status: true, editionEnd: true, outcome: true, attendedCount: true, spokeCount: true } },
    },
  })
  const sentBefore = await prisma.conferenceNudge.findMany({ select: { candidateId: true, eventId: true, stage: true, edition: true, sentAt: true } })
  const done = new Set(sentBefore.map((n) => `${n.candidateId}|${n.eventId}|${n.stage}|${n.edition}`))
  const lastMatchSend = new Map<string, Date>()
  for (const n of sentBefore) if (n.stage === 'EXPLORE') lastMatchSend.set(n.candidateId, n.sentAt > (lastMatchSend.get(n.candidateId) ?? new Date(0)) ? n.sentAt : lastMatchSend.get(n.candidateId)!)

  // Events announced to each member already, and the cut-off after which an event counts as new.
  const announced = new Map<string, Set<string>>()
  for (const n of sentBefore) if (n.stage === 'NEW_EVENT') announced.set(n.candidateId, (announced.get(n.candidateId) ?? new Set()).add(n.eventId))
  const since = new Date(process.env.CONFERENCE_NEW_SINCE ?? NEW_EVENT_SINCE_DEFAULT)

  const lastAny = new Map<string, Date>()
  for (const n of sentBefore) if (n.sentAt > (lastAny.get(n.candidateId) ?? new Date(0))) lastAny.set(n.candidateId, n.sentAt)

  let due = 0
  const plan: PlannedSend[] = []
  for (const m of members) {
    try {
      const interests = new Map(m.conferenceInterests.map((i) => [i.eventId, i.status as InterestStatus]))
      const todo: { event: (typeof events)[number]; stage: Stage; source: 'interest' | 'match'; edition: string; followUp?: FollowUp; newMatches?: EventMatch[] }[] = []
      for (const i of m.conferenceInterests) {
        const e = byId.get(i.eventId)
        if (!e) continue
        const followUp: FollowUp = { interestId: i.id, attendedCount: i.attendedCount, spokeCount: i.spokeCount, outcome: i.outcome }
        const edition = editionKey(e, now)
        for (const stage of dueStages(e, i.status as InterestStatus, now)) if (!done.has(`${m.id}|${e.id}|${stage}|${edition}`)) todo.push({ event: e, stage, source: 'interest', edition, followUp })
        // After the event: ask how it went, once per edition.
        const ckKey = i.editionEnd ? i.editionEnd.toISOString().slice(0, 7) : ''
        if (checkInDue(i, now) && !done.has(`${m.id}|${e.id}|CHECK_IN|${ckKey}`)) todo.push({ event: e, stage: 'CHECK_IN', source: 'interest', edition: ckKey, followUp })
        // Next year's dates are out for someone who went, spoke or follows it.
        if (nextEditionDue(e, i, now) && !done.has(`${m.id}|${e.id}|NEXT_EDITION|${edition}`)) todo.push({ event: e, stage: 'NEXT_EDITION', source: 'interest', edition, followUp })
      }
      // Discovery: one best-fit flagship, only if no heads-up went to this member recently.
      const last = lastMatchSend.get(m.id)
      if (!last || now.getTime() - last.getTime() >= MATCH_GAP_DAYS * 86_400_000) {
        const top = matchEvents(events, factsFor(m)).find((x) => x.score >= MATCH_MIN_SCORE && x.event.importance <= 2 && x.event.verified && !interests.has(x.event.id))
        if (top && dueStages(top.event, null, now).includes('EXPLORE') && !done.has(`${m.id}|${top.event.id}|EXPLORE|${editionKey(top.event, now)}`)) todo.push({ event: top.event, stage: 'EXPLORE', source: 'match', edition: editionKey(top.event, now) })
      }
      // New conferences added since launch that fit this member: one email naming up to three.
      const fresh = newEventsFor(events, factsFor(m), since, announced.get(m.id) ?? new Set(), new Set(interests.keys()), now)
      if (fresh.length > 0) todo.push({ event: fresh[0].event, stage: 'NEW_EVENT', source: 'match', edition: '', newMatches: fresh })
      todo.sort((a, b) => STAGE_PRIORITY.indexOf(a.stage) - STAGE_PRIORITY.indexOf(b.stage))
      due += todo.length
      const recent = lastAny.get(m.id)
      const capped = recent && now.getTime() - recent.getTime() < WEEKLY_GAP_DAYS * 86_400_000
      // One email a week: send the most urgent due item; the rest stay due until their windows close.
      const pick = todo.find((t) => !capped || URGENT_STAGES.includes(t.stage))
      if (pick) plan.push({ member: { id: m.id, userId: m.userId, firstName: m.firstName }, event: pick.event, stage: pick.stage, source: pick.source, edition: pick.edition, followUp: pick.followUp, newMatches: pick.newMatches })
    } catch (error) {
      console.error('Conference heads-up failed for member', m.id, error)
    }
  }
  // Most urgent first, so the daily cap never starves a speaker deadline or a final check.
  plan.sort((a, b) => STAGE_PRIORITY.indexOf(a.stage) - STAGE_PRIORITY.indexOf(b.stage))
  const max = sendCap(process.env.CONFERENCE_HEADSUP_MAX_PER_RUN)
  const byStage: Record<string, number> = {}
  for (const p of plan) byStage[p.stage] = (byStage[p.stage] ?? 0) + 1
  let sent = 0
  if (!opts.dryRun) {
    for (const p of plan.slice(0, max)) {
      try {
        const ok = p.stage === 'NEW_EVENT' && p.newMatches ? await sendNewEventsDigest(p.member, p.newMatches) : await sendConferenceHeadsUp(p.member, p.event, p.stage, p.source, { edition: p.edition, followUp: p.followUp })
        if (ok) {
          sent++
          // A new edition starts a new cycle: forget last year's answer and count down to the new end date.
          if (p.stage === 'NEXT_EDITION' && p.followUp)
            await prisma.conferenceInterest.update({ where: { id: p.followUp.interestId }, data: { outcome: null, outcomeAt: null, editionEnd: p.event.endDate ?? p.event.startDate } })
        }
      } catch (error) {
        console.error('Conference heads-up send failed for member', p.member.id, error)
      }
    }
  }
  return { enabled, sent, due, members: members.length, planned: plan.length, cap: max, byStage, plan: opts.dryRun ? plan : undefined }
}
