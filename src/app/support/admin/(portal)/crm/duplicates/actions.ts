'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { mergeOrganizations } from '@/lib/crm/merge-organization'

const PAGE = '/support/admin/crm/duplicates'

export type DuplicateResult = { ok: true; message: string } | { ok: false; error: string }

/** Keeps one organization and merges the others in the group into it. */
export async function mergeOrganizationGroup(survivorId: string, sourceIds: string[]): Promise<DuplicateResult> {
  const admin = await requireAdmin()
  const merged: string[] = []
  const refused: string[] = []
  for (const id of sourceIds.filter((i) => i !== survivorId)) {
    const r = await mergeOrganizations(survivorId, id, admin.email ?? null)
    if (r.ok) merged.push(r.merged)
    else refused.push(r.reason)
  }
  captureServerEvent(admin.email ?? 'admin', 'duplicate_organizations_merged', {
    survivorId, requested: sourceIds.length - (sourceIds.includes(survivorId) ? 1 : 0), merged: merged.length, refused: refused.length,
  })
  revalidatePath(PAGE)
  revalidatePath('/support/admin/crm/organizations')
  if (merged.length === 0) return { ok: false, error: refused[0] ?? 'Nothing to merge.' }
  return {
    ok: true,
    message: `Merged ${merged.length} ${merged.length === 1 ? 'organization' : 'organizations'}.${refused.length ? ` ${refused.length} could not be merged: ${refused.join(' ')}` : ''}`,
  }
}

/**
 * Records an admin's decision on a suggested abbreviation. "Same company" saves the
 * alias (so future resume and posting names resolve to the company), moves the
 * abbreviation's resumes and postings over, and merges their CRM organizations when
 * both exist. "Not the same" is remembered so the pair is never suggested again.
 */
export async function decideAbbreviation(
  abbreviationCompanyId: string,
  fullCompanyId: string,
  decision: 'same' | 'different',
): Promise<DuplicateResult> {
  const admin = await requireAdmin()
  const [abbr, full] = await Promise.all([
    prisma.company.findUnique({ where: { id: abbreviationCompanyId }, select: { id: true, name: true, canonicalNameNormalized: true } }),
    prisma.company.findUnique({ where: { id: fullCompanyId }, select: { id: true, name: true } }),
  ])
  if (!abbr || !full) return { ok: false, error: 'One of these companies no longer exists. Reload the page.' }

  try {
    await prisma.companyAlias.upsert({
      where: { aliasKey_companyId: { aliasKey: abbr.canonicalNameNormalized, companyId: full.id } },
      create: { aliasKey: abbr.canonicalNameNormalized, companyId: full.id, status: decision === 'same' ? 'CONFIRMED' : 'REJECTED', createdByEmail: admin.email ?? null },
      update: { status: decision === 'same' ? 'CONFIRMED' : 'REJECTED' },
    })
  } catch {
    return { ok: false, error: 'Decisions can’t be saved yet. The company alias table hasn’t been created in the database.' }
  }

  if (decision === 'different') {
    captureServerEvent(admin.email ?? 'admin', 'abbreviation_rejected', { abbreviationCompanyId, fullCompanyId })
    revalidatePath(PAGE)
    return { ok: true, message: `Marked ${abbr.name} and ${full.name} as different companies.` }
  }

  // The abbreviation's own resumes and postings now belong to the full company.
  const from = { companyId: abbr.id }
  const to = { companyId: full.id }
  const [postings, openings, work, undated] = await Promise.all([
    prisma.exclusiveJobPosting.updateMany({ where: from, data: to }),
    prisma.companyJobOpening.updateMany({ where: from, data: to }),
    prisma.workHistoryEntry.updateMany({ where: from, data: to }),
    prisma.undatedEmployment.updateMany({ where: from, data: to }),
  ])

  // Their CRM organizations are the same company too.
  const [abbrOrg, fullOrg] = await Promise.all([
    prisma.crmOrganization.findFirst({ where: { companyId: abbr.id }, select: { id: true } }),
    prisma.crmOrganization.findFirst({ where: { companyId: full.id }, select: { id: true } }),
  ])
  let orgNote = ''
  if (abbrOrg && fullOrg) {
    const r = await mergeOrganizations(fullOrg.id, abbrOrg.id, admin.email ?? null)
    orgNote = r.ok ? ' Their CRM organizations are merged.' : ` The CRM organizations were not merged: ${r.reason}`
  }

  captureServerEvent(admin.email ?? 'admin', 'abbreviation_confirmed', {
    abbreviationCompanyId, fullCompanyId,
    postingsMoved: postings.count + openings.count, resumeEntriesMoved: work.count + undated.count, orgsMerged: Boolean(abbrOrg && fullOrg && !orgNote.includes('not merged')),
  })
  revalidatePath(PAGE)
  revalidatePath('/support/admin/crm/organizations')
  return { ok: true, message: `${abbr.name} now means ${full.name}. Moved ${postings.count + openings.count} postings and ${work.count + undated.count} resume entries.${orgNote}` }
}
