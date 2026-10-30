// The daily content drafts: one data-backed "card" per story, turned into a version for each channel by plain
// templates (no model call, so no per-draft cost). Pure and client-safe; tested in src/test/content-drafts.test.ts.
//
// Every number in a version comes from the card, and every card is built from NextChapter's own data in cards.ts.
// Posts never name a private person: an employer, an occupation and a count are the only subjects.

export const SITE = 'https://launchyournextchapter.com'

export const CHANNELS = ['linkedin', 'x', 'reddit', 'video', 'newsletter'] as const
export type Channel = (typeof CHANNELS)[number]
export const CHANNEL_LABEL: Record<Channel, string> = {
  linkedin: 'LinkedIn', x: 'X', reddit: 'Reddit', video: 'Short video', newsletter: 'Newsletter',
}

export type CardKind = 'layoff' | 'ai-job' | 'ai-pay' | 'market' | 'deadline'
export const KIND_LABEL: Record<CardKind, string> = {
  layoff: 'Layoff', 'ai-job': 'AI job check', 'ai-pay': 'AI pay premium', market: 'Job market', deadline: 'Benefits deadline',
}

export interface Card {
  kind: CardKind
  /** What the card is about inside its kind and day (an employer, an occupation). */
  subject: string
  /** One plain sentence that carries the number. It is also the first line of every post. */
  headline: string
  /** The number shown huge on the image: "1,200", "+18%". */
  big: string
  /** What the big number counts, one short line under it. */
  bigLabel: string
  /** Two or three plain sentences, each a fact from the data. */
  points: string[]
  /** The first thing a reader can do. */
  action: string
  /** Where the numbers come from, in a few words: "Illinois WARN filing". */
  source: string
  /** The page the links go to, starting with "/". */
  path: string
  /** Subreddits whose rules usually allow a data post on the topic; a person checks each sub's rules before posting. */
  subreddits: string[]
  hashtags: string[]
}

export interface Versions {
  linkedin: { body: string; comment: string }
  x: { body: string }
  reddit: { title: string; body: string; subreddits: string[] }
  video: { lines: { at: string; say: string; show: string }[]; caption: string }
  newsletter: { subject: string; body: string }
}

const UTM_SOURCE: Record<Channel, { source: string; medium: string }> = {
  linkedin: { source: 'linkedin', medium: 'social' },
  x: { source: 'x', medium: 'social' },
  reddit: { source: 'reddit', medium: 'social' },
  video: { source: 'video', medium: 'social' },
  newsletter: { source: 'newsletter', medium: 'email' },
}

/** The campaign every link in one draft carries, so visits by draft can be counted: cd-20261030-ai-job-<subject>. */
export function campaignFor(day: string, card: Pick<Card, 'kind' | 'subject'>): string {
  const subject = card.subject.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `cd-${day.replace(/-/g, '')}-${card.kind}${subject ? `-${subject}` : ''}`
}

/** The full https link for one channel. The Visitors pages read utm_source and utm_campaign from the page path. */
export function trackedLink(path: string, channel: Channel, campaign: string): string {
  const { source, medium } = UTM_SOURCE[channel]
  const sep = path.includes('?') ? '&' : '?'
  return `${SITE}${path}${sep}utm_source=${source}&utm_medium=${medium}&utm_campaign=${campaign}`
}

/** X counts every link as 23 characters, whatever its length. */
export const X_LIMIT = 280
export const X_LINK_LENGTH = 23
export function xLength(text: string): number {
  return text.replace(/https?:\/\/\S+/g, 'x'.repeat(X_LINK_LENGTH)).length
}

function pick<T>(options: T[], seed: string): T {
  let h = 0
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return options[h % options.length]
}

const stop = (s: string) => s.trim().replace(/[.!?]+$/, '')
const sentence = (s: string) => `${stop(s)}.`

function xPost(card: Card, link: string, seed: string): string {
  const closer = pick([card.action, `What to do: ${stop(card.action).toLowerCase()}`], seed)
  const options = [
    `${sentence(card.headline)} ${sentence(card.points[0] ?? '')} ${sentence(closer)}`,
    `${sentence(card.headline)} ${sentence(closer)}`,
    sentence(card.headline),
  ]
  for (const text of options) {
    const full = `${text.replace(/\s+/g, ' ').trim()}\n\n${link}`
    if (xLength(full) <= X_LIMIT) return full
  }
  // The headline alone is too long: cut it at a word so the link still fits.
  const room = X_LIMIT - X_LINK_LENGTH - 4
  const cut = card.headline.slice(0, room).replace(/\s+\S*$/, '')
  return `${cut}…\n\n${link}`
}

/** Builds the five channel versions of a card. Pure: the same card, day and campaign give the same text. */
export function buildVersions(card: Card, campaign: string): Versions {
  const seed = campaign
  const link = (c: Channel) => trackedLink(card.path, c, campaign)
  const bullets = card.points.map((p) => `• ${sentence(p)}`).join('\n')
  const tags = card.hashtags.map((h) => `#${h}`).join(' ')
  const sourceLine = `Source: ${card.source}.`

  const linkedin = {
    body: [
      sentence(card.headline),
      bullets,
      sentence(card.action),
      `${sourceLine}${tags ? `\n\n${tags}` : ''}`,
    ].join('\n\n'),
    comment: `${pick(['The full numbers', 'The details and the source', 'More on this'], seed)}: ${link('linkedin')}`,
  }

  const x = { body: xPost(card, link('x'), seed) }

  // Reddit: the information first, plain, no pitch. The link is the last line so it can be deleted where a sub bans links.
  const reddit = {
    title: stop(card.headline),
    body: [
      card.points.map(sentence).join(' '),
      sentence(card.action),
      sourceLine,
      `More, with the numbers behind it: ${link('reddit')}`,
    ].join('\n\n'),
    subreddits: card.subreddits,
  }

  const short = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/\s+\S*$/, '')}…`)
  const video = {
    lines: [
      { at: '0-3s', say: sentence(card.headline), show: `${card.big} ${card.bigLabel}`.trim() },
      { at: '3-12s', say: sentence(card.points[0] ?? card.headline), show: short(card.points[0] ?? '', 70) },
      ...(card.points[1] ? [{ at: '12-20s', say: sentence(card.points[1]), show: short(card.points[1], 70) }] : []),
      { at: '20-27s', say: sentence(card.action), show: short(card.action, 70) },
      { at: '27-30s', say: 'The link is in my bio.', show: 'launchyournextchapter.com' },
    ],
    caption: `${sentence(card.headline)} ${sourceLine} ${tags}`.trim(),
  }

  const newsletter = {
    subject: short(stop(card.headline), 95),
    body: [
      `**${stop(card.headline)}**`,
      card.points.map(sentence).join(' '),
      sentence(card.action),
      `[Read the numbers](${link('newsletter')})`,
    ].join('\n\n'),
  }

  return { linkedin, x, reddit, video, newsletter }
}

/** Plain text of a channel's version, for the Copy button. */
export function copyText(v: Versions, channel: Channel): string {
  switch (channel) {
    case 'linkedin': return v.linkedin.body
    case 'x': return v.x.body
    case 'reddit': return `${v.reddit.title}\n\n${v.reddit.body}`
    case 'video': return `${v.video.lines.map((l) => `[${l.at}] ${l.say}\n   On screen: ${l.show}`).join('\n')}\n\nCaption: ${v.video.caption}`
    case 'newsletter': return `${v.newsletter.subject}\n\n${v.newsletter.body}`
  }
}
