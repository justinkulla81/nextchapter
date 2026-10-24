// Employer size bands for the board's level flex (level-flex.ts), by normalized company
// name. Pure and client-safe: the server loads the map (loadBoardCompanySizes in
// company-size.ts: the curated static list, the permanent CompanySizeLookup cache and
// Company.sizeBand — never an LLM call) and registers it here before ranking; a name not
// in the map reads as unknown size, which never moves a level.

import type { CompanySizeBand } from '@prisma/client'
import { normalizeOrgName } from '@/lib/text/org-name-match'

let sizes: Map<string, CompanySizeBand> | null = null
const byName = new Map<string, CompanySizeBand | null>()
const BY_NAME_MAX = 200_000

export function setBoardCompanySizes(map: Map<string, CompanySizeBand>): void {
  if (sizes === map) return
  sizes = map
  byName.clear()
}

/** The employer's size band from the registered map, or null (unknown). */
export function boardCompanySizeBand(companyName: string | null | undefined): CompanySizeBand | null {
  if (!sizes || !companyName) return null
  let band = byName.get(companyName)
  if (band === undefined) {
    band = sizes.get(normalizeOrgName(companyName)) ?? null
    if (byName.size >= BY_NAME_MAX) byName.clear()
    byName.set(companyName, band)
  }
  return band
}
