import 'server-only'
import type { ExclusiveJobPosting } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { normalizeOrgName } from '@/lib/text/org-name-match'
import { classifyContactRole, type ContactRole } from '@/lib/jobs/contact-role'

/**
 * Who a member should contact about a job:
 *  - the search firm, for a recruiter-led search (public: it's the source we found it on);
 *  - people THE MEMBER ALREADY KNOWS at that employer — their own contacts (LinkedIn
 *    export, calendar, manual) — who are a recruiter, or a leader in the job's function;
 *  - a LinkedIn people search for recruiters there, for everything else.
 *
 * Deliberately NOT here: anyone from NextChapter's CRM. A candidate never sees CRM
 * data, and CRM contacts never agreed to be handed to members. An earlier version
 * listed CRM recruiters' real emails; that source is gone, and the wall test
 * (src/test/company-wall.test.ts) now fails if a CRM table is read here again.
 *
 * The contacts returned are the member's own data, matched against only the member's
 * own list — nothing here crosses to another member.
 */

export interface JobContact {
  id: string
  name: string
  title: string | null
  role: ContactRole
  email: string | null
  linkedinUrl: string | null
}

export interface JobContacts {
  firm: { name: string; url: string | null } | null
  /** The member's own contacts at this employer, recruiters first. */
  known: JobContact[]
  linkedinSearchUrl: string
}

const MAX_KNOWN = 3

type ContactPosting = Pick<ExclusiveJobPosting, 'id' | 'title' | 'companyName' | 'sourceCategory' | 'sourceName' | 'url' | 'disclosure'>

function originOf(url: string): string | null {
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

export async function loadJobContacts(postings: ContactPosting[], candidateId: string): Promise<Map<string, JobContacts>> {
  // Only contacts with a title and an employer can be classified or matched, which also
  // keeps a 27,000-row LinkedIn export down to the few that matter.
  const mine = await prisma.supportNetworkContact.findMany({
    where: {
      candidateId,
      removedAt: null,
      title: { not: null },
      OR: [{ company: { not: null } }, { inferredCompany: { not: null } }],
    },
    select: { id: true, name: true, title: true, company: true, inferredCompany: true, email: true, linkedinUrl: true },
  })

  const byCompany = new Map<string, typeof mine>()
  for (const c of mine) {
    for (const raw of new Set([c.company, c.inferredCompany])) {
      if (!raw) continue
      const key = normalizeOrgName(raw)
      if (!key) continue
      const list = byCompany.get(key)
      if (list) list.push(c)
      else byCompany.set(key, [c])
    }
  }

  const out = new Map<string, JobContacts>()
  for (const p of postings) {
    // A confidential search names no company, so there is no employer to match.
    const confidential = p.disclosure === 'CONFIDENTIAL'
    const known: JobContact[] = []
    if (!confidential) {
      const seen = new Set<string>()
      for (const c of byCompany.get(normalizeOrgName(p.companyName)) ?? []) {
        if (seen.has(c.id)) continue
        const role = classifyContactRole({ contactTitle: c.title, jobTitle: p.title })
        if (!role) continue
        seen.add(c.id)
        known.push({ id: c.id, name: c.name, title: c.title, role, email: c.email, linkedinUrl: c.linkedinUrl })
      }
      // Recruiters first (they run the process), then the likely hiring manager.
      known.sort((a, b) => Number(b.role === 'recruiter') - Number(a.role === 'recruiter'))
    }
    out.set(p.id, {
      firm: p.sourceCategory === 'search_firm' && p.sourceName ? { name: p.sourceName, url: originOf(p.url) } : null,
      known: known.slice(0, MAX_KNOWN),
      linkedinSearchUrl: `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(
        `${confidential ? '' : p.companyName} recruiter`.trim()
      )}`,
    })
  }
  return out
}
