import 'server-only'
import * as cheerio from 'cheerio'
import { z } from 'zod'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type Anthropic from '@anthropic-ai/sdk'

// A tech-news newsletter packs a dozen company events into one email: layoffs,
// acquisitions, shutdowns, executive moves. This reads one email and returns
// the ones a job seeker could act on — who, what, and the story's own link.
// One Haiku call per email (~$0.01), no page fetches.

export const EXTRACT_MODEL = 'claude-haiku-4-5-20251001'
export const MAX_TEXT_CHARS = 24_000
export const MAX_LINKS = 80

export const EVENT_KINDS = ['layoff', 'acquisition', 'shutdown', 'exec_change'] as const
export type EventKind = (typeof EVENT_KINDS)[number]

export const EVENT_LABELS: Record<EventKind, string> = {
  layoff: 'Newsletter: layoffs',
  acquisition: 'Newsletter: acquisitions and acqui-hires',
  shutdown: 'Newsletter: product and service shutdowns',
  exec_change: 'Newsletter: executive changes',
}

const eventSchema = z.object({
  events: z.array(
    z.object({
      company: z.string(),
      kind: z.enum([...EVENT_KINDS, 'other']),
      summary: z.string(),
      employees: z.number().nullable(),
      role: z.string().nullable(),
      direction: z.enum(['departure', 'appointment', 'search']).nullable(),
      linkIndex: z.number().nullable(),
    })
  ),
})
export type NewsletterEvents = z.infer<typeof eventSchema>

const SKIP_LINK = /unsubscribe|preferences|manage|mailto:|view[- ]in[- ]browser|twitter\.com|x\.com|linkedin\.com\/share|facebook\.com/i

export interface NewsletterText { text: string; links: { text: string; url: string }[]; source: string | null }

/** A newsletter's readable text plus its story links, in order, for the model to point at by number. */
export function newsletterText(html: string): NewsletterText {
  const $ = cheerio.load(html)
  $('script, style, head').remove()
  const links: { text: string; url: string }[] = []
  const seen = new Set<string>()
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? ''
    const text = $(el).text().replace(/\s+/g, ' ').trim()
    try {
      const u = new URL(href)
      if (!/^https?:$/.test(u.protocol) || SKIP_LINK.test(href) || seen.has(u.toString())) return
      seen.add(u.toString())
      if (links.length < MAX_LINKS) links.push({ text: text.slice(0, 80), url: u.toString() })
    } catch { /* not a link worth keeping */ }
  })
  const text = $('body').text().replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, MAX_TEXT_CHARS)
  return { text, links, source: null }
}

function prompt(n: NewsletterText): string {
  const links = n.links.map((l, i) => `${i}: ${l.text || '(no text)'}`).join('\n')
  return `Below is a tech-industry newsletter. List each company event a job seeker could act on:
- layoff: a company cutting staff (give the headcount in "employees" when stated, else null).
- acquisition: a company acquiring another, including acqui-hires where the team joins the buyer. Name the company that is ACQUIRED or whose team moves, not the buyer, unless the buyer is also hiring or cutting.
- shutdown: a product or service closing down.
- exec_change: a named executive leaving, being demoted or being hired, or an executive search under way ("role" is the seat, e.g. "CFO"; "direction" is "departure" if they left or were removed or demoted out of the seat, "appointment" if a permanent new person took it, "search" if the company is looking for someone to fill it; null for other kinds).
Everything else (funding rounds, product launches, opinion, lawsuits) is "other" — skip it or mark it other.

For each event: company (its common name, no suffix), kind, summary (one plain sentence for a job seeker naming the company), employees, role, and linkIndex — the number of the link below that points to that story, or null if none clearly does.

Newsletter text:
${n.text}

Links:
${links}`
}

export interface ExtractedEvent {
  company: string
  kind: EventKind
  summary: string
  employees: number | null
  role: string | null
  direction: 'departure' | 'appointment' | 'search' | null
  url: string | null
}

/** Pure: the model's read made into events with real URLs, other kinds and blank names dropped. */
export function eventsFromRead(read: NewsletterEvents, links: { url: string }[]): ExtractedEvent[] {
  const out: ExtractedEvent[] = []
  for (const e of read.events) {
    if (e.kind === 'other') continue
    const company = e.company.trim()
    if (company.length < 2 || !e.summary.trim()) continue
    const url = e.linkIndex != null && Number.isInteger(e.linkIndex) ? links[e.linkIndex]?.url ?? null : null
    const employees = e.employees != null && e.employees > 0 && e.employees < 500_000 ? Math.round(e.employees) : null
    out.push({
      company, kind: e.kind, summary: e.summary.trim(), employees, role: e.role?.trim() || null,
      direction: e.kind === 'exec_change' ? e.direction : null, url,
    })
  }
  return out
}

/** One Haiku call over one newsletter. Throws on API or parse failure; the caller leaves the email unread. */
export async function extractNewsletterEvents(client: Anthropic, n: NewsletterText): Promise<ExtractedEvent[]> {
  const stream = client.messages.stream({
    model: EXTRACT_MODEL,
    max_tokens: 2048,
    thinking: { type: 'disabled' },
    output_config: { format: zodOutputFormat(eventSchema) },
    messages: [{ role: 'user', content: prompt(n) }],
  })
  const message = await stream.finalMessage()
  if (!message.parsed_output) throw new Error(`no parsed output (stop_reason ${message.stop_reason})`)
  return eventsFromRead(message.parsed_output, n.links)
}
