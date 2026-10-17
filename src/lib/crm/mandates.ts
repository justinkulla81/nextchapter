export const MANDATE_STATUSES = ['ACTIVE', 'ON_HOLD', 'CLOSED'] as const
export type MandateStatusKey = (typeof MANDATE_STATUSES)[number]
export const MANDATE_STATUS_LABELS: Record<MandateStatusKey, string> = {
  ACTIVE: 'Active',
  ON_HOLD: 'On hold',
  CLOSED: 'Closed',
}
