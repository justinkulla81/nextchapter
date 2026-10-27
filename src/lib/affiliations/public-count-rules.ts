// When a public page may show how many people are connected to an organization. Pure and client-safe; the queries are in public-count.ts.
//
// The same floor the layoff-cohort launch kit uses: fewer than this and no number is shown anywhere, so a small group can never be read
// person by person, and a page with few members says nothing instead of showing a small number.

export const PUBLIC_COUNT_FLOOR = 10

/** The number to show, or null when it is under the floor. */
export function publicCount(n: number | null | undefined): number | null {
  return typeof n === 'number' && Number.isFinite(n) && n >= PUBLIC_COUNT_FLOOR ? Math.floor(n) : null
}

/** "212 people", "1 person"; used where a count reads in a sentence. */
export function peopleWord(n: number): string {
  return n === 1 ? 'person' : 'people'
}
