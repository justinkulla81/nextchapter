import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /nonprofits: nonprofits, community organizations and research partners. Nonprofit and community organizations get the
// same free workspace as workforce organizations (src/lib/plans/provision.ts maps NONPROFIT and FOUNDATION to a
// community organization), so the plans are the workforce plans and the claim works the same way. Research and funding
// partnerships are set up one at a time: no dataset, access terms or outcome is promised here.

const admin = shot('workforce-admin-overview', {
  title: 'Admin overview',
  alt: 'An organization admin overview showing active members out of 50, staff, the services the organization lists, and basic counts with small groups held back.',
  why: 'It shows the member limit, the staff and the services you list, so an administrator sees what the workspace holds before anything else.',
})
const dashboard = shot('workforce-hub-dashboard', {
  title: 'Program dashboard',
  alt: 'A program dashboard showing participants, people active this week, people applying or interviewing, new roles, seats used and member companies.',
  why: 'Each count says who it covers: participants who joined and, for outcomes, those who chose to share.',
})
const layoffs = shot('workforce-hub-layoffs', {
  title: 'Layoffs with seats',
  alt: 'A list of layoffs where seats were given, with workers, seats given and how many signed up, and public notices in the region not yet answered.',
  why: 'A seat gives each affected worker the full job search tools, and you see how many signed up, never who.',
})

export const NONPROFITS: PortalPageDef = {
  seo: {
    title: 'Workspace for nonprofits and community organizations',
    description:
      'Claim your organization’s page on NextChapter with a work email at your domain. A free workspace gives your own page, services and basic counts. Research partners can start a conversation.',
    path: '/nonprofits',
    image: { src: admin.src, width: admin.width, height: admin.height, alt: admin.alt },
  },
  content: {
    analyticsKey: 'nonprofits',
    path: '/nonprofits',
    eyebrow: 'Nonprofits and community organizations',
    headline: 'Serve the job seekers in your community from a workspace of your own',
    subhead:
      'Claim your organization’s page with a work email at your domain, and a free workspace is created for you: your own page, your services, up to 50 active members and basic counts.',
    primary: { label: 'Claim your page', href: '#claim' },
    primaryNote: 'Nonprofits and community organizations. Research partners can start a conversation at the bottom of the page.',
    loginHref: PORTALS.workforce.loginHref,
    proof: {
      kind: 'sample',
      heading: 'What your administrator sees',
      intro: 'This is the free workspace as an administrator opens it. The sample shows a workforce board, and Tri-County Workforce Board is invented.',
    },
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
        'Your organization’s page is at https://launchyournextchapter.com/prepared/ followed by its name in lowercase with hyphens between the words, for example https://launchyournextchapter.com/prepared/riverside-food-bank. Open it and fill in your name, title and work email.',
        'Use a work email at your organization’s domain. Personal email addresses are not accepted. When we do not yet know your organization’s domain, our team follows up on the claim.',
        'If the address does not open, or your organization’s name has punctuation in it, use the form at the bottom of this page and we will follow up.',
      ],
    },
    plansFor: ['workforce'],
    plansIntro: 'The free workspace is listed at the top. The Program plan adds what a program needs at scale. Talk to us about it.',
    faq: [
      {
        q: 'Who can claim a page?',
        a: 'A staff member of a nonprofit or community organization with a work email at the organization’s domain. We send a one-time link to that address to confirm it. If we do not know your domain yet, our team follows up on the claim.',
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
        q: 'Do you offer AI training for our staff?',
        a: 'Yes, as an add-on to the Program plan: AI training for career services. Read more on https://launchyournextchapter.com/ai-training.',
      },
      {
        q: 'We are a researcher or a funder. How do we start?',
        a: 'Use the form at the bottom of this page and tell us what you want to study or support. Research and funding partnerships are set up one at a time.',
      },
      {
        q: 'What do the people we serve pay?',
        a: 'Job seekers use the core job search tools without paying. Membership and coaching are optional for them.',
      },
    ],
    finalCta: {
      title: 'Claim your page, or start a conversation',
      intro: 'Claim your page at the address above. Researchers, funders and organizations whose page does not open: send us a message.',
      form: { audience: 'ORGANIZATION', source: 'nonprofits', heading: 'Talk to us' },
    },
    footerLinks: [
      { href: '/government-workforce', label: 'Workforce and economic development' },
      { href: '/ai-training', label: 'AI training for career services' },
    ],
    jsonLd: {
      serviceName: 'Workspace for nonprofits and community organizations',
      serviceType: 'Community organization workspace',
      audienceType: 'Nonprofits, community organizations and research partners',
      description:
        'A workspace for nonprofits and community organizations: your own page, your services, active members and basic counts, with research partnerships set up one at a time.',
      trail: [
        { name: 'For organizations', path: '/for-organizations' },
        { name: 'Nonprofits and community organizations', path: '/nonprofits' },
      ],
    },
  },
}
