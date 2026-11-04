import { BOOKING_URL } from '@/lib/booking'
import type { PortalVisual } from '@/components/marketing/PortalMarketingPage'
import { OUTPLACEMENT_SHOTS } from './portal-pages/outplacement'
import { WORKFORCE_SHOTS } from './portal-pages/workforce'
import { HIGHER_ED_SHOTS } from './portal-pages/higher-education'
import { FOUNDER_LINE } from './founder-line'

// /lp/<offer>: the three pages the Google Ads campaigns for buyers send a click to. One goal each: the visitor fills in
// a short form above the fold. The headline repeats the promise in the ad, the button names the offer, and the form
// card is the only thing to do on the page. They are not the public pages (/outplacement, /for-rapid-response,
// /for-colleges/*), which stay as they are for search and for people who browse. Every claim is one the product makes
// today (see the content notes on those pages); nothing here is a customer quote or a number we do not have.

export type LeadOfferKey = 'outplacement' | 'workforce' | 'higher-ed'

export interface LeadOffer {
  key: LeadOfferKey
  path: string
  /** Names who the page is for, so the right visitor recognizes themselves in one line. */
  audience: string
  headline: string
  subhead: string
  bullets: string[]
  form: {
    title: string
    blurb: string
    button: string
    /** Up to four choices, shown as buttons beside each other. Optional for the visitor. */
    choicesLabel: string
    choices: string[]
    fine: string
  }
  success: {
    title: string
    body: string
    next: { label: string; href: string }
    bookLabel: string
  }
  pains: { title: string; body: string }[]
  stepsTitle: string
  steps: { title: string; body: string }[]
  shotsTitle: string
  shotsIntro: string
  shots: PortalVisual[]
  faq: { q: string; a: string }[]
  founder: string
  seo: { title: string; description: string }
}

export const LEAD_OFFERS: Record<LeadOfferKey, LeadOffer> = {
  outplacement: {
    key: 'outplacement',
    path: '/lp/outplacement',
    audience: 'For HR and people leaders planning a reduction',
    headline: 'Run your next reduction with a free 10-seat outplacement pilot',
    subhead:
      'Each person leaving gets job search tools and a Dossier they keep. HR sees counts, never individuals. Legal gets a compliance record for every seat.',
    bullets: [
      'Up to 10 seats at no charge for a reduction you are planning',
      'A compliance record for every seat, ready for legal',
      'Add everyone from one list. People keep their Dossier when the contract ends',
    ],
    form: {
      title: 'Start your free pilot',
      blurb: 'Tell us about the reduction. We set up the pilot and show the reporting on your own seat count.',
      button: 'Start my free pilot',
      choicesLabel: 'When is the reduction?',
      choices: ['Within 30 days', '1 to 3 months', 'Planning ahead', 'Comparing vendors'],
      fine: 'Up to 10 seats at no charge. We use your details only to set up the pilot and reply.',
    },
    success: {
      title: 'Got it. We will set up your pilot.',
      body: 'Pick a time and we will go through the reduction with you. While you wait, the vendor scorecard is the eight questions to ask any outplacement provider, ours included.',
      next: { label: 'Open the vendor scorecard', href: '/rfp-template' },
      bookLabel: 'Pick a 30-minute time with Justin',
    },
    pains: [
      { title: 'You hold a list of names and no view of who is being helped', body: 'Reporting here is in counts: seats, activation and engagement for your cohort, with small groups held back so no one can be picked out.' },
      { title: 'Legal asks for proof the benefit was offered', body: 'Every seat has a record with the contract term, enrollment, activation and placement dates. It holds no job search detail.' },
      { title: 'People leaving want something they keep', body: 'Each person gets a Dossier that stays theirs, with their references and an alumni account, after your reporting access ends.' },
    ],
    stepsTitle: 'How the pilot works',
    steps: [
      { title: 'Tell us about the reduction', body: 'The size, the timing and who is leaving. Two minutes on the form.' },
      { title: 'We set up up to 10 seats', body: 'Add people one at a time or upload a list. Each gets an invitation, a seat and a Dossier.' },
      { title: 'You see the reporting and the record', body: 'Follow seats in counts and download the compliance record for each seat. If it fits, we scope the full program with you by contract.' },
    ],
    shotsTitle: 'What your HR and legal teams see',
    shotsIntro: 'Sample screens. Northwind Foods and the numbers are invented.',
    shots: OUTPLACEMENT_SHOTS,
    faq: [
      { q: 'What does the pilot include?', a: 'Up to 10 seats at no charge for a reduction you are planning, with the seats, Dossiers, HR reporting and compliance records shown above. If it fits, we scope the full program with you by contract.' },
      { q: 'What can HR see about each person?', a: 'Who holds a seat and whether it is in use. HR never sees anyone’s activity, grade or progress.' },
      { q: 'Do you publish a placement rate?', a: 'No. We do not state a placement rate or a speed until we have outcome data to back it.' },
      { q: 'Do you cover reductions outside the United States?', a: 'NextChapter is built for reductions in the United States. If you are reducing across many countries, a provider with a global footprint may fit better.' },
    ],
    founder: FOUNDER_LINE,
    seo: { title: 'Free outplacement pilot for your next reduction', description: 'Up to 10 seats at no charge, HR reporting in counts and a compliance record for every seat.' },
  },

  workforce: {
    key: 'workforce',
    path: '/lp/workforce',
    audience: 'For Rapid Response teams, workforce boards and economic development',
    headline: 'When a layoff hits your region, send the workers one link',
    subhead:
      'Each worker gets full job search tools with local jobs on top, career support and the AI skills their best-fit employers ask for. You see how many signed up and how many stayed in your region, never who.',
    bullets: [
      'A demo built on your region’s real layoff notices and job data, in about a minute',
      'One sign-up page to share with the workers in each layoff',
      'A free workspace for up to 50 active members',
    ],
    form: {
      title: 'Build your region’s demo',
      blurb: 'Enter your work email and organization. The demo opens at once, and it is yours.',
      button: 'Build my region’s demo',
      choicesLabel: 'Your role',
      choices: ['Rapid Response', 'Workforce board', 'Economic development', 'Other'],
      fine: 'The workspace is free for up to 50 active members. We use your details only for your demo and to reply.',
    },
    success: {
      title: 'Your demo is ready.',
      body: 'Open it to see your region’s layoffs and the local jobs the workers would see. If you want to talk it through, pick a time with Justin.',
      next: { label: 'Open my region’s demo', href: '/demo/workforce?from=lp-workforce' },
      bookLabel: 'Pick a 30-minute time with Justin',
    },
    pains: [
      { title: 'A notice arrives and the clock is already running', body: 'Set up the layoff, give the affected workers seats and share one sign-up page the same day.' },
      { title: 'Workers get a list of resources, then nothing', body: 'Each worker gets the full job search tools, with jobs near your region at the top and a course for each AI skill gap.' },
      { title: 'You are asked how many stayed in the region', body: 'See how many signed up, how many landed and how many stayed local for workers who share their outcome. Groups under 5 are held back.' },
    ],
    stepsTitle: 'How it works',
    steps: [
      { title: 'Set up the layoff', body: 'When an employer announces a layoff, you give its workers seats and get a public sign-up page.' },
      { title: 'Workers sign up from one link', body: 'Local jobs on top, career support and AI skills, with no one to chase.' },
      { title: 'You see the counts', body: 'How many signed up and how many stayed in your region. Never who.' },
    ],
    shotsTitle: 'What your team sees',
    shotsIntro: 'Sample screens from the workforce workspace.',
    shots: WORKFORCE_SHOTS,
    faq: [
      { q: 'Is this a system of record for federal reporting?', a: 'No. NextChapter does not match wage records or produce PIRL files. It shows counts of sign-ups and outcomes workers choose to share.' },
      { q: 'What do the workers pay?', a: 'Job seekers use the core job search tools without paying. The Alumni plan and coaching are optional for them.' },
      { q: 'What do workers get for AI skills?', a: 'A library of courses from outside providers and live counts of the AI-skill jobs open now. A course built for your region or a specific layoff is scoped with you.' },
      { q: 'Does the demo use real data?', a: 'Yes. It uses your region’s real WARN notices and job data.' },
    ],
    founder: FOUNDER_LINE,
    seo: { title: 'Build a demo for your region’s layoffs', description: 'One sign-up link for the workers in a layoff, local jobs on top, and counts of who stayed in your region.' },
  },

  'higher-ed': {
    key: 'higher-ed',
    path: '/lp/higher-ed',
    audience: 'For alumni relations, development and career services teams',
    headline: 'Ask alumni at the right moment, and never when they are out of work',
    subhead:
      'Alumni who are between jobs are marked do-not-ask until it clears. Alumni who share a new role or employer tell your office first, so your next conversation starts with something that is true today.',
    bullets: [
      'A free workspace for your college, up to 50 active members',
      'Prospect signals for a VP-and-above title or a new employer, from alumni who choose to share',
      'A donor report for the Resilience Fund, so career help and giving connect',
    ],
    form: {
      title: 'Get your free workspace',
      blurb: 'Use a work email at your college’s domain. We confirm it with a one-time link.',
      button: 'Get my free workspace',
      choicesLabel: 'Your office',
      choices: ['Development', 'Alumni relations', 'Career services', 'Other'],
      fine: 'Free for up to 50 active members. We use your details only to set up your workspace and reply.',
    },
    success: {
      title: 'Thanks. Next, claim your college’s page.',
      body: 'Claiming takes a work email at your college’s domain and a one-time link. If you want to talk it through first, pick a time with Justin.',
      next: { label: 'Claim your college’s page', href: '/higher-education#claim' },
      bookLabel: 'Pick a 30-minute time with Justin',
    },
    pains: [
      { title: 'A gift ask lands the week an alum is laid off', body: 'An alum in an open career transition is marked do-not-ask until it clears.' },
      { title: 'You hear about a promotion months late, if at all', body: 'With consent to share job news, your office gets a signal for a VP-and-above title or a new employer.' },
      { title: 'Engagement is measured by who showed up', body: 'Activity counts only for alumni who share it, and gifts always count. Small groups are held back so no one can be picked out.' },
    ],
    stepsTitle: 'How it works',
    steps: [
      { title: 'Claim your page', body: 'A staff member confirms a work email at your college’s domain.' },
      { title: 'Invite your alumni', body: 'Up to 50 active members on the free workspace, with your own services listed for them.' },
      { title: 'See the signals', body: 'Job news arrives from alumni who share it, with the do-not-ask list kept for you.' },
    ],
    shotsTitle: 'What your office sees',
    shotsIntro: 'Sample screens. Riverside College is invented.',
    shots: [HIGHER_ED_SHOTS.alumni, HIGHER_ED_SHOTS.admin, HIGHER_ED_SHOTS.caseload],
    faq: [
      { q: 'Who can claim our college’s page?', a: 'A staff member with a work email at your college’s domain. We send a one-time link to confirm it.' },
      { q: 'Where do the job signals come from?', a: 'Only from alumni who choose to share job news with your college. Nothing is bought or scraped.' },
      { q: 'What do we see about individual alumni?', a: 'Reporting is in counts. Job news reaches your office from alumni who choose to share it, and from no one else.' },
      { q: 'Does it connect to our CRM?', a: 'The Institution plan exchanges records with your CRM and adds reporting and exports. Talk to us to set it up.' },
    ],
    founder: FOUNDER_LINE,
    seo: { title: 'Free alumni workspace for development teams', description: 'Do-not-ask for alumni in transition, prospect signals from job news alumni share, and a free workspace for your college.' },
  },
}

export const isLeadOfferKey = (v: string): v is LeadOfferKey => v in LEAD_OFFERS
export { BOOKING_URL }
