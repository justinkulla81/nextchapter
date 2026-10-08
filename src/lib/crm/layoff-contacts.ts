import type Anthropic from '@anthropic-ai/sdk'

/**
 * Finding a real person behind a layoff, from the news coverage of it.
 *
 * A layoff with only a company name is not a lead; a named person is. The CHRO
 * finder reads the company's own leadership pages and only ever returns the
 * head of HR. This reads the articles that reported the layoff and keeps anyone
 * actually involved: a spokesperson, an HR lead, the executive who announced it,
 * a site leader, a government official quoted on it.
 *
 * The model reads only the text we fetched. A person is kept only if their name
 * appears verbatim in the article, and the sentence it gives as evidence is
 * itself found in that article and contains their name. Nothing is filled in
 * from what a model might remember.
 */
export const LAYOFF_CONTACT_MODEL = 'claude-haiku-4-5'

export const CONTACT_KINDS = ['hr', 'spokesperson', 'executive', 'site_leader', 'official'] as const
export type ContactKind = (typeof CONTACT_KINDS)[number]

export const LAYOFF_CONTACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['contacts'],
  properties: {
    contacts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'title', 'kind', 'evidence', 'sourceUrl'],
        properties: {
          name: { type: 'string' },
          title: { type: ['string', 'null'] },
          kind: { type: 'string', enum: [...CONTACT_KINDS] },
          evidence: { type: 'string' },
          sourceUrl: { type: 'string' },
        },
      },
    },
  },
} as const

const INSTRUCTIONS = `You are reading news articles about a company's layoff to find the real people connected to it, so someone can contact them about helping the affected employees.

Return each named person who is directly involved, with the kind that fits:
- hr: leads or speaks for human resources, people, or talent at the company
- spokesperson: the company's spokesperson or communications contact
- executive: an executive or manager who announced, explained or oversees the cuts (for example the author of the memo)
- site_leader: head of the specific site, plant, office or unit being cut
- official: a government or workforce official quoted about the layoff

Leave out: journalists and article authors, analysts, investors, lawyers, union members, and the laid-off employees themselves. Leave out anyone who is not named; "a spokesperson said" is not a person. Leave out anyone who is only mentioned as background, such as a CEO named for context, a founder, or someone quoted about the company's strategy or products. The sentence must connect the person to these cuts: they announced, explained, oversee, or were named as responsible for them, or they speak for the company about them.

Copy the name exactly as written. Give the title as written next to their name, or null if none. For evidence, copy one sentence from the article, word for word, that names this person and shows their connection. Give the address of the article you took them from as sourceUrl. Return at most five people, the most directly involved first. Return an empty list if the articles name nobody. Only use what is written in the articles below. Never answer from memory.`

export interface ArticleRead { url: string; text: string }

export function buildContactRequest(company: string, articles: ArticleRead[]): Anthropic.MessageCreateParamsNonStreaming {
  const body = articles.map((a) => `<article url="${a.url}">\n${a.text}\n</article>`).join('\n\n')
  return {
    model: LAYOFF_CONTACT_MODEL,
    max_tokens: 900,
    system: INSTRUCTIONS,
    messages: [{ role: 'user', content: `Company: ${company}\n\n${body}` }],
    output_config: { format: { type: 'json_schema', schema: LAYOFF_CONTACT_SCHEMA as unknown as Record<string, unknown> } },
  }
}

export interface FoundContact {
  name: string
  title: string | null
  kind: ContactKind
  evidence: string
  sourceUrl: string
}

const squash = (s: string) => s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()

/** A byline, not someone the article is about. */
const BYLINE = /^(by|reported by|reporting by|written by|edited by|story by|photo by)\b/i
/** Names that are really descriptions. */
const NOT_A_NAME = /\b(spokesperson|spokesman|spokeswoman|representative|company|employee|employees|worker|workers|team|department|staff)\b/i

/** The evidence has to be about the cuts, not about the person's place in the company. */
const ABOUT_THE_CUTS = /\b(lay\s?offs?|laid off|cuts?|cutting|jobs?|roles?|positions?|restructur\w*|reorgani[sz]\w*|eliminat\w*|notif\w*|memo|headcount|severance|downsiz\w*|reduction|redundanc\w*|statement|spokes\w*|confirm\w*|announc\w*|changes)\b/i

export const MAX_CONTACTS = 5

/**
 * The model's answer, minus anyone the articles do not bear out. A name must
 * appear in the article the evidence is credited to, the evidence sentence must
 * be in that article and contain the name, and the same person is returned once.
 */
export function verifiedContacts(raw: string, articles: ArticleRead[]): FoundContact[] {
  let parsed: { contacts?: Partial<FoundContact>[] }
  try { parsed = JSON.parse(raw) } catch { return [] }
  const out: FoundContact[] = []
  const seen = new Set<string>()
  for (const c of parsed.contacts ?? []) {
    const name = c.name?.trim().replace(/\s+/g, ' ')
    const evidence = c.evidence?.trim()
    if (!name || !evidence || !c.kind || !(CONTACT_KINDS as readonly string[]).includes(c.kind)) continue
    if (name.split(' ').length < 2 || name.length > 60 || NOT_A_NAME.test(name)) continue
    if (BYLINE.test(evidence)) continue
    const article = articles.find((a) => a.url === c.sourceUrl)
    if (!article) continue
    const text = squash(article.text)
    if (!text.includes(squash(name))) continue
    // The evidence is trusted only if it is really in the article and names them.
    const ev = squash(evidence)
    if (ev.length < 20 || !text.includes(ev) || !ev.includes(squash(name).split(' ').slice(-1)[0])) continue
    if (!ABOUT_THE_CUTS.test(evidence)) continue
    const key = squash(name)
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ name, title: c.title?.trim() || null, kind: c.kind as ContactKind, evidence: evidence.slice(0, 400), sourceUrl: article.url })
    if (out.length >= MAX_CONTACTS) break
  }
  return out
}

/** What a kind of contact is in the CRM: roles, and whether they are worth a baseline follow-up. */
export function crmRolesFor(kind: ContactKind): { roles: ('HIRING_MANAGER' | 'OTHER')[]; priority: 'P2' | null } {
  return kind === 'spokesperson' || kind === 'official'
    ? { roles: ['OTHER'], priority: null }
    : { roles: ['HIRING_MANAGER'], priority: 'P2' }
}
