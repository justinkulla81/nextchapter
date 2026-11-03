import { getPersona } from '@/lib/constants/personas'
import { planFor } from '@/lib/leads/first-week-plans'
import { NUDGE_DAYS, type LeadStep, type LeadVariant } from './config'

export interface LeadEmailContent {
  subject: string
  headline: string
  paragraphs: string[]
  benefits: string[]
  ctaLabel: string | null
  /** The one-tap "which sounds most like you" buttons, when we do not know their journey yet. The profile button becomes a plain link beneath. */
  choicesPrompt?: string
  choices?: { label: string; url: string }[]
  /** The line above the unsubscribe link: says what else we will and will not send. */
  footerNote: string
}

export interface LeadEmailContext {
  firstName: string | null
  /** The job title and company for a saved job, the search for an alert, the audience for a waitlist. */
  detail: string | null
  /** The persona slug they picked in an earlier email, when they did. */
  journey?: string | null
  /** The journey buttons to show when `journey` is unknown. */
  choices?: { label: string; url: string }[]
}

const BENEFITS = [
  'Every job ranked for you, with a fit score and the reason behind it',
  'Job alerts that match your background, not just your search words',
  'Your saved jobs kept in one place',
]

const FREE = 'It is free and takes about five minutes.'

const hello = (c: LeadEmailContext) => (c.firstName ? `Hi ${c.firstName},` : 'Hi,')

/**
 * Plain and direct: what they did, then one question (which situation is closest) until we know, then what a profile does for
 * them. Once they have answered, the reminder is their first-week plan instead of the generic pitch.
 */
export function leadEmailContent(variant: LeadVariant, step: LeadStep, c: LeadEmailContext): LeadEmailContent {
  const base = baseContent(variant, step, c)
  if (variant === 'waitlist_b2b' || !base.ctaLabel) return base
  const followUp = variant === 'applied_job' && step === 'nudge1'
  const persona = c.journey ? getPersona(c.journey) : null

  if (persona && step === 'nudge1' && !followUp) {
    const plan = planFor(persona.slug)
    return {
      ...base,
      subject: `Your first week: ${persona.label.toLowerCase()}`,
      headline: 'Your first-week plan',
      paragraphs: [hello(c), plan.intro, 'Three steps for this week:'],
      benefits: plan.steps,
      ctaLabel: 'Save this plan: create my free profile',
    }
  }
  // The second reminder asks for something different from the first: not a plan to save but a look at where they stand,
  // starting with a few questions (the résumé is optional), in the words of the situation they picked or the job they saved.
  if (step === 'nudge2' && variant !== 'applied_job') {
    const stand = 'Your free Market Reality Assessment shows how the market reads you, what people in your role are paid, and a weekly plan matched to how soon you want to move. Start with a few questions; add your résumé now or later.'
    if (persona) {
      return { ...base, subject: 'What the market sees when it reads you', headline: 'Before an employer does', paragraphs: [hello(c), persona.hook, stand, 'This is our last note.'], benefits: [], ctaLabel: 'See where I stand', footerNote: 'This is the last reminder.' }
    }
    if (variant === 'saved_job' && c.detail) {
      return { ...base, subject: `How well do you fit ${c.detail}?`, headline: 'How well do you fit?', paragraphs: [hello(c), `You saved ${c.detail}. A free profile shows how well you fit it, what is missing, and which similar jobs fit you better.`, 'Start with a few questions; add your résumé now or later. This is our last note.'], benefits: [], ctaLabel: 'Show me my fit', footerNote: 'This is the last reminder.' }
    }
    return { ...base, subject: 'Where do you stand? Find out in five minutes', headline: 'Where do you stand?', paragraphs: [hello(c), stand, 'This is our last note.'], benefits: [], ctaLabel: 'See where I stand', footerNote: 'This is the last reminder.' }
  }
  if (!persona && c.choices?.length && (step === 'welcome' || (step === 'nudge1' && !followUp))) {
    return {
      ...base,
      // The question is the action: keep the greeting and what they did, drop the profile pitch until they answer.
      paragraphs: base.paragraphs.slice(0, 2),
      benefits: [],
      choicesPrompt: 'Which sounds most like you? One tap and we tailor what we send. No résumé needed.',
      choices: c.choices,
      ctaLabel: 'Or skip ahead: create my free profile',
    }
  }
  return base
}

function baseContent(variant: LeadVariant, step: LeadStep, c: LeadEmailContext): LeadEmailContent {
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

  if (variant === 'applied_job' && step === 'nudge1') {
    const role = c.detail ?? 'the job you applied for'
    return {
      subject: 'Heard back about your application?',
      headline: 'Time to follow up?',
      paragraphs: [
        hello(c),
        `It has been three days since you went to apply for ${role}. If you have not heard back, a short note to the recruiter or hiring manager keeps you in view.`,
        `Something like: “Hello, I applied for ${role} and wanted to confirm it reached you. I am very interested and glad to answer any questions.”`,
        'To see more jobs like this one ranked for you, create a free profile. Add your résumé and every job on the site comes back ordered by how well you fit.',
      ],
      benefits: BENEFITS,
      ctaLabel: 'Create my free profile',
      footerNote: 'This is the only follow-up reminder we send about this application.',
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

  if (variant === 'applied_job') {
    return {
      subject: c.detail ? `Your application: ${c.detail}` : 'Your application',
      headline: 'We kept your application',
      paragraphs: [
        hello(c),
        c.detail ? `You went to apply for ${c.detail}. We saved it here, so you can open it again while it is listed.` : 'You went to apply for a job. We saved it here, so you can open it again while it is listed.',
        'In three days we send one note to help you follow up with the employer.',
        'Create a free profile and every job comes back ranked for you, so the ones like this come first.',
        FREE,
      ],
      benefits: BENEFITS,
      ctaLabel: 'Create my free profile',
      footerNote: 'We send one follow-up reminder in three days, then stop.',
    }
  }

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

  // Stopped at the onboarding step that asked for a Gmail account; Google connect is no longer required, so say so.
  if (c.detail === 'onboarding_no_gmail') {
    return {
      subject: 'You do not need Gmail to finish your NextChapter profile',
      headline: 'You can finish without Gmail',
      paragraphs: [
        hello(c),
        'You stopped at the step that asked for a Gmail account. You no longer need one: you can finish your profile with just your email address.',
        'Add your résumé, or skip it and answer a few questions, and every job on the site comes back ranked for you.',
        FREE,
      ],
      benefits: BENEFITS,
      ctaLabel: 'Finish my free profile',
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
    ...(content.choices?.length ? ['', content.choicesPrompt ?? '', ...content.choices.map((o) => `- ${o.label}: ${o.url}`)] : []),
    ...(content.benefits.length ? ['', ...content.benefits.map((b) => `- ${b}`)] : []),
    ...(content.ctaLabel && ctaUrl ? ['', `${content.ctaLabel}: ${ctaUrl}`] : []),
    '',
    content.footerNote,
  ].join('\n')
}
