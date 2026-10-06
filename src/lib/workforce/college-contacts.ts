import type Anthropic from '@anthropic-ai/sdk'
import { COLLEGE_ROLES, type CollegeRole, type PageText } from './college-pages'

/**
 * Pulling department heads out of a college's own pages with Claude Haiku
 * 4.5, through the Batch API. The model reads only the text we fetched; a
 * contact is kept only if its name — and its email, when it has one —
 * appears verbatim on the page it is credited to. Nothing is filled in
 * from what a model might remember.
 */
export const CONTACTS_MODEL = 'claude-haiku-4-5'

const ROLES = Object.keys(COLLEGE_ROLES) as CollegeRole[]

const nullableString = { type: ['string', 'null'] } as const
export const CONTACTS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['contacts'],
  properties: {
    contacts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['role', 'name', 'title', 'email', 'phone', 'sourceUrl'],
        properties: {
          role: { type: 'string', enum: ROLES },
          name: nullableString,
          title: nullableString,
          email: nullableString,
          phone: nullableString,
          sourceUrl: { type: 'string' },
        },
      },
    },
  },
} as const

const INSTRUCTIONS = `You are reading pages from a college's website to find who leads four offices:
- career: career services / career center
- alumni: alumni relations / alumni association
- development: advancement, development, fundraising or the college foundation
- execEd: executive education, continuing education, professional studies or workforce training

For each office, give the person who leads it: their title must show they head that office as a whole (for example "Executive Director, Career Center", "Vice President for Advancement", "Director of Alumni Relations", "Dean of Continuing Education", "Executive Director of the Foundation"). Someone who runs one program inside the office (volunteer experience, donor services, annual giving, events, employer relations) or a board member or volunteer is not its leader; leave them out.

If the pages name no leader for an office but show the office's own general email or phone, return that office with name null and the office's email and phone.

Copy names, titles, emails and phones exactly as written, and give the address of the page you took them from as sourceUrl. Only use what is written in the pages below. If an email or phone is not shown, use null. Never guess an email address from a naming pattern. Leave out any office the pages say nothing useful about.`

export function buildContactsRequest(collegeName: string, pages: PageText[]): Anthropic.MessageCreateParamsNonStreaming {
  const body = pages
    .map((p) => `<page url="${p.url}" office="${p.role}">\n${p.text}\n</page>`)
    .join('\n\n')
  return {
    model: CONTACTS_MODEL,
    max_tokens: 1500,
    system: INSTRUCTIONS,
    messages: [{ role: 'user', content: `College: ${collegeName}\n\n${body}` }],
    output_config: { format: { type: 'json_schema', schema: CONTACTS_SCHEMA as unknown as Record<string, unknown> } },
  }
}

export interface ExtractedContact {
  role: CollegeRole
  /** null for an office's general line. */
  name: string | null
  title: string | null
  email: string | null
  phone: string | null
  sourceUrl: string
}

/** A title that heads an office — listed, not inferred. */
const LEADER_TITLE = /\b(director|dean|vice president|vice chancellor|vice provost|president|chancellor|chief|head|executive director|associate vice|assistant vice|avp|vp)\b/i
/** Titles of one program inside an office, which the model sometimes offers as its head. */
const SUB_PROGRAM = /\b(donor services|annual (giving|fund)|volunteer|events?|stewardship|employer relations|prospect research|gift (processing|planning)|data|operations|communications|marketing|records|student engagement|reunion|chapters?|board (member|chair)|trustee)\b/i

export function isLeaderTitle(title: string | null): boolean {
  return !!title && LEADER_TITLE.test(title) && !SUB_PROGRAM.test(title)
}

const squash = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()

/**
 * The contacts that check out against their pages: one per role, the name
 * on the cited page (or any page read for that college), the email too.
 */
export function verifiedContacts(raw: string, pages: PageText[]): ExtractedContact[] {
  let parsed: { contacts?: ExtractedContact[] }
  try { parsed = JSON.parse(raw) } catch { return [] }
  const all = squash(pages.map((p) => p.text).join('\n'))
  const out = new Map<CollegeRole, ExtractedContact>()
  for (const c of parsed.contacts ?? []) {
    if (!ROLES.includes(c.role)) continue
    // A person beats an office line for the same role.
    const existing = out.get(c.role)
    if (existing && (existing.name || !c.name)) continue
    const name = c.name?.trim() || null
    if (name && (name.split(/\s+/).length < 2 || name.length > 80)) continue
    const page = pages.find((p) => p.url === c.sourceUrl)
    const text = page ? squash(page.text) : all
    if (name && !text.includes(squash(name))) continue
    if (name && !isLeaderTitle(c.title)) continue
    const email = c.email?.trim().replace(/^mailto:/i, '') || null
    const emailOk = !!email && /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) && all.includes(email.toLowerCase())
    const phone = c.phone?.trim() || null
    const digits = (v: string) => v.replace(/\D/g, '')
    const phoneOk = !!phone && digits(phone).length >= 10 && digits(all).includes(digits(phone).slice(-10))
    // An office line is only worth keeping with a way to reach it.
    if (!name && !emailOk && !phoneOk) continue
    out.set(c.role, {
      role: c.role,
      name,
      title: c.title?.trim() || null,
      email: emailOk ? email : null,
      phone: phoneOk ? phone : null,
      sourceUrl: page?.url ?? (name ? pages.find((p) => squash(p.text).includes(squash(name)))?.url : undefined) ?? pages[0]?.url ?? c.sourceUrl,
    })
  }
  return [...out.values()]
}
