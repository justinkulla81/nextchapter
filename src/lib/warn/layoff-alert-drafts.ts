/**
 * The first note to each contact in a layoff alert, written for their role and for this layoff,
 * and the Gmail compose link that opens it from justin@launchyournextchapter.com. Pure: the
 * numbers come in as a LocalPicture, so the wording is testable without a database.
 *
 * Pull style (feedback 2026-10-28): the first line is a number about their area they can
 * check, one link, plain text, under 80 words, and the kit or handout is the reward for a reply.
 */
import { gmailComposeHref } from '@/lib/email/gmail-compose-href'
import { STATE_NAMES } from '@/lib/workforce/places'
import { stateSlug } from '@/lib/seo/states'
import { INDUSTRY_NAME, type LocalPicture } from './layoff-picture'
import type { ContactCard, ContactGroup } from './layoff-alert-rules'

export const COMPOSE_ACCOUNT = 'justin@launchyournextchapter.com'
const SITE = 'https://launchyournextchapter.com'
const SIGN_OFF = 'Best,\nJustin Kulla\nFounder and CEO, NextChapter'

const HONOR = /^(dr|mr|mrs|ms|miss|mx|hon|rev|prof|sen|rep|sir|dame|judge|chief|capt|col|gen)\.?$/i
const FORMAL = /^(dr|hon|rev|prof|judge|sen|rep)\.?$/i

/** The greeting for a person: first name, with honorifics and initials dropped; a doctor or judge is "Dr. Last". "team" when nothing usable. */
export function greetingFor(full: string | null | undefined): string {
  const toks = (full ?? '').replace(/\(.*?\)/g, '').replace(/,.*$/, '').trim().split(/\s+/).filter(Boolean)
  let i = 0, formal: string | null = null
  while (i < toks.length && HONOR.test(toks[i])) { if (FORMAL.test(toks[i])) formal = toks[i].replace(/\.?$/, '.'); i++ }
  const rest = toks.slice(i).filter((t) => !/^[A-Za-z]\.?$/.test(t))
  const g = formal ? (rest.length ? `${formal} ${rest[rest.length - 1]}` : '') : (rest[0] ?? '')
  return /^([A-Z][a-z]{0,6}\. )?[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ'’-]+$/.test(g) ? g : 'team'
}

export interface DraftContext {
  picture: LocalPicture
  /** The page for the people affected, on our site (/network/company/<slug>): their employer and situation are known, so it asks them nothing up front. */
  peoplePage: string | null
}

export interface Draft { subject: string; body: string }

const n = (x: number) => x.toLocaleString('en-US')
const industry = (key: string | null) => (key ? INDUSTRY_NAME[key] ?? key.replace(/_/g, ' ') : null)
const jobs = (p: LocalPicture) => (p.employees ? `${n(p.employees)} people` : 'the people')

type Kind = 'head_hr' | 'rewards' | 'er' | 'ta' | 'other_employee' | 'rapid_response' | 'workforce_board' | 'job_centers' | 'economic_development' | 'recruiters'

/** Which note a card gets: by its group, and inside HR by the person's title. */
export function draftKind(groupKey: string, title: string | null): Kind | null {
  if (groupKey === 'hr_team') {
    if (/talent|recruit/i.test(title ?? '')) return 'ta'
    if (/employee relations|labor relations|business partner|people partner|hrbp/i.test(title ?? '')) return 'er'
    return 'rewards'
  }
  if (groupKey === 'employer_other') return 'other_employee'
  const direct: Kind[] = ['head_hr', 'rapid_response', 'workforce_board', 'job_centers', 'economic_development', 'recruiters']
  return (direct as string[]).includes(groupKey) ? (groupKey as Kind) : null
}

/** The sentence every note opens on: a count from our job board that the reader can check on the page we link. */
function openingNumber(p: LocalPicture): string | null {
  if (p.openInState == null || !p.state) return null
  const state = STATE_NAMES[p.state] ?? p.state
  return `${n(p.openInState)} professional roles are open in ${state} on our job board today${p.openSeniorInState ? `, ${n(p.openSeniorInState)} at manager level or above` : ''}.`
}

function hiring(p: LocalPicture, k = 3): string | null {
  const top = p.topIndustries.slice(0, k).map((t) => `${industry(t.key)} (${n(t.openings)})`)
  return top.length ? `Most hiring is outside ${industry(p.industryKey) ?? 'this industry'}: ${top.join(', ')}.` : null
}

export function draftFor(kind: Kind, c: ContactCard, x: DraftContext): Draft {
  const p = x.picture
  const state = p.state ? (STATE_NAMES[p.state] ?? p.state) : null
  const statePage = p.state ? `${SITE}/places/${stateSlug(p.state)}` : SITE
  const page = x.peoplePage ?? statePage
  const hello = !c.greet || c.greet === 'team' ? 'Hi team,' : `${c.greet},`
  const open = openingNumber(p)
  const ind = industry(p.industryKey)
  const who = jobs(p)
  const org = p.employer
  const place = p.county ? `${p.county.replace(/\s+county$/i, '')} County` : state
  const fallbackOpen = `${org} is letting ${who} go${state ? ` in ${state}` : ''}.`

  // The head of HR note is Justin's own wording (2026-10-28), kept whole, with his short sign-off.
  if (kind === 'head_hr') {
    return {
      subject: open && state ? `${n(p.openInState!)} open roles in ${state} for the people leaving ${org}` : `For the people leaving ${org}`,
      body: [hello,
        `I'm Justin Kulla, founder of NextChapter, the leading job transition platform built for laid-off professionals.`,
        `I saw the news that ${who} are leaving ${org}. You're not alone; there's a lot of change hitting the market now. Whether or not you have decided to move forward with a legacy outplacement company, we complement it. You want the best for your people, and it's also in your interest to get them into their next role as fast as possible. We do five things that make that possible: personalized job searching based on skills, networking assistance (since we know that can be the most effective way to get a new job), learning and retraining (with an emphasis on AI), fractional work while they are searching, and coaching, which many people need now more than ever.`,
        `I built a page matching those roles to the work your people did, free for them to use: ${page}`,
        `We're new, so we're willing to work with you on a program that's right for you and your people; we won't let expensive programs be a reason to say no. Our goal is to help the most people possible. Would you be open to a quick 15 minute call this week to discuss how we can help?`,
        'Justin'].join('\n\n'),
    }
  }

  let subject: string, lines: string[]
  switch (kind) {
    case 'rewards':
      subject = open && state ? `${n(p.openInState!)} open roles in ${state} for the people leaving ${org}` : `For the people leaving ${org}`
      lines = [open ?? fallbackOpen,
        `For the ${who} leaving ${org}, we built a page of the roles that fit their work: ${page}`,
        `It can sit beside your outplacement and severance package, and you see counts of who engaged, interviewed and landed, never names. Want the one-pager?`]
      break
    case 'er':
      subject = `A paragraph for ${org}'s separation notes`
      lines = [open ?? fallbackOpen,
        `For the separation notes at ${org}, I can give you one paragraph, with a link, pointing the ${who} leaving to open roles that fit them: ${page}`,
        'Who on your team should receive it?']
      break
    case 'ta':
      subject = `Who owns the transition at ${org}?`
      lines = [open ?? fallbackOpen,
        `You see the market from the hiring side. For the ${who} leaving ${org}, this is what is open now: ${page}`,
        'Who owns their transition? You may know the right person better than any directory does.']
      break
    case 'other_employee':
      subject = `For the people leaving ${org}`
      lines = [open ?? fallbackOpen,
        `I'm reaching out because you know ${org} from the inside. We built a page of the roles that fit the ${who} leaving: ${page}`,
        'Who should it go to? A name is enough.']
      break
    case 'rapid_response':
      subject = open && state ? `${n(p.openInState!)} open roles in ${state}, for your ${org} meeting` : `For your ${org} Rapid Response meeting`
      lines = [open ?? fallbackOpen,
        `${[hiring(p), `If the ${who} leaving ${org} come through your meeting, the roles are here: ${statePage}`].filter(Boolean).join(' ')}`,
        'May I send a one-page handout for the session?']
      break
    case 'workforce_board':
      subject = open && place ? `${n(p.openInState!)} open roles in ${state}, and the ${org} layoff in ${place}` : `The ${org} layoff and where ${place ?? 'your region'} is hiring`
      lines = [open ?? fallbackOpen,
        [hiring(p), p.unemploymentRate != null && p.areaLabel ? `${p.areaLabel} unemployment is ${p.unemploymentRate}%.` : null].filter(Boolean).join(' '),
        `The page, built from public data and our own postings: ${statePage}`,
        'Want a demo for your region?'].filter(Boolean) as string[]
      break
    case 'job_centers':
      subject = `For anyone who comes in from ${org}`
      lines = [open ?? fallbackOpen,
        `${hiring(p) ?? ''} For anyone who walks in from the ${org} layoff, the roles are here: ${statePage}`.trim(),
        'May I send a one-page handout with a QR code for your front desk?']
      break
    case 'economic_development':
      subject = `Keeping ${org}'s talent in ${place ?? 'the state'}`
      lines = [p.openInIndustry != null && ind && state ? `${n(p.openInIndustry)} roles in ${ind} are open in ${state} right now, on our job board.` : (open ?? fallbackOpen),
        `${org} is letting ${who} go. ${hiring(p) ?? ''} Skilled people leave a region when they cannot find work in it; the roles are here: ${statePage}`.replace(/\s+/g, ' ').trim(),
        'Would a one-page note to share with member employers help?']
      break
    case 'recruiters':
      subject = `${who === 'the people' ? 'Professionals' : who} leaving ${org}${state ? ` in ${state}` : ''}`
      lines = [`${org} is letting ${who} go${state ? ` in ${state}` : ''}${ind ? `, in ${ind}` : ''}.`,
        `We work with laid-off professionals, and those who opt in can be introduced to firms that place them. The market they face: ${statePage}`,
        `Open to a short call about working together?`]
      break
  }
  return { subject, body: [hello, ...lines].join('\n\n') + '\n\n' + SIGN_OFF }
}

/**
 * The groups with a Gmail compose link on every card that has an email address. A card for a role we
 * write no note for, or with no address, is returned untouched.
 */
export function withComposeLinks(groups: ContactGroup[], x: DraftContext): ContactGroup[] {
  return groups.map((g) => ({
    ...g,
    cards: g.cards.map((c) => {
      const kind = draftKind(g.key, c.title)
      if (!kind || !c.email) return c
      const d = draftFor(kind, c, x)
      return { ...c, compose: gmailComposeHref(c.email, d.subject, d.body, COMPOSE_ACCOUNT) }
    }),
  }))
}
