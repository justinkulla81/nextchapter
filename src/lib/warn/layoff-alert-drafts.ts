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

/** The key a tracked compose click carries through /api/e/go, and the read of it back. */
export const COMPOSE_KEY_PREFIX = 'layoff_compose:'
export const composeKey = (group: string, variant: string | undefined, noticeId: string, personId?: string) => `${COMPOSE_KEY_PREFIX}${group}:${variant ?? '-'}:${personId ?? '-'}:${noticeId}`
export function readComposeKey(key: string): { group: string; variant: string | null; personId: string | null; noticeId: string } | null {
  if (!key.startsWith(COMPOSE_KEY_PREFIX)) return null
  const [group, variant, personId, ...rest] = key.slice(COMPOSE_KEY_PREFIX.length).split(':')
  return group && rest.length ? { group, variant: variant === '-' ? null : variant, personId: personId === '-' ? null : personId, noticeId: rest.join(':') } : null
}

export const COMPOSE_ACCOUNT = 'justin@launchyournextchapter.com'
const SITE = 'https://launchyournextchapter.com'
export const SIGN_OFF = 'Best,\nJustin Kulla\nFounder & CEO, NextChapter\n2248 Broadway #1838, New York, NY 10024\njustin@launchyournextchapter.com\n203-247-9497'
/**
 * Every note ends on the same ask: a 15-minute call. We are selling (Justin, 2026-10-28), so no note offers a handout, a one-pager or a
 * "reply yes" in place of the call, and none ends on a favor. A test fails when a kind drops it.
 */
export const ALONGSIDE = "We’re not a replacement for the services you already offer. We sit alongside them. We help people get hired faster with five things: a job search built around their skills, help with networking (the hardest part to do, and the most effective), retraining (a lot of it on AI), fractional work while they look, and coaching. NextChapter is designed not just to help your people get new jobs, but great jobs and as quickly as possible."
export const CLOSE = "We're a young company, so we're investing to build something that fits you and your people, and cost won't be the reason it doesn't happen. Could we grab 15 minutes this week?"


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
  /** The layoff's county page (/places/<state>/county/<county>), when it exists; the partner notes fall back to the state page. */
  localPage?: string | null
  /** Wraps a compose link so a click is counted (src/app/api/e/go) before it opens Gmail. Absent: the plain link. */
  track?: (href: string, meta: { group: string; variant: string | undefined; personId: string | undefined }) => string
}

/** `variant` is the subject-line test arm ('A', 'B', 'C'), set when a note has several subjects; the same address always gets the same one. */
export interface Draft { subject: string; body: string; variant?: string; /** Every subject arm, for review. */ subjects?: string[] }

function pickSubject(subjects: string[], key: string): { subject: string; variant: string; subjects: string[] } {
  let h = 0
  for (const ch of key.toLowerCase()) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const i = h % subjects.length
  return { subject: subjects[i], variant: 'ABC'[i], subjects }
}

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
  const emp = p.employees ? n(p.employees) : null
  const org = p.employer
  const place = p.county ? `${p.county.replace(/\s+county$/i, '')} County` : state
  const fallbackOpen = `${org} is letting ${who} go${state ? ` in ${state}` : ''}.`

  // The head of HR note: Justin's wording, tightened (2026-10-28). Hook is a checkable number and the page; the call ask stays.
  if (kind === 'head_hr') {
    return {
      ...pickSubject([
        ...(emp ? [`${emp} people leaving ${org}`, `where ${org}'s ${emp} can land`] : [`people leaving ${org}`]),
        `a page for the ${emp ?? ''} leaving ${org}`.replace(/\s{2,}/g, ' '),
      ], c.email ?? c.name),
      body: [hello,
        `I'm Justin Kulla, founder of NextChapter, the leading job transition platform built for laid-off professionals.`,
        `I saw that ${who} are leaving ${org} and wanted to reach out. ${p.openInState != null && state ? `There are ${n(p.openInState)} professional roles open in ${state} right now${p.openSeniorInState ? `, ${n(p.openSeniorInState)} at manager level or above` : ''}, so there is somewhere for them to go.` : ''} I put together a page that shows each person the roles that fit the work they've done. It's free for them to get started with their job transition, regardless of whether you partner with us: ${page}`.replace(/\s{2,}/g, ' '),
        ALONGSIDE,
        CLOSE,
        SIGN_OFF].join('\n\n'),
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
    case 'workforce_board':
    case 'job_centers':
    case 'economic_development': {
      // Public partners, in Justin's voice (2026-10-28): his intro first, the number, the page, "we sit alongside", one short ask.
      const market = p.openInState != null && state ? `There are ${n(p.openInState)} professional roles open in ${state} right now${p.openSeniorInState ? `, ${n(p.openSeniorInState)} at manager level or above` : ''}.` : ''
      const where = place && kind !== 'rapid_response' ? ` in ${place}` : ''
      const lead: Record<string, string> = {
        rapid_response: `I saw that ${who} are leaving ${org}${where} and wanted to reach out before your employer meeting.`,
        workforce_board: `I saw that ${who} are leaving ${org}${where} and wanted to reach out.`,
        job_centers: `I saw that ${who} are leaving ${org}${where}, and some of them may walk into your center.`,
        economic_development: `I saw that ${who} are leaving ${org}${where} and wanted to reach out about keeping that talent in the region.`,
      }
      // Two links for a public partner: the page for the people leaving the employer (what they can hand out) and the local picture.
      // The second link is the partner's own branded page when it has one (a board, a job center, an economic development group), else the county picture.
      const local = c.page ?? x.localPage ?? statePage
      const second = c.page ? `And here is the page I built for ${c.pageName ?? 'your organization'}, with the roles and employers near you: ${c.page}` : `And here is the picture for ${x.localPage && place ? place : state ?? 'your state'}, with where the roles are: ${local}`
      const share = x.peoplePage ? `I put together a page for the ${who} leaving ${org}, matched to the work they did. It's free for ${kind === 'job_centers' ? 'them' : kind === 'economic_development' ? 'the people affected' : 'the people you refer'}: ${x.peoplePage} ${second}` : `I put together a page that shows where the roles are. It's free for the people you refer: ${local}`
      const pageLine: Record<string, string> = { rapid_response: share, workforce_board: share, job_centers: share, economic_development: share }
      const unemployment = kind === 'workforce_board' && p.unemploymentRate != null && p.areaLabel ? `${p.areaLabel} unemployment is ${p.unemploymentRate}%.` : ''
      const subjects: Record<string, string[]> = {
        rapid_response: [`before your ${org} meeting`, ...(emp ? [`where ${org}'s ${emp} can land in ${state ?? 'the state'}`] : [])],
        workforce_board: [emp ? `${org}'s ${emp}, in ${place ?? 'your region'}` : `${org}, in ${place ?? 'your region'}`, `a page for your ${org} layoff`],
        job_centers: [`if someone from ${org} walks in`, `a page for anyone leaving ${org}`],
        economic_development: [`keeping ${org}'s ${emp ?? 'talent'} in ${place ?? 'the state'}`, ...(emp ? [`where ${org}'s ${emp} can land, in ${state ?? 'the state'}`] : [])],
      }
      return {
        ...pickSubject(subjects[kind], c.email ?? c.name),
        body: [hello,
          `I'm Justin Kulla, founder of NextChapter, the leading job transition platform built for laid-off professionals.`,
          [lead[kind], market, hiring(p) ?? '', unemployment, pageLine[kind]].filter(Boolean).join(' '),
          ALONGSIDE,
          CLOSE,
          SIGN_OFF].join('\n\n'),
      }
    }
    case 'recruiters':
      subject = `${who === 'the people' ? 'Professionals' : who} leaving ${org}${state ? ` in ${state}` : ''}`
      lines = [`${org} is letting ${who} go${state ? ` in ${state}` : ''}${ind ? `, in ${ind}` : ''}.`,
        `We work with laid-off professionals, and those who opt in can be introduced to firms that place them. The market they face: ${statePage}`,
        `Open to a short call about working together?`]
      break
  }
  return { subject, body: [hello, ...lines.slice(0, -1), ALONGSIDE, CLOSE, SIGN_OFF].join('\n\n') }
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
      const href = gmailComposeHref(c.email, d.subject, d.body, COMPOSE_ACCOUNT)
      return { ...c, compose: x.track ? x.track(href, { group: g.key, variant: d.variant, personId: c.personId }) : href, variant: d.variant }
    }),
  }))
}
