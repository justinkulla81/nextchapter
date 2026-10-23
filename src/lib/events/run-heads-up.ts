import 'server-only'
import { prisma } from '@/lib/prisma'
import { NOT_CASUAL_WHERE } from '@/lib/journey/intensity'
import { listEvents } from './store'
import { checkInDue, dueStages, editionKey, nextEditionDue, STAGE_PRIORITY, URGENT_STAGES, type InterestStatus, type Stage } from './headsup'
import { factsFor } from './member'
import { matchEvents } from './match'
import { sendConferenceHeadsUp, type FollowUp } from './send-heads-up'

// Daily, at most one email a week per member (urgent stages excepted). Two audiences: members who saved, are going to, or are speaking at an event get every stage; the
// rest get at most one EXPLORE note about their single best-fit flagship, no more than one every 14 days.
// Off until CONFERENCE_HEADSUP_ENABLED=1, because these are real emails to real members.
const MATCH_MIN_SCORE = 8
const MATCH_GAP_DAYS = 14
const WEEKLY_GAP_DAYS = 6

export async function runConferenceHeadsUp(now = new Date(), opts: { dryRun?: boolean } = {}) {
  const enabled = process.env.CONFERENCE_HEADSUP_ENABLED === '1'
  if (!enabled && !opts.dryRun) return { enabled: false as const, sent: 0, due: 0 }
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

  const lastAny = new Map<string, Date>()
  for (const n of sentBefore) if (n.sentAt > (lastAny.get(n.candidateId) ?? new Date(0))) lastAny.set(n.candidateId, n.sentAt)

  let due = 0
  let sent = 0
  for (const m of members) {
    try {
      const interests = new Map(m.conferenceInterests.map((i) => [i.eventId, i.status as InterestStatus]))
      const todo: { event: (typeof events)[number]; stage: Stage; source: 'interest' | 'match'; edition: string; followUp?: FollowUp }[] = []
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
      todo.sort((a, b) => STAGE_PRIORITY.indexOf(a.stage) - STAGE_PRIORITY.indexOf(b.stage))
      due += todo.length
      const recent = lastAny.get(m.id)
      const capped = recent && now.getTime() - recent.getTime() < WEEKLY_GAP_DAYS * 86_400_000
      // One email a week: send the most urgent due item; the rest stay due until their windows close.
      const pick = todo.find((t) => !capped || URGENT_STAGES.includes(t.stage))
      if (pick && !opts.dryRun && (await sendConferenceHeadsUp(m, pick.event, pick.stage, pick.source, { edition: pick.edition, followUp: pick.followUp }))) {
        sent++
        // A new edition starts a new cycle: forget last year's answer and count down to the new end date.
        if (pick.stage === 'NEXT_EDITION' && pick.followUp)
          await prisma.conferenceInterest.update({ where: { id: pick.followUp.interestId }, data: { outcome: null, outcomeAt: null, editionEnd: pick.event.endDate ?? pick.event.startDate } })
      }
    } catch (error) {
      console.error('Conference heads-up failed for member', m.id, error)
    }
  }
  return { enabled, sent, due, members: members.length }
}
