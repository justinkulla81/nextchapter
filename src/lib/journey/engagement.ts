// Getting the most out of NextChapter: what a member hasn't connected or done
// yet, what that would unlock, and what to try next when a search has stalled.
// Pure and client-safe. The plan, the dashboard card and the weekly emails all
// read this, so they say the same thing. Server-side loading is in
// ./engagement-data.ts.
//
// The principle: people who connect their accounts, do the work and prove it
// (references, a finished Dossier, real outreach) get the most from the
// platform. The nudge is never "try harder", it is "here is the next thing
// that opens something new".

import type { CoachingStylePreference } from '@prisma/client'
import { conversationPlanItem } from '@/lib/review-prep/conversation'
import type { JourneyStage, JourneyType } from './journey'
import { getJourney, normalizeJourney } from './journey'

export type EngagementSignals = {
  journey: JourneyType | null
  stage: JourneyStage | null
  tone: CoachingStylePreference | null
  // Looking casually (open to the right thing) rather than actively; and doing
  // fractional, interim or part-time work right now. See ./intensity.ts.
  casual: boolean
  workingNow: boolean
  // Their own answers to the Screening Questions (restrictive covenant, fired
  // for cause, drug test, background check). Used only to sharpen this
  // member's own plan; never shown to anyone else (see affiliations/visibility.ts).
  redFlags: RedFlags
  // Saved career conversations (review, raise, promotion, offer), for the plan.
  conversations: { kind: string; scheduledFor: Date | null; outcome: string }[]
  weeksInStage: number
  gmail: boolean
  calendar: boolean
  linkedin: boolean
  completedReferences: number
  requestedReferences: number
  referencesTarget: number
  openResumeIssues: number
  hasPersonalityProfile: boolean
  skillsAssessmentDone: boolean
  dossierUnlocked: boolean
  // Real results in the current stage window (or all time for the lifetime ones).
  outreach: number
  applications: number
  interviews: number
  offers: number
}

export type RedFlags = { restrictiveCovenant: boolean; firedForCause: boolean; noDrugTest: boolean; noBackgroundCheck: boolean }

export const NO_RED_FLAGS: RedFlags = { restrictiveCovenant: false, firedForCause: false, noDrugTest: false, noBackgroundCheck: false }

export type Step = { key: string; label: string; why: string; unlocks: string; href: string }

export type ConnectKind = 'gmail' | 'linkedin'

// Why connecting is worth it, in terms of what this person is doing.
export function connectReason(journey: JourneyType | null, kind: ConnectKind): string {
  const j = journey ? normalizeJourney(journey) : null
  if (kind === 'gmail') {
    switch (j) {
      case 'GROWING':
      case 'PROMOTION':
        return 'Connect Gmail and we log your conversations with managers, sponsors and mentors for you, so you can see who you have followed up with.'
      case 'EXPLORING_MOVE':
        return 'Connect Gmail and we track your quiet conversations for you, and never contact anyone on your behalf.'
      case 'STUDENT_NEW_GRAD':
        return 'Connect Gmail and we keep track of every alum, recruiter and employer you talk to, so nothing slips.'
      case 'NEXT_ACT':
        return 'Connect Gmail and we track your conversations about board, advisory and fractional work.'
      default:
        return 'Connect Gmail and we track your outreach and applications automatically, so your progress counts without logging it by hand.'
    }
  }
  switch (j) {
    case 'GROWING':
    case 'PROMOTION':
      return 'Connect LinkedIn so we can find sponsors, peers and people who have made the next move, and help you build visibility at your own pace.'
    case 'EXPLORING_MOVE':
      return 'Connect LinkedIn privately and we find the right people at your target companies. Nothing shows on your profile.'
    case 'CAREER_CHANGE':
      return 'Connect LinkedIn and we find people already working in the field you want to move into.'
    default:
      return 'Connect LinkedIn and we analyze your network for the right people to reach out to first.'
  }
}

// The unlock steps this person has not done, most valuable first. A step the
// member has done does not appear. Order: connect, then prove, then deepen.
export function unlockSteps(s: EngagementSignals): Step[] {
  const j = s.journey
  const out: Step[] = []
  if (!s.gmail) {
    out.push({
      key: 'gmail',
      label: 'Connect Gmail',
      why: connectReason(j, 'gmail'),
      unlocks: 'Network, Jobs and Interim Work, and your activity counted automatically',
      href: '/dashboard/privacy',
    })
  }
  if (!s.linkedin) {
    out.push({
      key: 'linkedin',
      label: 'Connect LinkedIn',
      why: connectReason(j, 'linkedin'),
      unlocks: 'Warm introductions and your Marketing Plan',
      href: '/dashboard/profile',
    })
  }
  if (s.requestedReferences < s.referencesTarget) {
    out.push({
      key: 'references',
      label: `Ask ${s.referencesTarget - s.requestedReferences} more ${s.referencesTarget - s.requestedReferences === 1 ? 'person' : 'people'} for a reference`,
      why: 'A reference from someone who has worked with you says what a résumé cannot, and it is the strongest proof in your Dossier.',
      unlocks: 'Your Executive Dossier, A-List jobs and recruiter visibility',
      href: '/dashboard/references',
    })
  } else if (s.completedReferences < s.referencesTarget) {
    out.push({
      key: 'references-follow-up',
      label: 'Follow up on your open reference requests',
      why: `${s.completedReferences} of ${s.referencesTarget} are completed. A short personal note usually gets them back.`,
      unlocks: 'Your Executive Dossier, A-List jobs and recruiter visibility',
      href: '/dashboard/references',
    })
  }
  if (s.openResumeIssues > 0) {
    out.push({
      key: 'resume',
      label: `Fix ${s.openResumeIssues} thing${s.openResumeIssues === 1 ? '' : 's'} on your résumé`,
      why: 'These are what a recruiter or an applicant tracking system trips on first.',
      unlocks: 'A stronger Market Reality grade',
      href: '/dashboard/resume/walkthrough',
    })
  }
  if (!s.hasPersonalityProfile) {
    out.push({
      key: 'personality',
      label: 'Finish your Personality Profile',
      why: 'It adds how you work to your Dossier, which is what makes it different from a résumé.',
      unlocks: 'A fuller Dossier and better matches',
      href: '/dashboard/how-i-perform',
    })
  }
  if (!s.skillsAssessmentDone) {
    out.push({
      key: 'skills',
      label: 'Take the Skills Assessment',
      why: 'It shows the skills you have and the ones worth building.',
      unlocks: 'Learning and Videos, and better job matches',
      href: '/dashboard/skills-assessments',
    })
  }
  return out
}

// How much of the platform this person is using: connected, proving it, and
// doing real work. Drives whether the weekly email leads with "unlock more".
export type EngagementLevel = 'NOT_CONNECTED' | 'CONNECTED_NOT_PROVEN' | 'PROVING'

export function engagementLevel(s: EngagementSignals): EngagementLevel {
  if (!s.gmail && !s.linkedin) return 'NOT_CONNECTED'
  if (!s.dossierUnlocked) return 'CONNECTED_NOT_PROVEN'
  return 'PROVING'
}

// What the results say about a search, not just how long it has run.
export type SearchPattern = 'NOT_STARTED' | 'APPLYING_NO_INTERVIEWS' | 'INTERVIEWS_NO_OFFERS' | 'MOVING'

export function searchPattern(s: EngagementSignals): SearchPattern | null {
  if (!s.stage || (s.stage !== 'APPLYING' && s.stage !== 'INTERVIEWING')) return null
  if (s.offers > 0) return 'MOVING'
  if (s.interviews > 0) return 'INTERVIEWS_NO_OFFERS'
  if (s.applications + s.outreach === 0) return 'NOT_STARTED'
  return 'APPLYING_NO_INTERVIEWS'
}

export type GateMove = { headline: string; body: string; cta: string; href: string; items: { text: string; actionType?: string }[] }

const MIN_WEEKS_FOR_GATE = 3

// True when more applications is the advice that has stopped working: the gate
// is open and applications are not turning into interviews or offers.
export function stallsOnApplications(s: EngagementSignals): boolean {
  const move = gateMove(s)
  const pattern = searchPattern(s)
  return !!move && (pattern === 'APPLYING_NO_INTERVIEWS' || pattern === 'INTERVIEWS_NO_OFFERS')
}

// When a search has run a while without the result it should have, the next
// move changes with what is actually happening. Different things to try, by
// pattern and how long it has run, never the same advice again.
function gateMoveFor(s: EngagementSignals): GateMove | null {
  const pattern = searchPattern(s)
  if (!pattern || pattern === 'MOVING') return null
  // A casual search runs at half the pace: the gates open twice as late, and a
  // search that has not "started" is not a problem for someone who is open, not pushing.
  const w = s.casual ? Math.floor(s.weeksInStage / 2) : s.weeksInStage
  if (pattern === 'NOT_STARTED') {
    if (s.casual || w < 1) return null
    return {
      headline: 'Your search has not started yet',
      body: 'Nothing is logged: no applications and no conversations. The first five reach-outs matter more than the next five hours of reading.',
      cta: 'Send your first five messages',
      href: '/dashboard/network',
      items: [{ text: 'Send your first five messages to people who could help', actionType: 'OUTREACH_MESSAGE' }],
    }
  }
  if (w < MIN_WEEKS_FOR_GATE) return null
  if (pattern === 'APPLYING_NO_INTERVIEWS') {
    if (w >= 9) {
      return {
        headline: `${w} weeks in, applications but no interviews`,
        body: 'More of the same will not change this. Get a coach to look at what is not working, and ask someone who hires for your kind of role to critique your pitch.',
        cta: 'Find a coach',
        href: '/dashboard/premium',
        items: [
          { text: 'Book a coaching session to review what is not working' },
          { text: 'Ask one person who hires for your kind of role to critique your pitch', actionType: 'OUTREACH_CALL' },
        ],
      }
    }
    if (w >= 6) {
      return {
        headline: `${w} weeks in, applications but no interviews`,
        body: 'The targets may be too narrow, or the income gap may be better bridged while you search. Widen the roles you go for and look at interim work.',
        cta: 'Look at interim work',
        href: '/dashboard/interim-work',
        items: [
          { text: 'Widen your targets: add a second role title or industry' },
          { text: 'Look at interim or fractional work while you search', actionType: 'INTERIM_PROFILE_CREATED' },
        ],
      }
    }
    return {
      headline: `${w} weeks in, applications but no interviews`,
      body: 'When applications do not turn into interviews, the résumé is the first place to look. Run the Résumé Fixer against the roles you want.',
      cta: 'Run the Résumé Fixer',
      href: '/dashboard/resume/walkthrough',
      items: [
        { text: 'Run the Résumé Fixer against the roles you want', actionType: 'RESUME_UPDATE' },
        { text: 'Ask two people you trust what is unclear in your résumé' },
      ],
    }
  }
  // INTERVIEWS_NO_OFFERS
  return {
    headline: `${w} weeks in, interviews but no offers`,
    body: 'Getting in the room is working. Now it is about how you close: practice the hard questions, get strong references ready, and ask for feedback after each one.',
    cta: 'Practice interview answers',
    href: '/dashboard/interview-prep',
    items: [
      { text: 'Do a mock interview', actionType: 'INTERVIEW_PREP' },
      { text: 'Practice answers to 3 behavioral questions', actionType: 'INTERVIEW_BEHAVIORAL_PRACTICE' },
      { text: 'Ask for feedback after your last interview', actionType: 'FOLLOW_UP_NOTE_SENT' },
    ],
  }
}

export function gateMove(s: EngagementSignals): GateMove | null {
  const move = gateMoveFor(s)
  if (!move || !s.casual) return move
  // The headline shows the real weeks, not the halved count the gate used.
  return { ...move, headline: move.headline.replace(/^\d+ weeks/, `${s.weeksInStage} weeks`), body: `${move.body} You are looking casually, so make one change, not a full push.` }
}

// The tone preference decides how the same fact is said, never what is said.
export type ToneKind = 'unlock' | 'stalled'

export function toneLine(tone: CoachingStylePreference | null, kind: ToneKind): string {
  if (kind === 'unlock') {
    if (tone === 'TOUGH_LOVE') return 'You are getting a fraction of what NextChapter can do. The members who connect, get references and finish their Dossier get the most. Do the work.'
    if (tone === 'GENTLE_ENCOURAGEMENT') return 'There is more here waiting for you, and each step is small. Members who connect their accounts and build their proof get the most from NextChapter.'
    return 'The members who connect their accounts, get references and finish their Dossier get the most from NextChapter. Here is the next step.'
  }
  if (tone === 'TOUGH_LOVE') return 'What you are doing is not working. Change it.'
  if (tone === 'GENTLE_ENCOURAGEMENT') return 'This happens to a lot of people, and it usually means one thing needs to change, not everything.'
  return 'A stalled search usually means one thing needs to change. Here is what to try next.'
}

export type EngagementLead = {
  level: EngagementLevel
  line: string
  steps: Step[] // at most three
  gate: GateMove | null
}

// The one block the weekly emails and the dashboard card share. Null when the
// member is connected, proving it and not stuck: nothing to say.
export function engagementLead(s: EngagementSignals): EngagementLead | null {
  const level = engagementLevel(s)
  const steps = unlockSteps(s).slice(0, 3)
  const gate = gateMove(s)
  if (steps.length === 0 && !gate) return null
  const line = gate && level === 'PROVING' ? toneLine(s.tone, 'stalled') : toneLine(s.tone, 'unlock')
  return { level, line, steps, gate }
}

// Things to get ahead of before they surprise an employer, from the member's
// own screening answers. Plain guidance for them alone: these are private, and
// none of it is legal advice. Only while looking, since that is when it bites.
export function redFlagGuidance(s: EngagementSignals): { text: string; actionType?: string }[] {
  const looking = s.stage === 'PREPARING' || s.stage === 'APPLYING' || s.stage === 'INTERVIEWING' || s.stage === 'OFFER'
  if (!looking) return []
  const out: { text: string; actionType?: string }[] = []
  if (s.redFlags.restrictiveCovenant) {
    out.push({ text: 'Read your non-compete or non-solicit before you apply or accept an offer, and have an employment lawyer check what it covers if you are unsure' })
  }
  if (s.redFlags.firedForCause) {
    out.push({ text: 'Prepare a short, honest answer about why you left your last role, and practice saying it calmly', actionType: 'INTERVIEW_PREP' })
  }
  if (s.redFlags.noBackgroundCheck) {
    out.push({ text: 'Find out which roles you are targeting require a background check, and know what yours would show before an employer does' })
  }
  if (s.redFlags.noDrugTest) {
    out.push({ text: 'Check whether the roles you are targeting require a drug test, so you can decide now which ones fit' })
  }
  return out
}

// Plan items for the weekly plan: the gate's new moves, then the top unlock step.
export function engagementPlanItems(s: EngagementSignals): { text: string; actionType?: string }[] {
  const items: { text: string; actionType?: string }[] = []
  const gate = gateMove(s)
  if (gate) items.push(...gate.items)
  for (const step of unlockSteps(s).slice(0, 2)) items.push({ text: step.label })
  items.push(...redFlagGuidance(s))
  const convo = conversationPlanItem(s.conversations)
  if (convo) items.unshift(convo)
  return items
}

export function isSearching(journey: JourneyType | null): boolean {
  return journey ? getJourney(journey).searching : true
}
