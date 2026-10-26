import { pageSeo } from '@/lib/seo/keywords'
import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /government-workforce: workforce boards, economic development organizations, chambers and community organizations.
// The proof is live: src/components/organizations/WorkforceNumbers.tsx, read from our own database, is put in by the
// page (a ReactNode does not belong in this file). The free workspace is live (2026-10-24), claimed at
// https://launchyournextchapter.com/prepared/<organization-slug>. No federal indicators, wage-record match or PIRL
// export are claimed anywhere: those are not built.

const admin = shot('workforce-admin-overview', {
  title: 'Admin overview',
  alt: 'A workforce board admin overview showing active members out of 50, staff, the services the board lists, and basic counts with small groups held back.',
  why: 'It shows the member limit, the staff and the services you list, so an administrator sees what the workspace holds before anything else.',
})
const dashboard = shot('workforce-hub-dashboard', {
  title: 'Program dashboard',
  alt: 'A workforce program dashboard showing participants, people active this week, people applying or interviewing, new roles, people kept in the region, seats used and member companies.',
  why: 'Each count says who it covers: participants who joined and, for outcomes, those who chose to share.',
})
const layoffs = shot('workforce-hub-layoffs', {
  title: 'Layoffs with seats',
  alt: 'A list of layoffs where the board gave seats, with workers, seats given and how many signed up, and public notices in the region not yet answered.',
  why: 'A seat gives each affected worker the full job search tools, and you see how many signed up, never who.',
})

export const WORKFORCE: PortalPageDef = {
  seo: {
    ...pageSeo('/government-workforce'),
    path: '/government-workforce',
    image: { src: dashboard.src, width: dashboard.width, height: dashboard.height, alt: dashboard.alt },
  },
  content: {
    analyticsKey: 'government',
    path: '/government-workforce',
    eyebrow: 'Workforce and economic development',
    headline: 'Help the job seekers in your region get back to work',
    subhead:
      'Claim your organization’s page with a work email at your domain, and a free workspace is created for you: your own page, your services, up to 50 active members and basic counts.',
    primary: { label: 'Claim your page', href: '#claim' },
    primaryNote: 'Workforce boards, economic development organizations and chambers. Community organizations can claim a page too.',
    loginHref: PORTALS.workforce.loginHref,
    // The page replaces this node with the live WorkforceNumbers section.
    proof: { kind: 'live', node: null },
    visuals: [admin, dashboard, layoffs],
    steps: [
      {
        title: 'Claim your page',
        body: 'A staff member opens the organization’s page, enters a work email at the organization’s domain and confirms the one-time link we send.',
      },
      {
        title: 'Set up the workspace',
        body: 'When the email matches your domain, the workspace is created with the person who claimed it as administrator. List the services you offer so the people you serve see them.',
      },
      {
        title: 'Invite the people you serve',
        body: 'Invite participants, up to 50 active members on the free workspace. Counts show who joined and how active they are, with small groups held back.',
      },
    ],
    claim: {
      title: 'How to claim your page',
      paragraphs: [
        'Your organization’s page is at https://launchyournextchapter.com/prepared/ followed by its name in lowercase with hyphens between the words, for example https://launchyournextchapter.com/prepared/tri-county-workforce-board. Open it and fill in your name, title and work email.',
        'Use a work email at your organization’s domain. Personal email addresses are not accepted. When we do not yet know your organization’s domain, our team follows up on the claim.',
        'If the address does not open, or your organization’s name has punctuation in it, use the form at the bottom of this page and we will follow up.',
      ],
    },
    plansFor: ['workforce'],
    plansIntro: 'The free workspace is listed at the top. The Program plan adds what a program needs at scale. Talk to us about it.',
    faq: [
      {
        q: 'Who can claim our organization’s page?',
        a: 'A staff member with a work email at your organization’s domain. We send a one-time link to that address to confirm it. If we do not know your domain yet, our team follows up on the claim.',
      },
      {
        q: 'What does the free workspace include?',
        a: 'Your own page on NextChapter, up to 50 active members, your own services listed for the people you serve, and basic counts of participants and activity.',
      },
      {
        q: 'What does the Program plan add?',
        a: 'Reporting and exports, exchange of records with your CRM, more active members, staff roles, an audit log of staff activity, NextChapter coaching and courses offered to the people you serve, and program reporting scoped with you.',
      },
      {
        q: 'Does NextChapter replace our system of record?',
        a: 'No. NextChapter is not a system of record for federal reporting. It does not match wage records or produce PIRL files. Program reporting is scoped with you on the Program plan.',
      },
      {
        q: 'What do the people we serve pay?',
        a: 'Job seekers use the core job search tools without paying. Membership and coaching are optional for them.',
      },
    ],
    asset: 'workforce-demo',
    finalCta: {
      title: 'Claim your page, or tell us about your program',
      intro: 'Claim your page at the address above. For the Program plan, or if your page does not open, send us a message.',
      form: { audience: 'ORGANIZATION', source: 'government-workforce', heading: 'Talk to us' },
    },
    footerLinks: [
      { href: '/demo/workforce', label: 'Demo workspace' },
      { href: '/reports/latest', label: 'White Collar Employment Report' },
      { href: '/ai-training', label: 'AI training for career services' },
    ],
    jsonLd: {
      serviceName: 'Job seeker support for workforce boards and economic development',
      serviceType: 'Workforce development workspace',
      audienceType: 'Workforce boards, economic development organizations and chambers',
      description:
        'A workspace for workforce boards, economic development organizations, chambers and community organizations: your own page, your services, active members and basic counts.',
      trail: [
        { name: 'For organizations', path: '/for-organizations' },
        { name: 'Workforce and economic development', path: '/government-workforce' },
      ],
    },
  },
}
