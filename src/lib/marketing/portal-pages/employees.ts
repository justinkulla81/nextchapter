import { PORTALS } from '@/lib/marketing/portals'
import { shot } from '@/lib/marketing/screenshots'
import type { PortalPageDef } from './types'

// /employees (new): the Employees section of the employer lifecycle, current employees: retention (promotion and raise
// preparation, internal roles, team reporting) and learning and development (your own courses, an AI skills view).
// Job retraining is declared in src/lib/employer/sections.ts but not built, so the page says it is not available yet.
// Everything the employer sees is a count by team, never a person. Set up with our team: no self-serve sign-up.

const retention = shot('employees-retention', {
  title: 'Retention view',
  alt: 'A retention view showing how many people joined, who is building a promotion plan, who finished review preparation, outcomes shared by employees and internal roles with how many raised a hand.',
  why: 'It shows counts, not names, so you see whether people are using their plans and moving into internal roles without seeing who.',
})
const learning = shot('employees-learning', {
  title: 'Learning and development reporting',
  alt: 'A learning reporting view showing participation, AI skills missing across a workforce, and results by team.',
  why: 'Each person gets a skills plan for their role and the next one, starting with your courses, and you see the gap and the progress by team.',
})
const enroll = shot('employees-enroll', {
  title: 'Enroll people',
  alt: 'The enroll screen where an employer adds one person or uploads a list with email, name and team.',
  why: 'An invitation goes to each person’s work email so each person joins under their own name, and the team column is what reporting is grouped by.',
})

export const EMPLOYEES: PortalPageDef = {
  seo: {
    title: 'Employee development and retention',
    description:
      'Give your current employees promotion and raise preparation, internal roles and a skills plan starting with your courses. You see counts by team, never by person.',
    path: '/employees',
    image: { src: retention.src, width: retention.width, height: retention.height, alt: retention.alt },
  },
  content: {
    analyticsKey: 'employees',
    path: '/employees',
    eyebrow: 'Employees',
    headline: 'Develop and keep the people you have',
    subhead:
      'Retention and learning and development for your current employees: promotion and raise preparation, internal roles and a skills plan starting with your courses. You see counts by team, never by person.',
    primary: { label: 'Talk to us', href: '#talk' },
    primaryNote: 'We set it up with you. Employees is for people who work for you today.',
    loginHref: PORTALS.employees.loginHref,
    parent: { href: '/employers', label: 'For employers' },
    proof: {
      kind: 'sample',
      heading: 'What your HR team sees',
      intro: 'This is the retention view as an HR team opens it. Northwind Foods and the numbers are invented.',
    },
    visuals: [retention, learning, enroll],
    steps: [
      {
        title: 'Talk to us',
        body: 'We set up Employees with you: which teams take part, which courses you cover and which internal roles to post.',
      },
      {
        title: 'Enroll your people',
        body: 'Add people one at a time or upload a list with email, name and team. Each person gets an invitation at their work email and chooses to join.',
      },
      {
        title: 'Read the counts by team',
        body: 'See participation, skills and outcomes grouped by team. Nobody’s individual activity is shown, and counts wait until enough people have joined.',
      },
    ],
    plansFor: ['employees'],
    plansIntro: 'Employees is set up with you. Take it on its own, or with Hiring and Outplacement under one contract. Talk to us about it.',
    faq: [
      {
        q: 'What does Employees cover?',
        a: 'Retention: promotion and raise preparation, internal roles and team reporting. Learning and development: your own courses and a view of the skills gap. Job retraining is not available yet.',
      },
      {
        q: 'Can we see what an individual employee does?',
        a: 'No. You see counts by team, and counts wait until enough people have joined so no one can be picked out. Promotion and raise counts include people who chose to share their outcome.',
      },
      {
        q: 'Does every employee have to join?',
        a: 'No. Each person gets an invitation at their work email and chooses to join.',
      },
      {
        q: 'Can we offer our own courses?',
        a: 'Yes. Each person gets a skills plan for their role and the next one, starting with the courses you cover.',
      },
      {
        q: 'Can we take Employees together with Hiring and Outplacement?',
        a: 'Yes. Each section can be taken on its own, or all three under one contract with the enterprise bundle.',
      },
    ],
    finalCta: {
      title: 'Tell us about your team',
      intro: 'Tell us which teams you want to start with.',
      form: { audience: 'ORGANIZATION', source: 'employees', heading: 'Talk to us about Employees' },
    },
    footerLinks: [
      { href: '/employers', label: 'For employers' },
      { href: '/talent', label: 'Hiring' },
      { href: '/outplacement', label: 'Outplacement' },
      { href: '/ai-training', label: 'AI training for your people' },
    ],
    jsonLd: {
      serviceName: 'Employee development and retention',
      serviceType: 'Employee development and retention',
      audienceType: 'Employers',
      description:
        'Retention and learning and development for current employees: promotion and raise preparation, internal roles and a skills plan, reported as counts by team.',
      trail: [
        { name: 'For employers', path: '/employers' },
        { name: 'Employees', path: '/employees' },
      ],
    },
  },
}
