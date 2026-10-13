import type { ContactWarmth } from '@prisma/client'

// The networking coach: for one contact and one goal, what to say, why you
// have a reason to write, what to offer, how big an ask is fair, when to follow
// up, and a short blurb they can forward. Deterministic templates (same call as
// scripts.ts: free, instant, reviewable) — the candidate edits the draft before
// sending, so these aim to be a strong, specific starting point, not a finished
// letter.

export type PlaybookPurpose =
  | 'REACH_OUT'
  | 'INFO_CHAT'
  | 'ASK_INTRO'
  | 'ASK_REFERRAL'
  | 'FOLLOW_UP'
  | 'THANK_YOU'
  | 'GIVE_FIRST'

export const PLAYBOOK_PURPOSES: { purpose: PlaybookPurpose; label: string; blurb: string }[] = [
  { purpose: 'REACH_OUT', label: 'Reconnect', blurb: "It's been a while — warm the relationship up before asking for anything" },
  { purpose: 'INFO_CHAT', label: 'Ask for a 15-minute chat', blurb: 'Their advice on a field, company or move' },
  { purpose: 'ASK_INTRO', label: 'Ask for an introduction', blurb: 'Someone they know who you want to meet' },
  { purpose: 'ASK_REFERRAL', label: 'Ask for a referral', blurb: 'A specific open role at their company' },
  { purpose: 'FOLLOW_UP', label: 'Follow up (no reply yet)', blurb: 'A short, kind nudge after silence' },
  { purpose: 'THANK_YOU', label: 'Thank you', blurb: 'After a chat, an intro or advice' },
  { purpose: 'GIVE_FIRST', label: 'Offer something first', blurb: 'Send value with no ask attached' },
]

export type AskSize = 'SMALL' | 'MEDIUM' | 'BIG'

export const ASK_SIZES: { size: AskSize; label: string; description: string }[] = [
  { size: 'SMALL', label: 'Small', description: 'A reply, a name or a link — a minute of their time' },
  { size: 'MEDIUM', label: 'Medium', description: '15 minutes on a call or coffee' },
  { size: 'BIG', label: 'Big', description: 'An intro or a referral — they spend their reputation' },
]

// A real reason to write that isn't "I need a job". People respond to a
// specific, genuine trigger far more than to a bare "just checking in".
export type HookKind =
  | 'THEIR_NEWS'
  | 'COMPANY_NEWS'
  | 'SHARED_HISTORY'
  | 'MUTUAL_CONNECTION'
  | 'CONTENT'
  | 'ADVICE_ON_MOVE'
  | 'SEASONAL'

export const HOOKS: { kind: HookKind; label: string; prompt: string }[] = [
  { kind: 'THEIR_NEWS', label: 'Their promotion, post or news', prompt: 'What did they share or achieve recently?' },
  { kind: 'COMPANY_NEWS', label: 'News from their company', prompt: 'A launch, funding round or announcement you saw' },
  { kind: 'SHARED_HISTORY', label: 'Something you shared', prompt: 'A project, employer or school you both know' },
  { kind: 'MUTUAL_CONNECTION', label: 'Someone you both know', prompt: 'Who mentioned them, or who suggested you write?' },
  { kind: 'CONTENT', label: 'An article or idea for them', prompt: 'Something you read that made you think of them' },
  { kind: 'ADVICE_ON_MOVE', label: 'Their take on a decision', prompt: 'A choice where their experience is exactly what you need' },
  { kind: 'SEASONAL', label: 'The season or a milestone', prompt: 'New year, a conference, an anniversary of working together' },
]

export interface PlaybookInput {
  purpose: PlaybookPurpose
  askSize: AskSize
  hook: HookKind
  // One specific sentence about the hook, written by the candidate. Empty is
  // fine — the draft keeps a [bracketed] slot so it can't go out generic by
  // accident.
  hookDetail: string
  contactFirstName: string
  contactCompany: string | null
  contactTitle: string | null
  warmth: ContactWarmth
  candidateFirstName: string
  targetRole: string | null
  // Confidential Search Mode: never say "job search" or "looking for".
  discreet: boolean
  // Something the candidate can give back (an intro, a data point, feedback).
  offer: string
  // Role the referral is for, when purpose is ASK_REFERRAL.
  roleTitle: string
  daysSinceLastContact: number | null
}

export interface PlaybookResult {
  subject: string
  body: string
  whyItWorks: string[]
  askGuidance: string
  offerIdeas: string[]
  followUpPlan: string[]
  leaveBehind: string
  warnings: string[]
}

const slot = (value: string, placeholder: string) => (value.trim() ? value.trim() : `[${placeholder}]`)

function openingLine(input: PlaybookInput): string {
  const detail = input.hookDetail.trim()
  switch (input.hook) {
    case 'THEIR_NEWS':
      return `Congratulations on ${slot(detail, 'their news — be specific')}. It's well earned.`
    case 'COMPANY_NEWS':
      return `I saw ${slot(detail, 'the news from their company')} and immediately thought of you.`
    case 'SHARED_HISTORY':
      return `I was thinking about ${slot(detail, 'the project or place you shared')} the other day and how much I learned from working with you.`
    case 'MUTUAL_CONNECTION':
      return `${slot(detail, 'Mutual connection')} suggested I get in touch.`
    case 'CONTENT':
      return `I came across ${slot(detail, 'the article or idea')} and thought of you.`
    case 'ADVICE_ON_MOVE':
      return `I'm weighing ${slot(detail, 'the decision')} and your experience is exactly what I'd want to hear.`
    case 'SEASONAL':
      return `${slot(detail, 'A quick note for the season or milestone')}.`
  }
}

function askLine(input: PlaybookInput): string {
  const role = input.targetRole ?? 'my next role'
  if (input.discreet) {
    switch (input.askSize) {
      case 'SMALL':
        return `If anything comes to mind about where ${role} work is heading, I'd value a line or two, no rush.`
      case 'MEDIUM':
        return `Would you be open to 15 minutes sometime in the next couple of weeks? I'm quietly getting a read on ${role} work and would love your perspective.`
      case 'BIG':
        return `Is there someone in your world who'd be worth talking to about ${role} work? An introduction would mean a lot, and I'm happy to make it easy to forward.`
    }
  }
  switch (input.askSize) {
    case 'SMALL':
      return `If you hear of anything in ${role}, or know a name I should look up, I'd be grateful for a line back, no rush.`
    case 'MEDIUM':
      return `Would you be open to 15 minutes in the next couple of weeks? I'm focused on ${role} and would value your read on how to go about it.`
    case 'BIG':
      return `Would you be open to introducing me to someone worth talking to about ${role}? I'll write something short you can forward as is.`
  }
}

function offerLine(input: PlaybookInput): string {
  const offer = input.offer.trim()
  return offer ? `In return, ${offer}.` : ''
}

function exitLine(input: PlaybookInput): string {
  return input.warmth === 'COLD'
    ? "And if the timing isn't right, no problem at all. I'm glad to be back in touch."
    : "No pressure either way. Say the word and I'll keep it easy for you."
}

function compose(parts: (string | false | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim().length > 0).join('\n\n')
}

export function buildPlaybook(input: PlaybookInput): PlaybookResult {
  const hi = `Hi ${input.contactFirstName || '[Name]'},`
  const sign = `Thanks,\n${input.candidateFirstName || '[Your name]'}`
  const company = input.contactCompany ?? 'your company'
  const role = input.roleTitle.trim() || '[role title]'
  const warnings: string[] = []

  let subject: string
  let body: string

  switch (input.purpose) {
    case 'REACH_OUT':
      subject = input.hook === 'MUTUAL_CONNECTION' ? 'Introduction from a mutual friend' : 'Thinking of you'
      body = compose([
        hi,
        openingLine(input),
        input.daysSinceLastContact !== null && input.daysSinceLastContact > 365
          ? "It's been far too long. I'd love to hear what you're working on now."
          : "I'd love to hear what you're working on now.",
        input.askSize === 'SMALL' ? undefined : askLine(input),
        offerLine(input),
        exitLine(input),
        sign,
      ])
      break
    case 'INFO_CHAT':
      subject = '15 minutes of your advice?'
      body = compose([hi, openingLine(input), askLine({ ...input, askSize: 'MEDIUM' }), offerLine(input), exitLine(input), sign])
      break
    case 'ASK_INTRO':
      subject = 'A quick introduction?'
      body = compose([
        hi,
        openingLine(input),
        `I noticed you know [Person] at [Their company]. ${askLine({ ...input, askSize: 'BIG' })}`,
        "To keep it easy, here's a two-line note you can forward as is (below). Totally fine to say no.",
        offerLine(input),
        sign,
      ])
      break
    case 'ASK_REFERRAL':
      subject = `${role} at ${company}`
      body = compose([
        hi,
        openingLine(input),
        `I saw the ${role} opening at ${company}. My background lines up in [one specific way], and I'd love to know whether you'd be comfortable referring me or telling me who owns the hiring.`,
        "I'll send my resume and a short note you can pass along, and I'll understand either way if it isn't a fit for a referral.",
        offerLine(input),
        sign,
      ])
      if (!input.roleTitle.trim()) warnings.push('Add the exact role title so they can find it in a minute.')
      break
    case 'FOLLOW_UP':
      subject = 'Re: my last note'
      body = compose([
        hi,
        'Floating this back to the top of your inbox in case it got buried, I know how busy things get.',
        input.askSize === 'SMALL'
          ? 'Even a one-line answer would help.'
          : 'If a call is too much right now, a quick reply with one name or one tip would still be a big help.',
        exitLine(input),
        sign,
      ])
      break
    case 'THANK_YOU':
      subject = 'Thank you'
      body = compose([
        hi,
        `Thank you for ${slot(input.hookDetail, 'what they did — name the specific advice or intro')}. It made a real difference.`,
        "I'm going to [one thing you'll do with their advice] and I'll let you know how it goes.",
        offerLine(input) || 'If I can ever return the favor, please say so.',
        sign,
      ])
      break
    case 'GIVE_FIRST':
      subject = 'Thought this might be useful'
      body = compose([hi, openingLine(input), offerLine(input) || 'No reply needed. I just wanted to send it your way.', 'No ask attached, just thinking of you.', sign])
      break
  }

  if (input.discreet && /\b(job search|looking for|laid off|unemployed)\b/i.test(body)) {
    warnings.push('Confidential Search Mode is on: edit out anything that announces a search.')
  }
  if (input.purpose !== 'THANK_YOU' && input.purpose !== 'GIVE_FIRST' && input.warmth === 'COLD' && input.askSize === 'BIG') {
    warnings.push(
      'This is a big ask for someone you haven\'t talked to in a while. Consider reconnecting first, or asking for 15 minutes before asking for an intro.'
    )
  }
  if (input.purpose === 'ASK_REFERRAL' && input.askSize !== 'BIG') {
    warnings.push('A referral is a big ask. Ask for it, or pick a smaller ask.')
  }

  return {
    subject,
    body,
    whyItWorks: whyItWorks(input),
    askGuidance: askGuidance(input),
    offerIdeas: [
      'A relevant article, report or data point from your own research',
      'An introduction to someone useful to them',
      'Your honest feedback on their product, post or hiring page',
      'A heads-up about a person, event or opening you know of',
      'Your time: an hour of help on a project in your area of expertise',
    ],
    followUpPlan: followUpPlan(input),
    leaveBehind: leaveBehind(input),
    warnings,
  }
}

function whyItWorks(input: PlaybookInput): string[] {
  const reasons = ['It opens with a real reason to write, not "just checking in".']
  if (input.askSize === 'SMALL') reasons.push('The ask takes under a minute, so it is easy to say yes.')
  else if (input.askSize === 'MEDIUM') reasons.push('15 minutes is specific and bounded, which gets more yeses than "pick your brain".')
  else reasons.push('It makes forwarding easy: you do the writing, they only press send.')
  reasons.push(input.warmth === 'COLD' ? 'It gives them an easy, graceful way to say no.' : 'It stays warm and low-pressure.')
  return reasons
}

function askGuidance(input: PlaybookInput): string {
  switch (input.askSize) {
    case 'SMALL':
      return 'A small ask is right for a lukewarm contact or a first message. Send it freely.'
    case 'MEDIUM':
      return input.warmth === 'COLD'
        ? 'A 15-minute ask is fair after a warm-up note. If you have not spoken in over a year, reconnect first.'
        : 'A 15-minute call is a fair ask of a warm contact. Offer two specific times if they say yes.'
    case 'BIG':
      return input.warmth === 'HOT'
        ? 'A big ask suits a close contact. Make it easy: draft the forward note for them and give them an easy out.'
        : 'Save big asks for people who know your work. Build up with a smaller ask first.'
  }
}

function followUpPlan(input: PlaybookInput): string[] {
  if (input.purpose === 'THANK_YOU') {
    return ['Send within 24 hours of the chat.', 'Two to four weeks later, send a short update on what you did with their advice.']
  }
  if (input.purpose === 'GIVE_FIRST') {
    return ["Don't chase a reply.", 'Wait a month, then ask for a small favor, now with goodwill behind it.']
  }
  return [
    'Day 7: we will flag it here if there is no reply. Send one short nudge.',
    'Day 14 to 21: a second, different nudge, such as a new article or a quick update.',
    'After that, stop. Revisit in two or three months with something new to share.',
    'If they say yes: confirm times within the hour, and send a thank-you the same day.',
  ]
}

// The thing they can forward or keep after the conversation: a self-contained
// paragraph about the candidate, so a busy contact never has to write one.
function leaveBehind(input: PlaybookInput): string {
  const role = input.targetRole ?? '[target role]'
  const lead = input.discreet
    ? `${input.candidateFirstName || '[Your name]'} is a ${role} professional building a view of the market.`
    : `${input.candidateFirstName || '[Your name]'} is a ${role} professional looking for the next step.`
  return [
    lead,
    '[One sentence on the result you are proudest of, with a number.]',
    'Good fits: [2 to 3 specific roles or companies]. Helpful intros: [the kind of person who would be most useful].',
    'Resume and LinkedIn: [link]',
  ].join(' ')
}
