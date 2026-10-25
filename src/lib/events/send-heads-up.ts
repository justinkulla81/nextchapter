import 'server-only'
import { createResend } from '@/lib/email/resend-client'
import { createAdminClient } from '@/lib/supabase/admin'
import { candidateUnsubscribeUrl } from '@/lib/email/signed-links'
import { captureServerEvent } from '@/lib/posthog/server'
import ConferenceHeadsUpEmail from '@/emails/conference-heads-up'
import ConferenceNewEventsEmail from '@/emails/conference-new-events'
import { SPEAKING_LABEL, type Speaking } from './types'
import type { EventMatch } from './match'
import { prisma } from '@/lib/prisma'
import { costLabel, whenLabel, whereLabel } from './format'
import { STAGE_SUBJECT, type Stage } from './headsup'
import { outcomeUrl } from './outcome'
import type { ConferenceRow } from './types'

export interface FollowUp { interestId: string; attendedCount: number; spokeCount: number; outcome: string | null }

const STEPS: Record<Stage, (e: ConferenceRow, f?: FollowUp) => string[]> = {
  // NEW_EVENT is sent by sendNewEventsDigest, which builds its own list.
  NEW_EVENT: () => [],
  CHECK_IN: () => ['Did you go? One tap tells us, and we will tell you when next year\u2019s dates are announced, early enough to ask about speaking and to book.', 'If you spoke, say so below. That helps us find the right panels and organizers for you next time.'],
  NEXT_EDITION: (e, f) => [
    f && (f.spokeCount > 0 || f.outcome === 'SPOKE') ? 'You spoke here before. Propose again early: organizers remember returning speakers.' : 'Ask the organizer about speaking or a panel now. Slots are chosen months ahead.',
    e.speaking === 'OPEN_CFP' && e.speakingDeadline ? `Speaker proposals close ${e.speakingDeadline.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })}.` : 'Read the new agenda as it appears and note who you want to meet.',
    e.cheaperWays ? `Early or cheaper ways in: ${e.cheaperWays}` : 'Put the dates in your calendar and decide on a ticket while early pricing lasts. We will remind you in time to book.',
  ],
  EXPLORE: (e) => [
    'Ask the organizer how to get on the program: a talk, a panel seat or a sponsor or partner slot. Speaker choices are made months ahead. A draft is ready for you.',
    e.speaking === 'OPEN_CFP' ? 'Speaker proposals are open. Decide whether you have a talk.' : 'Read last year\u2019s agenda and note the sessions and speakers you would most want to meet.',
    'Decide later whether it is worth a ticket. We will remind you in time to book.',
  ],
  SPEAK_30: () => ['Proposals close in about a month. Write a one-paragraph outline and two titles.', 'Ask someone who has spoken there to read it.'],
  SPEAK_7: () => ['Proposals close this week. Submit what you have; a short, specific proposal beats a perfect late one.'],
  DECIDE: (e) => ['Early pricing usually ends soon. Decide whether to go.', e.cheaperWays ? `Cheaper ways in: ${e.cheaperWays}` : 'If the ticket is too much, ask the organizer about volunteer or scholarship passes.'],
  BOOK: (e) => ['Book your ticket now. Early pricing rarely lasts.', 'Book flights and a hotel close to the venue before rooms sell out.', e.cheaperWays ? `Cheaper ways in: ${e.cheaperWays}` : 'Ask your employer or a sponsor about a pass if cost is the hold-up.'],
  NETWORK_PREP: () => ['List ten people you want to meet: speakers, companies you want to work for, people you already know who are going.', 'Send each a short note now. Drafts are ready for you to edit.', 'Book coffee slots for the first two days.'],
  FINAL: () => ['Pick your sessions for each day.', 'Message your top three meetings once more with a time and place.', 'Bring a one-line answer to “what are you looking for next?”'],
}

/** Sends one heads-up and records it so the stage never repeats. Returns false when nothing was sent. */
export async function sendConferenceHeadsUp(
  candidate: { id: string; userId: string; firstName: string | null },
  e: ConferenceRow,
  stage: Stage,
  source: 'interest' | 'match',
  opts: { edition?: string; followUp?: FollowUp } = {},
): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(candidate.userId)
  const to = data.user?.email
  if (!to) return false
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // Record first: a second concurrent run hits the unique key and stops here, so nobody gets two.
  try {
    await prisma.conferenceNudge.create({ data: { candidateId: candidate.id, eventId: e.id, stage, edition: opts.edition ?? '' } })
  } catch {
    return false
  }
  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to,
    subject: STAGE_SUBJECT[stage](e.name),
    react: ConferenceHeadsUpEmail({
      firstName: candidate.firstName,
      headline: STAGE_SUBJECT[stage](e.name),
      eventName: e.name,
      when: whenLabel(e).replace(/^Usually /, 'usually in '),
      where: whereLabel(e),
      cost: costLabel(e),
      steps: STEPS[stage](e, opts.followUp),
      buttons: stage === 'CHECK_IN' && opts.followUp ? [
        { label: 'I went', href: outcomeUrl(appUrl, opts.followUp.interestId, 'ATTENDED') },
        { label: 'I spoke', href: outcomeUrl(appUrl, opts.followUp.interestId, 'SPOKE') },
        { label: 'I did not go', href: outcomeUrl(appUrl, opts.followUp.interestId, 'DID_NOT_GO') },
      ] : undefined,
      eventUrl: e.url!,
      planUrl: `${appUrl}/dashboard/network/events`,
      unsubscribeUrl: candidateUnsubscribeUrl(appUrl, candidate.id, 'weekly'),
    }),
  })
  if (error) {
    await prisma.conferenceNudge.deleteMany({ where: { candidateId: candidate.id, eventId: e.id, stage, edition: opts.edition ?? '' } })
    console.error('Conference heads-up failed', error)
    return false
  }
  captureServerEvent(candidate.id, stage === 'NEXT_EDITION' ? 'conference_next_edition_sent' : 'conference_heads_up_sent', { eventId: e.id, stage, source, edition: opts.edition ?? '', access: e.access, speaking: e.speaking })
  return true
}

/** Sends a sample reminder (made-up event) to one address so the owner can see exactly what members get. Records nothing. */
export async function sendTestHeadsUp(to: string, firstName: string | null, which: 'EXPLORE' | 'CHECK_IN' | 'BOOK'): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) return false
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const e = {
    id: 'sample', name: 'Sample Annual Conference', url: appUrl, startDate: new Date(Date.now() + 200 * 86_400_000), endDate: new Date(Date.now() + 202 * 86_400_000),
    datesConfirmed: true, typicalMonth: null, city: 'Las Vegas', state: 'NV', country: 'US', format: 'IN_PERSON', kind: 'CONFERENCE', access: 'PAID', costLow: 1795, costHigh: 2295,
    costNote: null, cheaperWays: 'Volunteer passes and a $199 expo-only pass.', speaking: 'LIKELY', speakingDeadline: null, speakingUrl: null,
  } as unknown as ConferenceRow
  const resend = createResend(process.env.RESEND_API_KEY)
  const f: FollowUp = { interestId: 'sample', attendedCount: 0, spokeCount: 0, outcome: null }
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    to,
    subject: `[TEST, sample event] ${STAGE_SUBJECT[which](e.name)}`,
    react: ConferenceHeadsUpEmail({
      firstName, headline: STAGE_SUBJECT[which](e.name), eventName: e.name, when: whenLabel(e), where: whereLabel(e), cost: costLabel(e), steps: STEPS[which](e, f),
      eventUrl: appUrl, planUrl: `${appUrl}/dashboard/network/events`, unsubscribeUrl: `${appUrl}/dashboard/privacy`,
      buttons: which === 'CHECK_IN' ? [{ label: 'I went', href: appUrl }, { label: 'I spoke', href: appUrl }, { label: 'I did not go', href: appUrl }] : undefined,
    }),
  })
  return !error
}

/** One email naming up to 3 events added since launch that fit the member. Each event is recorded so it is announced once. */
export async function sendNewEventsDigest(candidate: { id: string; userId: string; firstName: string | null }, matches: EventMatch[]): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || matches.length === 0) return false
  const admin = createAdminClient()
  const { data } = await admin.auth.admin.getUserById(candidate.userId)
  const to = data.user?.email
  if (!to) return false
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  // Record first, one row per event: a concurrent run hits the unique key and stops, so nobody is told twice.
  const recorded: string[] = []
  for (const m of matches) {
    try {
      await prisma.conferenceNudge.create({ data: { candidateId: candidate.id, eventId: m.event.id, stage: 'NEW_EVENT', edition: '' } })
      recorded.push(m.event.id)
    } catch {
      /* already announced to this member */
    }
  }
  const sending = matches.filter((m) => recorded.includes(m.event.id))
  if (sending.length === 0) return false
  const items = sending.map((m) => ({
    name: m.event.name, url: m.event.url!, when: whenLabel(m.event), where: whereLabel(m.event), cost: costLabel(m.event).replace(/\.?$/, '.'),
    speaking: SPEAKING_LABEL[m.event.speaking as Speaking] ?? '', why: m.why,
  }))
  const headline = sending.length === 1 ? STAGE_SUBJECT.NEW_EVENT(sending[0].event.name) : `${sending.length} new conferences for you: ${sending.map((m) => m.event.name).slice(0, 2).join(', ')}${sending.length > 2 ? ' and more' : ''}`
  const resend = createResend(process.env.RESEND_API_KEY)
  const { error } = await resend.emails.send({
    from: 'NextChapter <support@launchyournextchapter.com>',
    replyTo: 'support@launchyournextchapter.com',
    to,
    subject: headline,
    react: ConferenceNewEventsEmail({ firstName: candidate.firstName, headline, events: items, planUrl: `${appUrl}/dashboard/network/events`, unsubscribeUrl: candidateUnsubscribeUrl(appUrl, candidate.id, 'weekly') }),
  })
  if (error) {
    await prisma.conferenceNudge.deleteMany({ where: { candidateId: candidate.id, eventId: { in: recorded }, stage: 'NEW_EVENT' } })
    console.error('New-events email failed', error)
    return false
  }
  captureServerEvent(candidate.id, 'conference_new_events_sent', { eventIds: sending.map((m) => m.event.id), count: sending.length })
  return true
}
