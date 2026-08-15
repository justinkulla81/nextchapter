import 'server-only'
import { prisma } from '@/lib/prisma'
import type { Trajectory } from '@/lib/companies/signals'
import { suppressSmallCells, type MaybeSuppressed } from '@/lib/admin/cell-suppression'
import { getCurrentlySearchingCountRaw, getCurrentlySearchingCountsByCompanyRaw } from '@/lib/companies/nervous-employee-panel'

// Outplacement pitch signal composite — Phase 2 Master Script, Part C,
// Prompt 6: "Meridian Health — outplacement pitch signal: HIGH ... Rank all
// companies by this composite so the sales list is generated rather than
// assembled by hand."
//
// Spec frames this as extending "the same logic already running in the WARN
// lead-generation pipeline" — no such pipeline exists anywhere in this
// codebase (confirmed absent, same as CompanySignal's own WARN columns).
// Built fresh from what's real: posting trajectory (CompanySignal) + member
// concentration (MemberEmployment). The WARN component is rendered as an
// explicit "not available" state everywhere this signal is shown — never
// silently 0, never omitted — so an admin knows a real WARN signal would
// raise the score once that agent exists, not that today's score is final.
//
// The currently-searching sub-score NEVER uses the raw count once it's
// below MIN_CELL_SIZE — see the comment on searchingPoints below. This is a
// deliberate extension of the "no exceptions" cell-suppression rule from
// display into scoring: a tiny real count is real signal, but letting it
// move the composite (and therefore the sort order) would let a careful
// reader back out roughly how small it was, which is exactly what
// suppression exists to prevent.

export type OutplacementLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface OutplacementPitchSignal {
  level: OutplacementLevel
  compositeScore: number
  trajectory: Trajectory | null
  rolesDelta12wk: number | null
  currentEmployerCount: number
  // Display-safe — already run through suppressSmallCells. Never read the
  // raw count directly; this is the only shape a UI should render.
  currentlySearchingDisplay: MaybeSuppressed<{ count: number }>
  // Always 'not_available' this phase — no WARN monitoring agent exists.
  // Kept as an explicit field (not a boolean or an omitted key) so a future
  // real WARN integration has one obvious place to wire a real value in,
  // and so every render site is forced to handle the "don't have this yet"
  // case instead of defaulting to a fabricated number.
  warnComponent: 'not_available'
}

const TRAJECTORY_POINTS: Record<Trajectory, number> = { contracting: 3, flat: 1, growing: 0 }

// Coarse, deliberately simple buckets — "a simple sortable admin table is
// enough, don't over-engineer a dedicated ranking algorithm" per spec.
function bucketPoints(n: number): number {
  if (n >= 20) return 4
  if (n >= 10) return 3
  if (n >= 5) return 2
  if (n >= 1) return 1
  return 0
}

interface BuildSignalInput {
  trajectory: Trajectory | null
  rolesDelta12wk: number | null
  currentEmployerCount: number
  currentlySearchingRaw: number
}

// Pure scoring function shared by both the single-company detail page
// (computeOutplacementPitchSignal) and the bulk ranked list
// (listCompaniesRankedByOutplacementSignal) — kept separate from the
// queries so the scoring rule lives in exactly one place.
function buildOutplacementSignal(input: BuildSignalInput): OutplacementPitchSignal {
  const trajectoryPoints = input.trajectory ? TRAJECTORY_POINTS[input.trajectory] : 0
  const employerPoints = bucketPoints(input.currentEmployerCount)
  // See file header — a sub-5 raw count contributes 0, never its own
  // bucket, so the composite score can never reveal roughly how small a
  // suppressed count was.
  const searchingPoints = input.currentlySearchingRaw >= 5 ? bucketPoints(input.currentlySearchingRaw) : 0

  // Trajectory (public postings data) is weighted 2x a single concentration
  // bucket step — the spec's own Meridian example leads with the WARN/
  // trajectory line before member counts, so posting contraction should
  // move the needle more than employer headcount alone.
  const compositeScore = trajectoryPoints * 2 + employerPoints + searchingPoints
  const level: OutplacementLevel = compositeScore >= 8 ? 'HIGH' : compositeScore >= 4 ? 'MEDIUM' : 'LOW'

  const [currentlySearchingDisplay] = suppressSmallCells(
    [{ count: input.currentlySearchingRaw }],
    (r) => r.count,
    () => 'Members currently searching'
  )

  return {
    level,
    compositeScore,
    trajectory: input.trajectory,
    rolesDelta12wk: input.rolesDelta12wk,
    currentEmployerCount: input.currentEmployerCount,
    currentlySearchingDisplay,
    warnComponent: 'not_available',
  }
}

// Single-company read — the admin company detail page.
export async function computeOutplacementPitchSignal(companyId: string): Promise<OutplacementPitchSignal> {
  const [latestSignal, currentEmployerCount, currentlySearchingRaw] = await Promise.all([
    prisma.companySignal.findFirst({ where: { companyId }, orderBy: { weekStartDate: 'desc' } }),
    prisma.memberEmployment.count({ where: { companyId, isCurrent: true } }),
    getCurrentlySearchingCountRaw(companyId),
  ])

  return buildOutplacementSignal({
    trajectory: (latestSignal?.trajectory as Trajectory | undefined) ?? null,
    rolesDelta12wk: latestSignal?.rolesDelta12wk ?? null,
    currentEmployerCount,
    currentlySearchingRaw,
  })
}

export interface RankedCompanyRow {
  companyId: string
  companyName: string
  industry: string | null
  signal: OutplacementPitchSignal
}

// Sales-list ranking — every Company row, sorted by compositeScore desc.
// Four bulk queries total regardless of company count (batched, not one
// round trip per company) — the same "don't recompute per row" discipline
// PopulationSnapshot/company-signals.ts already apply elsewhere.
export async function listCompaniesRankedByOutplacementSignal(): Promise<RankedCompanyRow[]> {
  const [companies, allSignals, currentEmploymentGrouped, searchingByCompany] = await Promise.all([
    prisma.company.findMany({ select: { id: true, name: true, industry: true } }),
    prisma.companySignal.findMany({ orderBy: { weekStartDate: 'desc' } }),
    prisma.memberEmployment.groupBy({ by: ['companyId'], where: { isCurrent: true }, _count: { candidateId: true } }),
    getCurrentlySearchingCountsByCompanyRaw(),
  ])

  const latestSignalByCompany = new Map<string, (typeof allSignals)[number]>()
  for (const s of allSignals) {
    if (!latestSignalByCompany.has(s.companyId)) latestSignalByCompany.set(s.companyId, s)
  }
  const currentEmployerByCompany = new Map(currentEmploymentGrouped.map((g) => [g.companyId, g._count.candidateId]))

  const rows: RankedCompanyRow[] = companies.map((c) => {
    const latest = latestSignalByCompany.get(c.id)
    const signal = buildOutplacementSignal({
      trajectory: (latest?.trajectory as Trajectory | undefined) ?? null,
      rolesDelta12wk: latest?.rolesDelta12wk ?? null,
      currentEmployerCount: currentEmployerByCompany.get(c.id) ?? 0,
      currentlySearchingRaw: searchingByCompany.get(c.id) ?? 0,
    })
    return { companyId: c.id, companyName: c.name, industry: c.industry, signal }
  })

  return rows.sort((a, b) => b.signal.compositeScore - a.signal.compositeScore)
}
