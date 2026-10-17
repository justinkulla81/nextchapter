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

export type MenuMode = 'EXPLORING' | 'PREPARING' | 'ACTIVE' | 'STAYING' | 'LANDED' | 'PORTFOLIO' | 'LEAVE'

// Where in the search someone is, as far as the menu cares. No stage yet (a
// member from before journeys) sees everything, as an active search does.
export function menuMode(stage: JourneyStage | null, journey: JourneyType | null = null): MenuMode {
  // Going for a promotion before applying elsewhere is about the job they have.
  if (journey && normalizeJourney(journey) === 'PROMOTION' && (stage === 'EXPLORING' || stage === 'PREPARING')) return 'STAYING'
  // Not looking, but not in a job to grow in either: running a portfolio of clients, or on a break.
  if (journey && (stage === 'STAYING' || stage === 'PAUSED')) {
    const j = normalizeJourney(journey)
    if (j === 'FRACTIONAL') return 'PORTFOLIO'
    if (j === 'TIME_OFF') return 'LEAVE'
  }
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
  grow: 'Manage your career', // staying: reviews, pay, skills, a career that holds up
  career: 'Manage your career', // landed: the new job, then the same
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
  // Happy with fractional work: the work (clients, rate, pipeline) comes first.
  PORTFOLIO: ['work', 'prove', 'network', 'plan', 'learn', 'coach', 'search', 'support'],
  // On leave or time off: gentle, with the return in mind.
  LEAVE: ['plan', 'prove', 'network', 'learn', 'coach', 'search', 'support'],
}

// The phone's bottom bar has room for four tabs: Home, one situational tab,
// Network and Profile. The situational tab is the main thing to do right now.
export type MobileTab = 'jobs' | 'plan' | 'worth' | 'first90'

export const MOBILE_TAB: Record<MenuMode, MobileTab> = {
  EXPLORING: 'plan',
  PREPARING: 'jobs',
  ACTIVE: 'jobs',
  STAYING: 'worth',
  LANDED: 'first90',
  PORTFOLIO: 'worth',
  LEAVE: 'plan',
}

export type Visibility = 'show' | 'locked' | 'hide'

export type MenuItemKey =
  | 'strategy' | 'profile' | 'assessments' | 'marketReality' | 'worth' | 'local'
  | 'references' | 'portfolio' | 'marketing'
  | 'jobs' | 'companies' | 'interviewPrep' | 'offer' | 'marketIntel'
  | 'network' | 'contacts' | 'community' | 'inbox' | 'recruiter' | 'universities' | 'collegeBenefits'
  | 'learning' | 'webinars'
  | 'coach'
  | 'interim' | 'eqoveriq'
  | 'stats' | 'benefits' | 'struggling' | 'membership' | 'help' | 'privacy' | 'faq'
  | 'growWorth' | 'growCase' | 'growResults' | 'growSkills' | 'growConversation' | 'growStyle'
  | 'careerFirst90' | 'careerWorth' | 'careerNetwork'

type Rule = { pillar: Pillar; modes?: Partial<Record<MenuMode, Visibility>>; pillarIn?: Partial<Record<MenuMode, Pillar>> }

// What each tool is called in the menu. The sidebar and the stage guide both read this.
export const MENU_LABELS: Record<MenuItemKey, string> = {
  strategy: "My Search Strategy",
  profile: "My Profile",
  assessments: "Skills & Behavioral Assessments",
  marketReality: "Market Reality Report",
  worth: "Know your worth",
  local: "Your local market",
  references: "My References",
  portfolio: "My Portfolio",
  marketing: "My Marketing Plan",
  jobs: "Find a Full-time Job",
  companies: "Companies",
  interviewPrep: "Interview Prep",
  offer: "Got An Offer 🎉",
  marketIntel: "Market Intelligence",
  network: "Network with Contacts",
  contacts: "My Contacts",
  community: "NextChapter Community",
  inbox: "My Inbox",
  recruiter: "Executive Recruiter",
  universities: "Universities",
  collegeBenefits: "Higher Education Career Services and Benefits",
  learning: "Learn New Skills",
  webinars: "Videos and Webinars",
  coach: "Executive Coach",
  interim: "Find Interim Work",
  eqoveriq: "EQoverIQ — Fractional AI Work",
  stats: "My Stats",
  benefits: "Benefits & Financial Bridge",
  struggling: "I'm Struggling",
  membership: "Membership",
  help: "Help & feedback",
  privacy: "Privacy Settings",
  faq: "FAQ",
  growWorth: "Know your worth",
  growCase: "Build your case",
  growResults: "Prove your results",
  growSkills: "Build new skills",
  growConversation: "Practice the hard conversation",
  growStyle: "Know how you work",
  careerFirst90: "Your first 90 days",
  careerWorth: "Know your worth",
  careerNetwork: "Thank the people who helped",
}

const L = 'locked' as const
const H = 'hide' as const

// The job-search tools turn on once someone is applying; until then they show
// as locked (exploring, preparing, staying) so people know what is waiting.
const SEARCH_TOOLS: Partial<Record<MenuMode, Visibility>> = { EXPLORING: L, STAYING: L, PORTFOLIO: L, LEAVE: L, LANDED: H }

export const MENU_RULES: Record<MenuItemKey, Rule> = {
  // Personalize
  strategy: { pillar: 'plan' },
  profile: { pillar: 'plan' },
  assessments: { pillar: 'plan' },
  marketReality: { pillar: 'plan' },
  // Where your pay sits. In the manage-your-career menus it is the grow / career item instead.
  worth: { pillar: 'plan', modes: { STAYING: H, LANDED: H } },
  // What is happening where you live: layoffs, hiring, news, other members (anonymous), your workforce board.
  local: { pillar: 'plan' },
  // Prove it
  references: { pillar: 'prove' },
  portfolio: { pillar: 'prove' },
  marketing: { pillar: 'prove' },
  // Search and apply
  jobs: { pillar: 'search', modes: SEARCH_TOOLS },
  companies: { pillar: 'search', pillarIn: { LANDED: 'career' } },
  interviewPrep: { pillar: 'search', modes: { EXPLORING: L, STAYING: L, LEAVE: L, LANDED: H } },
  offer: { pillar: 'search', modes: { EXPLORING: L, PREPARING: L, STAYING: L, PORTFOLIO: L, LEAVE: L }, pillarIn: { LANDED: 'career' } },
  marketIntel: { pillar: 'search', pillarIn: { LANDED: 'career' } },
  // Network
  network: { pillar: 'network' },
  contacts: { pillar: 'network' },
  community: { pillar: 'network' },
  inbox: { pillar: 'network' },
  recruiter: { pillar: 'network', modes: { EXPLORING: L, STAYING: H, PORTFOLIO: H, LEAVE: H, LANDED: H } },
  universities: { pillar: 'network' },
  collegeBenefits: { pillar: 'network', modes: { LANDED: H } },
  // Learn
  learning: { pillar: 'learn' },
  webinars: { pillar: 'learn' },
  // Coaching
  coach: { pillar: 'coach' },
  // Work now
  interim: { pillar: 'work', modes: { STAYING: H, LEAVE: H, LANDED: H } },
  eqoveriq: { pillar: 'work', modes: { STAYING: H, LEAVE: H, LANDED: H } },
  // Support and settings
  stats: { pillar: 'support' },
  benefits: { pillar: 'support', modes: { STAYING: H, LANDED: H } },
  struggling: { pillar: 'support' },
  membership: { pillar: 'support' },
  help: { pillar: 'support' },
  privacy: { pillar: 'support' },
  faq: { pillar: 'support' },
  // Manage your career (staying in a job, going for a promotion)
  growWorth: { pillar: 'grow' },
  growCase: { pillar: 'grow' },
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
    case 'PORTFOLIO':
      return {
        why: 'Full-time job tools turn on when you want a full-time role. Your menu is built around your clients and your pipeline.',
        answers: [
          { answer: 'ready', label: "I'm ready to start applying", because: 'Turns on Find a Full-time Job and interview practice, and your plan switches to applications and outreach.' },
          { answer: 'laid_off', label: 'I lost my main client or role', because: 'Starts a laid-off plan: benefits first, then a fast search.' },
        ],
      }
    case 'LEAVE':
      return {
        why: 'Job tools are off while you are on a break. Tell us when that changes.',
        answers: [
          { answer: 'back', label: "I'm back at work", because: 'Moves you to managing your career, with a plan for your return.' },
          { answer: 'ready', label: "I'm ready to start applying", because: 'Turns on Find a Full-time Job and interview practice.' },
        ],
      }
    default:
      return null
  }
}
