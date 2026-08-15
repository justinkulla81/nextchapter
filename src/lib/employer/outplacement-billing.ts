import 'server-only'
import { prisma } from '@/lib/prisma'
import { getCurrentPlan } from '@/lib/admin/plan-catalog'
import type { CurrentOutplacementOrgUser } from '@/lib/employer/outplacement-auth'

// Invoicing/PO terms (§A7, §A9) — data fields and an admin/finance view,
// not a live Stripe integration (explicitly out of scope this phase). Every
// field here is contract-level (tier, seats, term, PO/invoice reference) —
// no candidate data at all, so this file needs none of the identity-guard
// discipline the reporting/roster/compliance modules do.

export interface ContractInvoiceInfo {
  contractId: string
  cohortLabel: string | null
  tier: string
  seatCount: number
  pricePerSeatCents: number | null
  totalCents: number | null
  termStartAt: Date
  termEndAt: Date
  poReference: string | null
  invoiceReference: string | null
  status: string
}

const TIER_PLAN_KEY: Record<string, string> = {
  CORE: 'outplacement_core',
  PLUS: 'outplacement_plus',
  PREMIUM: 'outplacement_premium',
}

export async function getOrgInvoiceInfo(orgUser: CurrentOutplacementOrgUser): Promise<ContractInvoiceInfo[]> {
  const contracts = await prisma.outplacementContract.findMany({
    where: { orgId: orgUser.orgId },
    orderBy: { createdAt: 'desc' },
  })

  return Promise.all(
    contracts.map(async (c) => {
      // Reads the price from the admin-managed plan catalog (§2.2) rather
      // than hardcoding it here — per this phase's own instruction to reuse
      // Phase 3's PlanCatalogEntry instead of re-deriving §A2.2's numbers.
      const plan = await getCurrentPlan(TIER_PLAN_KEY[c.tier] ?? '')
      const pricePerSeatCents = plan?.priceCents ?? null
      return {
        contractId: c.id,
        cohortLabel: c.cohortLabel,
        tier: c.tier,
        seatCount: c.seatCount,
        pricePerSeatCents,
        totalCents: pricePerSeatCents != null ? pricePerSeatCents * c.seatCount : null,
        termStartAt: c.termStartAt,
        termEndAt: c.termEndAt,
        poReference: c.poReference,
        invoiceReference: c.invoiceReference,
        status: c.status,
      }
    })
  )
}
