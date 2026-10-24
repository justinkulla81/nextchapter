import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /talent: the Hiring section of the employer lifecycle (future employees). Posting a role is free today and has a
// real sign-up at /talent/signup. Team seats, analytics and candidate export are the Hiring team plan (plans.ts).

const dashboard = shot('hiring-dashboard', {
  title: 'Hiring dashboard',
  alt: 'A hiring dashboard showing candidates who chose to be seen and matched on what they say they are looking for, with the evidence behind each match and counts of roles and conversations.',
  why: 'Candidates are matched on what each person says they want, across all your active roles, not on a job title search.',
})
const evidence = shot('hiring-evidence-brief', {
  title: 'Evidence brief',
  alt: 'A candidate evidence brief with why they might fit, effort, work history, gaps, questions worth asking and work samples.',
  why: 'Every statement is written from the facts beside it and labeled by the kind of evidence behind it, and gaps are listed so you decide what matters for the role.',
})
const roles = shot('hiring-roles', {
  title: 'Roles and hiring team',
  alt: 'A list of open roles with how many candidates match and how many are in conversation, and the members of the hiring team.',
  why: 'Each role shows how many candidates match and how many you are talking to, so you know where to spend the day.',
})

export const HIRING: PortalPageDef = {
  seo: {
    title: 'Hire candidates who show their evidence',
    description:
      'Post a role on NextChapter and see candidates who chose to be seen, matched on what they say they want, with an evidence brief for each. Name and contact stay private until the candidate agrees.',
    path: '/talent',
    image: { src: dashboard.src, width: dashboard.width, height: dashboard.height, alt: dashboard.alt },
  },
  content: {
    analyticsKey: 'talent',
    path: '/talent',
    eyebrow: 'Hiring',
    headline: 'Hire people who show you the evidence',
    subhead:
      'Post a role and see candidates who chose to be seen, matched on what they say they are looking for, with an evidence brief for each. Posting is free.',
    primary: { label: 'Post a role', href: '/talent/signup' },
    primaryNote: 'Hiring is for future employees. Employees and Outplacement cover current and departing ones.',
    loginHref: PORTALS.hiring.loginHref,
    parent: { href: '/employers', label: 'For employers' },
    proof: {
      kind: 'sample',
      heading: 'What your hiring team sees',
      intro: 'This is the dashboard as a hiring team opens it. Northwind Foods and the candidates are invented.',
    },
    visuals: [dashboard, evidence, roles],
    steps: [
      {
        title: 'Post a role',
        body: 'Describe the role and where it is. Candidates who chose to be seen are matched to it on what they say they want.',
      },
      {
        title: 'Read the evidence brief',
        body: 'Each brief shows the facts behind the match: work history the candidate chose to show, effort, work samples, references and the gaps.',
      },
      {
        title: 'Ask for an introduction',
        body: 'The candidate decides who sees what. Name and contact stay private until the candidate agrees to the introduction.',
      },
    ],
    plansFor: ['hiring'],
    plansIntro: 'Posting a role is free. The Hiring team plan adds seats for colleagues, analytics and export. Talk to us about it.',
    faq: [
      {
        q: 'Is it free to post a role?',
        a: 'Yes. Posting a role is free, and so is seeing the candidates matched to it.',
      },
      {
        q: 'Which candidates do I see?',
        a: 'Candidates who chose to be seen. They are matched on what each person says they are looking for, across all your active roles, not on a job title search.',
      },
      {
        q: 'What is in an evidence brief?',
        a: 'Why the person might fit, written from the facts in the brief and labeled by the kind of evidence behind it. It also shows effort, the work history the candidate chose to show, work samples, gaps and questions worth asking.',
      },
      {
        q: 'When do I see a candidate’s name and contact details?',
        a: 'After the candidate agrees to an introduction. Until then they stay private.',
      },
      {
        q: 'Can my colleagues review candidates with me?',
        a: 'Yes, with seats on the Hiring team plan. Each person sees what the candidate chose to share. Talk to us to set it up.',
      },
    ],
    finalCta: {
      title: 'Post a role',
      intro: 'Create an account and describe a role. Questions about the Hiring team plan: send us a message.',
      action: { label: 'Post a role', href: '/talent/signup' },
      form: { audience: 'ORGANIZATION', source: 'talent', heading: 'Talk to us about the Hiring team plan' },
    },
    footerLinks: [
      { href: '/employers', label: 'For employers' },
      { href: '/employees', label: 'Employees' },
      { href: '/outplacement', label: 'Outplacement' },
    ],
    jsonLd: {
      serviceName: 'Hiring on NextChapter',
      serviceType: 'Direct hiring',
      audienceType: 'Employers hiring directly',
      description:
        'Post a role and see candidates who chose to be seen, matched on what they say they are looking for, with an evidence brief for each.',
      trail: [
        { name: 'For employers', path: '/employers' },
        { name: 'Hiring', path: '/talent' },
      ],
    },
  },
}
