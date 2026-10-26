import { pageSeo } from '@/lib/seo/keywords'
import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /coaches: independent career coaches and coaching practices. This page also carries what /coach-platform used to say
// (the full client view, session notes and directives, your practice name and logo); /coach-platform is a permanent
// redirect to here (next.config.ts). Free for now (owner decision 2026-10-24). Scheduling with Google Calendar is built
// but switched off until the owner sets it up, so it is never advertised as live. Billing is not part of the workspace.

const clients = shot('coach-clients', {
  title: 'Your clients',
  alt: 'A coach’s client list showing each client’s week in search, execution grade and trend.',
  why: 'Grade, trend and week in search sit side by side, so you can see who is slipping before the session.',
})
const brief = shot('coach-pre-session-brief', {
  title: 'Pre-session brief',
  alt: 'A pre-session brief for one client with tracked dimensions, a suggested opening question, the last mood check-in and the actions committed to this week.',
  why: 'It is built from what the client shares with you, so you start the session with what the client did and did not do.',
})
const log = shot('coach-session-log', {
  title: 'Full client view and session log',
  alt: 'A full client view with a form to log a session with private notes and directives, the session log and the client’s targeting.',
  why: 'A note and a directive take one minute. Directives you write show up in the client’s plan, and your private notes never do.',
})

export const COACHES: PortalPageDef = {
  seo: {
    ...pageSeo('/coaches'),
    path: '/coaches',
    image: { src: clients.src, width: clients.width, height: clients.height, alt: clients.alt },
  },
  content: {
    analyticsKey: 'coaches',
    path: '/coaches',
    eyebrow: 'Coaches',
    headline: 'Start every session knowing where your client stands',
    subhead:
      'Invite clients with a code, and get a pre-session brief built from what each client shares. Keep session notes and follow-ups in one place, under your practice’s name and logo.',
    primary: { label: 'Set up your account', href: '/support/coach/signup' },
    primaryNote: 'Independent coaches and coaching practices. The workspace is free for now.',
    loginHref: PORTALS.coaches.loginHref,
    proof: {
      kind: 'sample',
      heading: 'What a coach sees',
      intro: 'This is the client list as a coach opens it. Maya Ortiz Coaching and the clients are invented.',
    },
    visuals: [clients, brief, log],
    steps: [
      {
        title: 'Set up your account',
        body: 'Create your coach account and add your practice name and logo, which go on the tools your clients see. You do not need an organization.',
      },
      {
        title: 'Invite clients with a code',
        body: 'Each client joins with your code and chooses what to share. You keep billing your clients your way.',
      },
      {
        title: 'Prepare, then follow up',
        body: 'Read the pre-session brief, then log the session. Directives you write show up in the client’s plan, and your private notes never do.',
      },
    ],
    plansFor: ['coaches'],
    plansIntro: 'The coach workspace is free for now.',
    faq: [
      {
        q: 'What do I see about a client?',
        a: 'The plan, applications and progress each client chooses to share, with the execution grade and trend beside the week in search.',
      },
      {
        q: 'What is in the pre-session brief?',
        a: 'Seven tracked dimensions of the search read from the client’s recent activity and your last notes, the market reality assessment, a suggested opening question, the last mood check-in and the actions the client committed to this week.',
      },
      {
        q: 'Can my clients see my session notes?',
        a: 'Directives you write show up in the client’s plan. Your private notes never do.',
      },
      {
        q: 'Do I bill clients through NextChapter?',
        a: 'No. You invite clients with a code and keep billing them your way.',
      },
      {
        q: 'Can I put my practice’s name on it?',
        a: 'Yes. Your practice name and logo appear on the tools your clients see.',
      },
      {
        q: 'Can clients book sessions through NextChapter?',
        a: 'Booking sessions through NextChapter is not available yet.',
      },
    ],
    finalCta: {
      title: 'Set up your coach workspace',
      intro: 'Create an account and invite a client. Questions before you start: send us a message.',
      action: { label: 'Set up your account', href: '/support/coach/signup' },
      form: { audience: 'COACH_RECRUITER', source: 'coaches', heading: 'Questions before you sign up' },
    },
    footerLinks: [{ href: '/coaching', label: 'Coaching for candidates' }],
    jsonLd: {
      serviceName: 'Client workspace for career coaches',
      serviceType: 'Career coaching workspace',
      audienceType: 'Career coaches',
      description:
        'Invite clients with a code, get a pre-session brief built from what each client shares, and keep session notes and follow-ups in one place.',
      trail: [
        { name: 'For organizations', path: '/for-organizations' },
        { name: 'Coaches', path: '/coaches' },
      ],
    },
  },
}
