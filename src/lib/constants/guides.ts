export interface Guide {
  slug: string
  title: string
  description: string
  /** Shown only when locked — what they'll get once they unlock it. */
  lockedTeaser?: string
  /** Where "Activate" sends them to complete the gate. Omit if always unlocked. */
  activateHref?: string
}

export const GUIDES: Guide[] = [
  {
    slug: 'unemployed',
    title: "You're unemployed now. What actually works.",
    description: 'Evidence-based guidance for experienced professionals — week one through month three.',
  },
  {
    slug: '72-hours',
    title: 'You just got here. Start here.',
    description: 'The first 72 hours after a layoff — what to do, in order.',
  },
  {
    slug: 'pre-exit',
    title: 'Before you go.',
    description: "What to handle in your last days at a job — records, contacts, and paperwork you'll want later.",
  },
  {
    slug: 'cobra-aca',
    title: 'COBRA & marketplace coverage.',
    description: 'How to keep or replace your health insurance after leaving a job.',
  },
  {
    slug: 'bridge-income',
    title: 'Bridge income options.',
    description: 'Ways to bring in income while you search, without derailing it.',
  },
  {
    slug: 'gatekeeper',
    title: 'Getting through the gatekeeper.',
    description: 'How recruiters, HR screens, and hiring managers actually work — and how to get from inbox to interview.',
  },
  {
    slug: 'offer-letter',
    title: 'You have an offer. Now read it correctly.',
    description: 'Total comp breakdown, negotiation scripts, and red flags to catch.',
  },
  {
    slug: 'narrative-workshop',
    title: 'Build your core story.',
    description: 'A workshop for building the story you tell about your career — for resumes, interviews, and networking.',
    lockedTeaser: 'Unlocks once you build your Core Narrative in Interview Prep.',
    activateHref: '/dashboard/interview-prep',
  },
  {
    slug: 'network-activation',
    title: 'Activate your network.',
    description: 'How to turn your existing contacts into real conversations.',
    lockedTeaser: 'Unlocks once you answer the comfort-check on Outreach Contacts.',
    activateHref: '/dashboard/network',
  },
  {
    slug: 'ask-for-help',
    title: 'Before you start outreach, read this.',
    description: 'Why asking for help works, and how to do it without it feeling awkward.',
    lockedTeaser: 'Unlocks once you answer the comfort-check on Outreach Contacts.',
    activateHref: '/dashboard/network',
  },
  {
    slug: 'network-scripts',
    title: 'The networking script book.',
    description: 'Scripts for every kind of outreach — cold, warm, and everything between.',
    lockedTeaser: 'Unlocks once you answer the comfort-check on Outreach Contacts.',
    activateHref: '/dashboard/network',
  },
  {
    slug: 'interview-prep',
    title: 'Interview prep guide.',
    description: 'How to prepare for interviews at every stage, from phone screen to final round.',
    lockedTeaser: 'Unlocks once you answer the comfort-check in Interview Prep.',
    activateHref: '/dashboard/interview-prep',
  },
  {
    slug: 'post-interview',
    title: "You have an interview. Here's how to follow up.",
    description: 'What to do in the 24-48 hours after an interview.',
  },
  {
    slug: 'thought-leadership',
    title: 'Build a public presence.',
    description: 'How to write and share thought leadership content that gets noticed.',
    lockedTeaser: 'Unlocks once you answer the two gating questions in My Marketing Plan.',
    activateHref: '/dashboard/marketing-plan',
  },
  {
    slug: 'first-90-days',
    title: 'Your first 90 days.',
    description: 'How to start strong in a new role.',
  },
]
