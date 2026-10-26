import { pageSeo } from '@/lib/seo/keywords'
import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /higher-education: career services, alumni relations, development, executive education and administration.
// The free workspace is live (2026-10-24): a staff member claims the institution's page at
// https://launchyournextchapter.com/prepared/<organization-slug> with a work email at the institution's domain.
// Plans come from src/lib/marketing/plans.ts. Nothing here states an amount.

const admin = shot('higher-education-admin-overview', {
  title: 'Admin overview',
  alt: 'A college admin overview showing active members out of 50, staff, the services the college lists for its members, and basic counts with small groups held back.',
  why: 'It shows the limit, the staff and the services you list, so an administrator sees what the workspace holds before anything else. Small groups are held back so no one can be picked out.',
})
const alumni = shot('higher-education-alumni-workspace', {
  title: 'Alumni relations',
  alt: 'The alumni relations workspace showing member counts, layoff alerts near alumni and jobs posted for alumni.',
  why: 'Layoff alerts are matched to where your alumni live, so you can reach out early, and alumni jobs are shown to your alumni.',
})
const caseload = shot('higher-education-career-caseload', {
  title: 'Career services caseload',
  alt: 'A career services caseload listing each person with class year, status, last contact and the next step.',
  why: 'People who need a conversation are listed at the top, with the next step beside each name, so the hour goes to them.',
})

export const HIGHER_EDUCATION: PortalPageDef = {
  seo: {
    ...pageSeo('/higher-education'),
    path: '/higher-education',
    image: { src: admin.src, width: admin.width, height: admin.height, alt: admin.alt },
  },
  content: {
    analyticsKey: 'higher_education',
    path: '/higher-education',
    eyebrow: 'Higher education',
    headline: 'Support every alum and student in their next career move',
    subhead:
      'Claim your institution’s page with a work email at your domain, and a free workspace is created for you: your own page, your services, up to 50 active members and basic counts.',
    primary: { label: 'Claim your page', href: '#claim' },
    primaryNote: 'Career services, alumni relations, development, executive education and administration.',
    loginHref: PORTALS.higher_education.loginHref,
    proof: {
      kind: 'sample',
      heading: 'What your administrator sees',
      intro: 'This is the free workspace as an administrator opens it. Riverside College is invented.',
    },
    visuals: [admin, alumni, caseload],
    steps: [
      {
        title: 'Claim your page',
        body: 'A staff member opens the institution’s page, enters a work email at the institution’s domain and confirms the one-time link we send.',
      },
      {
        title: 'Set up the workspace',
        body: 'When the email matches your domain, the workspace is created with the person who claimed it as administrator. List the services you offer so members see them.',
      },
      {
        title: 'Invite your members',
        body: 'Invite alumni and students, up to 50 active members on the free workspace. Counts show who joined and how active they are, with small groups held back.',
      },
    ],
    claim: {
      title: 'How to claim your page',
      paragraphs: [
        'Your institution’s page is at https://launchyournextchapter.com/prepared/ followed by its name in lowercase with hyphens between the words, for example https://launchyournextchapter.com/prepared/riverside-college. Open it and fill in your name, title and work email.',
        'Use a work email at your institution’s domain. Personal email addresses are not accepted. When we do not yet know your institution’s domain, our team follows up on the claim.',
        'If the address does not open, or your institution’s name has punctuation in it, use the form at the bottom of this page and we will follow up.',
      ],
    },
    plansFor: ['higher_education'],
    plansIntro: 'The free workspace is listed at the top. The Institution plan adds what an administrator needs at scale. Talk to us about it.',
    faq: [
      {
        q: 'Who can claim our institution’s page?',
        a: 'A staff member with a work email at your institution’s domain. We send a one-time link to that address to confirm it. If we do not know your domain yet, our team follows up on the claim.',
      },
      {
        q: 'What does the free workspace include?',
        a: 'Your own page on NextChapter, up to 50 active members, your own services listed for your members, and basic counts of members and activity.',
      },
      {
        q: 'What does the Institution plan add?',
        a: 'Reporting and exports, exchange of records with your CRM, more active members, staff roles, an audit log of staff activity, and NextChapter coaching and courses offered to your members. Talk to us to set it up.',
      },
      {
        q: 'Do alumni and students pay?',
        a: 'Members use the core job search tools without paying. Membership and coaching are optional for them.',
      },
      {
        q: 'What do we see about individual members?',
        a: 'Reporting is in counts, and small groups are held back so no one can be picked out of a group.',
      },
    ],
    finalCta: {
      title: 'Claim your page, or tell us what you need',
      intro: 'Claim your page at the address above. For the Institution plan, or if your page does not open, send us a message.',
      form: { audience: 'ORGANIZATION', source: 'higher-education', heading: 'Talk to us' },
    },
    footerLinks: [{ href: '/reports/latest', label: 'White Collar Employment Report' }],
    jsonLd: {
      serviceName: 'Alumni and student career workspace for colleges',
      serviceType: 'Career services and alumni workspace',
      audienceType: 'Colleges and universities',
      description:
        'A workspace for career services, alumni relations, development and executive education: your own page, your services, active members and basic counts.',
      trail: [
        { name: 'For organizations', path: '/for-organizations' },
        { name: 'Higher education', path: '/higher-education' },
      ],
    },
  },
}
