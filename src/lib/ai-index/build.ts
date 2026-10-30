import { AI_EXPOSURE_SOURCE, BAND_LABEL, bandOf, summarizeJobsByExposure, type ExposureBand, type ExposureMap, type JobsByExposure } from '@/lib/skills/ai-exposure'
import { aiPremiumForFunction, type FunctionAiPremium } from '@/lib/pay/ai-premium'
import type { AiMarketData, AiPremium } from '@/lib/skills/ai-market'
import { MIN_PER_SIDE } from '@/lib/skills/ai-market'
import { checkPath } from '@/lib/ai-check/slug'

// The NextChapter AI Jobs Index: one monthly edition built only from data NextChapter already holds (Anthropic Economic Index
// exposure by occupation, the live board, and the daily AI market snapshot). Pure assembly, so the figures, the CSV and the
// citation line are tested without a database. No model is called anywhere on the path.

export const INDEX_NAME = 'NextChapter AI Jobs Index'
export const INDEX_PATH = '/data/ai-jobs-index'
export const INDEX_CSV_PATH = '/data/ai-jobs-index.csv'
export const INDEX_LICENSE = 'CC BY 4.0'
export const INDEX_LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
/** An occupation needs this many live openings before it is ranked in the "most exposed and hiring" view. */
export const MIN_OPENINGS_RANKED = 200
const TABLE_ROWS = 20

export interface OccupationRow {
  soc6: string
  title: string
  score: number
  band: ExposureBand
  openings: number
  path: string
}

export interface AiJobsIndex {
  /** ISO date the figures were computed (the AI market snapshot's), YYYY-MM-DD. */
  asOf: string
  /** "October 2026". */
  edition: string
  liveOpenings: number | null
  /** Share of the postings read from a full description that ask for a specific AI skill, 0 to 100. */
  aiSkillSharePct: number | null
  premium: AiPremium | null
  split: JobsByExposure | null
  mostExposedHiring: OccupationRow[]
  mostOpenings: OccupationRow[]
  functions: FunctionAiPremium[]
  /** Every measured occupation, most exposed first. The CSV is this list. */
  all: OccupationRow[]
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
export const editionOf = (iso: string): string => `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${iso.slice(0, 4)}`.trim()

export function buildAiJobsIndex(input: { map: ExposureMap; openingsBySoc: ReadonlyMap<string, number>; market: AiMarketData | null; today: string }): AiJobsIndex {
  const { map, openingsBySoc, market } = input
  const asOf = (market?.asOf ?? input.today).slice(0, 10)
  const all: OccupationRow[] = [...map.entries()]
    .map(([soc6, v]) => ({ soc6, title: v.title, score: v.score, band: bandOf(v.score), openings: openingsBySoc.get(soc6) ?? 0, path: checkPath(v.title, soc6) }))
    .sort((a, b) => b.score - a.score || b.openings - a.openings || a.soc6.localeCompare(b.soc6))
  const split = map.size && openingsBySoc.size ? summarizeJobsByExposure([...openingsBySoc].map(([soc6, count]) => ({ soc6, count })), map) : null
  const overall = market?.overall && market.overall.nAi >= MIN_PER_SIDE && market.overall.nBase >= MIN_PER_SIDE ? market.overall : null
  return {
    asOf,
    edition: editionOf(asOf),
    liveOpenings: market?.counts.live ?? null,
    aiSkillSharePct: market && market.counts.fullText > 0 ? Math.round((1000 * market.counts.aiSkillFullText) / market.counts.fullText) / 10 : null,
    premium: overall,
    split: split && split.measured > 0 ? split : null,
    mostExposedHiring: all.filter((r) => r.openings >= MIN_OPENINGS_RANKED).slice(0, TABLE_ROWS),
    mostOpenings: [...all].sort((a, b) => b.openings - a.openings || b.score - a.score).filter((r) => r.openings > 0).slice(0, TABLE_ROWS),
    functions: market
      ? Object.keys(market.functions)
          .map((fn) => aiPremiumForFunction(market, fn))
          .filter((p): p is FunctionAiPremium => p !== null)
          .sort((a, b) => (b.likePct ?? b.rawPct) - (a.likePct ?? a.rawPct))
      : [],
    all,
  }
}

const csvCell = (v: string | number): string => {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const INDEX_CSV_COLUMNS = ['soc_code', 'occupation', 'observed_exposure_pct', 'exposure_band', 'live_openings', 'as_of', 'exposure_source'] as const

/** One row per measured occupation. Aggregates only: no posting, employer or person. */
export function indexCsv(index: AiJobsIndex): string {
  const lines: string[] = [INDEX_CSV_COLUMNS.join(',')]
  for (const r of index.all) {
    lines.push([r.soc6, r.title, Math.round(r.score * 1000) / 10, BAND_LABEL[r.band], r.openings, index.asOf, AI_EXPOSURE_SOURCE.name].map(csvCell).join(','))
  }
  return `${lines.join('\n')}\n`
}

export const indexUrl = (site: string): string => `${site}${INDEX_PATH}`

/** The line to copy. Names the edition, the as-of date and the exposure source the license requires. */
export function indexCitation(index: Pick<AiJobsIndex, 'edition' | 'asOf'>, site: string): string {
  return `${INDEX_NAME}, ${index.edition} edition, data as of ${index.asOf}. AI exposure: ${AI_EXPOSURE_SOURCE.name} (Anthropic, CC BY 4.0). ${indexUrl(site)}`
}

export const INDEX_DESCRIPTION =
  'Monthly index of how much of each job AI already does, how many jobs are open in each occupation, and what AI skills add to advertised pay. Free to cite, with the data as a CSV.'

export function indexJsonLd(index: AiJobsIndex, site: string, creator: Record<string, unknown>): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Dataset',
    name: `${INDEX_NAME}, ${index.edition}`,
    description: INDEX_DESCRIPTION,
    url: indexUrl(site),
    license: INDEX_LICENSE_URL,
    creator,
    isAccessibleForFree: true,
    dateModified: index.asOf,
    temporalCoverage: index.asOf,
    spatialCoverage: 'United States',
    keywords: ['AI exposure by occupation', 'AI jobs', 'AI skills pay premium', 'job openings', 'labor market'],
    isBasedOn: [{ '@type': 'Dataset', name: AI_EXPOSURE_SOURCE.name, url: AI_EXPOSURE_SOURCE.url, license: INDEX_LICENSE_URL }],
    variableMeasured: ['Observed AI exposure by occupation', 'Live openings by occupation', 'Share of postings asking for an AI skill', 'Advertised pay premium for AI skills'],
    distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${site}${INDEX_CSV_PATH}` }],
  }
}
