import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export type MergeOrgResult = { ok: true; merged: string } | { ok: false; reason: string }

/**
 * Merges one organization into another and deletes the source.
 *
 * Most of an organization's records are deleted along with it (people links,
 * activity, tasks...), so everything is moved to the survivor first. Where the
 * survivor already has a matching row under a unique key, the source's copy is
 * the duplicate and is dropped. Records that can exist only once per
 * organization (an investor profile, the college record, a production link) are
 * moved if the survivor has none; if both have one, the merge is refused rather
 * than choosing which to lose.
 */
export async function mergeOrganizations(
  survivorId: string,
  sourceId: string,
  actorEmail: string | null,
): Promise<MergeOrgResult> {
  if (survivorId === sourceId) return { ok: false, reason: 'Pick two different organizations.' }
  const include = {
    investorProfile: { select: { id: true } },
    outplacementProfile: { select: { id: true } },
    partnerProfile: { select: { id: true } },
    researchProfile: { select: { id: true } },
    institution: { select: { id: true } },
  } as const
  const [survivor, source] = await Promise.all([
    prisma.crmOrganization.findUnique({ where: { id: survivorId }, include }),
    prisma.crmOrganization.findUnique({ where: { id: sourceId }, include }),
  ])
  if (!survivor || !source) return { ok: false, reason: 'One of these organizations no longer exists. Reload the page.' }

  // Single-slot records that both sides have: refuse.
  const clashes: string[] = []
  if (source.investorProfile && survivor.investorProfile) clashes.push('an investor profile')
  if (source.outplacementProfile && survivor.outplacementProfile) clashes.push('an outplacement profile')
  if (source.partnerProfile && survivor.partnerProfile) clashes.push('a partner profile')
  if (source.researchProfile && survivor.researchProfile) clashes.push('a research profile')
  if (source.institution && survivor.institution) clashes.push('a college record')
  if (source.outplacementOrgId && survivor.outplacementOrgId && source.outplacementOrgId !== survivor.outplacementOrgId) clashes.push('a different outplacement account')
  if (source.recruiterFirmId && survivor.recruiterFirmId && source.recruiterFirmId !== survivor.recruiterFirmId) clashes.push('a different recruiter firm')
  if (clashes.length > 0) {
    return { ok: false, reason: `${source.name} and ${survivor.name} each have ${clashes.join(' and ')}. Merge these by hand so nothing is lost.` }
  }

  await prisma.$transaction(async (tx) => {
    // Unique-keyed children: drop the source's duplicate, then move the rest.
    for (const a of await tx.crmAffiliation.findMany({ where: { orgId: survivorId }, select: { personId: true, title: true } })) {
      await tx.crmAffiliation.deleteMany({ where: { orgId: sourceId, personId: a.personId, title: a.title } })
    }
    await tx.crmAffiliation.updateMany({ where: { orgId: sourceId }, data: { orgId: survivorId } })

    for (const b of await tx.crmBackground.findMany({ where: { orgId: survivorId }, select: { personId: true, kind: true } })) {
      await tx.crmBackground.deleteMany({ where: { orgId: sourceId, personId: b.personId, kind: b.kind } })
    }
    await tx.crmBackground.updateMany({ where: { orgId: sourceId }, data: { orgId: survivorId } })

    for (const h of await tx.crmPortfolioHolding.findMany({ where: { investorOrgId: survivorId }, select: { normalizedName: true } })) {
      await tx.crmPortfolioHolding.deleteMany({ where: { investorOrgId: sourceId, normalizedName: h.normalizedName } })
    }
    await tx.crmPortfolioHolding.updateMany({ where: { investorOrgId: sourceId }, data: { investorOrgId: survivorId } })

    // Everything else just follows the survivor.
    const move = { where: { orgId: sourceId }, data: { orgId: survivorId } }
    await tx.crmMandate.updateMany(move)
    await tx.crmOpportunity.updateMany(move)
    await tx.crmActivity.updateMany(move)
    await tx.crmTask.updateMany(move)
    await tx.crmDeadline.updateMany(move)
    await tx.crmResearchItem.updateMany(move)
    await tx.crmSourceRecord.updateMany(move)
    await tx.crmMeetingPrep.updateMany(move)
    await tx.crmIntroPath.updateMany({ where: { targetOrgId: sourceId }, data: { targetOrgId: survivorId } })
    await tx.searchFirm.updateMany({ where: { crmOrgId: sourceId }, data: { crmOrgId: survivorId } })
    await tx.productCompetitor.updateMany({ where: { crmOrgId: sourceId }, data: { crmOrgId: survivorId } })
    await tx.localCollege.updateMany({ where: { crmOrgId: sourceId }, data: { crmOrgId: survivorId } })
    await tx.geoOrgLead.updateMany({ where: { crmOrganizationId: sourceId }, data: { crmOrganizationId: survivorId } })
    // Layoff notices promoted to a lead point at the organization by plain id (no foreign key), as do search-firm reviews.
    await tx.warnNotice.updateMany({ where: { promotedOrgId: sourceId }, data: { promotedOrgId: survivorId } })
    await tx.searchFirm.updateMany({ where: { reviewOrgId: sourceId }, data: { reviewOrgId: survivorId } })
    // Funding notices name their issuing organization; the table is applied by hand.
    await tx.$executeRaw`UPDATE "FundingOpportunity" SET "orgId" = ${survivorId} WHERE "orgId" = ${sourceId}`.catch(() => 0)

    // One-per-organization records move only into an empty slot (clashes were refused above).
    if (source.investorProfile) await tx.crmInvestorProfile.update({ where: { orgId: sourceId }, data: { orgId: survivorId } })
    if (source.outplacementProfile) await tx.crmOutplacementProfile.update({ where: { orgId: sourceId }, data: { orgId: survivorId } })
    if (source.partnerProfile) await tx.crmPartnerProfile.update({ where: { orgId: sourceId }, data: { orgId: survivorId } })
    if (source.researchProfile) await tx.crmResearchProfile.update({ where: { orgId: sourceId }, data: { orgId: survivorId } })
    if (source.institution) await tx.institution.update({ where: { id: source.institution.id }, data: { crmOrganizationId: survivorId } })
    await tx.organization.updateMany({ where: { crmOrganizationId: sourceId }, data: { crmOrganizationId: survivorId } })

    // Fill what the survivor is missing; never overwrite what it has.
    const fill: Prisma.CrmOrganizationUpdateInput = {
      orgTypes: { set: [...new Set([...survivor.orgTypes, ...source.orgTypes])] },
      goals: { set: [...new Set([...survivor.goals, ...source.goals])] },
      ...(source.hiringClient && !survivor.hiringClient ? { hiringClient: true, hiringClientAt: source.hiringClientAt ?? new Date() } : {}),
      ...(survivor.website ? {} : { website: source.website }),
      ...(survivor.hqCity ? {} : { hqCity: source.hqCity }),
      ...(survivor.hqRegion ? {} : { hqRegion: source.hqRegion }),
      ...(survivor.usState ? {} : { usState: source.usState }),
      ...(survivor.industry ? {} : { industry: source.industry }),
      ...(survivor.focus ? {} : { focus: source.focus }),
      ...(survivor.emailDomain ? {} : { emailDomain: source.emailDomain, emailDomainSource: source.emailDomainSource, emailDomainCheckedAt: source.emailDomainCheckedAt }),
      ...(survivor.dealStatus ? {} : { dealStatus: source.dealStatus, dealStatusAt: source.dealStatusAt }),
      ...(survivor.leadQuality === 'UNGRADED' ? { leadQuality: source.leadQuality } : {}),
      ...(survivor.companyId ? {} : source.companyId ? { company: { connect: { id: source.companyId } }, companyLinkState: source.companyLinkState } : {}),
      ...(survivor.outplacementOrgId || !source.outplacementOrgId ? {} : { outplacementOrg: { connect: { id: source.outplacementOrgId } } }),
      ...(survivor.recruiterFirmId || !source.recruiterFirmId ? {} : { recruiterFirm: { connect: { id: source.recruiterFirmId } } }),
      ...(source.notes ? { notes: [survivor.notes, `Merged from ${source.name}: ${source.notes}`].filter(Boolean).join('\n\n') } : {}),
    }
    await tx.crmOrganization.delete({ where: { id: sourceId } })
    await tx.crmOrganization.update({ where: { id: survivorId }, data: fill })
    await tx.crmActivity.create({
      data: {
        type: 'FIELD_CHANGED', direction: 'INTERNAL', orgId: survivorId,
        subject: 'duplicate organization merged', body: `${source.name} was merged into ${survivor.name}.`,
        loggedByEmail: actorEmail,
      },
    })
    // A big organization (Amazon has thousands of rows to move) outlasts Prisma's 5-second default.
  }, { timeout: 120_000, maxWait: 20_000 })
  return { ok: true, merged: source.name }
}
