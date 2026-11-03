// The segments that get their own job lists, and the rules that decide which board postings belong. Pure, no I/O, so the
// rules are unit-tested (src/test/segments.test.ts).
//
// A posting is in a segment when any one of the segment's rules matches; a rule matches when every field it names matches.
// Rules are allowlists (employer names written out, title patterns that name the work), never a blanket guess: a posting no
// rule recognises is simply in no segment. Employer names are matched whole after the same normalising the employer pages use
// ("Lockheed Martin Corporation" is "lockheed martin"), so "Target" never matches "Targeted Genomics".

import { normalizeOrgName } from '@/lib/text/org-name-match'
import type { BoardRow } from '@/lib/segments/types'

interface Rule {
  /** Crawler industry codes (ExclusiveJobPosting.industry). */
  codes?: string[]
  /** Employer names, whole, as people write them. */
  employers?: string[]
  /** Pattern for words in an employer name ("casino", "hotel"). */
  company?: RegExp
  title?: RegExp
  /** Clearance and similar requirement tags. */
  tags?: RegExp
}

export interface SegmentDef {
  slug: string
  name: string
  /** How a heading reads: "Open {label} jobs". */
  label: string
  blurb: string
  rules: Rule[]
  /** A posting matching this is left out even when a rule matched it. */
  exclude?: { title?: RegExp; company?: RegExp }
  /** The words the "all jobs" search link and the saved search use. */
  query: string
}

const names = (list: string[]) => new Set(list.map((n) => normalizeOrgName(n)))

// Employers post under longer forms of the same name ("Marriott International", "Hilton Worldwide"). These endings, and only
// these, are dropped before a name is compared; any other ending ("Targeted Genomics") is a different employer.
const SAFE_TAILS = ['international', 'worldwide', 'holdings', 'holding', 'global', 'usa', 'us', 'america', 'north america', 'americas', 'brands', 'entertainment', 'resorts', 'hotels', 'stores', 'companies', 'enterprises']

export function employerIn(set: Set<string>, normalized: string): boolean {
  if (set.has(normalized)) return true
  for (const t of SAFE_TAILS) if (normalized.endsWith(` ${t}`) && set.has(normalized.slice(0, -t.length - 1))) return true
  return false
}

export const MIN_SEGMENT_JOBS = 30

export const SEGMENTS: SegmentDef[] = [
  {
    slug: 'data-centers',
    name: 'Data centers',
    label: 'data center',
    blurb: 'The operators, builders and power teams behind the buildings that run the internet and AI.',
    query: 'data center',
    rules: [
      { employers: ['Equinix', 'Digital Realty', 'QTS', 'CyrusOne', 'Switch', 'Vantage Data Centers', 'Aligned Data Centers', 'Stack Infrastructure', 'CoreWeave', 'Compass Datacenters', 'EdgeConneX', 'Flexential', 'DataBank', 'Cologix', 'Applied Digital', 'Crusoe', 'Core Scientific', 'Sabey Data Centers', 'Yondr', 'Related Digital', 'Prime Data Centers', 'Novva', 'TierPoint', 'Iron Mountain Data Centers', 'Lambda', 'Nebius', 'Tract'] },
      { company: /\bdata ?cent(er|re)s?\b|\bdatacenters?\b/i },
      { title: /\bdata ?cent(er|re)\b|\bdatacenter\b|\bhyperscale\b|\bcolocation\b|\bcritical (facilities|environments?)\b|\bmission[- ]critical\b/i },
    ],
    exclude: { title: /\bdata cent(er|re)\b.*\b(sales|account executive)\b/i },
  },
  {
    slug: 'defense',
    name: 'Defense and aerospace',
    label: 'defense and aerospace',
    blurb: 'Prime contractors, new defense technology companies and the cleared roles that support them.',
    query: 'defense',
    rules: [
      { codes: ['aerospace_defense'] },
      { employers: ['Lockheed Martin', 'RTX', 'Raytheon', 'Northrop Grumman', 'General Dynamics', 'L3Harris', 'Boeing', 'Anduril', 'Huntington Ingalls Industries', 'BAE Systems', 'Leidos', 'Booz Allen Hamilton', 'SAIC', 'CACI', 'Parsons', 'Peraton', 'Textron', 'Palantir', 'Shield AI', 'Saronic', 'Kratos', 'Mercury Systems', 'Sierra Nevada Corporation', 'Collins Aerospace', 'Pratt & Whitney', 'GE Aerospace', 'Honeywell Aerospace', 'Oshkosh Defense', 'Maxar', 'Ball Aerospace', 'SpaceX', 'Blue Origin', 'Rocket Lab', 'Virgin Galactic', 'Hexcel', 'Howmet', 'TransDigm', 'Curtiss-Wright', 'Moog', 'Elbit America', 'Leonardo DRS', 'V2X', 'Amentum', 'KBR', 'ManTech', 'Science Applications International'] },
      { tags: /clearance/i },
    ],
  },
  {
    slug: 'healthcare',
    name: 'Healthcare',
    label: 'healthcare',
    blurb: 'Hospital systems, health plans and the leadership, clinical and administrative professionals inside them.',
    query: 'healthcare',
    rules: [{ codes: ['healthcare'] }],
  },
  {
    slug: 'financial-services',
    name: 'Financial services',
    label: 'financial services',
    blurb: 'Banks, lenders, insurers, payments, wealth and asset managers.',
    query: 'financial services',
    rules: [{ codes: ['financial_services'] }],
  },
  {
    slug: 'real-estate',
    name: 'Real estate',
    label: 'real estate',
    blurb: 'Brokerages, developers, property managers and the investors behind them.',
    query: 'real estate',
    rules: [
      { codes: ['real_estate'], company: /\b(realty|real estate|propert(y|ies)|brokerage|reit|leasing|residential|apartments?|asset management)\b/i },
      { employers: ['CBRE', 'JLL', 'Jones Lang LaSalle', 'Cushman & Wakefield', 'Colliers', 'Newmark', 'Keller Williams', 'RE/MAX', 'Zillow', 'Redfin', 'Opendoor', 'eXp Realty', 'Equity Residential', 'Prologis', 'Simon Property Group', 'Invitation Homes', 'Greystar', 'Lincoln Property Company', 'AvalonBay', 'Realogy', 'Anywhere Real Estate', 'Berkshire Hathaway HomeServices', 'Coldwell Banker', 'Century 21', 'Sotheby\'s International Realty', 'Marcus & Millichap', 'Realty Income', 'Public Storage', 'Welltower', 'Extra Space Storage'] },
      { title: /\b(property manager|leasing (consultant|manager|agent)|real estate (agent|broker|analyst|associate|manager|director)|asset manager.*real estate|realtor)\b/i },
    ],
  },
  {
    slug: 'construction',
    name: 'Construction',
    label: 'construction',
    blurb: 'Contractors, homebuilders and the project, estimating and field leadership that deliver buildings and infrastructure.',
    query: 'construction',
    rules: [
      { codes: ['real_estate'], company: /\b(construct\w*|builders?|contracting|contractors?|homes|engineering and construction)\b/i },
      { employers: ['Turner Construction', 'Bechtel', 'Fluor', 'Kiewit', 'Skanska', 'Jacobs', 'AECOM', 'DPR Construction', 'Whiting-Turner', 'Clark Construction', 'Hensel Phelps', 'Sundt', 'McCarthy Building Companies', 'Mortenson', 'Webcor', 'Toll Brothers', 'Lennar', 'D.R. Horton', 'PulteGroup', 'NVR', 'KB Home', 'Meritage Homes', 'Granite Construction', 'Tutor Perini', 'Balfour Beatty', 'Gilbane', 'Holder Construction', 'Brasfield & Gorrie', 'Swinerton', 'JE Dunn', 'Sterling Infrastructure', 'Quanta Services', 'MasTec', 'EMCOR', 'Comfort Systems USA', 'Dycom', 'Primoris'] },
      { title: /\b(construction (manager|project manager|superintendent|engineer|executive|director|estimator)|superintendent|estimator|preconstruction|general superintendent|site superintendent|project superintendent)\b/i },
    ],
    exclude: { title: /\b(software|sales|recruiter|accountant)\b/i },
  },
  {
    slug: 'retail',
    name: 'Retail',
    label: 'retail',
    blurb: 'Store chains, marketplaces and direct-to-consumer brands: merchandising, operations, finance and corporate roles.',
    query: 'retail',
    rules: [
      { codes: ['consumer'], company: /\b(retail|stores?|shops?|mart|outlet|e-?commerce|depot|boutique|supermarkets?|grocery)\b/i },
      { employers: ['Walmart', 'Target', 'Costco', 'Home Depot', 'Lowe\'s', 'Kroger', 'Best Buy', 'Macy\'s', 'Kohl\'s', 'Nordstrom', 'TJX', 'Ross Stores', 'Dollar General', 'Dollar Tree', 'Albertsons', 'Publix', 'Ulta Beauty', 'Gap', 'Williams-Sonoma', 'Dick\'s Sporting Goods', 'Petco', 'PetSmart', 'AutoZone', 'O\'Reilly Automotive', 'Advance Auto Parts', 'Wayfair', 'Etsy', 'eBay', 'Chewy', 'Sephora', 'Bath & Body Works', 'Victoria\'s Secret', 'Lululemon', 'Burlington', 'Five Below', 'Tractor Supply', 'Wegmans', 'Aldi', 'H-E-B', 'Meijer', 'Sally Beauty', 'Foot Locker', 'Academy Sports + Outdoors'] },
    ],
  },
  {
    slug: 'consumer-packaged-goods',
    name: 'Consumer packaged goods',
    label: 'consumer packaged goods',
    blurb: 'Food, beverage, beauty and household brands: brand, supply chain, sales and finance careers.',
    query: 'consumer packaged goods',
    rules: [
      { codes: ['consumer'], company: /\b(foods?|brands?|beverages?|consumer products|cosmetics?|beauty|household|packaged|snacks?|brewing|distilling)\b/i },
      { employers: ['Procter & Gamble', 'Unilever', 'Colgate-Palmolive', 'Kimberly-Clark', 'General Mills', 'Kellanova', 'Kellogg', 'PepsiCo', 'Coca-Cola', 'Mondelez', 'Hershey', 'Mars', 'Campbell\'s', 'Conagra Brands', 'Kraft Heinz', 'Tyson Foods', 'Hormel Foods', 'Clorox', 'Church & Dwight', 'Estee Lauder', 'L\'Oreal', 'J.M. Smucker', 'Keurig Dr Pepper', 'Molson Coors', 'Constellation Brands', 'Anheuser-Busch', 'Newell Brands', 'Reckitt', 'Edgewell', 'Spectrum Brands', 'Post Holdings', 'Lamb Weston', 'McCormick', 'Hain Celestial', 'Monster Beverage', 'Kenvue', 'Haleon', 'Nestle', 'Danone', 'Henkel', 'Coty', 'Revlon', 'Energizer'] },
    ],
  },
  {
    slug: 'restaurants',
    name: 'Restaurants',
    label: 'restaurant',
    blurb: 'Restaurant companies and the operations, culinary, franchise and corporate teams that run them.',
    query: 'restaurant',
    rules: [
      { company: /\b(restaurants?|grill|kitchen|eatery|pizza|burgers?|taqueria|bistro|steakhouse|tavern|diner|cafe|coffee)\b/i },
      { employers: ['McDonald\'s', 'Starbucks', 'Chipotle', 'Darden Restaurants', 'Yum! Brands', 'Restaurant Brands International', 'Domino\'s', 'Wendy\'s', 'Burger King', 'Chick-fil-A', 'Panera Bread', 'Olive Garden', 'Texas Roadhouse', 'Brinker International', 'Cheesecake Factory', 'Bloomin\' Brands', 'Cracker Barrel', 'Sweetgreen', 'Shake Shack', 'Wingstop', 'Papa John\'s', 'Dine Brands', 'Jack in the Box', 'Dutch Bros', 'Cava', 'Portillo\'s', 'Taco Bell', 'KFC', 'Pizza Hut', 'Subway', 'Dunkin\'', 'Arby\'s', 'Inspire Brands', 'Sonic Drive-In', 'Popeyes', 'Tim Hortons', 'Red Robin', 'First Watch', 'Dave & Buster\'s', 'BJ\'s Restaurants', 'Aramark', 'Sodexo', 'Compass Group'] },
      { title: /\b(restaurant (general )?manager|culinary (director|manager)|executive chef|director of (food and beverage|restaurant operations)|franchise (business )?(consultant|manager))\b/i },
    ],
  },
  {
    slug: 'tourism-hospitality',
    name: 'Tourism and hospitality',
    label: 'tourism and hospitality',
    blurb: 'Hotels, resorts, cruise lines, theme parks and travel companies: operations, revenue, sales and guest experience.',
    query: 'hospitality',
    rules: [
      { company: /\b(hotels?|resorts?|hospitality|inns?|lodging|cruises?|cruise line|vacations?|travel)\b/i },
      { employers: ['Marriott', 'Hilton', 'Hyatt', 'IHG Hotels & Resorts', 'Wyndham', 'Choice Hotels', 'Airbnb', 'Expedia', 'Booking Holdings', 'Tripadvisor', 'Carnival', 'Royal Caribbean', 'Norwegian Cruise Line', 'Vail Resorts', 'Six Flags', 'Cedar Fair', 'SeaWorld', 'Disney Parks', 'Universal Parks & Resorts', 'Host Hotels & Resorts', 'Park Hotels & Resorts', 'Sonder', 'Vacasa', 'Four Seasons', 'Omni Hotels & Resorts', 'Loews Hotels', 'Aimbridge Hospitality', 'Highgate', 'Kimpton', 'Great Wolf Resorts', 'Viking', 'Lindblad Expeditions', 'Hertz', 'Avis Budget Group'] },
      { title: /\b(hotel (general )?manager|director of (revenue management|rooms|sales and marketing)|revenue manager.*hotel|resort manager|guest experience (manager|director)|destination marketing)\b/i },
    ],
    exclude: { company: /\b(casinos?|gaming|nurses?|nursing|staffing|healthcare|health)\b/i },
  },
  {
    slug: 'casino-gaming',
    name: 'Casino and gaming',
    label: 'casino and gaming',
    blurb: 'Casino operators, sportsbooks and gaming suppliers: operations, compliance, analytics and executive roles. Video game studios are not included.',
    query: 'casino gaming',
    rules: [
      { company: /\b(casinos?|gaming|sportsbook|wagering)\b/i },
      { employers: ['MGM Resorts', 'Caesars Entertainment', 'Wynn Resorts', 'Las Vegas Sands', 'Penn Entertainment', 'Boyd Gaming', 'DraftKings', 'FanDuel', 'Flutter Entertainment', 'Bally\'s', 'Light & Wonder', 'Scientific Games', 'IGT', 'International Game Technology', 'Aristocrat', 'Everi', 'Churchill Downs', 'Red Rock Resorts', 'Station Casinos', 'Golden Entertainment', 'Hard Rock', 'Seminole Hard Rock', 'Mohegan', 'Foxwoods', 'Rush Street Interactive', 'BetMGM', 'Fanatics Betting and Gaming', 'Genting', 'Resorts World', 'Sycuan', 'Pechanga', 'Wind Creek', 'Choctaw', 'Seneca Gaming', 'Mohegan Gaming & Entertainment', 'Full House Resorts', 'Monarch Casino', 'Century Casinos', 'Accel Entertainment', 'Sportradar', 'Genius Sports'] },
      { title: /\b(casino (manager|operations|host|marketing)|table games|slot operations|sportsbook|gaming (compliance|operations|manager|licensing)|surveillance (manager|director)|player development)\b/i },
    ],
    exclude: { company: /\b(video games?|game studio|games inc|esports)\b/i },
  },
  {
    slug: 'sports',
    name: 'Sports',
    label: 'sports',
    blurb: 'Leagues, teams, venues and sports media and betting: sponsorship, operations, analytics and front-office roles.',
    query: 'sports',
    rules: [
      { company: /\b(sports|football club|baseball club|hockey club|basketball|athletics department|arena|stadium)\b/i },
      { employers: ['NFL', 'NBA', 'MLB', 'Major League Baseball', 'NHL', 'MLS', 'Major League Soccer', 'WNBA', 'NCAA', 'UFC', 'TKO Group', 'WWE', 'NASCAR', 'PGA Tour', 'PGA of America', 'LPGA', 'USTA', 'FIFA', 'Fanatics', 'Formula 1', 'Madison Square Garden Sports', 'Madison Square Garden Entertainment', 'Endeavor', 'IMG', 'Learfield', 'Legends', 'Oak View Group', 'Topgolf', 'Topgolf Callaway Brands', 'Atlanta Braves', 'Dallas Cowboys', 'Los Angeles Lakers', 'US Olympic & Paralympic Committee', 'Team USA', 'Genius Sports', 'Sportradar', 'Hudl', 'Stats Perform', 'On Location'] },
      { title: /\b(sports (marketing|sponsorship|partnerships?|analytics|operations|performance|business)|director of (athletics|player (personnel|development))|scouting|team operations)\b/i },
    ],
    exclude: { company: /\b(medicine|physical therapy|orthop\w*|chiropractic|rehab\w*|school|academy|christian|preparatory|elementary)\b/i },
  },
  {
    slug: 'tv',
    name: 'TV and streaming',
    label: 'TV and streaming',
    blurb: 'Broadcasters, cable networks and streaming services: programming, advertising sales, production, technology and finance.',
    query: 'television',
    rules: [
      { company: /\b(television|broadcasting|broadcast)\b/i },
      { employers: ['NBCUniversal', 'CBS', 'Paramount', 'Paramount Global', 'Fox', 'Fox Corporation', 'Warner Bros. Discovery', 'Discovery', 'AMC Networks', 'Nexstar', 'Sinclair', 'Gray Media', 'Gray Television', 'TEGNA', 'E.W. Scripps', 'Hearst Television', 'Univision', 'TelevisaUnivision', 'Telemundo', 'HBO', 'Netflix', 'Hulu', 'Peacock', 'Roku', 'Fubo', 'Pluto TV', 'Tubi', 'ESPN', 'CNN', 'MSNBC', 'Starz', 'Lionsgate Starz', 'Sling TV', 'DirecTV', 'Disney Streaming', 'A+E Networks', 'Scripps Networks', 'Allen Media Group', 'Cox Media Group', 'Graham Media Group', 'Entravision'] },
      { title: /\b(broadcast (engineer|operations)|news (director|producer)|executive producer|programming (manager|director)|master control|television)\b/i },
    ],
    exclude: { company: /\b(tv ?(repair|mount)|network (solutions|security|engineering))\b/i },
  },
  {
    slug: 'movies',
    name: 'Movies and film',
    label: 'film and movie',
    blurb: 'Studios, producers, visual effects houses and theater chains: production, finance, distribution, marketing and technology.',
    query: 'film',
    rules: [
      { company: /\b(pictures|film|films|cinemas?|theatres?|theaters?|animation)\b/i },
      { employers: ['Walt Disney Studios', 'Warner Bros.', 'Universal Pictures', 'Paramount Pictures', 'Sony Pictures', 'Sony Pictures Entertainment', 'Lionsgate', 'A24', 'Legendary Entertainment', 'IMAX', 'AMC Theatres', 'Cinemark', 'Regal Cinemas', 'Pixar', 'DreamWorks Animation', 'Lucasfilm', 'Skydance', 'MGM Studios', 'Amazon MGM Studios', 'Fandango', 'Industrial Light & Magic', 'Weta FX', 'DNEG', 'Framestore', 'Technicolor', 'Illumination', 'Blumhouse', 'Marvel', 'Marvel Studios', 'Netflix Studios', 'Apple Studios', 'Atlas Entertainment', 'Village Roadshow', 'Fathom Entertainment', 'Alamo Drafthouse', 'Studio Movie Grill', 'Marcus Theatres', 'Harkins Theatres', 'Cineplex'] },
      { title: /\b(post[- ]production|visual effects|vfx|film (production|distribution|finance)|production accountant|line producer|studio (operations|finance))\b/i },
    ],
    exclude: { company: /\b(studio (apartments|lofts)|film (coating|packaging|extrusion))\b/i, title: /\bfilm(ed)? (coating|packaging)|plastic film\b/i },
  },
  {
    slug: 'music',
    name: 'Music',
    label: 'music',
    blurb: 'Labels, publishers, streaming, live music and instrument makers: licensing, A&R, marketing, royalties and technology.',
    query: 'music',
    rules: [
      { company: /\b(music|recordings|publishing group|concerts?)\b/i },
      { employers: ['Spotify', 'Universal Music Group', 'Sony Music', 'Sony Music Entertainment', 'Warner Music Group', 'Live Nation', 'Ticketmaster', 'iHeartMedia', 'SiriusXM', 'Sirius XM', 'Pandora', 'BMG', 'ASCAP', 'BMI', 'SESAC', 'SoundCloud', 'Fender', 'Gibson', 'Guitar Center', 'Sweetwater', 'Kobalt', 'Concord', 'Reservoir Media', 'Downtown Music', 'Create Music Group', 'TuneCore', 'DistroKid', 'Audible', 'Beatport', 'Splice', 'Bandcamp', 'Roland', 'Yamaha Music', 'AEG Presents', 'Audacy', 'Cumulus Media', 'Townsquare Media', 'Entercom', 'Napster', 'Tidal', 'Live Nation Entertainment', 'SoundExchange', 'The Orchard', 'Epidemic Sound', 'Believe'] },
      { title: /\b(music (licensing|supervisor|publishing|marketing|business|operations)|a&r|royalt(y|ies) (analyst|manager|accountant)|artist (relations|development))\b/i },
    ],
  },
]

export const segmentBySlug = (slug: string): SegmentDef | null => SEGMENTS.find((s) => s.slug === slug) ?? null

interface Compiled { def: SegmentDef; rules: (Rule & { employerSet?: Set<string> })[] }
const COMPILED: Compiled[] = SEGMENTS.map((def) => ({ def, rules: def.rules.map((r) => ({ ...r, employerSet: r.employers ? names(r.employers) : undefined })) }))

// A search firm's or staffing agency's posting is not the employer's own, so it is in no segment: the lists are of employers.
const FIRM = /\b(staffing|recruit(ing|ers?|ment)|executive search|search (firm|group|partners|associates)|talent (acquisition|partners|solutions)|management search)\b/i

/** The segments one posting belongs to (usually none, at most a few). */
export function segmentsOf(row: Pick<BoardRow, 'title' | 'company' | 'industry' | 'reqTags'> & { postingType?: string | null; sourceCategory?: string | null }): string[] {
  if (row.postingType === 'recruiter_search' || row.sourceCategory === 'search_firm' || FIRM.test(row.company)) return []
  const norm = normalizeOrgName(row.company)
  const out: string[] = []
  for (const { def, rules } of COMPILED) {
    if (def.exclude?.title?.test(row.title) || def.exclude?.company?.test(row.company)) continue
    const hit = rules.some((r) => {
      if (r.codes && !(row.industry && r.codes.includes(row.industry))) return false
      if (r.employerSet && !employerIn(r.employerSet, norm)) return false
      if (r.company && !r.company.test(row.company)) return false
      if (r.title && !r.title.test(row.title)) return false
      if (r.tags && !(row.reqTags && r.tags.test(row.reqTags))) return false
      return true
    })
    if (hit) out.push(def.slug)
  }
  return out
}
