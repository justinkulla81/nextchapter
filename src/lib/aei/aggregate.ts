// Joins AEI exposure to the postings we see open and builds the three exhibits
// for the monthly report. Counts only; association, not attribution.
import { BAND_LABELS, EXPOSURE_BANDS, bandFor, type ExposureBand, type ExposureRow } from './exposure'
import { matchTitle, type TitleIndex, type TitleMatch } from './match'

export interface PostingInput {
  title: string
  /** Our function label, may be null. */
  fn: string | null
  firstSeenAt: Date
  closedAt: Date | null
}

/** Cells with fewer open postings than this are not shown. */
export const MIN_CELL = 100
const DAY = 86_400_000

export interface MatchedPosting extends PostingInput {
  match: TitleMatch | null
}

export function matchPostings(postings: PostingInput[], index: TitleIndex): MatchedPosting[] {
  // Titles repeat heavily; match each distinct title once.
  const cache = new Map<string, TitleMatch | null>()
  return postings.map((p) => {
    if (!cache.has(p.title)) cache.set(p.title, matchTitle(p.title, index))
    return { ...p, match: cache.get(p.title) ?? null }
  })
}

export interface Counts {
  open: number
  newRecent: number
  newPrior: number
  closedRecent: number
  closedPrior: number
}

const empty = (): Counts => ({ open: 0, newRecent: 0, newPrior: 0, closedRecent: 0, closedPrior: 0 })

function tally(into: Counts, p: PostingInput, asOf: Date) {
  const t = asOf.getTime()
  const seen = p.firstSeenAt.getTime()
  const closed = p.closedAt?.getTime() ?? null
  if (seen <= t && (closed === null || closed > t)) into.open++
  if (seen > t - 30 * DAY && seen <= t) into.newRecent++
  else if (seen > t - 60 * DAY && seen <= t - 30 * DAY) into.newPrior++
  if (closed !== null && closed > t - 30 * DAY && closed <= t) into.closedRecent++
  else if (closed !== null && closed > t - 60 * DAY && closed <= t - 30 * DAY) into.closedPrior++
}

/** Percent change from prior to recent, or null when the prior count is too small to compare. */
export function pctChange(recent: number, prior: number): number | null {
  if (prior < 20) return null
  return Math.round(((recent - prior) / prior) * 1000) / 10
}

export interface Coverage {
  open: number
  matchedOpen: number
  /** Share of open postings matched to an occupation, 0 to 1. */
  share: number
}

export interface BandRow extends Counts {
  band: ExposureBand
  label: string
  /** Share of matched open postings, 0 to 1. */
  shareOfMatched: number
  newChangePct: number | null
  suppressed: boolean
}

export interface OccupationRow extends Counts {
  socCode: string
  title: string
  exposure: number
  newChangePct: number | null
}

export interface FunctionRow extends Counts {
  fn: string
  matchedOpen: number
  /** Mean observed exposure across matched open postings. */
  meanExposure: number | null
  newChangePct: number | null
  suppressed: boolean
}

export interface Exhibits {
  asOf: string
  coverage: Coverage
  byBand: BandRow[]
  topOccupations: OccupationRow[]
  byFunction: FunctionRow[]
}

export function buildExhibits(matched: MatchedPosting[], asOf: Date, topN = 15): Exhibits {
  const total = empty()
  const bandCounts = new Map<ExposureBand, Counts>(EXPOSURE_BANDS.map((b) => [b, empty()]))
  const occ = new Map<string, OccupationRow>()
  const fnCounts = new Map<string, { counts: Counts; matchedOpen: number; exposureSum: number }>()

  for (const p of matched) {
    tally(total, p, asOf)
    const fn = p.fn ?? 'Unclassified'
    if (!fnCounts.has(fn)) fnCounts.set(fn, { counts: empty(), matchedOpen: 0, exposureSum: 0 })
    const f = fnCounts.get(fn)!
    tally(f.counts, p, asOf)
    if (!p.match) continue
    tally(bandCounts.get(bandFor(p.match.exposure))!, p, asOf)
    if (!occ.has(p.match.socCode)) {
      occ.set(p.match.socCode, {
        socCode: p.match.socCode, title: p.match.title, exposure: p.match.exposure, ...empty(), newChangePct: null,
      })
    }
    tally(occ.get(p.match.socCode)!, p, asOf)
  }

  // matched open per function and mean exposure need a second pass over open postings only
  const t = asOf.getTime()
  let matchedOpen = 0
  for (const p of matched) {
    const isOpen = p.firstSeenAt.getTime() <= t && (p.closedAt === null || p.closedAt.getTime() > t)
    if (!isOpen || !p.match) continue
    matchedOpen++
    const f = fnCounts.get(p.fn ?? 'Unclassified')!
    f.matchedOpen++
    f.exposureSum += p.match.exposure
  }

  const matchedBandOpen = EXPOSURE_BANDS.reduce((s, b) => s + bandCounts.get(b)!.open, 0)
  const byBand: BandRow[] = EXPOSURE_BANDS.map((band) => {
    const c = bandCounts.get(band)!
    const suppressed = c.open < MIN_CELL
    return {
      band, label: BAND_LABELS[band], ...c,
      shareOfMatched: matchedBandOpen ? c.open / matchedBandOpen : 0,
      newChangePct: suppressed ? null : pctChange(c.newRecent, c.newPrior),
      suppressed,
    }
  })

  const topOccupations = [...occ.values()]
    .filter((o) => o.open >= MIN_CELL)
    .map((o) => ({ ...o, newChangePct: pctChange(o.newRecent, o.newPrior) }))
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, topN)

  const byFunction: FunctionRow[] = [...fnCounts.entries()]
    .map(([fn, f]) => {
      const suppressed = f.matchedOpen < MIN_CELL
      return {
        fn, ...f.counts, matchedOpen: f.matchedOpen,
        meanExposure: f.matchedOpen ? Math.round((f.exposureSum / f.matchedOpen) * 1000) / 1000 : null,
        newChangePct: suppressed ? null : pctChange(f.counts.newRecent, f.counts.newPrior),
        suppressed,
      }
    })
    .sort((a, b) => (b.meanExposure ?? -1) - (a.meanExposure ?? -1))

  return {
    asOf: asOf.toISOString().slice(0, 10),
    coverage: { open: total.open, matchedOpen, share: total.open ? matchedOpen / total.open : 0 },
    byBand, topOccupations, byFunction,
  }
}

/** Distinct matched titles for a hand check: stratified by method, capped. */
export function matchSample(matched: MatchedPosting[], size = 200): { title: string; socCode: string; occupation: string; score: number; method: string }[] {
  const seen = new Map<string, MatchedPosting>()
  for (const p of matched) if (p.match && !seen.has(p.title)) seen.set(p.title, p)
  const rows = [...seen.values()].map((p) => ({
    title: p.title, socCode: p.match!.socCode, occupation: p.match!.title, score: p.match!.score, method: p.match!.method,
  }))
  // Deterministic spread: sort by title hash-ish order then take every nth.
  rows.sort((a, b) => (a.title < b.title ? -1 : 1))
  const step = Math.max(1, Math.floor(rows.length / size))
  return rows.filter((_, i) => i % step === 0).slice(0, size)
}

export type { ExposureRow }
