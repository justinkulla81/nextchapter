import { prisma } from '@/lib/prisma'
import { isPaidChannel, type PaidChannel } from '@/lib/admin/paid-channels'

export type SemSegment = 'b2c' | 'b2b'

export interface SemSpendRow {
  day: string
  channel: PaidChannel
  segment: SemSegment
  amountCents: number
}

export interface SemCostLine {
  label: string
  spendCents: number
  leads: number
  accounts: number
  /** null when there is nothing to divide by: a cost per lead of $0 would read as free. */
  costPerLeadCents: number | null
  costPerAccountCents: number | null
}

const div = (cents: number, n: number): number | null => (n > 0 ? Math.round(cents / n) : null)

export function costLine(label: string, spendCents: number, leads: number, accounts: number): SemCostLine {
  return { label, spendCents, leads, accounts, costPerLeadCents: div(spendCents, leads), costPerAccountCents: div(spendCents, accounts) }
}

export const formatDollars = (cents: number) =>
  `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: cents % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })}`

// Fail-soft like the lead query: before the table exists the chart shows no spend instead of breaking the page.
export async function loadSemSpend(dayKeys: string[]): Promise<SemSpendRow[]> {
  try {
    const rows = await prisma.semSpend.findMany({ where: { day: { in: dayKeys } }, select: { day: true, channel: true, segment: true, amountCents: true } })
    return rows.filter((r): r is SemSpendRow => (r.segment === 'b2c' || r.segment === 'b2b') && isPaidChannel(r.channel))
  } catch (error) {
    console.error('Paid search spend query failed:', error)
    return []
  }
}
