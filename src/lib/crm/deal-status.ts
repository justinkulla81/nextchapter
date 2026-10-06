import type { CrmDealStatus } from '@prisma/client'

/** In the order a deal moves through them, then the two ways it stops. */
export const DEAL_STATUSES: CrmDealStatus[] = ['PROSPECT', 'CONTACTED', 'IN_CONVERSATION', 'PROPOSAL', 'PILOT', 'CUSTOMER', 'ON_HOLD', 'LOST']

export const DEAL_STATUS_LABELS: Record<CrmDealStatus, string> = {
  PROSPECT: 'Prospect',
  CONTACTED: 'Contacted',
  IN_CONVERSATION: 'In conversation',
  PROPOSAL: 'Proposal sent',
  PILOT: 'Pilot',
  CUSTOMER: 'Customer',
  ON_HOLD: 'On hold',
  LOST: 'Lost',
}

/** A live deal — past first contact and not stopped. */
export const ACTIVE_DEAL_STATUSES: CrmDealStatus[] = ['IN_CONVERSATION', 'PROPOSAL', 'PILOT', 'CUSTOMER']

export function isDealStatus(v: string): v is CrmDealStatus {
  return (DEAL_STATUSES as string[]).includes(v)
}
