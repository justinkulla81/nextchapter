import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /employers: the public overview of the employer side, by employee lifecycle: Hiring (future employees), Employees
// (current employees) and Outplacement (departing employees). It used to be a permanent redirect to /outplacement.
// The page puts the section overview (src/components/marketing/EmployerOverview.tsx, which reads
// src/lib/employer/sections.ts) in as the proof node. /employer-home stays the signed-in front door and stays noindex.
// Not claimed anywhere: a single sign-in across sections, or one person running several sections. Neither is built.

const hiring = shot('hiring-dashboard', {
  title: 'Hiring',
  alt: 'A hiring dashboard showing candidates who chose to be seen and matched on what they say they are looking for.',
  why: 'Hiring is for future employees: candidates are matched on what each person says they want, and name and contact stay private until the candidate agrees.',
})
const employees = shot('employees-retention', {
  title: 'Employees',
  alt: 'A retention view showing participation in promotion plans and review preparation, outcomes people shared and internal roles.',
  why: 'Employees is for current employees: you see counts by team, never by person.',
})
const outplacement = shot('outplacement-reporting', {
  title: 'Outplacement',
  alt: 'An outplacement reporting view for a sample cohort showing seats, activation, engagement and time to placement.',
  why: 'Outplacement is for departing employees: HR sees aggregate reporting and never anyone’s activity, grade or progress.',
})

export const EMPLOYERS: PortalPageDef = {
  seo: {
    title: 'Employer solutions for hiring, employees and outplacement',
    description:
      'NextChapter for employers, by stage of the employee lifecycle: Hiring for future employees, Employees for current ones, and Outplacement for people who are leaving.',
    path: '/employers',
    image: { src: hiring.src, width: hiring.width, height: hiring.height, alt: hiring.alt },
  },
  content: {
    analyticsKey: 'employers',
    path: '/employers',
    eyebrow: 'Employers',
    headline: 'Support your people at every stage, from hiring to departure',
    subhead:
      'Hiring for future employees, Employees for current ones, and Outplacement for people who are leaving. Take one section, or all three.',
    primary: { label: 'Talk to us', href: '#talk' },
    primaryNote: 'Posting a role is free. Employees and Outplacement are set up with our team.',
    loginHref: '/employer-home',
    parent: { href: '/for-organizations', label: 'For organizations' },
    // The page replaces this node with the section overview and a link to each section’s page.
    proof: { kind: 'live', node: null },
    visuals: [hiring, employees, outplacement],
    steps: [
      {
        title: 'Choose a section',
        body: 'Pick the stage you need help with: Hiring, Employees or Outplacement. Each has its own page, and each can be taken on its own.',
      },
      {
        title: 'Get started',
        body: 'Hiring starts when you post a role. Employees and Outplacement are set up with our team.',
      },
      {
        title: 'Add sections when you need them',
        body: 'Add another section later, or take all three together under one contract.',
      },
    ],
    plansFor: ['hiring', 'employees', 'outplacement'],
    includeBundle: true,
    plansIntro: 'Each section has its own plans. Posting a role is free. Talk to us about the rest.',
    faq: [
      {
        q: 'What are the three sections?',
        a: 'Hiring is for future employees: post roles and review candidates. Employees is for current employees: retention, and learning and development. Outplacement is for departing employees: a seat for each person leaving, with reporting for HR and a compliance record for legal.',
      },
      {
        q: 'Do we need all three?',
        a: 'No. Each section can be taken on its own, or all three together under one contract with the enterprise bundle.',
      },
      {
        q: 'Where do we log in?',
        a: 'Hiring has its own log in at https://launchyournextchapter.com/talent/login. Employees and Outplacement use the employer log in at https://launchyournextchapter.com/employer/login.',
      },
      {
        q: 'What do we see about individual people?',
        a: 'In Hiring, candidates decide who sees what. In Employees you see counts by team, never by person. In Outplacement you never see anyone’s activity, grade or progress.',
      },
      {
        q: 'How do we get started?',
        a: 'Post a role to start Hiring. For Employees and Outplacement, use the form at the bottom of this page and we will set it up with you.',
      },
    ],
    finalCta: {
      title: 'Tell us what you are working on',
      intro: 'Tell us which stage you want help with, or post a role now.',
      action: { label: 'Post a role', href: '/talent/signup' },
      form: { audience: 'ORGANIZATION', source: 'employers', heading: 'Talk to us' },
    },
    footerLinks: [
      { href: '/talent', label: 'Hiring' },
      { href: '/employees', label: 'Employees' },
      { href: '/outplacement', label: 'Outplacement' },
    ],
    jsonLd: {
      serviceName: 'NextChapter for employers',
      serviceType: 'Employer hiring, development and outplacement services',
      audienceType: 'Employers',
      description:
        'Hiring for future employees, Employees for current ones, and Outplacement for people who are leaving.',
      trail: [{ name: 'For employers', path: '/employers' }],
    },
  },
}
