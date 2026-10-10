// US / non-US classification for job locations, used to keep non-US jobs off the
// board (ATS feed and ncrawl import) and for display.
//
// Three verdicts, because "I can't tell" is a real and common answer:
//   us       an explicit US signal (a state, "United States", "USA")
//   non_us   an explicit foreign signal (a country, a known foreign city, a
//            non-US country code)
//   unknown  no usable signal: empty, "Remote", "Hybrid", "3 Locations", or a
//            bare city that could be anywhere
//
// Only `non_us` is ever rejected. `unknown` is kept — most employers on the board
// are US companies and rejecting every location-less job would drop real roles —
// but it is never reported as confirmed US.
//
// The previous version matched foreign names as SUBSTRINGS, which rejected real US
// jobs: "india" matched Indiana, "mexico" matched New Mexico, "paris" Paris TX,
// "london" London KY, "dublin" Dublin OH, "china" China Grove NC. Everything here
// matches whole words, and a US state signal always beats a city-name collision.

export type LocationVerdict = 'us' | 'non_us' | 'unknown'

const US_STATE_CODES = new Set(
  'AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC PR GU VI'.split(' ')
)

const US_STATE_NAMES = [
  'alabama', 'alaska', 'arizona', 'arkansas', 'california', 'colorado', 'connecticut', 'delaware', 'florida',
  'georgia', 'hawaii', 'idaho', 'illinois', 'indiana', 'iowa', 'kansas', 'kentucky', 'louisiana', 'maine',
  'maryland', 'massachusetts', 'michigan', 'minnesota', 'mississippi', 'missouri', 'montana', 'nebraska',
  'nevada', 'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota', 'ohio',
  'oklahoma', 'oregon', 'pennsylvania', 'rhode island', 'south carolina', 'south dakota', 'tennessee', 'texas',
  'utah', 'vermont', 'virginia', 'washington', 'west virginia', 'wisconsin', 'wyoming', 'district of columbia',
  'puerto rico',
]

// Countries (whole-word). "georgia" is deliberately absent: it is a US state far more
// often than the country, and the country's cities are listed below.
const NON_US_COUNTRIES = [
  'canada', 'united kingdom', 'great britain', 'england', 'scotland', 'wales', 'northern ireland', 'ireland',
  'germany', 'france', 'spain', 'italy', 'portugal', 'netherlands', 'holland', 'belgium', 'switzerland',
  'austria', 'sweden', 'norway', 'denmark', 'finland', 'iceland', 'poland', 'czech republic', 'czechia',
  'slovakia', 'hungary', 'romania', 'bulgaria', 'greece', 'serbia', 'croatia', 'slovenia', 'estonia',
  'latvia', 'lithuania', 'ukraine', 'russia', 'turkey', 'turkiye', 'cyprus', 'malta', 'luxembourg',
  'brazil', 'argentina', 'chile', 'colombia', 'peru', 'uruguay', 'ecuador', 'venezuela', 'costa rica',
  'panama', 'guatemala', 'dominican republic', 'jamaica', 'mexico',
  'india', 'china', 'hong kong', 'taiwan', 'japan', 'south korea', 'korea', 'singapore', 'malaysia',
  'thailand', 'vietnam', 'indonesia', 'philippines', 'pakistan', 'bangladesh', 'sri lanka', 'nepal',
  'australia', 'new zealand',
  'israel', 'united arab emirates', 'uae', 'saudi arabia', 'qatar', 'kuwait', 'bahrain', 'oman', 'jordan',
  'lebanon', 'egypt', 'morocco', 'tunisia', 'algeria', 'nigeria', 'ghana', 'kenya', 'ethiopia', 'tanzania',
  'uganda', 'south africa', 'emea', 'apac', 'latam',
]

// Foreign cities that appear with no country attached. A US state signal beats these
// ("Paris, TX", "London, KY", "Dublin, OH").
const NON_US_CITIES = [
  'toronto', 'vancouver', 'montreal', 'montréal', 'ottawa', 'calgary', 'edmonton', 'winnipeg', 'quebec',
  'london', 'manchester', 'birmingham uk', 'edinburgh', 'glasgow', 'bristol', 'leeds', 'cambridge uk', 'oxford uk',
  'dublin', 'cork', 'galway', 'berlin', 'munich', 'frankfurt', 'hamburg', 'cologne', 'stuttgart', 'dusseldorf',
  'paris', 'lyon', 'marseille', 'toulouse', 'madrid', 'barcelona', 'valencia', 'lisbon', 'porto', 'rome', 'milan',
  'turin', 'amsterdam', 'rotterdam', 'the hague', 'utrecht', 'eindhoven', 'brussels', 'antwerp', 'zurich',
  'geneva', 'basel', 'vienna', 'stockholm', 'gothenburg', 'malmo', 'copenhagen', 'oslo', 'helsinki', 'warsaw',
  'krakow', 'wroclaw', 'prague', 'budapest', 'bucharest', 'sofia', 'athens', 'kyiv', 'kiev', 'istanbul', 'tallinn',
  'riga', 'vilnius', 'sao paulo', 'são paulo', 'rio de janeiro', 'mexico city', 'guadalajara', 'monterrey',
  'buenos aires', 'santiago', 'bogota', 'bogotá', 'medellin', 'lima', 'bangalore', 'bengaluru', 'mumbai', 'delhi',
  'new delhi', 'gurgaon', 'gurugram', 'noida', 'hyderabad', 'chennai', 'pune', 'kolkata', 'ahmedabad',
  'shanghai', 'beijing', 'shenzhen', 'guangzhou', 'chengdu', 'hangzhou', 'taipei', 'taichung', 'hsinchu',
  'kaohsiung', 'tokyo', 'osaka', 'yokohama', 'nagoya', 'seoul', 'busan', 'singapore', 'penang', 'kuala lumpur',
  'johor', 'bangkok', 'laem chabang', 'ho chi minh', 'hanoi', 'jakarta', 'manila', 'cebu', 'karachi', 'lahore',
  'dhaka', 'colombo', 'sydney', 'melbourne', 'brisbane', 'perth', 'adelaide', 'auckland', 'wellington',
  'tel aviv', 'jerusalem', 'haifa', 'dubai', 'abu dhabi', 'riyadh', 'doha', 'cairo', 'casablanca', 'lagos',
  'nairobi', 'accra', 'johannesburg', 'cape town', 'tbilisi',
]

// ISO country codes seen as a trailing ", XX" / " - XX" that are not US state codes.
// Codes that are ALSO a US state (CA, DE, IN, IL, PA, GA, AL, AR, CO, ...) are
// deliberately excluded: after a comma they are overwhelmingly the state.
const NON_US_ISO2 = new Set(
  'TH MY TW SG HK JP KR CN VN ID PH PK BD LK NP AU NZ GB UK IE FR ES IT PT NL BE CH AT SE NO DK FI PL CZ SK HU RO BG GR RS HR SI EE LV LT UA RU TR CY MT LU BR CL PE UY EC VE CR GT DO JM MX IL AE SA QA KW BH OM JO LB EG MA TN DZ NG GH KE ET TZ UG ZA'.split(' ')
)
// ...of which these double as a US state/territory code and so are skipped.
for (const c of ['IL', 'DE']) NON_US_ISO2.delete(c)

// Well-known US cities that appear bare, with no state. Only consulted when there is
// no foreign signal at all, so "San Francisco" resolves but "Paris" never does.
const US_CITIES = [
  'new york', 'new york city', 'nyc', 'los angeles', 'chicago', 'houston', 'phoenix', 'philadelphia', 'san antonio',
  'san diego', 'dallas', 'san jose', 'austin', 'jacksonville', 'fort worth', 'columbus', 'charlotte',
  'san francisco', 'san francisco bay area', 'bay area', 'indianapolis', 'seattle', 'denver', 'washington dc',
  'boston', 'el paso', 'nashville', 'detroit', 'oklahoma city', 'portland', 'las vegas', 'memphis',
  'louisville', 'baltimore', 'milwaukee', 'albuquerque', 'tucson', 'fresno', 'sacramento', 'kansas city',
  'atlanta', 'omaha', 'raleigh', 'miami', 'oakland', 'minneapolis', 'tulsa', 'cleveland', 'tampa',
  'new orleans', 'honolulu', 'pittsburgh', 'cincinnati', 'st louis', 'saint louis', 'orlando', 'irvine',
  'santa clara', 'sunnyvale', 'mountain view', 'palo alto', 'menlo park', 'redwood city', 'cupertino',
  'boulder', 'salt lake city', 'richmond', 'durham', 'madison', 'ann arbor', 'princeton', 'stamford',
]
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const wordRe = (terms: string[]) => new RegExp(`(^|[^a-z])(${terms.map(escape).join('|')})([^a-z]|$)`, 'i')

const COUNTRY_RE = wordRe(NON_US_COUNTRIES)
const CITY_RE = wordRe(NON_US_CITIES)
const STATE_NAME_RE = wordRe(US_STATE_NAMES)
const US_CITY_RE = wordRe(US_CITIES)
const US_WORD_RE = /(^|[^a-z])(united states( of america)?|usa|u\.s\.a?\.?|us|america)([^a-z]|$)/i

function trailingCode(location: string): string | null {
  // "..., NJ", "... - NJ", "... - NJ - US", "...(NJ)"
  const parts = location
    .split(/[,|/;()]| - | – /)
    .map((p) => p.trim())
    .filter(Boolean)
  for (let i = parts.length - 1; i >= 0; i--) {
    if (/^[A-Za-z]{2}$/.test(parts[i])) return parts[i].toUpperCase()
  }
  return null
}

export function classifyLocation(location: string | null | undefined): LocationVerdict {
  if (!location || !location.trim()) return 'unknown'
  const lower = location.toLowerCase().trim()

  const hasUsWord = US_WORD_RE.test(lower)
  // A US state NAME is a US signal, and removing it first stops "New Mexico" from
  // being read as Mexico and "Indiana" as India.
  const hasStateName = STATE_NAME_RE.test(lower)
  const withoutStates = hasStateName ? lower.replace(new RegExp(STATE_NAME_RE.source, 'gi'), ' ') : lower

  const code = trailingCode(location)
  const hasStateCode = code !== null && US_STATE_CODES.has(code)

  // 1. An explicit foreign country name, with no explicit US signal beside it. A US
  // state code outranks a country-named town ("Lebanon, PA") unless the country is
  // stated as the LAST part ("Toronto, ON, Canada", "Indianapolis, IN, India").
  const lastPart = withoutStates.split(/[,|/;]| - | – /).map((p) => p.trim()).filter(Boolean).pop() ?? ''
  const countryIsLast = COUNTRY_RE.test(lastPart)
  if (COUNTRY_RE.test(withoutStates) && !hasUsWord && (countryIsLast || !hasStateCode)) return 'non_us'
  // 2. Explicit US signal.
  if (hasUsWord || hasStateCode || hasStateName) return 'us'
  // 3. A foreign city or a non-US country code, with no US signal at all.
  if (CITY_RE.test(lower)) return 'non_us'
  if (code !== null && NON_US_ISO2.has(code)) return 'non_us'
  // 4. A well-known US city with no foreign signal anywhere.
  if (US_CITY_RE.test(lower)) return 'us'
  return 'unknown'
}

/**
 * Kept for existing callers: false only when the location is confidently non-US.
 * Unknown locations pass — see the header for why.
 */
export function isUsLocation(location: string | null): boolean {
  return classifyLocation(location) !== 'non_us'
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

const US_STATE_CODE_PATTERN =
  'AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC'
const CLEARLY_US = new RegExp(`\\b(united states|usa|u\\.s\\.a?\\.?)\\b|,\\s*(${US_STATE_CODE_PATTERN})\\b`, 'i')

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
