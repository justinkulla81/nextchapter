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
import { culturePlanItems, type CultureFit } from '@/lib/culture/culture-fit'
import type { SpineGap } from '@/lib/personalization/spine'
import type { JourneyStage, JourneyType } from './journey'
import { getJourney, normalizeJourney } from './journey'
import { pivotPlanItems, type PivotDetails } from './pivot'
import { careerPlanItems, type CareerDetails } from './career'
import type { Relocation } from './relocation'
import { situationPlanItems } from './situation'
import { parallelPlanItems } from './paths'
import { reaskPlanItems } from './stalled-reask'
import { startPlanItems } from './start-business'
import { gradPlanItems } from '@/lib/early-career/graduation-plan'
import { deriveLearningPaths, pathPlanItems, pathProgressOf } from './learning-paths'

export type EngagementSignals = {
  journey: JourneyType | null
  stage: JourneyStage | null
  tone: CoachingStylePreference | null
  // Looking casually (open to the right thing) rather than actively; and doing
  // fractional, interim or part-time work right now. See ./intensity.ts.
  casual: boolean
  workingNow: boolean
  // The kinds of side work they said they do (the ParallelPath answer): contract, fractional, part-time, and so on. Optional.
  parallelKinds?: string[] | null
  // profile.interimConsultingInterest: open to interim or consulting work.
  interimInterest?: boolean
  // What they told us about where they are willing to go, what they want next and what they said they did before joining.
  // Optional so older callers need not set them.
  pivot?: PivotDetails | null
  career?: CareerDetails | null
  skillsToBuild?: string[]
  targets?: { roleType: string | null; function: string | null; industries: string[]; compFloor: number | null; relocation: Relocation; applicationGoal: number | null; outreachGoal: number | null; followUp?: boolean | null }
  venture?: string | null
  graduation?: Date | null
  priorActivity?: boolean
  from?: string | null
  ownedFunctions?: string[]
  boardInterest?: boolean
  seniorLevel?: boolean
  // journeyDetails as stored: situation facts the plan reads (src/lib/journey/situation.ts).
  rawDetails?: unknown
  // Their own answers to the Screening Questions (restrictive covenant, fired
  // for cause, drug test, background check). Used only to sharpen this
  // member's own plan; never shown to anyone else (see affiliations/visibility.ts).
  redFlags: RedFlags
  // Said AI had a part in losing or putting at risk their last role ("yes" or "partly"). Optional, so older callers need not set it.
  aiJobLoss?: boolean
  // Company culture and working environment, only if it matters to them.
  culture: CultureFit | null
  // From journeyDetails: a return date (taking a break), and a fractional member's offer, open days and when the current engagement ends.
  details: { returnDate: Date | null; offering: string | null; openDays: number | null; engagementEnds: Date | null }
  // What the personalization spine still needs from this member (src/lib/personalization/spine.ts), most useful first.
  spineGaps: SpineGap[]
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

export type RedFlags = { covenantDetails?: string | null; restrictiveCovenant: boolean; firedForCause: boolean; noDrugTest: boolean; noBackgroundCheck: boolean }

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
  // Personalization comes first: it is what the plan, learning, networking and
  // opportunities are built from. One question at a time, never a form.
  for (const g of s.spineGaps.slice(0, 1)) {
    out.push({ key: `spine-${g.key}`, label: g.label, why: `${g.why}`, unlocks: g.unlocks, href: g.href })
  }
  // On a break, or building something of their own: personalization and check-ins
  // only. No pushing to connect accounts or collect references.
  if (j === 'TIME_OFF' || j === 'ENTREPRENEUR' || j === 'BUY_BUSINESS') return out
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
      unlocks: 'Your Executive Dossier and recruiter visibility',
      href: '/dashboard/references',
    })
  } else if (s.completedReferences < s.referencesTarget) {
    out.push({
      key: 'references-follow-up',
      label: 'Follow up on your open reference requests',
      why: `${s.completedReferences} of ${s.referencesTarget} are completed. A short personal note usually gets them back.`,
      unlocks: 'Your Executive Dossier and recruiter visibility',
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
    // Someone who said they had applied before joining has started, off this platform.
    if (s.casual || w < 1 || s.priorActivity) return null
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
    const what = s.redFlags.covenantDetails?.trim()
    out.push({ text: `Read your non-compete or non-solicit${what ? ` (${what.slice(0, 120)})` : ''} before you apply or accept an offer, and have an employment lawyer check what it covers if you are unsure` })
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

// Someone whose role was hit by AI gets a step aimed at it: which roles hold up
// and which skills they ask for. Only while planning or in a search.
export function aiOutlookItems(s: EngagementSignals): { text: string; actionType?: string }[] {
  if (!s.aiJobLoss) return []
  const planning = s.stage === 'EXPLORING' || s.stage === 'PREPARING' || s.stage === 'APPLYING' || s.stage === 'INTERVIEWING'
  if (!planning) return []
  return [{ text: 'See which roles hold up against AI, and add one skill they ask for', actionType: 'LEARNING_MODULE' }]
}

const DAY_MS = 86_400_000

// Steps that come from what the member told us about their situation: how close
// the return is on a break, and how full the pipeline is for fractional work.
export function journeyDetailItems(s: EngagementSignals, now: Date = new Date()): { text: string; actionType?: string }[] {
  const out: { text: string; actionType?: string }[] = []
  if (s.journey === 'TIME_OFF' && s.details.returnDate) {
    const days = Math.ceil((s.details.returnDate.getTime() - now.getTime()) / DAY_MS)
    if (days > 0 && days <= 42) {
      out.push({ text: `Your return is in ${days <= 7 ? 'about a week' : `${Math.round(days / 7)} weeks`}: decide what you want your first month back to look like` })
    }
  }
  if (s.journey === 'FRACTIONAL') {
    if (s.details.engagementEnds) {
      const days = Math.ceil((s.details.engagementEnds.getTime() - now.getTime()) / DAY_MS)
      if (days >= 0 && days <= 45) {
        out.push({ text: `Your current engagement ends in ${days} days: start the renewal or replacement conversation now`, actionType: 'OUTREACH_CALL' })
      }
    }
    if (s.details.openDays && s.details.openDays > 0) {
      out.push({ text: `You have ${s.details.openDays} open ${s.details.openDays === 1 ? 'day' : 'days'} a week: have a conversation with someone who could use them`, actionType: 'OUTREACH_CALL' })
    }
    if (s.details.offering) {
      out.push({ text: `Use your one-line offer in a post or a message this week: "${s.details.offering}"`, actionType: 'LINKEDIN_POST_IDEA' })
    }
  }
  return out
}

const DAYS = 86_400_000

// Steps that come from what the member told us: where they are willing to go, which fields they are
// open to (with the commitment they made), what they want from their career, their own targets and
// what they are building. This is what makes two people on the same journey get different plans.
export function profileDrivenItems(s: EngagementSignals, now: Date = new Date()): { text: string; actionType?: string }[] {
  const out: { text: string; actionType?: string }[] = []
  const searching = !!s.journey && getJourney(s.journey).searching && s.stage !== 'STAYING' && s.stage !== 'LANDED'
  // Other fields they are open to, and the learning they committed to.
  if (searching) out.push(...pivotPlanItems(s.pivot ?? null, now))
  // Learning paths, each tied to a goal they told us about or one we can infer from it.
  out.push(
    ...pathPlanItems(
      deriveLearningPaths({
        from: s.from ?? null,
        pivot: searching ? (s.pivot ?? null) : null,
        career: s.journey === 'GROWING' || s.journey === 'PROMOTION' ? (s.career ?? null) : null,
        skillsToBuild: s.skillsToBuild ?? [],
        aiJobLoss: !!s.aiJobLoss,
        boardInterest: !!s.boardInterest,
        seniorLevel: s.seniorLevel,
        ownedFunctions: s.ownedFunctions,
      }),
      pathProgressOf(s.rawDetails),
    ),
  )
  // Review, next level, pay and skills for people managing their career or going for a promotion.
  if (s.journey === 'GROWING' || s.journey === 'PROMOTION') out.push(...careerPlanItems(s.career ?? null, s.skillsToBuild ?? [], now))
  const t = s.targets
  const active = s.stage === 'PREPARING' || s.stage === 'APPLYING' || s.stage === 'INTERVIEWING'
  if (searching && t && active && !s.casual) {
    if (t.industries.length > 0 && (s.stage === 'PREPARING' || s.weeksInStage < 2)) {
      out.push({ text: `List 10 companies in ${t.industries.slice(0, 2).join(' or ')} that hire for ${t.function ?? 'your function'}`, actionType: 'WATCHLIST_ADD' })
    }
    if (t.compFloor && s.stage === 'PREPARING') out.push({ text: `Check that your $${Math.round(t.compFloor / 1000)}k floor fits what ${t.function ?? 'your'} roles pay where you will search` })
    if (s.stage === 'APPLYING' && t.applicationGoal) out.push({ text: `Apply to ${t.applicationGoal} roles that fit this week`, actionType: 'JOB_APPLICATION_SUBMITTED' })
    if ((s.stage === 'APPLYING' || s.stage === 'INTERVIEWING') && t.followUp === true) out.push({ text: 'Follow up on applications you sent one to two weeks ago', actionType: 'FOLLOW_UP_NOTE_SENT' })
    if (s.stage === 'APPLYING' && t.outreachGoal) out.push({ text: `Send ${t.outreachGoal} outreach messages this week`, actionType: 'OUTREACH_MESSAGE' })
    // A search that has run a while widens by the places they said they would go.
    if (s.stage === 'APPLYING' && s.weeksInStage >= 6) {
      const r = t.relocation
      if (r.scope === 'STATES' && r.states?.length) out.push({ text: `Search roles in ${r.states.join(', ')}: you said you would move there` })
      else if (r.scope === 'RADIUS') out.push({ text: `Widen your search to about ${r.radiusMiles ?? 50} miles` })
      else if (r.scope === 'ANYWHERE') out.push({ text: 'Look outside your area: you said you would go anywhere for the right role' })
    }
  }
  out.push(...situationPlanItems(s.journey, s.rawDetails, { fn: s.targets?.function ?? null, now, kinds: s.parallelKinds, senior: s.seniorLevel }))
  // What they said they want to change when asked about a stalled search: one matching step for four weeks.
  out.push(...reaskPlanItems(s.rawDetails, now))
  // What runs next to the main journey: at most one step per active path (researching or doing it; curious adds nothing).
  out.push(...parallelPlanItems({ main: s.journey, journeyDetails: s.rawDetails, kinds: s.parallelKinds, workingNow: s.workingNow, interimInterest: s.interimInterest }))
  // Building something of their own: the steps for the stage they are on (idea, validate, build, launch, grow).
  if (s.journey === 'ENTREPRENEUR') out.push(...startPlanItems(s.rawDetails, s.weeksInStage + 1))
  if (s.journey === 'ENTREPRENEUR' && s.venture) out.push({ text: `Venture check-in: ${s.venture}. Name the one thing that must happen this month` })
  // A student or new grad: this week's positioning, school-network and proof steps for how close graduation is.
  if (s.journey === 'STUDENT_NEW_GRAD') out.push(...gradPlanItems(s.graduation ?? null, s.weeksInStage + 1, now))
  if (s.journey === 'STUDENT_NEW_GRAD' && s.graduation) {
    const days = Math.ceil((s.graduation.getTime() - now.getTime()) / DAYS)
    if (days > 0 && days <= 150) out.push({ text: `You graduate in ${days <= 14 ? 'about two weeks' : `${Math.round(days / 7)} weeks`}: line up conversations now so offers arrive near graduation` })
  }
  return out
}

// Plan items for the weekly plan: the gate's new moves, then the top unlock step.
export function engagementPlanItems(s: EngagementSignals): { text: string; actionType?: string }[] {
  const items: { text: string; actionType?: string }[] = []
  const gate = gateMove(s)
  if (gate) items.push(...gate.items)
  for (const step of unlockSteps(s).slice(0, 2)) items.push({ text: step.key.startsWith('spine-') ? `Answer one question that sharpens your plan: ${step.label}` : step.label })
  items.push(...redFlagGuidance(s))
  items.push(...aiOutlookItems(s))
  items.push(...culturePlanItems(s.culture, s.stage))
  items.push(...journeyDetailItems(s))
  items.push(...profileDrivenItems(s))
  const convo = conversationPlanItem(s.conversations)
  if (convo) items.unshift(convo)
  return items
}

export function isSearching(journey: JourneyType | null): boolean {
  return journey ? getJourney(journey).searching : true
}
