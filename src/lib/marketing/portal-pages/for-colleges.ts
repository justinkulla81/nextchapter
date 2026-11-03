import { BOOKING_URL } from '@/lib/booking'
import { pageSeo } from '@/lib/seo/keywords'
import { PORTALS } from '@/lib/marketing/portals'
import { HIGHER_ED_SHOTS } from './higher-education'
import type { PortalPageContent } from '@/components/marketing/PortalMarketingPage'
import type { PortalPageDef } from './types'

// /for-colleges/<angle>: four landing pages for the higher education ad campaign (plan: 2026-11-02). Each ad sends its
// click to the page that matches its promise, and each page has its own analytics key, so a click, a booking and a
// claim are counted per angle. The pages share the higher-education template and its screens (Riverside College is
// invented). Every claim below is something the workspace does today:
//   - job news: an alum answers a check-in; with consent to share job news, development gets prospect signals for a
//     VP-and-above title and for a new employer (src/lib/higher-ed/transition.ts, raiseProspectSignals)
//   - an alum in an open transition is marked do-not-ask until it clears (transition.ts, doNotSolicit)
//   - the Resilience Fund and its printable donor report (src/lib/higher-ed/fund.ts, app/i/[slug]/report/fund)
//   - the giving-rate comparison appears only when both groups have 30 or more people (roi-math.ts)
//   - engagement scoring: activity counts only for alumni who share it; gifts always count (engagement.ts)
// Nothing here promises wealth screening, automatic job-change detection or an amount.

const { admin, alumni, caseload } = HIGHER_ED_SHOTS

const CALL = { label: 'Book a call with the founder', href: BOOKING_URL }
const CLAIM = { label: 'Claim your college’s page', href: '/higher-education#claim' }
const SHARED_FAQ = {
  claim: {
    q: 'Who can claim our institution’s page?',
    a: 'A staff member with a work email at your institution’s domain. We send a one-time link to that address to confirm it. If we do not know your domain yet, our team follows up on the claim.',
  },
  counts: {
    q: 'What do we see about individual alumni?',
    a: 'Reporting is in counts, and small groups are held back so no one can be picked out of a group. Job news reaches your office from alumni who choose to share it, and from no one else.',
  },
  crm: {
    q: 'Does it connect to our CRM?',
    a: 'The Institution plan exchanges records with your CRM and adds reporting and exports. Talk to us to set it up.',
  },
}

function page(args: {
  slug: string
  key: string
  eyebrow: string
  headline: string
  subhead: string
  primaryNote: string
  seoPath: string
  visuals: PortalPageContent['visuals']
  proofHeading: string
  proofIntro: string
  steps: PortalPageContent['steps']
  faq: PortalPageContent['faq']
  finalTitle: string
  jsonLd: { serviceName: string; serviceType: string; description: string; trailName: string }
}): PortalPageDef {
  const path = args.seoPath
  const lead = args.visuals[0]
  return {
    seo: { ...pageSeo(path), path, image: { src: lead.src, width: lead.width, height: lead.height, alt: lead.alt } },
    content: {
      analyticsKey: args.key,
      path,
      eyebrow: args.eyebrow,
      headline: args.headline,
      subhead: args.subhead,
      primary: CALL,
      secondary: CLAIM,
      founderLine: true,
      primaryNote: args.primaryNote,
      parent: { href: '/higher-education', label: 'Higher education' },
      loginHref: PORTALS.higher_education.loginHref,
      proof: { kind: 'sample', heading: args.proofHeading, intro: args.proofIntro },
      visuals: args.visuals,
      steps: args.steps,
      claim: {
        title: 'How to claim your page',
        paragraphs: [
          'Your institution’s page is at https://launchyournextchapter.com/prepared/ followed by its name in lowercase with hyphens between the words, for example https://launchyournextchapter.com/prepared/riverside-college. Open it and fill in your name, title and work email.',
          'Use a work email at your institution’s domain. Personal email addresses are not accepted.',
        ],
      },
      plansFor: ['higher_education'],
      plansIntro: 'The free workspace is listed at the top. The Institution plan adds what an administrator needs at scale. Talk to us about it.',
      faq: args.faq,
      finalCta: {
        title: args.finalTitle,
        intro: 'Book a call, claim your page at the address above, or send us a message.',
        action: CALL,
        form: { audience: 'ORGANIZATION', source: `college-ad-${args.slug}`, heading: 'Talk to us' },
      },
      jsonLd: {
        serviceName: args.jsonLd.serviceName,
        serviceType: args.jsonLd.serviceType,
        audienceType: 'Colleges and universities',
        description: args.jsonLd.description,
        trail: [
          { name: 'For organizations', path: '/for-organizations' },
          { name: 'Higher education', path: '/higher-education' },
          { name: args.jsonLd.trailName, path },
        ],
      },
    },
  }
}

export const ENGAGEMENT = page({
  slug: 'engagement',
  key: 'college_ad_engagement',
  seoPath: '/for-colleges/alumni-engagement',
  eyebrow: 'Alumni engagement',
  headline: 'Give alumni a reason to come back every time their job changes',
  subhead:
    'NextChapter is the leading job transition platform. Alumni get job search tools, mentors and job-search circles under your college’s name, and your office sees who is active, as counts.',
  primaryNote: 'The workspace is free for up to 50 active members. You claim your page with a work email at your college’s domain.',
  visuals: [alumni, admin, caseload],
  proofHeading: 'What your alumni relations team sees',
  proofIntro: 'Layoff alerts near your alumni and jobs posted for your alumni sit in one workspace. Riverside College is invented.',
  steps: [
    { title: 'Claim your page', body: 'A staff member with a work email at your college’s domain claims the page and becomes the administrator.' },
    { title: 'Invite alumni', body: 'Alumni join with the tools they need when a job changes: full job search tools, mentors from your alumni, job-search circles and events.' },
    { title: 'See who is active', body: 'Engagement is scored from logins, events, mentor calls, coaching and the gifts you record. Activity inside NextChapter counts for alumni who choose to share it, and for no one else.' },
  ],
  faq: [
    {
      q: 'Why would alumni use it?',
      a: 'It helps at the moment they care about: a layoff, a move or a promotion. They get job search tools, mentors and circles under your college’s name, so your college is there when it matters.',
    },
    SHARED_FAQ.counts,
    SHARED_FAQ.claim,
    SHARED_FAQ.crm,
  ],
  finalTitle: 'Book a call, or tell us what you need',
  jsonLd: {
    serviceName: 'Alumni engagement workspace for colleges',
    serviceType: 'Alumni engagement',
    description: 'A workspace that gives alumni job search tools, mentors and job-search circles under a college’s name, with activity shown to alumni relations as counts.',
    trailName: 'Alumni engagement',
  },
})

export const OUTCOMES = page({
  slug: 'outcomes',
  key: 'college_ad_outcomes',
  seoPath: '/for-colleges/alumni-outcomes',
  eyebrow: 'Alumni outcomes',
  headline: 'Know where your alumni work now, from the alumni who choose to tell you',
  subhead:
    'Alumni answer a short check-in when a job changes. You see the counts: who is working, who is between jobs, who moved to a new employer and who says your college helped. Small groups are held back.',
  primaryNote: 'The workspace is free for up to 50 active members. Alumni decide what they share with your college.',
  visuals: [admin, alumni, caseload],
  proofHeading: 'What your administrator sees',
  proofIntro: 'Counts of members and activity, the services you list, and small groups held back so no one can be picked out. Riverside College is invented.',
  steps: [
    { title: 'Alumni answer a check-in', body: 'When a job changes, an alum answers one question about where they are now, such as a new job or promotion. Alumni who share job news with your college add the title and employer.' },
    { title: 'Outcomes roll up', body: 'Answers roll up into counts for your office: working, between jobs, a new employer, and how many say your college helped.' },
    { title: 'Move the data', body: 'The Institution plan adds reporting and exports and exchanges records with your CRM, so the data lands where your office already works.' },
  ],
  faq: [
    {
      q: 'Where does the work data come from?',
      a: 'From alumni. They report a new job or promotion in a check-in, and the alumni who choose to share job news with your college add their title and employer. We do not scrape or guess.',
    },
    SHARED_FAQ.counts,
    SHARED_FAQ.claim,
    SHARED_FAQ.crm,
  ],
  finalTitle: 'Book a call, or tell us what you need',
  jsonLd: {
    serviceName: 'Alumni outcomes reporting for colleges',
    serviceType: 'Alumni outcomes data',
    description: 'Alumni report new jobs and promotions in a short check-in, and a college sees who is working, between jobs or helped by the college, as counts.',
    trailName: 'Alumni outcomes',
  },
})

export const GIVING = page({
  slug: 'giving',
  key: 'college_ad_giving',
  seoPath: '/for-colleges/alumni-giving',
  eyebrow: 'Alumni giving',
  headline: 'Ask alumni at the right moment, and never when they are out of work',
  subhead:
    'When an alum shares a new job with your college, development sees a signal: a VP-and-above title may be a timely major-gift conversation, and a new employer is worth a matching-gift check. Alumni between jobs are marked do-not-ask.',
  primaryNote: 'Signals come from job news that alumni choose to share with your college, and from nothing else. The workspace is free for up to 50 active members.',
  visuals: [admin, alumni, caseload],
  proofHeading: 'What your administrator sees',
  proofIntro: 'The overview your administrator opens on arrival, with the services you list and counts that hold small groups back. Riverside College is invented.',
  steps: [
    { title: 'Alumni share job news', body: 'An alum who is promoted or changes employer says so in a check-in, and chooses whether to share it with your college.' },
    { title: 'Development sees signals', body: 'A VP-and-above title raises a major-gift signal and a new employer raises a matching-gift signal. Gifts upload from your development records, and an alum in transition is marked do-not-ask until it clears.' },
    { title: 'Fund coaching, report to donors', body: 'Donors give to the Resilience Fund. You award coaching or a premium seat to an alum in transition and print a donor report of counts: alumni funded, back at work since their award, and who chose to share their story.' },
  ],
  faq: [
    {
      q: 'Does this replace prospect research?',
      a: 'No. Signals come from job news that alumni choose to share. They tell you when to look, not how much someone can give.',
    },
    {
      q: 'What stops us from asking someone who just lost a job?',
      a: 'An alum with an open transition is marked do-not-ask until the transition clears, so a gift request does not reach them while they are out of work.',
    },
    {
      q: 'How do we show that it helps giving?',
      a: 'Giving reports compare the giving rate of alumni who joined with matched alumni who did not. The comparison appears once both groups have at least 30 people, so it is fair to quote.',
    },
    SHARED_FAQ.claim,
  ],
  finalTitle: 'Book a call, or tell us what you need',
  jsonLd: {
    serviceName: 'Alumni giving signals for college development',
    serviceType: 'Alumni giving and advancement',
    description: 'A workspace that gives development signals from alumni job news, protects alumni in transition from gift requests, and runs a donor-funded coaching fund with a donor report.',
    trailName: 'Alumni giving',
  },
})

export const CAREER_SERVICES = page({
  slug: 'career-services',
  key: 'college_ad_career_services',
  seoPath: '/for-colleges/alumni-career-services',
  eyebrow: 'Alumni career services',
  headline: 'Offer alumni the career help your students get, for life',
  subhead:
    'NextChapter is a career platform that your office runs under its own name: your services listed, a caseload showing who needs a conversation, mentors from your alumni and job-search circles, so a small team can reach every alum.',
  primaryNote: 'The workspace is free for up to 50 active members. Career services, alumni relations and development share it.',
  visuals: [caseload, admin, alumni],
  proofHeading: 'What career services sees',
  proofIntro: 'People who need a conversation are listed at the top, with the next step beside each name. Riverside College is invented.',
  steps: [
    { title: 'List your services', body: 'Add the appointments, workshops and programs your office offers, so alumni see them next to the job search tools.' },
    { title: 'Work the caseload', body: 'Alumni who need a conversation rise to the top with the next step beside each name, so the hour goes to them.' },
    { title: 'Add mentors and circles', body: 'Alumni mentors take calls, and your office runs job-search circles for groups, such as mid-career alumni after a layoff.' },
  ],
  faq: [
    {
      q: 'Do alumni and students pay?',
      a: 'Members use the core job search tools without paying. Membership and coaching are optional for them.',
    },
    {
      q: 'Can we offer coaching and courses?',
      a: 'The Institution plan adds NextChapter coaching and courses offered to your members, and AI training for career services is available as an add-on. Talk to us to set it up.',
    },
    SHARED_FAQ.claim,
    SHARED_FAQ.counts,
  ],
  finalTitle: 'Book a call, or tell us what you need',
  jsonLd: {
    serviceName: 'Lifelong alumni career services for colleges',
    serviceType: 'Career services and alumni workspace',
    description: 'A career platform a college runs under its own name: services listed, a caseload, alumni mentors and job-search circles for alumni at any stage.',
    trailName: 'Alumni career services',
  },
})

export const FOR_COLLEGES: PortalPageDef[] = [ENGAGEMENT, OUTCOMES, GIVING, CAREER_SERVICES]
