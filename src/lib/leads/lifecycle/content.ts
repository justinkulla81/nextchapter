import { NUDGE_DAYS, type LeadStep, type LeadVariant } from './config'

export interface LeadEmailContent {
  subject: string
  headline: string
  paragraphs: string[]
  benefits: string[]
  ctaLabel: string | null
  /** The line above the unsubscribe link: says what else we will and will not send. */
  footerNote: string
}

export interface LeadEmailContext {
  firstName: string | null
  /** The job title and company for a saved job, the search for an alert, the audience for a waitlist. */
  detail: string | null
}

const BENEFITS = [
  'Every job ranked for you, with a fit score and the reason behind it',
  'Job alerts that match your background, not just your search words',
  'Your saved jobs kept in one place',
]

const FREE = 'It is free and takes about five minutes.'

const hello = (c: LeadEmailContext) => (c.firstName ? `Hi ${c.firstName},` : 'Hi,')

// Plain and direct: what they did, what a profile does for them, one button.
export function leadEmailContent(variant: LeadVariant, step: LeadStep, c: LeadEmailContext): LeadEmailContent {
  const remindersLeft = (n: number) => (n === 2 ? 'two short reminders' : 'one short reminder')

  if (variant === 'waitlist_b2b') {
    return {
      subject: 'You are on the NextChapter list',
      headline: 'You are on the list',
      paragraphs: [hello(c), `Thanks for your interest${c.detail ? ` as ${/^[aeiou]/i.test(c.detail) ? 'an' : 'a'} ${c.detail.toLowerCase()}` : ''}. We have your address and will write when there is news for you.`],
      benefits: [],
      ctaLabel: null,
      footerNote: 'This is the only email we send for this signup.',
    }
  }

  if (step === 'nudge1') {
    return {
      subject: 'Two minutes to a job search that fits you',
      headline: 'Still looking?',
      paragraphs: [
        hello(c),
        'A free profile is the step that makes NextChapter work for you. Add your résumé and we rank every job against it, so you read the ones that fit first.',
        FREE,
      ],
      benefits: BENEFITS,
      ctaLabel: 'Create my free profile',
      footerNote: variant === 'newsletter' ? 'This is the one reminder we send, then we stop.' : 'One more reminder after this, then we stop.',
    }
  }

  if (step === 'nudge2') {
    return {
      subject: 'Last note from us about your profile',
      headline: 'One last note',
      paragraphs: [
        hello(c),
        'This is our last reminder. If a ranked, personalised job search is useful to you, your profile takes about five minutes to set up and it is free.',
        'If not, no hard feelings. We will leave you alone.',
      ],
      benefits: [],
      ctaLabel: 'Create my free profile',
      footerNote: 'This is the last reminder.',
    }
  }

  const note = `If you do not make a profile we will send ${remindersLeft(NUDGE_DAYS[variant].length)}, then stop.`

  if (variant === 'saved_job') {
    return {
      subject: c.detail ? `Saved: ${c.detail}` : 'Your saved job',
      headline: 'Your job is saved',
      paragraphs: [
        hello(c),
        c.detail ? `You saved ${c.detail}. You can open it again any time while it is listed.` : 'You saved a job. You can open it again any time while it is listed.',
        'Create a free profile and we personalise your whole search: every job comes back ranked for you, so you can see how well you fit this one and what to do about the gaps.',
        FREE,
      ],
      benefits: BENEFITS,
      ctaLabel: 'Create my free profile',
      footerNote: note,
    }
  }

  if (variant === 'job_alert') {
    return {
      subject: 'Your job alerts are on. Make them yours',
      headline: 'Your alerts are on',
      paragraphs: [
        hello(c),
        c.detail ? `We will email you new jobs for ${c.detail}.` : 'We will email you new jobs that match your search.',
        'Right now they match on the words you searched. Create a free profile and they match on you: your experience, your level, what you are good at.',
        FREE,
      ],
      benefits: BENEFITS,
      ctaLabel: 'Create my free profile',
      footerNote: note,
    }
  }

  if (variant === 'newsletter') {
    return {
      subject: 'Welcome to NextChapter',
      headline: 'Welcome',
      paragraphs: [
        hello(c),
        'Thanks for subscribing. Each week we send one read on the white-collar job market: what is changing, who is hiring, who is cutting.',
        'If you are job hunting yourself, a free profile lets us tailor all of it to you. Add your résumé and every job on the site comes back ranked for you.',
        FREE,
      ],
      benefits: BENEFITS,
      ctaLabel: 'Create my free profile',
      footerNote: note,
    }
  }

  // waitlist (candidate)
  return {
    subject: 'You are on the NextChapter list',
    headline: 'You are on the list',
    paragraphs: [
      hello(c),
      'We have your address and will write when there is news.',
      'While you wait, a free profile gets you started now: add your résumé and every job on the site comes back ranked for you.',
      FREE,
    ],
    benefits: BENEFITS,
    ctaLabel: 'Create my free profile',
    footerNote: note,
  }
}

/** The plain-text twin, kept on the CRM record so you can read what was sent. */
export function leadEmailText(content: LeadEmailContent, ctaUrl: string | null): string {
  return [
    content.headline,
    '',
    ...content.paragraphs,
    ...(content.benefits.length ? ['', ...content.benefits.map((b) => `- ${b}`)] : []),
    ...(content.ctaLabel && ctaUrl ? ['', `${content.ctaLabel}: ${ctaUrl}`] : []),
    '',
    content.footerNote,
  ].join('\n')
}
