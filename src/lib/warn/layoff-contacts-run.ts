import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/prisma'
import { getPage, pageText } from '@/lib/workforce/college-pages'
import { addContactToCrm, ensureOrg } from '@/lib/crm/add-contact'
import { goalsForRoles } from '@/lib/crm/goals'
import { captureServerEvent } from '@/lib/posthog/server'
import {
  buildContactRequest, verifiedContacts, crmRolesFor, type ArticleRead,
} from '@/lib/crm/layoff-contacts'

/** The most articles read for one layoff — the metered part, kept small. */
const MAX_ARTICLES = 3
/** Articles tried to find that many readable ones; some are paywalled or built with JavaScript. */
const MAX_TRIES = 6
/** Under this, a page is a shell or a paywall, not an article. */
const MIN_ARTICLE_CHARS = 600

export interface LayoffContactResult {
  articlesRead: number
  found: number
  added: number
  matched: number
  review: number
  removed: number
}

/** The layoff a lookup is for: who cut, how many, when, and the articles that reported it. */
export interface LayoffCoverage {
  employer: string
  employees: number | null
  date: Date | null
  /** The employer's CRM organization when the notice has one; otherwise it is found or made by name. */
  orgId?: string | null
  urls: string[]
}

/** Syndicators and aggregators serve the same story as the publisher, with less of its text. */
const AGGREGATOR = /(^|\.)(msn\.com|news\.google\.com|yahoo\.com|flipboard\.com|newsbreak\.com)$/i
const host = (url: string) => { try { return new URL(url).hostname } catch { return '' } }

async function readArticles(urls: string[]): Promise<ArticleRead[]> {
  const ordered = [...urls.filter((u) => !AGGREGATOR.test(host(u))), ...urls.filter((u) => AGGREGATOR.test(host(u)))].slice(0, MAX_TRIES)
  const out: ArticleRead[] = []
  for (const url of ordered) {
    if (out.length >= MAX_ARTICLES) break
    const page = await getPage(url)
    if (!page) continue
    const text = pageText(page.html)
    if (text.length >= MIN_ARTICLE_CHARS) out.push({ url: page.url, text })
  }
  return out
}

/**
 * Finds the real people named in the coverage of one layoff and puts them in
 * the CRM. Reads at most three of the articles that reported it and makes one
 * Haiku call (about a cent). People land under the same rules as every other
 * contact: matched by email or by name at the organization, never recreated if
 * removed, and flagged for the Review List when the name is already in the CRM.
 * The note on each says where they were found, so no one is contacted blind.
 *
 * Keyed on the coverage, not a notice: a layoff a WARN filing already covers
 * has no notice of its own, and is the more common case for a big employer.
 */
export async function findLayoffContacts(layoff: LayoffCoverage, claude: Anthropic = new Anthropic()): Promise<LayoffContactResult> {
  const result: LayoffContactResult = { articlesRead: 0, found: 0, added: 0, matched: 0, review: 0, removed: 0 }
  const urls = [...new Set(layoff.urls)]
  if (!urls.length) return result

  const articles = await readArticles(urls)
  result.articlesRead = articles.length
  if (!articles.length) return result

  const msg = await claude.messages.create(buildContactRequest(layoff.employer, articles)).catch((e) => {
    console.error('Layoff contact lookup failed for', layoff.employer, e)
    return null
  })
  const raw = msg?.content.find((b) => b.type === 'text')?.text ?? ''
  const contacts = verifiedContacts(raw, articles)
  result.found = contacts.length
  if (!contacts.length) return result

  const org = layoff.orgId
    ? await prisma.crmOrganization.findUnique({ where: { id: layoff.orgId }, select: { id: true, name: true } })
    : null
  const target = org ?? (await ensureOrg({ name: layoff.employer, type: 'EMPLOYER' }))
  const when = layoff.date?.toISOString().slice(0, 10) ?? 'recently'
  const size = layoff.employees ? `${layoff.employees.toLocaleString('en-US')} jobs` : 'jobs'

  for (const c of contacts) {
    const { roles, priority } = crmRolesFor(c.kind)
    const r = await addContactToCrm({
      fullName: c.name, title: c.title, email: null,
      orgId: target.id, orgName: target.name, roles, goals: goalsForRoles(roles), priority,
      note: `${c.title ?? c.kind.replace('_', ' ')} named in coverage of the ${layoff.employer} layoff (${size}, ${when}): "${c.evidence}" Source: ${c.sourceUrl}. Found by the layoff contact finder; confirm before outreach.`,
    })
    if (r.outcome === 'removed') { result.removed++; continue }
    result[r.outcome]++
    captureServerEvent('cron', 'layoff_contact_found', {
      orgId: target.id, personId: r.personId, kind: c.kind, outcome: r.outcome, hasTitle: !!c.title, employer: layoff.employer,
    })
  }
  return result
}
