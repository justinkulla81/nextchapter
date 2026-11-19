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
  /** Open jobs like the one they applied for, each a tracked link. Shown under the paragraphs, above the profile button. */
  jobs?: LeadEmailJob[]
  /** The one line between the jobs and the profile button. */
  afterJobs?: string
  /** The newsletter welcome's lead: the latest report's headline finding and a link to the report. */
  feature?: { kicker: string; title: string; body: string; linkLabel: string; url: string }
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
  /** Open jobs like the one they applied for (the application welcome), each with its tracked link. */
  jobs?: LeadEmailJob[]
  /** The latest jobs report, for the newsletter welcome: its month, headline, summary and (tracked) link. */
  report?: { month: string; title: string; dek: string; url: string } | null
  /** The last seven days of layoff notices, for the newsletter reminder, with the (tracked) link to the week's page. */
  layoffs?: { notices: number; workers: number; states: number; top: { name: string; workers: number; state: string | null }[]; url: string } | null
  /** The résumé match from a job page's match box (src/lib/leads/resume-match.ts): its welcome leads with the score and the gaps. */
  match?: { score: number; bandLabel: string; missing: string[] } | null
  /** A résumé dropped on a layoff company page: the employer it named. */
  layoffCompany?: string | null
}

export interface LeadEmailJob {
  title: string
  company: string
  place: string | null
  url: string
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

  // A résumé matched on a job page: the welcome is the report they asked for (score, then what the posting asks for that the
  // résumé does not say), then jobs like it, then the account, which ranks every job against that résumé.
  if (c.match && variant === 'saved_job' && step === 'welcome') {
    const jobs = (c.jobs?.length ?? 0) >= 3 ? c.jobs!.slice(0, 3) : undefined
    return {
      ...base,
      subject: c.detail ? `Your résumé match for ${c.detail}: ${c.match.score}%` : `Your résumé match: ${c.match.score}%`,
      headline: `${c.match.score}% match: ${c.match.bandLabel.toLowerCase()}`,
      paragraphs: [
        hello(c),
        c.detail ? `Your résumé says ${c.match.score}% of what ${c.detail} asks for.` : `Your résumé says ${c.match.score}% of what the posting asks for.`,
        c.match.missing.length
          ? `The posting stresses these and your résumé does not say them: ${c.match.missing.join(', ')}. Add each one where it is true, in the bullet where you did it, with the result.`
          : 'Your résumé already says what the posting stresses. Lead with the results behind them.',
        ...(jobs ? ['Three more jobs like it are open now:'] : []),
      ],
      jobs,
      benefits: [],
      choices: undefined,
      choicesPrompt: undefined,
      ctaLabel: 'Open my free account',
      afterJobs: 'Your free account ranks every open job by how well you fit, so you read the ones you match first.',
    }
  }

  // A résumé dropped on a layoff company page.
  if (c.layoffCompany && variant === 'waitlist' && step === 'welcome') {
    return {
      ...base,
      subject: 'Your résumé is in: see the jobs you fit',
      headline: 'Your résumé is in',
      paragraphs: [
        hello(c),
        `We have your résumé. After ${c.layoffCompany}, the fastest way back is the jobs you already fit.`,
        'Open your free account and every open job comes back ranked by how well you fit, with what to add for the ones you nearly fit.',
        FREE,
      ],
      benefits: BENEFITS,
      choices: undefined,
      choicesPrompt: undefined,
      ctaLabel: 'See the jobs I fit',
    }
  }

  // Someone who just went to apply for a job, or saved one, wants jobs, so the welcome shows three open ones like it and makes one ask
  // under them. Without three to show it falls through to the situation question below. (2026-11-17: 57 application welcomes with the
  // question, 3 taps, 0 signups.)
  if ((variant === 'applied_job' || variant === 'saved_job') && step === 'welcome' && (c.jobs?.length ?? 0) >= 3) {
    const did = variant === 'applied_job' ? 'went to apply for' : 'saved'
    return {
      ...base,
      headline: 'Three more jobs like this one',
      paragraphs: [
        hello(c),
        c.detail ? `You ${did} ${c.detail}. These are open now and look like it:` : `You ${did} a job. These are open now and look like it:`,
      ],
      jobs: c.jobs!.slice(0, 3),
      benefits: [],
      ctaLabel: 'Open my free account',
      afterJobs: 'Your free account is ready: open it and we send you jobs like these, ranked by how well you fit. No résumé needed to start.',
    }
  }

  // A job alert's welcome shows three jobs the search finds now, then the one ask: alerts that match on them, not their words.
  if (variant === 'job_alert' && step === 'welcome' && (c.jobs?.length ?? 0) >= 3) {
    return {
      ...base,
      headline: 'Three jobs open now',
      paragraphs: [
        hello(c),
        c.detail ? `Your alert for ${c.detail} is on. These match it today:` : 'Your job alert is on. These match it today:',
      ],
      jobs: c.jobs!.slice(0, 3),
      benefits: [],
      ctaLabel: 'Open my free account',
      afterJobs: 'Right now your alert matches the words you searched. Open your free account and it matches you: your experience and level, ranked by how well you fit. No résumé needed to start.',
    }
  }

  // Someone who subscribed to the newsletter wants the market read, so the welcome leads with the latest report's one finding and a
  // link to it, then the one ask. (Owner decision 2026-11-18: no jobs here, the signup says nothing about what they do.)
  if (variant === 'newsletter' && step === 'welcome' && c.report) {
    return {
      ...base,
      paragraphs: [hello(c), 'Thanks for subscribing. Each week we send one read on the white-collar job market: what is changing, who is hiring, who is cutting. Here is where it stands now.'],
      feature: { kicker: `From our ${c.report.month} report`, title: c.report.title, body: c.report.dek, linkLabel: `Read the ${c.report.month} White Collar Employment Report`, url: c.report.url },
      benefits: [],
      ctaLabel: 'Open my free account',
      afterJobs: 'If you are job hunting yourself, your free account tailors all of this to you: every job on the site ranked by how well you fit. No résumé needed to start.',
    }
  }

  // The newsletter reminder (a week after the welcome, which showed the report) leads with something new: who filed layoffs in the
  // last seven days, the "who is cutting" the welcome promised. A quiet week falls through to the reminder as it was.
  if (variant === 'newsletter' && step === 'nudge1' && !persona && c.layoffs && c.layoffs.top.length > 0) {
    const n = (x: number) => x.toLocaleString('en-US')
    const l = c.layoffs
    const top = l.top.slice(0, 3).map((t) => `${t.name} (${n(t.workers)}${t.state ? `, ${t.state}` : ''})`)
    return {
      ...base,
      subject: `Layoffs this week: ${n(l.workers)} workers`,
      headline: 'Who is cutting this week',
      paragraphs: [hello(c), 'A week ago you subscribed to our read on the white-collar job market. Here is who filed layoff notices in the last seven days.'],
      feature: {
        kicker: 'Layoffs this week',
        title: `${n(l.notices)} notices, ${n(l.workers)} workers, ${n(l.states)} ${l.states === 1 ? 'state' : 'states'}`,
        body: `The largest: ${top.join('; ')}.`,
        linkLabel: 'See every layoff filed this week',
        url: l.url,
      },
      benefits: [],
      ctaLabel: 'Open my free account',
      afterJobs: 'If you are job hunting yourself, your free account turns this into your own plan: every job on the site ranked by how well you fit. No résumé needed to start.',
    }
  }

  // The reminders lead with jobs too: three not sent before (send.ts leaves out the ones already in an earlier email). The
  // application follow-up keeps its advice and swaps the benefits list for the jobs; someone who picked a situation keeps the
  // first-week plan and the last "where you stand" note, which are already about them.
  const fresh = (c.jobs?.length ?? 0) >= 3 ? c.jobs!.slice(0, 3) : null
  const last = step === 'nudge2'
  const lastNote = last ? { footerNote: 'This is the last reminder.' } : {}
  if (fresh && followUp) {
    return {
      ...base,
      paragraphs: [...base.paragraphs.slice(0, 3), 'While you wait, three more like it are open now:'],
      jobs: fresh,
      benefits: [],
      afterJobs: 'Your free account is ready: open it and we send you jobs like these, ranked by how well you fit. No résumé needed to start.',
    }
  }
  if (fresh && !persona && step !== 'welcome' && (variant === 'saved_job' || variant === 'job_alert')) {
    const saved = variant === 'saved_job'
    const what = saved
      ? c.detail ? `You saved ${c.detail}. Three more like it are open now:` : 'Three more jobs like the one you saved are open now:'
      : c.detail ? `New for your alert, ${c.detail}:` : 'New for your job alert:'
    return {
      ...base,
      subject: saved ? (c.detail ? `Three more like ${c.detail}` : 'Three more jobs like the one you saved') : c.detail ? `Three new jobs: ${c.detail}` : 'Three new jobs for your alert',
      headline: saved ? 'Three more like the one you saved' : 'Three new jobs for your alert',
      paragraphs: [hello(c), what],
      jobs: fresh,
      benefits: [],
      choices: undefined,
      choicesPrompt: undefined,
      ctaLabel: 'Open my free account',
      afterJobs: [
        saved
          ? 'Your free account shows how well you fit each of these, and what is missing. No résumé needed to start.'
          : 'Right now your alert matches the words you searched. Your free account makes it match you, ranked by how well you fit. No résumé needed to start.',
        last ? 'This is our last note.' : '',
      ].filter(Boolean).join(' '),
      ...lastNote,
    }
  }

  if (persona && step === 'nudge1' && !followUp) {
    const plan = planFor(persona.slug)
    return {
      ...base,
      subject: `Your first week: ${persona.label.toLowerCase()}`,
      headline: 'Your first-week plan',
      paragraphs: [hello(c), plan.intro, 'Three steps for this week:'],
      benefits: plan.steps,
      ctaLabel: 'Save this plan: open my free account',
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
      ctaLabel: 'Or skip ahead: open my free account',
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
      ctaLabel: 'Open my free account',
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
      ctaLabel: 'Open my free account',
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
      ctaLabel: 'Open my free account',
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
      ctaLabel: 'Open my free account',
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
      ctaLabel: 'Open my free account',
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
      ctaLabel: 'Open my free account',
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
      ctaLabel: 'Open my free account',
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
    ctaLabel: 'Open my free account',
    footerNote: note,
  }
}

/** The plain-text twin, kept on the CRM record so you can read what was sent. */
export function leadEmailText(content: LeadEmailContent, ctaUrl: string | null): string {
  return [
    content.headline,
    '',
    ...content.paragraphs,
    ...(content.feature ? ['', `${content.feature.kicker}: ${content.feature.title}`, content.feature.body, `${content.feature.linkLabel}: ${content.feature.url}`] : []),
    ...(content.jobs?.length ? ['', ...content.jobs.map((j) => `- ${j.title}, ${[j.company, j.place].filter(Boolean).join(', ')}: ${j.url}`)] : []),
    ...(content.afterJobs ? ['', content.afterJobs] : []),
    ...(content.choices?.length ? ['', content.choicesPrompt ?? '', ...content.choices.map((o) => `- ${o.label}: ${o.url}`)] : []),
    ...(content.benefits.length ? ['', ...content.benefits.map((b) => `- ${b}`)] : []),
    ...(content.ctaLabel && ctaUrl ? ['', `${content.ctaLabel}: ${ctaUrl}`] : []),
    '',
    content.footerNote,
  ].join('\n')
}
