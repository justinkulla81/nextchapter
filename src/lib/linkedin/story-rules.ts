/**
 * Rules for LinkedIn story posts, pure so they are tested without a database or a clock.
 *
 * A story post is the LinkedIn version of a fact the social stream sent: the same numbers, written for LinkedIn's readers (HR and
 * talent leaders, recruiters, coaches, workforce professionals, economists) in a professional voice, with a hook line, short
 * paragraphs and a closing question. The link goes in the first comment, never the post, so the post keeps its reach.
 */

import { FILLER } from '@/lib/social/validate'

export const MAX_STORY_CHARS = 1500
export const MIN_STORY_CHARS = 350
/** LinkedIn shows about this much before "see more", so the point has to land in it. */
export const HOOK_MAX = 140

const numbers = (s: string): string[] => (s.match(/\d[\d,]*(?:\.\d+)?/g) ?? []).map((x) => x.replace(/,/g, '').replace(/\.0+$/, ''))

export type StoryCheck = { ok: true } | { ok: false; reason: string }

/**
 * A draft is only kept if it holds to the fact it was written from: every number is one of the fact's numbers, the hook stands
 * alone and is short, there is no web address, exactly three hashtags close the post, and none of the tells of a machine-written post.
 */
export function checkStory(body: string, factLines: string[]): StoryCheck {
  const text = body.trim()
  if (text.length < MIN_STORY_CHARS) return { ok: false, reason: `too short: ${text.length} characters, at least ${MIN_STORY_CHARS}` }
  if (text.length > MAX_STORY_CHARS) return { ok: false, reason: `too long: ${text.length} characters, at most ${MAX_STORY_CHARS}` }
  const lines = text.split('\n')
  if ([...lines[0]].length > HOOK_MAX) return { ok: false, reason: `the first line is over ${HOOK_MAX} characters` }
  if (lines.length < 2 || lines[1].trim() !== '') return { ok: false, reason: 'the first line must stand alone, followed by a blank line' }
  if (/https?:\/\/|www\./i.test(text)) return { ok: false, reason: 'no web addresses: the link goes in the first comment' }
  if (/[—–]|\p{Extended_Pictographic}/u.test(text)) return { ok: false, reason: 'no emojis or dashes' }
  if (/!/.test(text)) return { ok: false, reason: 'no exclamation marks' }
  if (FILLER.test(text)) return { ok: false, reason: 'do not say what has or has not been reported or detailed: say only what the facts say' }
  if (/#next\s?chapter/i.test(text)) return { ok: false, reason: 'no brand hashtag: use three hashtags about the topic' }
  const last = lines[lines.length - 1].trim()
  const tags = text.match(/#[A-Za-z][A-Za-z0-9_]*/g) ?? []
  const lastTags = last.match(/#[A-Za-z][A-Za-z0-9_]*/g) ?? []
  if (tags.length !== 3 || lastTags.length !== 3 || last.replace(/#[A-Za-z][A-Za-z0-9_]*/g, '').trim() !== '') {
    return { ok: false, reason: 'the last line must be exactly three hashtags, and there must be no others' }
  }
  // The closing line, just above the hashtags, is a question the reader can answer.
  const closing = [...lines.slice(0, -1)].reverse().find((l) => l.trim() !== '')?.trim() ?? ''
  if (!closing.endsWith('?')) return { ok: false, reason: 'the closing line before the hashtags must be a question ending in a question mark' }
  const allowed = new Set(numbers(factLines.join(' ')))
  const extra = numbers(text).filter((n) => !allowed.has(n))
  if (extra.length) return { ok: false, reason: `these numbers are not in the facts: ${[...new Set(extra)].join(', ')}` }
  return { ok: true }
}

/** What the first comment says before the tracked link, by topic. */
const COMMENT_LEAD: Record<string, string> = {
  ranking: 'The full list, with every place ranked:',
  skill: 'Who is hiring for it and what it pairs with:',
  'ai-pay': 'The method and the data behind the comparison:',
  help: 'What the state pays and how to file:',
  press: 'The data, the charts and how to cite them:',
}

export function storyFirstComment(topic: string, link: string): string {
  return `${COMMENT_LEAD[topic] ?? 'More:'} ${link}`
}

// ---- Staging -----------------------------------------------------------------------------------------------------------

/** Mid-day Eastern, Tuesday to Thursday first: a weekday lunch-hour scroll is when this audience reads. */
const STORY_SLOT_ET: [number, number] = [12, 10]
/** The weekly press post goes out Tuesday at 10:00 Eastern. */
export const PRESS_SLOT_ET = { dow: 2, hour: 10, minute: 0 }
const PREFERRED_DAYS = [2, 3, 4]
const OTHER_DAYS = [1, 5]

const etParts = (d: Date) => {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short' }).formatToParts(d)
  const get = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return { key: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')), minute: Number(get('minute')), dow: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday')) }
}

/** The instant a given Eastern wall-clock time falls on, across the daylight-saving switch. */
function etInstant(y: number, m: number, d: number, hh: number, mm: number): Date {
  for (const off of [5, 4]) {
    const t = new Date(Date.UTC(y, m - 1, d, hh + off, mm))
    const p = etParts(t)
    if (p.hour === hh && p.minute === mm && p.key === `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`) return t
  }
  return new Date(Date.UTC(y, m - 1, d, hh + 5, mm))
}

/**
 * The next slot for a story post: a weekday, one story a day at most, at least an hour from now, and not on a day that already
 * has one waiting. Tuesday to Thursday come before Monday and Friday; weekends never. `press` asks for Tuesday 10:00 Eastern.
 */
export function nextStorySlot(now: Date, taken: Date[], press = false): Date {
  const takenDays = new Set(taken.map((t) => etParts(t).key))
  const earliest = now.getTime() + 3_600_000
  const candidates: Date[] = []
  for (let offset = 0; offset < 28; offset++) {
    const day = new Date(now.getTime() + offset * 86_400_000)
    const { key, dow } = etParts(day)
    const [y, m, d] = key.split('-').map(Number)
    if (press) {
      if (dow !== PRESS_SLOT_ET.dow) continue
      const slot = etInstant(y, m, d, PRESS_SLOT_ET.hour, PRESS_SLOT_ET.minute)
      if (slot.getTime() >= earliest) return slot
      continue
    }
    if (dow === 0 || dow === 6 || takenDays.has(key)) continue
    const slot = etInstant(y, m, d, STORY_SLOT_ET[0], STORY_SLOT_ET[1])
    if (slot.getTime() >= earliest) candidates.push(slot)
  }
  const rank = (s: Date) => (PREFERRED_DAYS.includes(etParts(s).dow) ? 0 : OTHER_DAYS.includes(etParts(s).dow) ? 1 : 2)
  // The earliest slot, unless a preferred day is within four days of it.
  const first = candidates[0] ?? new Date(earliest)
  const near = candidates.filter((c) => c.getTime() - first.getTime() <= 4 * 86_400_000 && rank(c) === 0)
  return rank(first) === 0 || near.length === 0 ? first : near[0]
}

/** A story is posted at least this long after any other LinkedIn post, so the page never posts twice in a row. */
export const STORY_MIN_GAP_MS = 3 * 3_600_000
/** A story more than a day past its slot is left alone; a person decides whether it is still worth posting. */
export const STORY_MAX_LATE_MS = 24 * 3_600_000
/** No new story drafts while this many wait, so the queue never grows into a backlog of stale posts. */
export const MAX_WAITING_STORIES = 6

export function storyDue(d: { status: string; scheduledFor: Date; postUrn: string | null }, now: Date): boolean {
  const late = now.getTime() - d.scheduledFor.getTime()
  return d.status === 'APPROVED' && d.postUrn === null && late >= 0 && late <= STORY_MAX_LATE_MS
}
