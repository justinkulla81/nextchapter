// Best-effort US/non-US classification for ATS feed listings and admin
// display. Deliberately biased toward "assume US unless a foreign signal is
// present" rather than requiring a positive US match — ATS location strings
// vary wildly ("San Francisco, CA", "Remote", "Remote - US", bare city names
// with no state) and most of the curated companies in ats-companies.ts are
// US-headquartered, so a strict positive-match list would reject far more
// legitimate US listings than it catches. Explicit foreign country/city
// names are a much stronger, lower-false-positive signal to filter on.
const NON_US_SIGNALS = [
  // Countries
  'canada',
  'united kingdom',
  'uk',
  'england',
  'scotland',
  'wales',
  'ireland',
  'germany',
  'france',
  'spain',
  'italy',
  'portugal',
  'netherlands',
  'belgium',
  'switzerland',
  'austria',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'poland',
  'brazil',
  'mexico',
  'argentina',
  'chile',
  'colombia',
  'india',
  'china',
  'japan',
  'south korea',
  'singapore',
  'australia',
  'new zealand',
  'israel',
  'united arab emirates',
  'uae',
  'south africa',
  'philippines',
  'vietnam',
  'thailand',
  'indonesia',
  'malaysia',
  'egypt',
  'nigeria',
  'kenya',
  'turkey',
  'russia',
  'ukraine',
  'romania',
  'greece',
  'czech republic',
  'hungary',
  // Common non-US cities that appear without an accompanying country name
  'toronto',
  'vancouver',
  'montreal',
  'montréal',
  'ottawa',
  'london',
  'manchester',
  'dublin',
  'berlin',
  'munich',
  'frankfurt',
  'hamburg',
  'paris',
  'madrid',
  'barcelona',
  'lisbon',
  'amsterdam',
  'rotterdam',
  'zurich',
  'geneva',
  'stockholm',
  'copenhagen',
  'oslo',
  'helsinki',
  'warsaw',
  'são paulo',
  'sao paulo',
  'rio de janeiro',
  'mexico city',
  'buenos aires',
  'bogota',
  'bogotá',
  'bangalore',
  'mumbai',
  'delhi',
  'hyderabad',
  'shanghai',
  'beijing',
  'shenzhen',
  'tokyo',
  'osaka',
  'seoul',
  'sydney',
  'melbourne',
  'auckland',
  'tel aviv',
  'dubai',
  'abu dhabi',
  'johannesburg',
  'cape town',
  'manila',
  'jakarta',
  'kuala lumpur',
  'bangkok',
  'cairo',
  'lagos',
  'nairobi',
  'istanbul',
]

export function isUsLocation(location: string | null): boolean {
  if (!location) return true // no signal either way — don't reject on absence
  const lower = location.toLowerCase()
  return !NON_US_SIGNALS.some((signal) => lower.includes(signal))
}

// "United States" as a bare location string carries no more information than
// "Remote" does (no state/city, i.e. the company didn't scope it to an
// office) — showing it as a literal place reads oddly next to actual city
// listings, so it's relabeled for display. The stored value is untouched.
export function displayJobLocation(location: string | null): string | null {
  if (!location) return null
  const trimmed = location.trim()
  return /^united states$/i.test(trimmed) || /^usa$/i.test(trimmed) ? 'Remote' : trimmed
}

const US_STATE_CODES =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC'
const CLEARLY_US = new RegExp(`\\b(united states|usa|u\\.s\\.a?\\.?)\\b|,\\s*(${US_STATE_CODES})\\b`, 'i')

/**
 * A location that says outright it's in the US ("Dresher, PA", "Remote,
 * United States") — enough to trust over a foreign-sounding word in the job
 * title ("Upper Dublin" is in Pennsylvania).
 */
export function isClearlyUsLocation(location: string | null): boolean {
  return !!location && CLEARLY_US.test(location)
}

// Foreign city names that are also US towns ("Rome, NY", "Vienna, VA",
// "Vancouver, WA"): with a US state code beside them, they're the US town.
const AMBIGUOUS_US_TOWN =
  /^(rome|paris|dublin|manchester|athens|lima|london|vienna|valencia|hamburg|frankfurt|berlin|milan|warsaw|delhi|edinburgh|glasgow|belfast|cologne|ottawa|montevideo|lisbon|madrid|amsterdam|rotterdam|cairo|melbourne|brussels|antwerp|toronto|vancouver|sofia|lyon|naples|florence|cork|santiago|quebec)$/i

/**
 * Whether a job's title or location names a place outside the US — catches
 * foreign towns isUsLocation doesn't know ("Poznań", "DEU - Bayern") and
 * European "(f/m/d)" titles, while trusting a clearly-US location over a
 * title word ("Upper Dublin" in Dresher, PA) and a US state code over an
 * ambiguous town name ("Rome, NY").
 */
export function namesNonUsPlace(title: string, location: string | null, nonUs: RegExp): boolean {
  const clearlyUs = isClearlyUsLocation(location)
  if (nonUs.test(title) && !clearlyUs) return true
  if (!location) return false
  const m = location.match(nonUs)
  if (!m) return false
  return !(clearlyUs && AMBIGUOUS_US_TOWN.test(m[0].trim()))
}
