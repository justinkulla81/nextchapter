// ROI math (spec §7), pure so it's tested on its own. Inputs are one row per
// alum for a fiscal year; nothing here touches the database.
//
//   Platform user   joined, and used the tools, coaching or a mentor call in the FY
//   Comparison      never joined, matched to users by class decade and
//                   whether they gave last FY (rates re-weighted to the users' mix)
//   Giving rate     share of a group with a gift in the FY
//   Lift            (users this FY − last FY) − (comparison this FY − last FY), points
//   Gift dollars    users' gifts dated after they joined
//   New donors      users whose first-ever gift came after they joined
//   Reactivated     gave before, not last FY, gave this FY after joining
//
// Either group under 30: raw numbers only, no lift.

export const MIN_GROUP = 30

export type RoiRow = {
  decade: string // '1990s' or 'Unknown'
  joined: boolean // CLAIMED or ACTIVE at some point
  claimedAt: Date | null
  usedThisFy: boolean
  gaveThisFy: boolean
  gaveLastFy: boolean
  gaveBeforeLastFy: boolean
  firstGiftAt: Date | null
  giftCentsAfterClaimThisFy: number
  gaveThisFyAfterClaim: boolean
}

export type FiscalYear = { label: string; start: Date; end: Date } // [start, end)

export function fiscalYear(now: Date, startMonth: number, offset = 0): FiscalYear {
  const m = now.getUTCMonth() + 1
  const startYear = (m >= startMonth ? now.getUTCFullYear() : now.getUTCFullYear() - 1) + offset
  const start = new Date(Date.UTC(startYear, startMonth - 1, 1))
  const end = new Date(Date.UTC(startYear + 1, startMonth - 1, 1))
  // Named for the calendar year it ends in (FY27 = Jul 2026–Jun 2027); a
  // January start is just the calendar year.
  const endsIn = startMonth === 1 ? startYear : startYear + 1
  return { label: `FY${String(endsIn).slice(2)}`, start, end }
}

export type Roi = {
  users: number
  comparison: number
  usersRate: { thisFy: number; lastFy: number } | null
  comparisonRate: { thisFy: number; lastFy: number } | null
  lift: number | null // percentage points
  usersDonors: number
  comparisonDonors: number
  giftCentsAfterClaim: number
  newDonors: number
  reactivated: number
  enough: boolean
}

const stratum = (r: RoiRow) => `${r.decade}|${r.gaveLastFy ? 1 : 0}`

export function computeRoi(rows: RoiRow[]): Roi {
  const users = rows.filter((r) => r.joined && r.usedThisFy)
  const comparison = rows.filter((r) => !r.joined)
  const enough = users.length >= MIN_GROUP && comparison.length >= MIN_GROUP
  const rate = (g: RoiRow[], k: 'gaveThisFy' | 'gaveLastFy') => (g.length ? g.filter((r) => r[k]).length / g.length : 0)

  // Comparison rates re-weighted to the users' strata; strata the comparison
  // group doesn't cover drop out of both sides.
  const byStratum = new Map<string, RoiRow[]>()
  for (const r of comparison) byStratum.set(stratum(r), [...(byStratum.get(stratum(r)) ?? []), r])
  const covered = users.filter((u) => byStratum.has(stratum(u)))
  let cThis = 0
  let cLast = 0
  for (const u of covered) {
    const g = byStratum.get(stratum(u))!
    cThis += rate(g, 'gaveThisFy')
    cLast += rate(g, 'gaveLastFy')
  }
  const n = covered.length
  const usersRate = users.length ? { thisFy: rate(users, 'gaveThisFy'), lastFy: rate(users, 'gaveLastFy') } : null
  const comparisonRate = n ? { thisFy: cThis / n, lastFy: cLast / n } : null
  const coveredRate = n ? { thisFy: rate(covered, 'gaveThisFy'), lastFy: rate(covered, 'gaveLastFy') } : null
  const lift =
    enough && comparisonRate && coveredRate
      ? Math.round(((coveredRate.thisFy - coveredRate.lastFy) - (comparisonRate.thisFy - comparisonRate.lastFy)) * 1000) / 10
      : null

  return {
    users: users.length,
    comparison: comparison.length,
    usersRate,
    comparisonRate,
    lift,
    usersDonors: users.filter((r) => r.gaveThisFy).length,
    comparisonDonors: comparison.filter((r) => r.gaveThisFy).length,
    giftCentsAfterClaim: users.reduce((s, r) => s + r.giftCentsAfterClaimThisFy, 0),
    newDonors: users.filter((r) => r.claimedAt && r.firstGiftAt && r.firstGiftAt >= r.claimedAt && r.gaveThisFyAfterClaim).length,
    reactivated: users.filter((r) => r.gaveBeforeLastFy && !r.gaveLastFy && r.gaveThisFyAfterClaim).length,
    enough,
  }
}
