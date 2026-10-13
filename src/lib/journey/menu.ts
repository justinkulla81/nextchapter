// The candidate menu follows the member's situation. Every item belongs to a
// pillar (the things a person actually does in a search) and, for each stage
// of the journey, is shown, locked or hidden:
//
//   show    the tool helps right now
//   locked  the tool turns on when the member's situation changes (for example,
//           job-search tools when they start applying). It stays visible, muted,
//           with the reason and a way to update their status, so they know it
//           exists and why it is off
//   hide    the tool will not matter to anyone in this situation or the next one
//
// Pure and client-safe: the sidebar, the status explainer and the tests read it.

import type { CheckInAnswer, JourneyStage, JourneyType } from './journey'
import { normalizeJourney } from './journey'

export type MenuMode = 'EXPLORING' | 'PREPARING' | 'ACTIVE' | 'STAYING' | 'LANDED'

// Where in the search someone is, as far as the menu cares. No stage yet (a
// member from before journeys) sees everything, as an active search does.
export function menuMode(stage: JourneyStage | null, journey: JourneyType | null = null): MenuMode {
  // Going for a promotion before applying elsewhere is about the job they have.
  if (journey && normalizeJourney(journey) === 'PROMOTION' && (stage === 'EXPLORING' || stage === 'PREPARING')) return 'STAYING'
  switch (stage) {
    case 'EXPLORING':
      return 'EXPLORING'
    case 'PREPARING':
      return 'PREPARING'
    case 'STAYING':
    case 'PAUSED': // legacy value: managing your career
      return 'STAYING'
    case 'LANDED':
      return 'LANDED'
    default:
      return 'ACTIVE' // APPLYING, INTERVIEWING, OFFER, or none yet
  }
}

// What a search is made of. Personalize, prove it, search and apply, network,
// learn, coach and work now are the things a person does; support and settings
// are always there. "grow" and "career" replace most of them for people who
// are staying in a job or have just landed one.
export type Pillar = 'grow' | 'career' | 'plan' | 'prove' | 'search' | 'network' | 'learn' | 'coach' | 'work' | 'support'

export const PILLAR_TITLES: Record<Pillar, string> = {
  grow: 'Grow in your job',
  career: 'Manage your career',
  plan: 'Personalize',
  prove: 'Prove it',
  search: 'Search and apply',
  network: 'Network',
  learn: 'Learn',
  coach: 'Coaching',
  work: 'Work now',
  support: 'Support and settings',
}

export const PILLAR_ORDER: Record<MenuMode, Pillar[]> = {
  EXPLORING: ['plan', 'prove', 'network', 'learn', 'coach', 'search', 'work', 'support'],
  PREPARING: ['plan', 'prove', 'search', 'network', 'learn', 'coach', 'work', 'support'],
  ACTIVE: ['plan', 'prove', 'search', 'network', 'learn', 'coach', 'work', 'support'],
  STAYING: ['grow', 'plan', 'prove', 'network', 'learn', 'coach', 'search', 'support'],
  LANDED: ['career', 'prove', 'network', 'learn', 'coach', 'plan', 'support'],
}

export type Visibility = 'show' | 'locked' | 'hide'

export type MenuItemKey =
  | 'strategy' | 'profile' | 'assessments' | 'marketReality'
  | 'references' | 'portfolio' | 'marketing'
  | 'jobs' | 'companies' | 'interviewPrep' | 'offer' | 'marketIntel'
  | 'network' | 'contacts' | 'community' | 'inbox' | 'recruiter' | 'universities' | 'collegeBenefits'
  | 'learning' | 'webinars'
  | 'coach'
  | 'interim' | 'eqoveriq'
  | 'stats' | 'benefits' | 'struggling' | 'membership' | 'help' | 'privacy' | 'faq'
  | 'growWorth' | 'growResults' | 'growSkills' | 'growConversation' | 'growStyle'
  | 'careerFirst90' | 'careerWorth' | 'careerNetwork'

type Rule = { pillar: Pillar; modes?: Partial<Record<MenuMode, Visibility>>; pillarIn?: Partial<Record<MenuMode, Pillar>> }

const L = 'locked' as const
const H = 'hide' as const

// The job-search tools turn on once someone is applying; until then they show
// as locked (exploring, preparing, staying) so people know what is waiting.
const SEARCH_TOOLS: Partial<Record<MenuMode, Visibility>> = { EXPLORING: L, STAYING: L, LANDED: H }

export const MENU_RULES: Record<MenuItemKey, Rule> = {
  // Personalize
  strategy: { pillar: 'plan' },
  profile: { pillar: 'plan' },
  assessments: { pillar: 'plan' },
  marketReality: { pillar: 'plan' },
  // Prove it
  references: { pillar: 'prove' },
  portfolio: { pillar: 'prove' },
  marketing: { pillar: 'prove' },
  // Search and apply
  jobs: { pillar: 'search', modes: SEARCH_TOOLS },
  companies: { pillar: 'search', pillarIn: { LANDED: 'career' } },
  interviewPrep: { pillar: 'search', modes: { EXPLORING: L, STAYING: L, LANDED: H } },
  offer: { pillar: 'search', modes: { EXPLORING: L, PREPARING: L, STAYING: L }, pillarIn: { LANDED: 'career' } },
  marketIntel: { pillar: 'search', pillarIn: { LANDED: 'career' } },
  // Network
  network: { pillar: 'network' },
  contacts: { pillar: 'network' },
  community: { pillar: 'network' },
  inbox: { pillar: 'network' },
  recruiter: { pillar: 'network', modes: { EXPLORING: L, STAYING: H, LANDED: H } },
  universities: { pillar: 'network' },
  collegeBenefits: { pillar: 'network', modes: { LANDED: H } },
  // Learn
  learning: { pillar: 'learn' },
  webinars: { pillar: 'learn' },
  // Coaching
  coach: { pillar: 'coach' },
  // Work now
  interim: { pillar: 'work', modes: { STAYING: H, LANDED: H } },
  eqoveriq: { pillar: 'work', modes: { STAYING: H, LANDED: H } },
  // Support and settings
  stats: { pillar: 'support' },
  benefits: { pillar: 'support', modes: { STAYING: H, LANDED: H } },
  struggling: { pillar: 'support' },
  membership: { pillar: 'support' },
  help: { pillar: 'support' },
  privacy: { pillar: 'support' },
  faq: { pillar: 'support' },
  // Grow in your job (staying in a job, going for a promotion)
  growWorth: { pillar: 'grow' },
  growResults: { pillar: 'grow' },
  growSkills: { pillar: 'grow' },
  growConversation: { pillar: 'grow' },
  growStyle: { pillar: 'grow' },
  // Manage your career (just landed)
  careerFirst90: { pillar: 'career' },
  careerWorth: { pillar: 'career' },
  careerNetwork: { pillar: 'career' },
}

// The pillar sections that only make sense in certain modes.
const MODE_ONLY: Partial<Record<Pillar, MenuMode[]>> = { grow: ['STAYING'], career: ['LANDED'] }

// Where an item sits in a given situation (a few move once someone has landed).
export function itemPillar(key: MenuItemKey, mode: MenuMode): Pillar {
  const rule = MENU_RULES[key]
  return rule.pillarIn?.[mode] ?? rule.pillar
}

export function itemVisibility(key: MenuItemKey, mode: MenuMode): Visibility {
  const rule = MENU_RULES[key]
  const only = MODE_ONLY[rule.pillar]
  if (only && !only.includes(mode)) return 'hide'
  return rule.modes?.[mode] ?? 'show'
}

// Why a tool is off, and what the member can do about it. The answer is one of
// the "Has anything changed?" answers, so updating from here is the same
// change as anywhere else.
export type StatusUnlock = { why: string; answers: { answer: CheckInAnswer; label: string; because: string }[] }

export function statusUnlock(mode: MenuMode): StatusUnlock | null {
  switch (mode) {
    case 'EXPLORING':
    case 'STAYING':
      return {
        why: 'Job-search tools turn on when you are looking for a new job. Your menu and your weekly plan follow your situation, so you only see what helps now.',
        answers: [
          { answer: 'ready', label: "I'm ready to start applying", because: 'Turns on Find a Full-time Job and interview practice, and your plan switches to applications and outreach.' },
          { answer: 'laid_off', label: 'I was laid off or let go', because: 'Starts a laid-off plan: benefits and severance first, then a fast search. Also tells a college you joined, if you share that.' },
        ],
      }
    case 'PREPARING':
      return {
        why: 'Offer and negotiation tools turn on when you are interviewing or have an offer.',
        answers: [
          { answer: 'ready', label: "I'm ready to start applying", because: 'Moves you into an active search with weekly application and outreach targets.' },
          { answer: 'interviewing', label: "I'm interviewing", because: 'Adds interview practice, reference follow-ups and what to do after each round.' },
        ],
      }
    default:
      return null
  }
}
