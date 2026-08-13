import type { RelationshipTag } from '@prisma/client'

// "Well-rounded outreach" nudge for the Networking progressive-unlock card —
// same shape as computeRequiredMix (references), built from the
// RelationshipTag(s) on whichever contacts the candidate has actually logged
// outreach against. Grouped into three real kinds of help rather than
// exposing all 9 RelationshipTag values directly, since several of them
// (FORMER_COLLEAGUE/PROFESSIONAL_CONTACT/SAME_SCHOOL,
// COACH/HELPING_ME/PERSONAL_FRIEND) are functionally the same bucket for
// this purpose. OTHER is intentionally left out of every bucket, same as
// ReferenceType.OTHER in required-mix.ts.
export interface OutreachRelationshipMixStatus {
  hasHiringConnection: boolean
  hasProfessionalContact: boolean
  hasPersonalSupport: boolean
  satisfied: boolean
}

const HIRING_TAGS: RelationshipTag[] = ['RECRUITER', 'HIRING_MANAGER']
const PROFESSIONAL_TAGS: RelationshipTag[] = ['FORMER_COLLEAGUE', 'PROFESSIONAL_CONTACT', 'SAME_SCHOOL']
const PERSONAL_SUPPORT_TAGS: RelationshipTag[] = ['COACH', 'HELPING_ME', 'PERSONAL_FRIEND']

export function computeOutreachRelationshipMix(contactedTags: RelationshipTag[][]): OutreachRelationshipMixStatus {
  const allTags = contactedTags.flat()
  const hasHiringConnection = allTags.some((t) => HIRING_TAGS.includes(t))
  const hasProfessionalContact = allTags.some((t) => PROFESSIONAL_TAGS.includes(t))
  const hasPersonalSupport = allTags.some((t) => PERSONAL_SUPPORT_TAGS.includes(t))
  return {
    hasHiringConnection,
    hasProfessionalContact,
    hasPersonalSupport,
    satisfied: hasHiringConnection && hasProfessionalContact && hasPersonalSupport,
  }
}
