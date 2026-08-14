// Minimum-cell-size suppression — Phase 2 Master Script, Part B, Prompt 8:
// "Minimum cell size of 5. Any segment with fewer than 5 members shows
// 'insufficient data,' never counts. A segment of 2 identifies people."
//
// This repo had zero precedent for this rule before Part B — no admin
// segment-breakdown view suppressed small cells (see
// src/lib/admin/structural-correlation.ts, which now uses this helper).
// Every future admin analytics view that pivots by segment (Prompt 4's
// "prevalence by segment," Prompt 5's population-report breakdowns) must
// run its rows through this before rendering or exporting — suppression
// has to happen before a row ever reaches a table or a CSV, not as a
// display-only filter, since a check applied only in the view layer is one
// forgotten call away from leaking a small cell through the "export CSV"
// path that skips the component tree entirely.
//
// Deliberately generic: the issues-analytics page and the population-report
// page will each pivot differently-shaped rows (an issue-code row with a
// `prevalenceCount`, a segment row with a `memberCount`, etc.) through this
// same helper, so it takes accessor functions rather than assuming a fixed
// field name.

export const MIN_CELL_SIZE = 5

// The suppressed placeholder deliberately carries nothing but a label —
// no count, no rate, no distribution. Any field that survives suppression
// is a field that can identify people in a 2-person segment, so this type
// has no optional "count if you really need it" escape hatch.
export interface SuppressedCell {
  suppressed: true
  label: string
}

export type MaybeSuppressed<T> = (T & { suppressed?: false }) | SuppressedCell

// Runs `rows` through the minimum-cell-size gate. `getCount` reads whatever
// field this particular row shape uses as its member count (e.g.
// `candidateCount`, `memberCount`); `getLabel` reads whatever field names
// the segment, so the suppressed placeholder can still say *which* segment
// was hidden without revealing anything about it.
export function suppressSmallCells<T>(
  rows: T[],
  getCount: (row: T) => number,
  getLabel: (row: T) => string,
  minSize: number = MIN_CELL_SIZE
): MaybeSuppressed<T>[] {
  return rows.map((row) => {
    if (getCount(row) < minSize) {
      return { suppressed: true, label: getLabel(row) }
    }
    return { ...row, suppressed: false }
  })
}

// Type guard for consumers (table components, CSV builders) branching on
// the union — `row.suppressed` alone doesn't narrow cleanly through
// `Array.prototype.map` callbacks without this.
export function isSuppressedCell<T>(row: MaybeSuppressed<T>): row is SuppressedCell {
  return (row as SuppressedCell).suppressed === true
}
