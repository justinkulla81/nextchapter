import 'server-only'
import { prisma } from '@/lib/prisma'
import { EVERYONE, highestTier, offeredFeatures, readProgramSettings, servicesForPackage } from './program-settings'

// The org's settings and the highest tier among its active contracts.
export async function orgProgram(orgId: string) {
  const org = await prisma.outplacementEmployerOrg.findUniqueOrThrow({
    where: { id: orgId },
    select: { name: true, programBrandName: true, programSettings: true, contracts: { where: { status: 'ACTIVE' }, select: { tier: true } } },
  })
  const tier = highestTier(org.contracts.map((c) => c.tier))
  return {
    name: org.programBrandName ?? org.name,
    orgName: org.name,
    programBrandName: org.programBrandName,
    tier,
    raw: org.programSettings,
    settings: readProgramSettings(org.programSettings),
    offered: offeredFeatures(org.programSettings, tier),
    forPackage: (packageKey: string | null) => servicesForPackage(org.programSettings, tier, packageKey),
  }
}

// For an employee's dashboard: the program behind their activated seat, if
// any, with the services their package includes.
export async function programForCandidate(candidateId: string) {
  const seat = await prisma.outplacementSeat.findFirst({
    where: { candidateId, status: 'ACTIVATED', contract: { status: 'ACTIVE' } },
    orderBy: { activatedAt: 'desc' },
    select: { packageKey: true, contract: { select: { orgId: true, termEndAt: true } } },
  })
  if (!seat) return null
  const p = await orgProgram(seat.contract.orgId)
  const pkg = p.settings.packages.find((x) => x.key === seat.packageKey)
  return { ...p, offered: p.forPackage(seat.packageKey ?? EVERYONE), packageName: pkg?.name ?? null, termEndAt: seat.contract.termEndAt }
}
