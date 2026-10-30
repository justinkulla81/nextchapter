import { pageSeo } from '@/lib/seo/keywords'
import { PORTALS } from '@/lib/marketing/portals'
import { WORKFORCE_SHOTS } from './workforce'
import type { PortalPageDef } from './types'

// /for-rapid-response: the landing page for the Rapid Response, workforce board and economic development campaign
// (plan: https://claude.ai/artifact/Kfkrfw9ikGK43ab2o6P2pQ). One headline, one action: build a demo for the visitor's own
// region at https://launchyournextchapter.com/demo/workforce. The live layoff counts and the personal line (an emailed
// contact's organization, the state an ad names, or a location guess) are put in by the page, because a ReactNode does
// not belong in this file. It claims only what exists: the layoff seats and sign-up page, local jobs ranked at the top,
// opt-in outcome counts with small groups held back, and courses from outside providers. A custom course built for a
// region is described as scoped with the customer, never as something finished.

const [layoffs] = WORKFORCE_SHOTS
const DEMO = '/demo/workforce?from=rapid-response'

export const RAPID_RESPONSE: PortalPageDef = {
  seo: {
    ...pageSeo('/for-rapid-response'),
    path: '/for-rapid-response',
    image: { src: layoffs.src, width: layoffs.width, height: layoffs.height, alt: layoffs.alt },
  },
  content: {
    analyticsKey: 'rapid_response',
    path: '/for-rapid-response',
    eyebrow: 'Rapid Response and workforce boards',
    headline: 'A page for the workers in your next layoff',
    subhead:
      'NextChapter is the leading job transition platform. When a layoff is announced in your region, your team sends the affected workers one link. They get local jobs at the top of their search, career support and AI skills. You get counts of who stayed in the region.',
    primary: { label: 'Build your region’s demo', href: DEMO },
    primaryNote: 'It takes about a minute and uses your region’s real WARN notices and job data. We ask for a work email so the demo is yours.',
    parent: { href: '/for-organizations', label: 'For organizations' },
    loginHref: PORTALS.workforce.loginHref,
    // The page replaces this node with the personal line and the live layoff counts.
    proof: { kind: 'live', node: null },
    visuals: WORKFORCE_SHOTS,
    steps: [
      {
        title: 'Set up the layoff',
        body: 'When an employer announces a layoff, you give its affected workers seats and get a public sign-up page to share.',
      },
      {
        title: 'Workers sign up from one link',
        body: 'Each worker gets the full job search tools, with jobs near your region at the top. They see the AI skills their best-fit employers ask for that they lack, with a course for each.',
      },
      {
        title: 'You see the counts',
        body: 'You see how many workers signed up, how many landed and how many stayed in your region. Small groups are held back, and you never see who.',
      },
    ],
    plansFor: ['workforce'],
    plansIntro: 'The free workspace is listed at the top. The Program plan adds what a program needs at scale. Talk to us about it.',
    faq: [
      {
        q: 'What happens when a layoff is announced?',
        a: 'You give the affected workers seats and share one sign-up page. Each worker gets the full job search tools, with local jobs ranked at the top. You see how many signed up, never who.',
      },
      {
        q: 'Can you report how many workers stayed in our region?',
        a: 'Yes, for workers who choose to share their outcome. Any group smaller than 5 is held back. NextChapter is not a system of record for federal reporting. It does not match wage records or produce PIRL files.',
      },
      {
        q: 'What do workers get for AI skills?',
        a: 'A library of courses from outside providers and live counts of the AI-skill jobs open now, at https://launchyournextchapter.com/ai-skills. A course built for your region or a specific layoff is scoped with you.',
      },
      {
        q: 'What do the workers pay?',
        a: 'Job seekers use the core job search tools without paying. Membership and coaching are optional for them.',
      },
    ],
    finalCta: {
      title: 'Build your demo, or talk it through with us',
      intro: 'Build a demo for your region at https://launchyournextchapter.com/demo/workforce. To talk it through, send us a message and we will set up 15 minutes.',
      action: { label: 'Build your region’s demo', href: DEMO },
      form: { audience: 'ORGANIZATION', source: 'rapid-response', heading: 'Talk to us' },
    },
    footerLinks: [
      { href: '/rapid-response', label: 'Rapid Response by state' },
      { href: '/layoffs', label: 'Layoff tracker' },
      { href: '/ai-skills', label: 'AI skills in the job market' },
      { href: '/government-workforce', label: 'Workforce board workspace' },
    ],
    jsonLd: {
      serviceName: 'Layoff response for workforce boards and Rapid Response teams',
      serviceType: 'Job transition platform for laid-off workers',
      audienceType: 'Workforce boards, Rapid Response teams and economic development organizations',
      description:
        'One sign-up page for the workers in a layoff: local jobs ranked at the top, career support and AI skills, with counts of who stayed in the region.',
      trail: [
        { name: 'For organizations', path: '/for-organizations' },
        { name: 'Layoff response', path: '/for-rapid-response' },
      ],
    },
  },
}
