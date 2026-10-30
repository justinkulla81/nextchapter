import type { TopicNotice } from '@/lib/seo/topic-data'
import { stateName } from '@/lib/seo/states'

// The weekly check asks two kinds of question. The general ones (prompts.ts) are about advice, where the assistants cite the big job
// sites, Reddit and the Department of Labor. These "data questions" are about the newest filings and our own figures, where we are the
// primary source, so they show how quickly a new layoff page is picked up. Built from the notices already loaded for the layoff pages.

export interface CitationPrompt { key: string; prompt: string }

const DAY_MS = 86_400_000
export const DATA_EMPLOYERS = 8
export const DATA_STATES = 2
/** How many of the general questions each weekly run asks; the 30 rotate so every one is asked about every other week. */
export const GENERAL_PER_RUN = 20

/** Questions about this week's filings: the largest recent employers, the busiest states, and two fixed questions about our own figures. */
export function weeklyDataPrompts(notices: TopicNotice[], now = Date.now()): CitationPrompt[] {
  const recent = notices.filter((n) => now - Date.parse(n.noticeDate) <= 7 * DAY_MS)
  const employers = new Map<string, { name: string; workers: number }>()
  const states = new Map<string, number>()
  for (const n of recent) {
    const e = employers.get(n.slug)
    if (!e) employers.set(n.slug, { name: n.employer, workers: n.workers ?? 0 })
    else e.workers += n.workers ?? 0
    states.set(n.state, (states.get(n.state) ?? 0) + 1)
  }
  const out: CitationPrompt[] = []
  for (const [slug, e] of [...employers.entries()].sort((a, b) => b[1].workers - a[1].workers || a[0].localeCompare(b[0])).slice(0, DATA_EMPLOYERS)) {
    out.push({ key: `data:employer:${slug}`, prompt: `Is ${e.name} laying off employees, and what do the WARN notices say?` })
  }
  for (const [code] of [...states.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, DATA_STATES)) {
    out.push({ key: `data:state:${code}`, prompt: `Which employers filed layoff notices in ${stateName(code)} recently, and how many workers are affected?` })
  }
  out.push({ key: 'data:white-collar', prompt: 'What do the latest numbers show for white-collar hiring and layoffs in the United States?' })
  out.push({ key: 'data:warn-week', prompt: 'Which companies filed WARN layoff notices this week?' })
  return out
}

/** `size` of the general questions, starting at a position that moves with the week, wrapping around the list. */
export function rotateGeneral<T>(all: T[], weekIndex: number, size = GENERAL_PER_RUN): T[] {
  if (all.length <= size) return all
  const start = (((weekIndex * size) % all.length) + all.length) % all.length
  return Array.from({ length: size }, (_, i) => all[(start + i) % all.length])
}

export const weekIndexOf = (now = Date.now()) => Math.floor(now / (7 * DAY_MS))

/** Whether a stored prompt key is one of the weekly data questions. */
export const isDataKey = (key: string) => key.startsWith('data:')
