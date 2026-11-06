// Collapsing a third-party copy of a job (Jooble, Careerjet, any aggregator row) into the employer's own listing of it.
//
// The crawler matches a Jooble row to a direct row (ncrawl direct_match.py) and sends the Jooble row with `duplicateOf` set
// to the direct row's url. The import collapses it the way it collapses any second copy: archived with closeReason 'duplicate'
// (job-status.ts: a current job shown through its primary copy, never a closure, so company history, past-job stats and the
// ghost-job counts stay right). New here: the row keeps the id of the row that replaced it (duplicateOfId) so a bad batch can be
// undone, and a third-party row is collapsed only when its direct row is on the board, open, verified recently, and itself direct.
// Pure — no I/O — so it is unit-tested (src/test/direct-replacement.test.ts).

import { PUBLIC_JOB_VERIFIED_DAYS } from '@/lib/jobs/public-job-page'

const DAY_MS = 86_400_000

/** Most third-party rows collapsed in one import request. The rest wait for the next run (a collapse is idempotent). */
export const MAX_AGGREGATOR_COLLAPSES_PER_REQUEST = 1000

export interface CollapseRow {
  url: string
  /** Where the crawler says the primary copy is. */
  duplicateOf: string
  /** The copy being collapsed, as stored today; null when it is not on the board yet. */
  existing: { sourceCategory: string | null; url: string } | null
}

export interface PrimaryRow {
  id: string
  url: string
  archivedAt: Date | null
  lastVerifiedAt: Date | null
  directListing: boolean
  sourceCategory: string | null
}

export interface CollapsePlan {
  /** Rows to archive as 'duplicate', each with the id of its primary (null when the primary is not on the board: only for rows that are not third-party). */
  collapse: { url: string; primaryId: string | null }[]
  blocked: { noPrimary: number; primaryNotLive: number; primaryNotDirect: number; deferred: number }
  /** How many of the collapses are third-party rows (the guarded kind). */
  guardedCollapses: number
}

const AGGREGATOR_HOST = /(^|\.)(jooble\.org|jobviewtrack\.com|careerjet\.[a-z.]+|adzuna\.[a-z.]+)$/i

/** True for a row whose apply link or source class says it is a third party's copy of a job. */
export function isThirdPartyRow(row: { url: string; sourceCategory: string | null }): boolean {
  if (row.sourceCategory === 'aggregator') return true
  try {
    return AGGREGATOR_HOST.test(new URL(row.url).hostname)
  } catch {
    return false
  }
}

export function isDirectPrimary(p: Pick<PrimaryRow, 'directListing' | 'sourceCategory'>): boolean {
  return p.directListing || p.sourceCategory === 'employer'
}

export function planCollapses(rows: CollapseRow[], primariesByUrl: ReadonlyMap<string, PrimaryRow>, now: Date, cap = MAX_AGGREGATOR_COLLAPSES_PER_REQUEST): CollapsePlan {
  const plan: CollapsePlan = { collapse: [], blocked: { noPrimary: 0, primaryNotLive: 0, primaryNotDirect: 0, deferred: 0 }, guardedCollapses: 0 }
  for (const r of rows) {
    const primary = primariesByUrl.get(r.duplicateOf.trim())
    // Rows that are not a third party's copy keep the importer's old behaviour: collapsed, with the link when the primary is known.
    if (!r.existing || !isThirdPartyRow({ url: r.url, sourceCategory: r.existing.sourceCategory })) {
      plan.collapse.push({ url: r.url, primaryId: primary?.id ?? null })
      continue
    }
    if (!primary) {
      plan.blocked.noPrimary++
      continue
    }
    const verifiedFresh = !!primary.lastVerifiedAt && now.getTime() - primary.lastVerifiedAt.getTime() <= PUBLIC_JOB_VERIFIED_DAYS * DAY_MS
    if (primary.archivedAt || !verifiedFresh) {
      plan.blocked.primaryNotLive++
      continue
    }
    if (!isDirectPrimary(primary) || isThirdPartyRow(primary)) {
      plan.blocked.primaryNotDirect++
      continue
    }
    if (plan.guardedCollapses >= cap) {
      plan.blocked.deferred++
      continue
    }
    plan.guardedCollapses++
    plan.collapse.push({ url: r.url, primaryId: primary.id })
  }
  return plan
}
