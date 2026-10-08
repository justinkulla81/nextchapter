import type Anthropic from '@anthropic-ai/sdk'
import { getPage, pageLinks, pageText, sameSite, type PageFetcher } from '@/lib/workforce/college-pages'
import { isHrLeaderTitle } from './org-domains'

/**
 * Finding who runs HR at a company, from the company's own leadership pages.
 * The model reads only the text we fetched; a person is kept only if their
 * name appears verbatim on a page we read and their title is on the list of
 * HR-leader titles. Nothing is filled in from what a model might remember.
 */
export const CHRO_MODEL = 'claude-haiku-4-5'

export const CHRO_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['leader'],
  properties: {
    leader: {
      anyOf: [
        { type: 'null' },
        {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'title', 'sourceUrl', 'linkedinUrl'],
          properties: {
            name: { type: 'string' },
            title: { type: 'string' },
            sourceUrl: { type: 'string' },
            linkedinUrl: { type: ['string', 'null'] },
          },
        },
      ],
    },
  },
} as const

const INSTRUCTIONS = `You are reading pages from a company's website to find the person who leads human resources for the whole company: Chief Human Resources Officer, Chief People Officer, Chief Talent Officer, Chief Culture Officer, or when there is no chief, the most senior executive over HR or people (for example "Executive Vice President, Human Resources" or "Head of People").

Return that one person, or null if the pages do not name them. Someone who leads HR for only one region, business unit or function (talent acquisition, benefits, learning, diversity) is not the head of HR; leave them out.

Copy the name and title exactly as written on the page, and give the address of the page you took them from as sourceUrl. If a LinkedIn profile link for this person appears on the page, give it as linkedinUrl; otherwise null. Only use what is written in the pages below. Never answer from memory.`

export interface PageRead { url: string; text: string }

export function buildChroRequest(company: string, pages: PageRead[]): Anthropic.MessageCreateParamsNonStreaming {
  const body = pages.map((p) => `<page url="${p.url}">\n${p.text}\n</page>`).join('\n\n')
  return {
    model: CHRO_MODEL,
    max_tokens: 400,
    system: INSTRUCTIONS,
    messages: [{ role: 'user', content: `Company: ${company}\n\n${body}` }],
    output_config: { format: { type: 'json_schema', schema: CHRO_SCHEMA as unknown as Record<string, unknown> } },
  }
}

export interface FoundChro { name: string; title: string; sourceUrl: string; linkedinUrl: string | null }

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/** The model's answer, if it checks out against the pages. */
export function verifiedChro(raw: string, pages: PageRead[]): FoundChro | null {
  let parsed: { leader?: FoundChro | null }
  try { parsed = JSON.parse(raw) } catch { return null }
  const l = parsed.leader
  if (!l?.name || !l.title) return null
  const name = l.name.trim()
  if (name.split(/\s+/).length < 2 || name.length > 80) return null
  if (!isHrLeaderTitle(l.title)) return null
  const page = pages.find((p) => p.url === l.sourceUrl)
  const text = squash(page ? page.text : pages.map((p) => p.text).join('\n'))
  if (!text.includes(squash(name))) return null
  const linkedin = l.linkedinUrl && /^https?:\/\/([a-z]+\.)?linkedin\.com\/in\//i.test(l.linkedinUrl) && pages.some((p) => p.text.includes(l.linkedinUrl!)) ? l.linkedinUrl : null
  return { name, title: l.title.trim(), sourceUrl: l.sourceUrl, linkedinUrl: linkedin }
}

const LEADERSHIP_LINK = /\b(leadership|executive (team|leadership|officers|committee)|management team|our (leaders|leadership|team)|senior (management|leadership)|corporate officers|officers|meet the team|leadership team)\b/i
const ABOUT_LINK = /\b(about( us)?|who we are|our company|company( overview)?)\b/i
/** News, blog and campaign pages mention leaders without being the team page. */
const NOT_TEAM_PAGE = /\/(news|newsroom|blog|stories|story|press|events?|insights|thought-leadership|resources|shop|store|products?|careers|jobs)(\/|-|$)|[?&]node=/i
const USUAL_PATHS = [
  'about/leadership', 'about-us/leadership', 'company/leadership', 'leadership', 'about/executive-team', 'about-us/leadership-team',
  'about/leadership-team', 'our-company/leadership', 'about/management', 'about-us/management-team', 'corporate/leadership',
  'en/about/leadership', 'about-us/executive-team', 'our-leadership', 'about/our-leadership', 'leadership-team', 'executive-team',
]

/** A page that lists officers: the word "chief" or "officer" several times. */
const listsOfficers = (text: string) => (text.match(/\b(chief|officer|president)\b/gi) ?? []).length >= 4

/** The company's leadership pages: up to three, found from its homepage or where they usually live. */
export async function readLeadershipPages(website: string, fetchPage: PageFetcher = getPage): Promise<PageRead[]> {
  const home = await fetchPage(website)
  if (!home) return []
  const path = (href: string) => decodeURIComponent(new URL(href).pathname).replace(/[-_/]+/g, ' ')
  const own = (links: ReturnType<typeof pageLinks>) =>
    links.filter((l) => sameSite(l.href, home.url) && !/\.(pdf|jpe?g|png)$/i.test(l.href) && !NOT_TEAM_PAGE.test(l.href))
  const links = own(pageLinks(home.html, home.url))
  const seen = new Set<string>([home.url])
  const out: PageRead[] = []
  const take = async (url: string, timeout?: number) => {
    if (seen.has(url) || out.length >= 3) return null
    seen.add(url)
    const page = await fetchPage(url, timeout)
    if (!page) return null
    const text = pageText(page.html)
    if (text.length >= 300 && listsOfficers(text)) out.push({ url: page.url, text })
    return page
  }
  for (const l of links.filter((l) => LEADERSHIP_LINK.test(l.text) || LEADERSHIP_LINK.test(path(l.href))).slice(0, 3)) await take(l.href)
  if (!out.length) {
    // An About page usually links the team page.
    const about = links.find((l) => ABOUT_LINK.test(l.text))
    const aboutPage = about ? await take(about.href) : null
    const fetched = aboutPage ?? (about ? await fetchPage(about.href) : null)
    if (fetched) {
      const sub = own(pageLinks(fetched.html, fetched.url)).filter((l) => LEADERSHIP_LINK.test(`${l.text} ${path(l.href)}`))
      for (const l of sub.slice(0, 2)) await take(l.href)
    }
  }
  if (!out.length) {
    const origin = new URL(home.url).origin
    for (const p of USUAL_PATHS) {
      if (out.length) break
      await take(`${origin}/${p}`, 6_000)
    }
  }
  return out
}
