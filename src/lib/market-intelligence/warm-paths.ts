import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'

// Partners Master Build Script §A3.3 — Premium "contact data with warm-path
// routing through their network." No licensed contact-data vendor exists
// (see decision-makers.ts's comment) and there is no real social graph in
// this codebase — the weekly-brief sample's "two degrees from the CEO
// through Marcus H." literal degrees-of-connection graph traversal isn't
// buildable from anything real here. What IS real: the candidate's own
// SupportNetworkContact list (LinkedIn import, calendar sync, manual add),
// each with a real warmth (HOT/WARM/COLD) and relationshipTags. This is the
// same "who do I already know here" signal src/lib/network/backchannel.ts
// already uses for applied-job matching (see that file's own comment on why
// it's the only real "who do I know here" signal this app has) —
// generalized here from "companies I've applied to" to "any target
// company," which is what the target-list builder needs.
export interface WarmPathContact {
  id: string
  name: string
  title: string | null
  warmth: string
  relationshipTags: string[]
}

export async function getWarmPathContactsForCompany(candidateId: string, companyName: string): Promise<WarmPathContact[]> {
  const contacts = await prisma.supportNetworkContact.findMany({
    where: {
      candidateId,
      removedAt: null,
      OR: [{ company: { not: null } }, { inferredCompany: { not: null } }],
    },
    select: { id: true, name: true, title: true, company: true, inferredCompany: true, warmth: true, relationshipTags: true },
  })

  return contacts
    .filter((c) => (c.company && orgNamesMatch(c.company, companyName)) || (c.inferredCompany && orgNamesMatch(c.inferredCompany, companyName)))
    .map((c) => ({ id: c.id, name: c.name, title: c.title, warmth: c.warmth, relationshipTags: c.relationshipTags }))
}
