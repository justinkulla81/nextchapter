import type { CurrentJobStatus } from '@prisma/client'

// Where each guide lives now that guides are no longer a standalone
// dashboard hub — every guide's card renders at the bottom of the one
// dashboard page most relevant to its content. The Learning page is the
// exception: it shows every situation-relevant guide (see
// getRelevantGuides below), acting as the de facto "browse all" surface
// that /dashboard/guides used to be.
export type GuidePageSlot = 'dashboard' | 'network' | 'interview-prep' | 'marketing-plan' | 'benefits' | 'find-my-job'

export interface Guide {
  slug: string
  title: string
  description: string
  pageSlot: GuidePageSlot
  // Which CurrentJobStatus values this guide's content actually applies to.
  // Omitted entirely = relevant to everyone (the guide's advice doesn't
  // depend on how the candidate got here). All guides are always unlocked;
  // this only controls whether a guide is worth showing to THIS candidate.
  situations?: CurrentJobStatus[]
}

export const GUIDES: Guide[] = [
  {
    slug: 'unemployed',
    title: "You're unemployed now. What actually works.",
    description: 'Evidence-based guidance for experienced professionals — week one through month three.',
    pageSlot: 'dashboard',
    // Written for someone whose default state right now is "out of work" —
    // not a fit for someone still employed, returning from leave (different
    // framing/narrative), or a first-time job seeker (guide assumes prior
    // experience).
    situations: ['LAID_OFF', 'RESIGNED', 'CAREER_PIVOT', 'RELOCATED_FOR_FAMILY'],
  },
  {
    slug: '72-hours',
    title: 'You just got here. Start here.',
    description: 'The first 72 hours after a layoff — what to do, in order.',
    pageSlot: 'dashboard',
    situations: ['LAID_OFF'],
  },
  {
    slug: 'pre-exit',
    title: 'Before you go.',
    description: "What to handle in your last days at a job — records, contacts, and paperwork you'll want later.",
    pageSlot: 'dashboard',
    // Only useful before departure — once someone has already left, this is
    // moot.
    situations: ['EMPLOYED_CONSIDERING_MOVE'],
  },
  {
    slug: 'cobra-aca',
    title: 'COBRA & marketplace coverage.',
    description: 'How to keep or replace your health insurance after leaving a job.',
    pageSlot: 'benefits',
    situations: ['LAID_OFF', 'RESIGNED', 'CAREGIVER_LEAVE_SABBATICAL', 'RELOCATED_FOR_FAMILY', 'CAREER_PIVOT'],
  },
  {
    slug: 'bridge-income',
    title: 'Bridge income options.',
    description: 'Ways to bring in income while you search, without derailing it.',
    pageSlot: 'benefits',
    // Everyone actively searching without a paycheck already coming in.
    situations: [
      'LAID_OFF',
      'RESIGNED',
      'CAREGIVER_LEAVE_SABBATICAL',
      'CAREER_PIVOT',
      'RELOCATED_FOR_FAMILY',
      'NEW_GRADUATE_FIRST_JOB',
    ],
  },
  {
    slug: 'gatekeeper',
    title: 'Getting through the gatekeeper.',
    description: 'How recruiters, HR screens, and hiring managers actually work — and how to get from inbox to interview.',
    pageSlot: 'find-my-job',
  },
  {
    slug: 'offer-letter',
    title: 'You have an offer. Now read it correctly.',
    description: 'Total comp breakdown, negotiation scripts, and red flags to catch.',
    pageSlot: 'find-my-job',
  },
  {
    slug: 'narrative-workshop',
    title: 'Build your core story.',
    description: 'A workshop for building the story you tell about your career — for resumes, interviews, and networking.',
    pageSlot: 'interview-prep',
  },
  {
    slug: 'network-activation',
    title: 'Activate your network.',
    description: 'How to turn your existing contacts into real conversations.',
    pageSlot: 'network',
  },
  {
    slug: 'ask-for-help',
    title: 'Before you start outreach, read this.',
    description: 'Why asking for help works, and how to do it without it feeling awkward.',
    pageSlot: 'network',
  },
  {
    slug: 'network-scripts',
    title: 'The networking script book.',
    description: 'Scripts for every kind of outreach — cold, warm, and everything between.',
    pageSlot: 'network',
  },
  {
    slug: 'interview-prep',
    title: 'Interview prep guide.',
    description: 'How to prepare for interviews at every stage, from phone screen to final round.',
    pageSlot: 'interview-prep',
  },
  {
    slug: 'post-interview',
    title: "You have an interview. Here's how to follow up.",
    description: 'What to do in the 24-48 hours after an interview.',
    pageSlot: 'interview-prep',
  },
  {
    slug: 'thought-leadership',
    title: 'Build a public presence.',
    description: 'How to write and share thought leadership content that gets noticed.',
    pageSlot: 'marketing-plan',
  },
  {
    slug: 'first-90-days',
    title: 'Your first 90 days.',
    description: 'How to start strong in a new role.',
    pageSlot: 'dashboard',
  },
]

function isRelevant(guide: Guide, currentJobStatus: CurrentJobStatus | null): boolean {
  return !guide.situations || currentJobStatus === null || guide.situations.includes(currentJobStatus)
}

// The 1-3 guides that belong at the bottom of one specific dashboard page,
// filtered to what's actually relevant to this candidate's situation.
export function getGuidesForSlot(pageSlot: GuidePageSlot, currentJobStatus: CurrentJobStatus | null): Guide[] {
  return GUIDES.filter((g) => g.pageSlot === pageSlot && isRelevant(g, currentJobStatus))
}

// The full situation-filtered guide library — used once, at the bottom of
// the Learning page, as the "browse everything relevant to you" surface.
export function getRelevantGuides(currentJobStatus: CurrentJobStatus | null): Guide[] {
  return GUIDES.filter((g) => isRelevant(g, currentJobStatus))
}
