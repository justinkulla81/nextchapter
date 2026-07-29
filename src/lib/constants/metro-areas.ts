// Normalized US metro-area buckets — CandidateProfile.currentCity/currentState
// are free text (resume/onboarding-derived), which fragments badly if grouped
// naively (Brooklyn, Newark, and Manhattan would each form their own tiny
// Community group instead of one real "NY Metro" peer group). This collapses
// city/state into a fixed set of ~48 major metros + a non-grouping catch-all.
//
// normalizeMetroArea() returns null on no match. "Other/Remote" is
// deliberately not one of the returned buckets — it isn't a real peer group,
// so a candidate outside every listed metro just doesn't get a metro chip.

const METRO_ALIASES: { metro: string; cities: string[] }[] = [
  { metro: 'New York Metro', cities: ['new york', 'brooklyn', 'queens', 'bronx', 'staten island', 'manhattan', 'newark', 'jersey city', 'hoboken', 'yonkers', 'white plains', 'stamford'] },
  { metro: 'SF Bay Area', cities: ['san francisco', 'oakland', 'san jose', 'palo alto', 'mountain view', 'sunnyvale', 'berkeley', 'fremont', 'redwood city', 'menlo park', 'santa clara', 'walnut creek'] },
  { metro: 'Los Angeles Metro', cities: ['los angeles', 'long beach', 'santa monica', 'pasadena', 'burbank', 'glendale', 'anaheim', 'irvine', 'santa ana'] },
  { metro: 'Chicago Metro', cities: ['chicago', 'evanston', 'naperville', 'schaumburg', 'oak park'] },
  { metro: 'DC Metro', cities: ['washington', 'arlington', 'alexandria', 'bethesda', 'rockville', 'silver spring', 'tysons', 'reston', 'mclean'] },
  { metro: 'Boston Metro', cities: ['boston', 'cambridge', 'somerville', 'quincy', 'newton', 'waltham'] },
  { metro: 'Seattle Metro', cities: ['seattle', 'bellevue', 'redmond', 'tacoma', 'kirkland', 'everett'] },
  { metro: 'Dallas-Fort Worth Metro', cities: ['dallas', 'fort worth', 'plano', 'irving', 'frisco', 'mckinney'] },
  { metro: 'Houston Metro', cities: ['houston', 'sugar land', 'the woodlands', 'pearland'] },
  { metro: 'Atlanta Metro', cities: ['atlanta', 'sandy springs', 'alpharetta', 'marietta', 'decatur'] },
  { metro: 'Miami Metro', cities: ['miami', 'fort lauderdale', 'hialeah', 'coral gables', 'boca raton', 'west palm beach'] },
  { metro: 'Philadelphia Metro', cities: ['philadelphia', 'camden', 'king of prussia', 'wilmington'] },
  { metro: 'Phoenix Metro', cities: ['phoenix', 'scottsdale', 'tempe', 'mesa', 'chandler', 'gilbert'] },
  { metro: 'Denver Metro', cities: ['denver', 'aurora', 'boulder', 'lakewood', 'centennial'] },
  { metro: 'Minneapolis-St. Paul Metro', cities: ['minneapolis', 'st. paul', 'saint paul', 'bloomington mn', 'edina'] },
  { metro: 'San Diego Metro', cities: ['san diego', 'chula vista', 'carlsbad', 'oceanside'] },
  { metro: 'Portland Metro', cities: ['portland', 'beaverton', 'hillsboro', 'gresham'] },
  { metro: 'Detroit Metro', cities: ['detroit', 'dearborn', 'ann arbor', 'sterling heights'] },
  { metro: 'Charlotte Metro', cities: ['charlotte', 'concord', 'gastonia'] },
  { metro: 'Raleigh-Durham Metro', cities: ['raleigh', 'durham', 'chapel hill', 'cary'] },
  { metro: 'Nashville Metro', cities: ['nashville', 'franklin', 'murfreesboro'] },
  { metro: 'Austin Metro', cities: ['austin', 'round rock', 'cedar park'] },
  { metro: 'San Antonio Metro', cities: ['san antonio', 'new braunfels'] },
  { metro: 'Tampa Bay Metro', cities: ['tampa', 'st. petersburg', 'saint petersburg', 'clearwater'] },
  { metro: 'Orlando Metro', cities: ['orlando', 'kissimmee', 'winter park'] },
  { metro: 'St. Louis Metro', cities: ['st. louis', 'saint louis', 'clayton'] },
  { metro: 'Baltimore Metro', cities: ['baltimore', 'towson', 'columbia'] },
  { metro: 'Pittsburgh Metro', cities: ['pittsburgh'] },
  { metro: 'Cincinnati Metro', cities: ['cincinnati', 'covington'] },
  { metro: 'Columbus Metro', cities: ['columbus', 'dublin'] },
  { metro: 'Cleveland Metro', cities: ['cleveland', 'akron'] },
  { metro: 'Indianapolis Metro', cities: ['indianapolis', 'carmel'] },
  { metro: 'Kansas City Metro', cities: ['kansas city', 'overland park'] },
  { metro: 'Las Vegas Metro', cities: ['las vegas', 'henderson'] },
  { metro: 'Sacramento Metro', cities: ['sacramento', 'roseville'] },
  { metro: 'Salt Lake City Metro', cities: ['salt lake city', 'provo', 'sandy'] },
  { metro: 'Milwaukee Metro', cities: ['milwaukee', 'waukesha'] },
  { metro: 'Providence Metro', cities: ['providence'] },
  { metro: 'Richmond Metro', cities: ['richmond', 'henrico'] },
  { metro: 'New Orleans Metro', cities: ['new orleans', 'metairie'] },
  { metro: 'Jacksonville Metro', cities: ['jacksonville'] },
  { metro: 'Oklahoma City Metro', cities: ['oklahoma city'] },
  { metro: 'Memphis Metro', cities: ['memphis'] },
  { metro: 'Louisville Metro', cities: ['louisville'] },
  { metro: 'Buffalo Metro', cities: ['buffalo', 'niagara falls'] },
  { metro: 'Hartford Metro', cities: ['hartford'] },
  { metro: 'Birmingham Metro', cities: ['birmingham'] },
  { metro: 'Albuquerque Metro', cities: ['albuquerque'] },
]

function normalizeCity(value: string): string {
  return value.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()
}

// Keyed on city alone, not `${city}|${state}` — every alias list above was
// built to avoid cross-metro name collisions (no two buckets share a city
// name), so state isn't needed to disambiguate and free-text state variance
// ("NY" vs "New York" vs "ny") can't cause a false miss.
export function normalizeMetroArea(city: string | null): string | null {
  if (!city) return null
  const normalizedCity = normalizeCity(city)
  const match = METRO_ALIASES.find(({ cities }) => cities.includes(normalizedCity))
  return match?.metro ?? null
}

export const METRO_AREA_NAMES = Array.from(new Set(METRO_ALIASES.map((m) => m.metro)))
