import 'server-only'
import { prisma } from '@/lib/prisma'
import { suppressSmallCells, isSuppressedCell, MIN_CELL_SIZE, type MaybeSuppressed } from '@/lib/admin/cell-suppression'

// ── The nervous-employee panel ──────────────────────────────────────────────
// Phase 2 Master Script, Part C, Prompt 7: "This is the most sensitive
// dataset in the product. It identifies which employers have staff quietly
// looking." Every guardrail below is load-bearing, not decorative:
//
//   1. Minimum cell size 5, no exceptions — enforced HERE, inside this
//      module, via suppressSmallCells. A caller can never accidentally
//      render the raw sub-5 count because this module never returns it in
//      display form (see getCurrentlySearchingCountForScoringOnly below for
//      the one narrow, documented exception).
//   2. Aggregate only. This module exposes NO function that returns
//      candidateIds for this population — only counts. If you're adding one,
//      stop: an admin who needs to help a specific member goes through that
//      member's own admin profile (/support/admin/candidates/[id]), never
//      through this employer-level surface. There is no "reason" field that
//      makes an individual drill-down from a company page acceptable.
//   3. Every real view must log an AdminAccessLog row with a reason BEFORE
//      calling into this module — see viewNervousEmployeePanel in
//      src/app/support/admin/(portal)/companies/[id]/actions.ts, the only
//      sanctioned call site for getNervousEmployeeDisplay.
//   4. Never CSV-exportable, never reachable from any route outside
//      support/admin/(portal)/. Do not add an export button, a route
//      handler, or a public API that reads from this module.
//   5. Never shown to anyone affiliated with the employer. No
//      employer_admin/employer_viewer role exists in this schema yet (the
//      Partners portal work is unbuilt) — this module is only ever imported
//      from support/admin/(portal)/ server code today, so this is trivially
//      true. If an employer-facing portal is ever built, it must not import
//      this module, directly or indirectly.
//   6. Never sold or shared as company-level searcher data. The outplacement
//      pitch (src/lib/companies/outplacement-signal.ts) uses this module's
//      output only as an internal, bucketed score input — never as a number
//      handed to a partner feed, sales collateral, or export. If you're
//      building an integration or a partner-facing report, this module's
//      output must not be one of its inputs.
//   7. Members are told this exists, in the privacy policy, in plain
//      language — as of this pass, src/app/privacy-policy/page.tsx does NOT
//      yet cover "aggregate employer-level statistics may inform outreach";
//      that's real copy work, flagged separately, not fixed by this file.

// "Currently searching while employed here" has no dedicated boolean on
// CandidateProfile — defined from two real, existing signals, scoped to
// MemberEmployment rows where isCurrent = true at this company:
//   - currentJobStatus === 'EMPLOYED_CONSIDERING_MOVE' — the platform's own
//     enum value for exactly this state, or
//   - searchIntensity === 'ACTIVELY_SEARCHING' — catches a member who hasn't
//     set currentJobStatus but has flagged themselves as actively looking.
const CURRENTLY_SEARCHING_WHILE_EMPLOYED_FILTER = {
  isCurrent: true as const,
  candidate: {
    OR: [{ currentJobStatus: 'EMPLOYED_CONSIDERING_MOVE' as const }, { searchIntensity: 'ACTIVELY_SEARCHING' as const }],
  },
}

// Raw count — NOT display-safe on its own (may be below MIN_CELL_SIZE).
// Only two callers exist and both are documented: getNervousEmployeeDisplay
// below (which suppresses it before returning), and
// src/lib/companies/outplacement-signal.ts (which only ever feeds it into a
// bucketed composite score, never renders it directly). Do not call this
// from a page component or a Server Action's return value.
export async function getCurrentlySearchingCountRaw(companyId: string): Promise<number> {
  return prisma.memberEmployment.count({
    where: { companyId, ...CURRENTLY_SEARCHING_WHILE_EMPLOYED_FILTER },
  })
}

// Bulk variant for the admin company list's ranked sort (Prompt 6) — same
// raw, not-display-safe values, batched across every company in one query
// instead of one round trip per company. Same two-caller restriction as
// getCurrentlySearchingCountRaw above.
export async function getCurrentlySearchingCountsByCompanyRaw(): Promise<Map<string, number>> {
  const grouped = await prisma.memberEmployment.groupBy({
    by: ['companyId'],
    where: CURRENTLY_SEARCHING_WHILE_EMPLOYED_FILTER,
    _count: { candidateId: true },
  })
  return new Map(grouped.map((g) => [g.companyId, g._count.candidateId]))
}

export interface NervousEmployeeDisplay {
  cell: MaybeSuppressed<{ count: number }>
}

// The ONLY display-safe read this module exposes. Suppression happens
// inside this function, not left to the caller, so there is no code path
// where a caller can forget to suppress and leak a sub-5 count.
export async function getNervousEmployeeDisplay(companyId: string): Promise<NervousEmployeeDisplay> {
  const count = await getCurrentlySearchingCountRaw(companyId)
  const [cell] = suppressSmallCells([{ count }], (r) => r.count, () => 'Members currently searching')
  return { cell }
}

export { isSuppressedCell, MIN_CELL_SIZE }
