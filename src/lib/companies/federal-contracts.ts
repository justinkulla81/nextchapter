import { normalizeOrgName } from '@/lib/text/org-name-match'

// Federal contract awards a company has won, from USAspending.gov (public, no key, no
// cost). A company that just won large federal work is likely to staff up for it. Pure —
// no network — so the rules are tested (src/test/federal-contracts.test.ts).
//
// Only awards whose recipient name EXACTLY matches the company (after normalisation) are
// counted: a federal "Acme Corp" is not assumed to be this Acme. No match, no number.

// normalizeOrgName leaves partnership suffixes; federal recipient names carry them.
const key = (n: string) => normalizeOrgName(n).replace(/ (llp|lp|pllc|pc)$/, '')

export interface UsaSpendingAward {
  recipientName: string
  amount: number
  agency: string | null
  startDate: string | null // YYYY-MM-DD
}

export interface FederalContractSummary {
  awards: number
  totalAmount: number
  topAgency: string | null
  latestStart: string | null
}

export function summarizeFederalAwards(
  companyName: string,
  awards: UsaSpendingAward[],
  since: string // YYYY-MM-DD: only awards that started on or after this
): FederalContractSummary | null {
  const wanted = key(companyName)
  if (!wanted) return null
  const mine = awards.filter(
    (a) => a.amount > 0 && a.startDate && a.startDate >= since && key(a.recipientName) === wanted
  )
  if (mine.length === 0) return null

  const byAgency = new Map<string, number>()
  for (const a of mine) if (a.agency) byAgency.set(a.agency, (byAgency.get(a.agency) ?? 0) + a.amount)
  const topAgency = [...byAgency.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? null

  return {
    awards: mine.length,
    totalAmount: Math.round(mine.reduce((s, a) => s + a.amount, 0)),
    topAgency,
    latestStart: mine.map((a) => a.startDate as string).sort().at(-1) ?? null,
  }
}
