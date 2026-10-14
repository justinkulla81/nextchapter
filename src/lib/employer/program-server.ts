import 'server-only'
import { prisma } from '@/lib/prisma'
import { highestTier, offeredFeatures, readProgramSettings } from './program-settings'

// The org's settings and the highest tier among its active contracts.
export async function orgProgram(orgId: string) {
  const org = await prisma.outplacementEmployerOrg.findUniqueOrThrow({
    where: { id: orgId },
    select: { name: true, programBrandName: true, programSettings: true, contracts: { where: { status: 'ACTIVE' }, select: { tier: true } } },
  })
  const tier = highestTier(org.contracts.map((c) => c.tier))
  return { name: org.programBrandName ?? org.name, orgName: org.name, programBrandName: org.programBrandName, tier, settings: readProgramSettings(org.programSettings), offered: offeredFeatures(org.programSettings, tier) }
}

// For an employee's dashboard: the program behind their activated seat, if any.
export async function programForCandidate(candidateId: string) {
  const seat = await prisma.outplacementSeat.findFirst({
    where: { candidateId, status: 'ACTIVATED', contract: { status: 'ACTIVE' } },
    orderBy: { activatedAt: 'desc' },
    select: { contract: { select: { orgId: true, termEndAt: true } } },
  })
  if (!seat) return null
  return { ...(await orgProgram(seat.contract.orgId)), termEndAt: seat.contract.termEndAt }
}
