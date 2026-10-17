import 'server-only'
import type { OrgWorkspaceType } from '@prisma/client'
import { prisma } from '@/lib/prisma'

// One line of plain counts per portal an organization owns, for staff. Counts
// only: no names and no individual detail. Sample data is included for demos
// (that is the point of a demo) and the page says so.
export interface PortalOverview {
  type: OrgWorkspaceType
  stats: Array<{ label: string; value: number }>
}

export async function organizationOverview(workspaces: Array<{ type: OrgWorkspaceType; refId: string | null }>): Promise<PortalOverview[]> {
  const out: PortalOverview[] = []
  for (const w of workspaces) {
    if (!w.refId) continue
    switch (w.type) {
      case 'OUTPLACEMENT': {
        const where = { contract: { orgId: w.refId } }
        const [seats, activated, placed] = await Promise.all([
          prisma.outplacementSeat.count({ where }),
          prisma.outplacementSeat.count({ where: { ...where, status: 'ACTIVATED' } }),
          prisma.outplacementSeat.count({ where: { ...where, placedAt: { not: null } } }),
        ])
        out.push({ type: w.type, stats: [{ label: 'People enrolled', value: seats }, { label: 'Active', value: activated }, { label: 'Closed as placed', value: placed }] })
        break
      }
      case 'COACH': {
        const [clients, sessions] = await Promise.all([
          prisma.candidateProfile.count({ where: { coachId: w.refId } }),
          prisma.coachSession.count({ where: { coachId: w.refId } }),
        ])
        out.push({ type: w.type, stats: [{ label: 'Clients', value: clients }, { label: 'Sessions', value: sessions }] })
        break
      }
      case 'HIRING': {
        const [candidates, interested] = await Promise.all([
          prisma.candidateInteraction.count({ where: { employerId: w.refId } }),
          prisma.candidateInteraction.count({ where: { employerId: w.refId, status: 'INTEREST_EXPRESSED' } }),
        ])
        out.push({ type: w.type, stats: [{ label: 'Candidates seen', value: candidates }, { label: 'Interest expressed', value: interested }] })
        break
      }
      case 'RECRUITER': {
        const where = { recruiter: { recruiterFirmId: w.refId } }
        const [recruiters, placements] = await Promise.all([
          prisma.recruiter.count({ where: { recruiterFirmId: w.refId } }),
          prisma.recruiterPlacement.count({ where }),
        ])
        out.push({ type: w.type, stats: [{ label: 'Recruiters', value: recruiters }, { label: 'Placements', value: placements }] })
        break
      }
      default:
        break
    }
  }
  return out
}
