// Jobs that are not open to people in the US, read from the posting text: "Remote from Latin America", "must be based
// in the Philippines", "LATAM-based professionals", or pay quoted as a monthly USD salary range (offshore staffing firms
// such as Hire Latam). The fit score treats them as not in the member's area (job-fit-bucket.ts placeFit), so they can
// never be a good or strong fit for a member in the US. Only explicit phrasing counts, and a region named together with
// the US ("US and Canada-based candidates", "remote in Europe or the US") does not. A monthly stipend ("$75 USD/month
// for internet") is not pay. Pure. Tests: src/test/real-board-fixes.test.ts. The import stores the result as the
// 'outside_us' requirement (requirements.ts), so the board's light rows carry it; live rows pick it up on re-import.

const REGIONS =
  '(?:latin america|latam|south america|central america|mexico|colombia|brazil|argentina|chile|peru|costa rica|' +
  'the philippines|philippines|india|pakistan|nigeria|kenya|south africa|europe|the eu|emea|apac|asia|' +
  'eastern europe|poland|ukraine|romania|portugal|spain|canada|the uk|united kingdom)'
const US = '(?:the\\s+)?(?:us|u\\.s\\.?|usa|united states|north america|americas)'
// Not "…, or the US" / "… and the US" after the region, nor "US and …" / "US or …" before it.
const NOT_WITH_US_AFTER = `(?!\\s*(?:,|/|&|\\bor\\b|\\band\\b)\\s*${US}\\b)`
const NOT_WITH_US_BEFORE = `(?<!${US}\\s*(?:,|/|&|or|and)\\s*)`

const PLACE_PATTERNS: RegExp[] = [
  // "Remote from Latin America", "remote within LATAM", "Remote (Philippines)"
  new RegExp(`\\bremote\\s*(?:from|within|across|in|\\(|-|–|:)\\s*${REGIONS}\\b${NOT_WITH_US_AFTER}`),
  // "must be located in Colombia", "candidates must reside in India"
  new RegExp(`\\b(?:must|should|need to)\\s+(?:be\\s+)?(?:located|based|residing|reside|living|live)\\s+(?:in|within)\\s+${REGIONS}\\b${NOT_WITH_US_AFTER}`),
  // "LATAM-based professionals", not "US and Canada-based candidates"
  new RegExp(`${NOT_WITH_US_BEFORE}\\b${REGIONS}[-\\s]based\\s+(?:candidates|professionals|talent|applicants|team members)\\b`),
  // "open to candidates in Latin America only"
  new RegExp(`\\b(?:candidates|applicants|professionals)\\s+(?:located\\s+|based\\s+)?in\\s+${REGIONS}\\s+only\\b`),
]

// A monthly salary range in USD with real amounts ("$3,500 - $4,500 USD monthly salary"), not a stipend.
const MONTHLY_PAY = [
  /\$?\d[\d,]{3,}\s*(?:-|–|to)\s*\$?\d[\d,]{3,}\s*usd\s*(?:monthly|per month|\/\s*month|a month)\b/,
  /\busd\s+monthly\s+salary\b/,
]
// A posting that also speaks to people in the US is not offshore-only on its pay alone.
const MENTIONS_US_RESIDENTS = /\b(?:united states|u\.s\.|usa)\b|\bus[- ]based\b|\bin the us\b/

/** True when the posting says it is for people outside the US. `text` is the title and description, any case. */
export function notOpenToUsResidents(text: string | null | undefined): boolean {
  if (!text) return false
  const lower = text.toLowerCase()
  if (PLACE_PATTERNS.some((re) => re.test(lower))) return true
  return MONTHLY_PAY.some((re) => re.test(lower)) && !MENTIONS_US_RESIDENTS.test(lower)
}
