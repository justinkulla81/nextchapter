import 'server-only'
import { prisma } from '@/lib/prisma'
import { orgNamesMatch } from '@/lib/text/org-name-match'
import { inferOrgFromEmailDomain } from '@/lib/text/email-domain'
import { normalizeContactKey } from './csv-import'
import type { ContactSource, RelationshipTag } from '@prisma/client'

// Shared by calendar-attendee auto-add (sync-google-calendar.ts) and
// recruiter/networking-email auto-add (sync-gmail.ts) — same rule either
// way: never overwrite a candidate-confirmed `company` or drop an existing
// relationshipTag, only fill gaps and add tags a real signal supports.
export async function upsertContactFromSignal(
  candidateId: string,
  params: {
    email: string
    name: string
    source: ContactSource
    isRecruiter: boolean
    workHistoryCompanies: string[]
  }
): Promise<void> {
  const email = params.email.toLowerCase()
  const { inferredCompany, inferredSchool } = inferOrgFromEmailDomain(email)
  const isFormerColleague = inferredCompany
    ? params.workHistoryCompanies.some((company) => orgNamesMatch(company, inferredCompany))
    : false

  const existing = await prisma.supportNetworkContact.findFirst({ where: { candidateId, email } })

  if (existing) {
    const tags = new Set(existing.relationshipTags)
    if (isFormerColleague) tags.add('FORMER_COLLEAGUE')
    if (params.isRecruiter) tags.add('RECRUITER')
    const nextTags = Array.from(tags)
    const tagsChanged = nextTags.length !== existing.relationshipTags.length
    if (tagsChanged || !existing.inferredCompany || !existing.inferredSchool) {
      await prisma.supportNetworkContact.update({
        where: { id: existing.id },
        data: {
          inferredCompany: existing.inferredCompany ?? inferredCompany,
          inferredSchool: existing.inferredSchool ?? inferredSchool,
          relationshipTags: nextTags,
        },
      })
    }
    return
  }

  const relationshipTags: RelationshipTag[] = []
  if (isFormerColleague) relationshipTags.push('FORMER_COLLEAGUE')
  if (params.isRecruiter) relationshipTags.push('RECRUITER')

  await prisma.supportNetworkContact
    .create({
      data: {
        candidateId,
        name: params.name,
        email,
        source: params.source,
        relationshipTags,
        inferredCompany,
        inferredSchool,
        normalizedKey: normalizeContactKey(params.name, inferredCompany),
      },
    })
    // Race with a concurrent sync hitting the same unique key — the other
    // write already added this contact, nothing left to do.
    .catch((error) => console.error('Failed to auto-add contact to network list:', error))
}
