import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { mergeOrganizations } from '@/lib/crm/merge-organization'
import { moveCultureResponses } from '@/lib/companies/culture-profile'
import { moveInstitutionTargets } from '@/lib/institution/merge-company-targets'

export type MergeCompanyResult = { ok: true; merged: string; orgNote: string } | { ok: false; reason: string }

/**
 * Merges one directory company into another and deletes the source.
 *
 * Postings, resume entries, intel, firms and CRM organizations follow the
 * survivor. Records keyed by company plus something else (weekly signals, a
 * member's employment, a college's target list) are moved unless the survivor
 * already has the same one, in which case the source's copy is the duplicate and
 * is dropped. A name the source went by keeps resolving to the survivor through a
 * confirmed alias. If both companies have a CRM organization, those are merged
 * too; if that is refused the organizations stay as two, both linked to the
 * survivor, and the result says so.
 */
export async function mergeCompanies(
  survivorId: string,
  sourceId: string,
  actorEmail: string | null,
): Promise<MergeCompanyResult> {
  if (survivorId === sourceId) return { ok: false, reason: 'Pick two different companies.' }
  const [survivor, source] = await Promise.all([
    prisma.company.findUnique({ where: { id: survivorId } }),
    prisma.company.findUnique({ where: { id: sourceId } }),
  ])
  if (!survivor || !source) return { ok: false, reason: 'One of these companies no longer exists. Reload the page.' }

  await prisma.$transaction(async (tx) => {
    const to = { companyId: survivorId }
    const from = { companyId: sourceId }

    // Unique-keyed children: drop the source's duplicate, then move the rest.
    const survivorSignals = await tx.companySignal.findMany({ where: { companyId: survivorId }, select: { weekStartDate: true } })
    for (const r of survivorSignals) await tx.companySignal.deleteMany({ where: { companyId: sourceId, weekStartDate: r.weekStartDate } })
    await tx.companySignal.updateMany({ where: from, data: to })

    const survivorOutcomes = await tx.companyApplicationOutcome.findMany({ where: { companyId: survivorId }, select: { weekStartDate: true } })
    for (const r of survivorOutcomes) await tx.companyApplicationOutcome.deleteMany({ where: { companyId: sourceId, weekStartDate: r.weekStartDate } })
    await tx.companyApplicationOutcome.updateMany({ where: from, data: to })

    const survivorEmployment = await tx.memberEmployment.findMany({ where: { companyId: survivorId }, select: { candidateId: true } })
    for (const r of survivorEmployment) await tx.memberEmployment.deleteMany({ where: { companyId: sourceId, candidateId: r.candidateId } })
    await tx.memberEmployment.updateMany({ where: from, data: to })

    await moveCultureResponses(tx, survivorId, sourceId)
    await moveInstitutionTargets(tx, survivorId, sourceId)

    // One hiring profile per company: keep the survivor's, or move the source's into the empty slot.
    const survivorProfile = await tx.companyHiringProfile.findUnique({ where: { companyId: survivorId }, select: { id: true } })
    if (survivorProfile) await tx.companyHiringProfile.deleteMany({ where: from })
    else await tx.companyHiringProfile.updateMany({ where: from, data: to })

    // Aliases that pointed at the source now point at the survivor (unless it already has that one).
    const survivorAliases = await tx.companyAlias.findMany({ where: { companyId: survivorId }, select: { aliasKey: true } })
    for (const a of survivorAliases) await tx.companyAlias.deleteMany({ where: { companyId: sourceId, aliasKey: a.aliasKey } })
    await tx.companyAlias.updateMany({ where: from, data: to })

    // Everything else just follows the survivor.
    await tx.workHistoryEntry.updateMany({ where: from, data: to })
    await tx.undatedEmployment.updateMany({ where: from, data: to })
    await tx.employerProfile.updateMany({ where: from, data: to })
    await tx.exclusiveJobPosting.updateMany({ where: from, data: to })
    await tx.companyJobOpening.updateMany({ where: from, data: to })
    await tx.companyIntel.updateMany({ where: from, data: to })
    await tx.insiderRequest.updateMany({ where: from, data: to })
    await tx.outplacementEmployerOrg.updateMany({ where: from, data: to })
    await tx.recruiterFirm.updateMany({ where: from, data: to })
    await tx.crmOrganization.updateMany({ where: from, data: to })
    await tx.warnNotice.updateMany({ where: from, data: to })
    await tx.layoffMatch.updateMany({ where: from, data: to })
    await tx.institutionRecruitingDate.updateMany({ where: from, data: to })
    await tx.institutionEarlyCareerRole.updateMany({ where: from, data: to })
    await tx.adminAccessLog.updateMany({ where: { viewedCompanyId: sourceId }, data: { viewedCompanyId: survivorId } })

    // Fill what the survivor is missing; never overwrite what it has.
    const fill: Prisma.CompanyUpdateInput = {
      ...(survivor.industry ? {} : { industry: source.industry, industryCheckedAt: source.industryCheckedAt }),
      ...(survivor.sizeBand ? {} : { sizeBand: source.sizeBand }),
      ...(survivor.hqMetro ? {} : { hqMetro: source.hqMetro }),
      ...(survivor.description ? {} : { description: source.description }),
      ...(survivor.atsPlatform ? {} : { atsPlatform: source.atsPlatform }),
      ...(survivor.atsToken ? {} : { atsToken: source.atsToken, atsCheckedAt: source.atsCheckedAt }),
      ...(survivor.ownershipType ? {} : { ownershipType: source.ownershipType }),
      ...(survivor.priority ? {} : { priority: source.priority }),
      ...(survivor.website ? {} : { website: source.website, websiteSource: source.websiteSource }),
      ...(survivor.chroName || survivor.chroEmail || survivor.chroLinkedinUrl ? {} : { chroName: source.chroName, chroEmail: source.chroEmail, chroLinkedinUrl: source.chroLinkedinUrl }),
      ...(source.isVerified && !survivor.isVerified ? { isVerified: true } : {}),
    }
    await tx.company.delete({ where: { id: sourceId } })
    await tx.company.update({ where: { id: survivorId }, data: fill })
    // The name the source went by still resolves to the survivor.
    await tx.companyAlias.upsert({
      where: { aliasKey_companyId: { aliasKey: source.canonicalNameNormalized, companyId: survivorId } },
      create: { aliasKey: source.canonicalNameNormalized, companyId: survivorId, status: 'CONFIRMED', createdByEmail: actorEmail },
      update: { status: 'CONFIRMED' },
    })
  })

  // Both companies' CRM organizations are now linked to the survivor; they are the same organization.
  let orgNote = ''
  const orgs = await prisma.crmOrganization.findMany({ where: { companyId: survivorId }, select: { id: true, name: true }, orderBy: { createdAt: 'asc' } })
  if (orgs.length > 1) {
    for (const extra of orgs.slice(1)) {
      const r = await mergeOrganizations(orgs[0].id, extra.id, actorEmail)
      if (!r.ok) orgNote += ` The CRM organizations were not merged: ${r.reason}`
    }
    if (!orgNote) orgNote = ' Their CRM organizations are merged.'
  }
  return { ok: true, merged: source.name, orgNote }
}
