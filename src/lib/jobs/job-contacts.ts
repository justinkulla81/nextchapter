import 'server-only'
import type { ExclusiveJobPosting } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'

/**
 * Who a member should contact about a job:
 * - the search firm, for a recruiter-led search (the source we found it on);
 * - recruiters in our CRM at that employer — recruiting / talent-acquisition
 *   titles, real email addresses only (never a guessed one), and never a
 *   person we're working ourselves (any CRM priority, or a BD / sales /
 *   fundraising goal), so members don't land in Justin's own pipeline;
 * - a LinkedIn people search for recruiters there, for everything else.
 */

export interface JobContact {
  name: string
  title: string | null
  email: string
}

export interface JobContacts {
  firm: { name: string; url: string | null } | null
  recruiters: JobContact[]
  linkedinSearchUrl: string
}

const RECRUITER_TITLE = /\b(recruit\w*|talent acquisition|talent partner|sourc(er|ing)|staffing|head of talent|talent lead)\b/i
const OUR_PIPELINE_GOALS = new Set(['BD', 'SALES', 'FUNDRAISING'])
const MAX_PER_COMPANY = 3

type ContactPosting = Pick<ExclusiveJobPosting, 'id' | 'companyName' | 'sourceCategory' | 'sourceName' | 'url' | 'disclosure'>

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export async function loadJobContacts(postings: ContactPosting[]): Promise<Map<string, JobContacts>> {
  const affiliations = await prisma.crmAffiliation.findMany({
    where: {
      isCurrent: true,
      OR: ['recruit', 'talent', 'sourc', 'staffing'].map((w) => ({ title: { contains: w, mode: 'insensitive' as const } })),
      person: { deletedAt: null, mergedIntoId: null, email: { not: null }, priority: null },
    },
    select: {
      title: true,
      org: { select: { name: true } },
      person: { select: { fullName: true, email: true, goals: true } },
    },
  })

  const byCompany = new Map<string, JobContact[]>()
  for (const a of affiliations) {
    if (!a.title || !RECRUITER_TITLE.test(a.title)) continue
    if (a.person.goals.some((g) => OUR_PIPELINE_GOALS.has(g))) continue
    const key = normalizeOrgName(a.org.name)
    const list = byCompany.get(key) ?? []
    if (list.length < MAX_PER_COMPANY && !list.some((c) => c.email === a.person.email)) {
      list.push({ name: a.person.fullName, title: a.title, email: a.person.email! })
    }
    byCompany.set(key, list)
  }

  const out = new Map<string, JobContacts>()
  for (const p of postings) {
    // A confidential search names no company, so no company contacts.
    const confidential = p.disclosure === 'CONFIDENTIAL'
    out.set(p.id, {
      firm: p.sourceCategory === 'search_firm' && p.sourceName ? { name: p.sourceName, url: originOf(p.url) } : null,
      recruiters: confidential ? [] : (byCompany.get(normalizeOrgName(p.companyName)) ?? []),
      linkedinSearchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
        `${confidential ? '' : p.companyName} recruiter`.trim()
      )}`,
    })
  }
  return out
}
