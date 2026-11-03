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
  /** The crawler's sector read ('nonprofit', 'academia', 'government'). */
  sectors?: string[]
}

export type SegmentGroup = 'Built in America' | 'Technology and communications' | 'Energy and resources' | 'Transportation and travel' | 'Health and life sciences' | 'Finance and property' | 'Consumer' | 'Media and sports' | 'Education and nonprofit'

/** The order the groups appear in on the hub. */
export const SEGMENT_GROUPS: SegmentGroup[] = ['Built in America', 'Technology and communications', 'Energy and resources', 'Transportation and travel', 'Health and life sciences', 'Finance and property', 'Consumer', 'Media and sports', 'Education and nonprofit']

export interface SegmentDef {
  slug: string
  group: SegmentGroup
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

/** The key one employer is counted under: SEC-style names carry a state ending ("Rivian Automotive, Inc. / DE") that is not part of the name. */
export const companyKey = (name: string) => normalizeOrgName(name.replace(/\s*\/\s*[A-Za-z]{2,3}\s*$/, ''))

const names = (list: string[]) => new Set(list.map((n) => companyKey(n)))

// Employers post under longer forms of the same name ("Marriott International", "Hilton Worldwide"). These endings, and only
// these, are dropped before a name is compared; any other ending ("Targeted Genomics") is a different employer.
const SAFE_TAILS = ['international', 'worldwide', 'holdings', 'holding', 'global', 'usa', 'us', 'america', 'north america', 'americas', 'brands', 'entertainment', 'resorts', 'hotels', 'stores', 'companies', 'enterprises']

export function employerIn(set: Set<string>, normalized: string): boolean {
  if (set.has(normalized)) return true
  for (const t of SAFE_TAILS) if (normalized.endsWith(` ${t}`) && set.has(normalized.slice(0, -t.length - 1))) return true
  return false
}

export const MIN_SEGMENT_JOBS = 30

// Design and engineering consultancies post engineer roles in every industry they serve: they belong in construction, not in the
// manufacturing, power or mining lists their clients' work shows up in.
const ENGINEERING_FIRMS = /\b(sargent (&|and) lundy|black (&|and) veatch|burns (&|and) mcdonnell|dewberry|hdr|kimley-horn|stantec|wsp|arcadis|tetra tech|hntb|gannett fleming|langan|terracon|kleinfelder|mott macdonald|trinzic|michels|consultants?|engineers)\b/i

export const SEGMENTS: SegmentDef[] = [
  {
    slug: 'data-centers',
    group: 'Technology and communications',
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
    group: 'Built in America',
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
    group: 'Health and life sciences',
    name: 'Healthcare',
    label: 'healthcare',
    blurb: 'Hospital systems, health plans and the leadership, clinical and administrative professionals inside them.',
    query: 'healthcare',
    rules: [{ codes: ['healthcare'] }],
  },
  {
    slug: 'financial-services',
    group: 'Finance and property',
    name: 'Financial services',
    label: 'financial services',
    blurb: 'Banks, lenders, insurers, payments, wealth and asset managers.',
    query: 'financial services',
    rules: [{ codes: ['financial_services'] }],
  },
  {
    slug: 'real-estate',
    group: 'Finance and property',
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
    group: 'Built in America',
    name: 'Construction',
    label: 'construction',
    blurb: 'Contractors, homebuilders and the project, estimating and field leadership that deliver buildings and infrastructure.',
    query: 'construction',
    rules: [
      { codes: ['real_estate'], company: /\b(construct\w*|builders?|contracting|contractors?|homes|engineering and construction)\b/i },
      { employers: ['Turner Construction', 'Bechtel', 'Fluor', 'Kiewit', 'Skanska', 'Jacobs', 'AECOM', 'DPR Construction', 'Whiting-Turner', 'Clark Construction', 'Hensel Phelps', 'Sundt', 'McCarthy Building Companies', 'Mortenson', 'Webcor', 'Toll Brothers', 'Lennar', 'D.R. Horton', 'PulteGroup', 'NVR', 'KB Home', 'Meritage Homes', 'Granite Construction', 'Tutor Perini', 'Balfour Beatty', 'Gilbane', 'Holder Construction', 'Brasfield & Gorrie', 'Swinerton', 'JE Dunn', 'Sterling Infrastructure', 'Sargent & Lundy', 'Black & Veatch', 'Burns & McDonnell', 'Dewberry', 'HDR', 'Kimley-Horn', 'Stantec', 'WSP', 'Arcadis', 'Tetra Tech', 'HNTB', 'Gannett Fleming', 'Langan', 'Terracon', 'Kleinfelder', 'Quanta Services', 'MasTec', 'EMCOR', 'Comfort Systems USA', 'Dycom', 'Primoris'] },
      { title: /\b(construction (manager|project manager|superintendent|engineer|executive|director|estimator)|superintendent|estimator|preconstruction|general superintendent|site superintendent|project superintendent)\b/i },
    ],
    exclude: { title: /\b(software|sales|recruiter|accountant)\b/i },
  },
  {
    slug: 'retail',
    group: 'Consumer',
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
    group: 'Consumer',
    name: 'Consumer packaged goods',
    label: 'consumer packaged goods',
    blurb: 'Food, beverage, beauty and household brands: brand, supply chain, sales and finance careers.',
    query: 'consumer packaged goods',
    rules: [
      { codes: ['consumer'], company: /\b(foods?|brands?|beverages?|consumer products|cosmetics?|beauty|household|packaged|snacks?|brewing|distilling)\b/i },
      { employers: ['Procter & Gamble', 'Unilever', 'Colgate-Palmolive', 'Kimberly-Clark', 'General Mills', 'Kellanova', 'Kellogg', 'PepsiCo', 'Coca-Cola', 'Mondelez', 'Hershey', 'Mars', 'Campbell\'s', 'Conagra Brands', 'Kraft Heinz', 'Tyson Foods', 'Hormel Foods', 'Clorox', 'Church & Dwight', 'Estee Lauder', 'L\'Oreal', 'J.M. Smucker', 'Keurig Dr Pepper', 'Molson Coors', 'Constellation Brands', 'Anheuser-Busch', 'Newell Brands', 'Reckitt', 'Edgewell', 'Spectrum Brands', 'Post Holdings', 'Lamb Weston', 'McCormick', 'Hain Celestial', 'Monster Beverage', 'Kenvue', 'Haleon', 'Nestle', 'Danone', 'Henkel', 'Coty', 'Revlon', 'Energizer'] },
    ],
    exclude: { company: /\b(ulta|us foods|performance food|sysco)\b/i },
  },
  {
    slug: 'restaurants',
    group: 'Consumer',
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
    group: 'Transportation and travel',
    name: 'Tourism and hospitality',
    label: 'tourism and hospitality',
    blurb: 'Hotels, resorts, cruise lines, theme parks and travel companies: operations, revenue, sales and guest experience.',
    query: 'hospitality',
    rules: [
      { company: /\b(hotels?|resorts?|hospitality|inns?|lodging|cruises?|cruise line|vacations?|travel)\b/i },
      { employers: ['Marriott', 'Hilton', 'Hyatt', 'IHG Hotels & Resorts', 'Wyndham', 'Choice Hotels', 'Airbnb', 'Expedia', 'Booking Holdings', 'Tripadvisor', 'Carnival', 'Royal Caribbean', 'Norwegian Cruise Line', 'Vail Resorts', 'Six Flags', 'Cedar Fair', 'SeaWorld', 'Disney Parks', 'Universal Parks & Resorts', 'Host Hotels & Resorts', 'Park Hotels & Resorts', 'Sonder', 'Vacasa', 'Four Seasons', 'Omni Hotels & Resorts', 'Loews Hotels', 'Aimbridge Hospitality', 'Highgate', 'Kimpton', 'Great Wolf Resorts', 'Viking', 'Lindblad Expeditions'] },
      { title: /\b(hotel (general )?manager|director of (revenue management|rooms|sales and marketing)|revenue manager.*hotel|resort manager|guest experience (manager|director)|destination marketing)\b/i },
    ],
    exclude: { company: /\b(casinos?|gaming|nurses?|nursing|staffing|healthcare|health|travel stops?|hertz|avis)\b/i },
  },
  {
    slug: 'casino-gaming',
    group: 'Consumer',
    name: 'Casino and gaming',
    label: 'casino and gaming',
    blurb: 'Casino operators, sportsbooks and gaming suppliers: operations, compliance, analytics and executive roles. Video game studios are not included.',
    query: 'casino gaming',
    rules: [
      { company: /\b(casinos?|gaming|sportsbook|wagering)\b/i },
      { employers: ['MGM Resorts', 'Caesars Entertainment', 'Wynn Resorts', 'Las Vegas Sands', 'Penn Entertainment', 'Boyd Gaming', 'DraftKings', 'FanDuel', 'Flutter Entertainment', 'Bally\'s', 'Light & Wonder', 'Scientific Games', 'IGT', 'International Game Technology', 'Aristocrat', 'Everi', 'Churchill Downs', 'Red Rock Resorts', 'Station Casinos', 'Golden Entertainment', 'Hard Rock', 'Seminole Hard Rock', 'Mohegan', 'Foxwoods', 'Rush Street Interactive', 'BetMGM', 'Fanatics Betting and Gaming', 'Genting', 'Resorts World', 'Sycuan', 'Pechanga', 'Wind Creek', 'Choctaw', 'Seneca Gaming', 'Mohegan Gaming & Entertainment', 'Full House Resorts', 'Monarch Casino', 'Century Casinos', 'Accel Entertainment', 'Sportradar', 'Genius Sports'] },
      { title: /\b(casino (manager|operations|host|marketing)|table games|slot operations|sportsbook|gaming (compliance|operations|manager|licensing)|surveillance (manager|director)|player development)\b/i },
    ],
    exclude: { company: /\b(video games?|game studio|games inc|esports|corsair|razer|logitech|turtle beach|steelseries)\b/i },
  },
  {
    slug: 'sports',
    group: 'Media and sports',
    name: 'Sports',
    label: 'sports',
    blurb: 'Leagues, teams, venues and sports media and betting: sponsorship, operations, analytics and front-office roles.',
    query: 'sports',
    rules: [
      { company: /\b(sports|football club|baseball club|hockey club|basketball|athletics department)\b/i },
      { employers: ['NFL', 'NBA', 'MLB', 'Major League Baseball', 'NHL', 'MLS', 'Major League Soccer', 'WNBA', 'NCAA', 'UFC', 'TKO Group', 'WWE', 'NASCAR', 'PGA Tour', 'PGA of America', 'LPGA', 'USTA', 'FIFA', 'Fanatics', 'Formula 1', 'Madison Square Garden Sports', 'Madison Square Garden Entertainment', 'Endeavor', 'IMG', 'Learfield', 'Legends', 'Oak View Group', 'Topgolf', 'Topgolf Callaway Brands', 'Atlanta Braves', 'Dallas Cowboys', 'Los Angeles Lakers', 'US Olympic & Paralympic Committee', 'Team USA', 'Genius Sports', 'Sportradar', 'Hudl', 'Stats Perform', 'On Location'] },
      { title: /\b(sports (marketing|sponsorship|partnerships?|analytics|operations|performance|business)|director of (athletics|player (personnel|development))|scouting|team operations)\b/i },
    ],
    exclude: { company: /\b(medicine|physical therapy|orthop\w*|chiropractic|rehab\w*|school|academy|christian|preparatory|elementary)\b/i },
  },
  {
    slug: 'tv',
    group: 'Media and sports',
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
    group: 'Media and sports',
    name: 'Movies and film',
    label: 'film and movie',
    blurb: 'Studios, producers, visual effects houses and theater chains: production, finance, distribution, marketing and technology.',
    query: 'film',
    rules: [
      { company: /\b(pictures|film|films|cinemas?|theatres?|theaters?|animation)\b/i },
      { employers: ['Walt Disney Studios', 'Warner Bros.', 'Universal Pictures', 'Paramount Pictures', 'Sony Pictures', 'Sony Pictures Entertainment', 'Lionsgate', 'A24', 'Legendary Entertainment', 'IMAX', 'AMC Theatres', 'Cinemark', 'Regal Cinemas', 'Pixar', 'DreamWorks Animation', 'Lucasfilm', 'Skydance', 'MGM Studios', 'Amazon MGM Studios', 'Fandango', 'Industrial Light & Magic', 'Weta FX', 'DNEG', 'Framestore', 'Technicolor', 'Illumination', 'Blumhouse', 'Marvel', 'Marvel Studios', 'Netflix Studios', 'Apple Studios', 'Atlas Entertainment', 'Village Roadshow', 'Fathom Entertainment', 'Alamo Drafthouse', 'Studio Movie Grill', 'Marcus Theatres', 'Harkins Theatres', 'Cineplex'] },
      { title: /\b(post[- ]production|visual effects|vfx|film (production|distribution|finance)|production accountant|line producer)\b/i },
    ],
    exclude: { company: /\b(studio (apartments|lofts)|film (coating|packaging|extrusion)|carvana|children'?s theat\w*)\b/i, title: /\bfilm(ed)? (coating|packaging)|plastic film\b/i },
  },
  {
    slug: 'music',
    group: 'Media and sports',
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
  {
    slug: 'us-manufacturing',
    group: 'Built in America',
    name: 'US manufacturing',
    label: 'manufacturing',
    blurb: 'Plant, operations, engineering, quality and supply chain leadership at American manufacturers, from heavy industry to consumer goods.',
    query: 'manufacturing',
    rules: [
      { codes: ['industrial'] },
      { title: /\b(plant (manager|director|controller)|manufacturing (engineer|engineering|manager|director|supervisor|operations|leader)|production (manager|supervisor|planner)|industrial engineer|continuous improvement (manager|engineer)|lean (manufacturing|six sigma)|process engineer|quality (engineer|manager|assurance manager)|operations manager.*(plant|manufacturing))\b/i },
    ],
    exclude: { title: /\b(software|sales|recruiter|accountant)\b/i, company: new RegExp(`${/\b(construct\w*|contracting|contractors?|infrastructure|ies holdings|mastec|emcor|quanta|tutor perini|haskell|kiewit|bechtel|geo group|clean harbors|grainger|siteone)\b/.source}|${ENGINEERING_FIRMS.source}`, 'i') },
  },
  {
    slug: 'automotive-ev',
    group: 'Built in America',
    name: 'Automotive and EV',
    label: 'automotive and EV',
    blurb: 'Vehicle makers, suppliers, battery and charging companies, and the engineers and operators building the next generation of vehicles.',
    query: 'automotive',
    rules: [
      { employers: ['Ford Motor', 'General Motors', 'GM', 'Stellantis', 'Tesla', 'Rivian', 'Lucid Motors', 'Toyota Motor North America', 'Toyota', 'Honda', 'American Honda Motor', 'Nissan North America', 'Hyundai Motor America', 'Kia America', 'BMW', 'BMW Manufacturing', 'Mercedes-Benz', 'Volkswagen Group of America', 'Volvo Cars', 'Paccar', 'Cummins', 'Lear', 'Magna', 'BorgWarner', 'Aptiv', 'Dana', 'Visteon', 'Goodyear', 'Bridgestone Americas', 'Michelin', 'American Axle', 'Gentex', 'Adient', 'Autoliv', 'Continental Automotive', 'Bosch', 'Denso', 'ZF', 'Harley-Davidson', 'Polaris', 'Allison Transmission', 'Navistar', 'Daimler Truck North America', 'Oshkosh', 'ChargePoint', 'Blink Charging', 'EVgo', 'QuantumScape', 'Solid Power', 'Panasonic Energy', 'LG Energy Solution', 'SK On', 'Ultium Cells', 'Samsung SDI', 'Enovix', 'Nikola', 'Waymo', 'Aurora Innovation', 'Zoox', 'Mobileye', 'Luminar', 'Applied Intuition', 'Mazda', 'Subaru of America', 'Mitsubishi Motors', 'Borg Warner'] },
      { company: /\b(automotive|motors?|motor company|vehicles?|auto parts|battery|batteries|ev charging)\b/i },
      { title: /\b(automotive|powertrain|vehicle (engineer|integration|software|dynamics)|battery (engineer|cell|pack|systems|manufacturing)|ev (charging|infrastructure)|adas|autonomous vehicle)\b/i },
    ],
    exclude: { company: /\b(motor ?sports|autozone|insurance|o'?reilly|advance auto|carmax|carvana|pep boys|napa)\b/i },
  },
  {
    slug: 'ai',
    group: 'Technology and communications',
    name: 'AI',
    label: 'AI',
    blurb: 'Companies building AI and the machine learning, research, product and applied roles inside them.',
    query: 'machine learning',
    rules: [
      { employers: ['OpenAI', 'Anthropic', 'Scale AI', 'Databricks', 'Cohere', 'Hugging Face', 'Perplexity', 'xAI', 'Mistral AI', 'Character.AI', 'C3.ai', 'DataRobot', 'SambaNova', 'Cerebras', 'Groq', 'Glean', 'Harvey', 'Runway', 'Midjourney', 'Stability AI', 'Together AI', 'Anyscale', 'Weights & Biases', 'Pinecone', 'Writer', 'Anysphere', 'Cognition', 'Sierra', 'Decagon', 'Figure AI', 'Applied Intuition', 'Adept AI', 'Inflection AI', 'Replit', 'ElevenLabs', 'Snorkel AI', 'Hippocratic AI', 'Abridge', 'Tempus AI', 'Palantir'] },
      { title: /\b(machine learning|ml (engineer|scientist|researcher)|mlops|ai (engineer|researcher|scientist|product|solutions|safety|research|infrastructure)|applied (scientist|ai)|research scientist|data scientist|deep learning|computer vision|natural language|nlp|llm|generative ai|prompt engineer|ai\/ml)\b/i },
    ],
  },
  {
    slug: 'semiconductors',
    group: 'Built in America',
    name: 'Semiconductors',
    label: 'semiconductor',
    blurb: 'Chip makers, equipment suppliers and designers: the fab, process, design and supply chain roles behind American chip manufacturing.',
    query: 'semiconductor',
    rules: [
      { employers: ['Intel', 'Micron Technology', 'GlobalFoundries', 'TSMC Arizona', 'Texas Instruments', 'Analog Devices', 'Microchip Technology', 'onsemi', 'Wolfspeed', 'SkyWater Technology', 'Applied Materials', 'Lam Research', 'KLA', 'Amkor Technology', 'Qualcomm', 'Advanced Micro Devices', 'AMD', 'NVIDIA', 'Broadcom', 'Marvell Technology', 'Samsung Austin Semiconductor', 'Entegris', 'MKS Instruments', 'Coherent', 'ASML', 'Tokyo Electron', 'Teradyne', 'Cirrus Logic', 'Skyworks Solutions', 'Qorvo', 'Diodes', 'Vishay', 'Monolithic Power Systems', 'Lattice Semiconductor', 'Synopsys', 'Cadence Design Systems', 'Rambus', 'SiTime', 'Allegro MicroSystems', 'Navitas Semiconductor', 'Ampere Computing', 'Cerebras', 'Applied Materials', 'Axcelis', 'Onto Innovation', 'FormFactor', 'Photronics', 'Ultra Clean Holdings', 'Ichor'] },
      { company: /\b(semiconductors?|microelectronics|photonics|wafers?)\b/i },
      { title: /\b(semiconductor|wafer|fab (engineer|technician|manager|operations)|lithography|plasma etch|chip (design|manufacturing)|asic|vlsi|rtl design|physical design|process integration)\b/i },
    ],
  },
  {
    slug: 'shipbuilding',
    group: 'Built in America',
    name: 'Shipbuilding and maritime',
    label: 'shipbuilding and maritime',
    blurb: 'Shipyards, naval suppliers and maritime operators: naval architecture, marine engineering, program management and production leadership.',
    query: 'shipbuilding',
    rules: [
      { employers: ['Huntington Ingalls Industries', 'Newport News Shipbuilding', 'Ingalls Shipbuilding', 'General Dynamics Electric Boat', 'Electric Boat', 'Bath Iron Works', 'NASSCO', 'Austal USA', 'Fincantieri Marinette Marine', 'Philly Shipyard', 'Bollinger Shipyards', 'Eastern Shipbuilding Group', 'Vigor', 'Gulf Island Fabrication', 'BAE Systems Ship Repair', 'Conrad Industries', 'Edison Chouest Offshore', 'Crowley', 'Matson', 'Maersk Line Limited', 'Saronic', 'Seacor', 'Kirby Corporation', 'Foss Maritime', 'Great Lakes Dredge & Dock'] },
      { company: /\b(shipbuild\w*|shipyards?|maritime|naval)\b/i },
      { title: /\b(naval architect|marine engineer|shipfitter|shipyard|shipbuilding|marine surveyor|ship (design|repair)|submarine)\b/i },
    ],
    exclude: { company: /\b(naval air|academy|university|college)\b/i },
  },
  {
    slug: 'steel-aluminum',
    group: 'Built in America',
    name: 'Steel, aluminum and metals',
    label: 'steel, aluminum and metals',
    blurb: 'Steelmakers, aluminum producers and metals processors: plant, metallurgy, engineering, operations and commercial roles.',
    query: 'steel',
    rules: [
      { employers: ['Nucor', 'Cleveland-Cliffs', 'United States Steel', 'U.S. Steel', 'Steel Dynamics', 'Commercial Metals', 'Alcoa', 'Century Aluminum', 'Novelis', 'Arconic', 'Kaiser Aluminum', 'Constellium', 'ATI', 'Carpenter Technology', 'Reliance Steel & Aluminum', 'Reliance', 'Olympic Steel', 'Worthington Steel', 'Worthington Enterprises', 'Ryerson', 'Gerdau', 'Metallus', 'TimkenSteel', 'Haynes International', 'Materion', 'Mueller Industries', 'Insteel Industries', 'Zekelman Industries', 'Atkore', 'Allegheny Technologies', 'Howmet Aerospace', 'Hydro', 'Steel Technologies', 'Berlin Metals'] },
      { company: /\b(steel|aluminum|aluminium|alloys?|foundry|metals)\b/i },
      { title: /\b(metallurg\w*|foundry|rolling mill|smelter|steel ?(plant|mill|making)|aluminum (smelter|rolling))\b/i },
    ],
    exclude: { company: /\b(precious metals|metals trading|bullion)\b|^alloy$/i },
  },
  {
    slug: 'transportation-logistics',
    group: 'Transportation and travel',
    name: 'Transportation and logistics',
    label: 'transportation and logistics',
    blurb: 'Freight, parcel, rail, trucking, warehousing and supply chain companies: operations, planning, network and commercial leadership.',
    query: 'logistics',
    rules: [
      { codes: ['logistics'] },
      { employers: ['UPS', 'FedEx', 'XPO', 'J.B. Hunt', 'Knight-Swift', 'Schneider National', 'Old Dominion Freight Line', 'Union Pacific', 'CSX', 'Norfolk Southern', 'BNSF Railway', 'Amtrak', 'Ryder System', 'C.H. Robinson', 'Expeditors', 'GXO Logistics', 'Uber Freight', 'Flexport', 'Werner Enterprises', 'Landstar', 'Saia', 'ArcBest', 'Hub Group', 'Forward Air', 'RXO', 'DHL Supply Chain', 'DHL', 'Penske Logistics', 'Estes Express', 'TFI International', 'Matson', 'Kirby Corporation', 'Port of Los Angeles', 'Amazon Logistics'] },
    ],
  },
  {
    slug: 'airlines-aviation',
    group: 'Transportation and travel',
    name: 'Airlines and aviation',
    label: 'airline and aviation',
    blurb: 'Airlines, airports, business aviation and the engineering, maintenance, operations and revenue teams that keep aircraft flying.',
    query: 'aviation',
    rules: [
      { employers: ['Delta Air Lines', 'United Airlines', 'American Airlines', 'Southwest Airlines', 'JetBlue', 'Alaska Air Group', 'Alaska Airlines', 'Spirit Airlines', 'Frontier Airlines', 'Hawaiian Airlines', 'SkyWest', 'Allegiant', 'Atlas Air', 'Joby Aviation', 'Archer Aviation', 'Wheels Up', 'NetJets', 'FlightSafety International', 'Textron Aviation', 'Gulfstream Aerospace', 'Cirrus Aircraft', 'Embraer', 'Honda Aircraft', 'Signature Aviation', 'Republic Airways', 'Mesa Air Group', 'Endeavor Air', 'PSA Airlines', 'Piedmont Airlines', 'Air Wisconsin'] },
      { company: /\b(airlines?|airways|aviation|airports?)\b/i },
      { title: /\b(pilot|flight (operations|dispatch|attendant)|aircraft (maintenance|mechanic)|airport (operations|manager|director)|air traffic|aviation (safety|manager))\b/i },
    ],
    exclude: { company: /\b(insurance|staffing)\b/i },
  },
  {
    slug: 'oil-and-gas',
    group: 'Energy and resources',
    name: 'Oil and gas',
    label: 'oil and gas',
    blurb: 'Producers, refiners, midstream operators and oilfield services: engineering, geoscience, operations, trading and commercial roles.',
    query: 'oil and gas',
    rules: [
      { employers: ['ExxonMobil', 'Exxon Mobil', 'Chevron', 'ConocoPhillips', 'Occidental Petroleum', 'Occidental', 'EOG Resources', 'Pioneer Natural Resources', 'Devon Energy', 'Marathon Petroleum', 'Valero Energy', 'Phillips 66', 'Halliburton', 'SLB', 'Schlumberger', 'Baker Hughes', 'Hess', 'Diamondback Energy', 'Coterra Energy', 'Kinder Morgan', 'Williams Companies', 'Enterprise Products Partners', 'Energy Transfer', 'Cheniere Energy', 'Targa Resources', 'ONEOK', 'NOV', 'Weatherford International', 'Expand Energy', 'Chesapeake Energy', 'APA Corporation', 'Murphy Oil', 'Ovintiv', 'Continental Resources', 'Antero Resources', 'EQT', 'Range Resources', 'Patterson-UTI', 'Helmerich & Payne', 'Transocean', 'Cactus', 'HF Sinclair', 'PBF Energy', 'Delek US', 'Plains All American', 'Western Midstream', 'DCP Midstream', 'Venture Global', 'NextDecade', 'Liberty Energy', 'ChampionX', 'TechnipFMC', 'Noble Corporation', 'Nabors Industries'] },
      { codes: ['energy'], company: /\b(oil|gas|petroleum|midstream|pipeline|drilling|lng|refining)\b/i },
      { title: /\b(petroleum|reservoir|drilling|wellsite|geoscientist|refinery|pipeline (engineer|integrity)|upstream|midstream|oil and gas)\b/i },
    ],
    exclude: { company: /\b(gas (and|&) electric|electric)\b/i },
  },
  {
    slug: 'utilities',
    group: 'Energy and resources',
    name: 'Utilities and power',
    label: 'utility and power',
    blurb: 'Electric, gas and water utilities and power producers: grid, generation, engineering, regulatory and customer operations.',
    query: 'utility',
    rules: [
      { employers: ['NextEra Energy', 'Florida Power & Light', 'Duke Energy', 'Southern Company', 'Georgia Power', 'Dominion Energy', 'American Electric Power', 'Exelon', 'Xcel Energy', 'Sempra', 'San Diego Gas & Electric', 'Edison International', 'Southern California Edison', 'PG&E', 'Pacific Gas and Electric', 'Entergy', 'FirstEnergy', 'PSEG', 'Public Service Enterprise Group', 'WEC Energy Group', 'Consolidated Edison', 'Con Edison', 'DTE Energy', 'Eversource', 'Ameren', 'CMS Energy', 'PPL', 'CenterPoint Energy', 'Evergy', 'AES', 'Avangrid', 'National Grid', 'Pinnacle West', 'Arizona Public Service', 'Portland General Electric', 'Puget Sound Energy', 'NRG Energy', 'Vistra', 'Constellation Energy', 'Tennessee Valley Authority', 'Oncor', 'ERCOT', 'PJM Interconnection', 'MISO', 'American Water', 'Essential Utilities', 'Atmos Energy', 'NiSource', 'Alliant Energy', 'OGE Energy', 'IDACORP', 'Black Hills', 'NorthWestern Energy', 'Avista', 'Southwest Gas', 'Spire', 'ONE Gas'] },
      { codes: ['energy'], company: /\b(electric|power (company|co|authority|cooperative)|utilit(y|ies)|water (company|works|authority)|gas (company|utility)|energy cooperative)\b/i },
      { title: /\b(substation|transmission (planner|engineer)|distribution (engineer|operations)|lineworker|power systems?|protection engineer|power grid|grid (operations|modernization|planning))\b/i },
    ],
    exclude: { company: new RegExp(`westinghouse|${ENGINEERING_FIRMS.source}`, 'i') },
  },
  {
    slug: 'clean-energy',
    group: 'Energy and resources',
    name: 'Clean energy and nuclear',
    label: 'clean energy and nuclear',
    blurb: 'Solar, wind, storage, hydrogen, geothermal, nuclear and fusion: the fastest-growing parts of the energy economy.',
    query: 'clean energy',
    rules: [
      { employers: ['NextEra Energy Resources', 'First Solar', 'Enphase Energy', 'SolarEdge', 'Sunrun', 'Sunnova', 'Fluence Energy', 'Stem', 'Plug Power', 'Bloom Energy', 'GE Vernova', 'Vestas', 'Orsted', 'Invenergy', 'Brookfield Renewable', 'Oklo', 'NuScale Power', 'TerraPower', 'X-energy', 'Centrus Energy', 'BWX Technologies', 'Westinghouse Electric', 'Holtec International', 'Kairos Power', 'Commonwealth Fusion Systems', 'TAE Technologies', 'Helion', 'Form Energy', 'ESS Tech', 'Ormat Technologies', 'Array Technologies', 'Nextracker', 'Shoals Technologies', 'Canadian Solar', 'Lightsource bp', 'Pattern Energy', 'Ørsted', 'Recurrent Energy', 'Tesla Energy', 'Redwood Materials', 'Fervo Energy', 'Sila', 'Group14'] },
      { company: /\b(solar|wind|renewables?|nuclear|geothermal|hydrogen|fusion|energy storage|clean energy)\b/i },
      { title: /\b(solar|wind turbine|nuclear|reactor|geothermal|hydrogen|battery storage|energy storage|renewable)\b/i },
    ],
    exclude: { company: ENGINEERING_FIRMS },
  },
  {
    slug: 'telecom',
    group: 'Technology and communications',
    name: 'Telecom',
    label: 'telecom',
    blurb: 'Wireless, broadband, cable, satellite and tower companies: network, engineering, product, operations and enterprise sales roles.',
    query: 'telecom',
    rules: [
      { codes: ['telecom'] },
      { employers: ['AT&T', 'Verizon', 'T-Mobile', 'Comcast', 'Charter Communications', 'Spectrum', 'Lumen Technologies', 'Frontier Communications', 'Cox Communications', 'Altice USA', 'Dish Network', 'EchoStar', 'Crown Castle', 'American Tower', 'SBA Communications', 'Ciena', 'Nokia', 'Ericsson', 'Viasat', 'Iridium', 'Globalstar', 'Zayo', 'Windstream', 'Consolidated Communications', 'Telephone and Data Systems', 'US Cellular', 'Cable One', 'Optimum', 'Starlink', 'AST SpaceMobile', 'Lumen'] },
      { title: /\b(telecommunications?|wireless (network|carrier)|5g (network|core|ran))\b/i },
    ],
  },
  {
    slug: 'natural-resources',
    group: 'Energy and resources',
    name: 'Mining and natural resources',
    label: 'mining and natural resources',
    blurb: 'Mining, minerals, timber and agriculture: geology, engineering, operations, environmental and commercial roles in the industries that supply American industry.',
    query: 'mining',
    rules: [
      { employers: ['Freeport-McMoRan', 'Newmont', 'Southern Copper', 'Peabody Energy', 'Arch Resources', 'CONSOL Energy', 'Core Natural Resources', 'Alliance Resource Partners', 'Albemarle', 'Arcadium Lithium', 'MP Materials', 'Lithium Americas', 'Piedmont Lithium', 'Compass Minerals', 'Mosaic', 'Nutrien', 'CF Industries', 'Weyerhaeuser', 'Rayonier', 'PotlatchDeltic', 'Hecla Mining', 'Coeur Mining', 'Royal Gold', 'Martin Marietta', 'Vulcan Materials', 'United States Lime & Minerals', 'Intrepid Potash', 'Energy Fuels', 'Ur-Energy', 'Uranium Energy', 'Cargill', 'Archer Daniels Midland', 'Bunge', 'Corteva', 'Deere'] },
      { company: /\b(mining|minerals?|lithium|copper|coal|timber|forestry|uranium|aggregates|potash)\b/i },
      { title: /\b(mining|mine (manager|engineer|planner|superintendent)|geologist|geotechnical|metallurgist|mineral|forestry|hydrologist)\b/i },
    ],
    exclude: { company: ENGINEERING_FIRMS },
  },
  {
    slug: 'nonprofits',
    group: 'Education and nonprofit',
    name: 'Nonprofits',
    label: 'nonprofit',
    blurb: 'Charities, foundations, associations and mission-driven organizations: fundraising, programs, operations, finance and leadership roles.',
    query: 'nonprofit',
    rules: [{ codes: ['nonprofit'] }, { sectors: ['nonprofit'] }],
    exclude: { company: /\b(construct\w*|contracting|contractors?|infrastructure)\b/i },
  },
  {
    slug: 'education',
    group: 'Education and nonprofit',
    name: 'Education',
    label: 'education',
    blurb: 'Universities, colleges, school systems and education companies: faculty-adjacent, administration, advancement, technology and operations roles.',
    query: 'education',
    rules: [{ codes: ['education'] }, { sectors: ['academia'] }],
    exclude: { company: /\b(construct\w*|contracting|contractors?|infrastructure)\b/i },
  },
  {
    slug: 'space',
    group: 'Built in America',
    name: 'Space',
    label: 'space',
    blurb: 'Launch, satellite and space systems companies: propulsion, avionics, mission operations, manufacturing and program roles.',
    query: 'space',
    rules: [
      { employers: ['SpaceX', 'Blue Origin', 'Rocket Lab', 'Relativity Space', 'Firefly Aerospace', 'Sierra Space', 'Axiom Space', 'Intuitive Machines', 'Planet Labs', 'Maxar Technologies', 'BlackSky', 'Spire Global', 'Virgin Galactic', 'United Launch Alliance', 'Redwire', 'Voyager Technologies', 'Impulse Space', 'Stoke Space', 'Varda Space Industries', 'Vast', 'True Anomaly', 'Astranis', 'Capella Space', 'Terran Orbital', 'York Space Systems', 'Ursa Major', 'Muon Space', 'Skybox', 'Astrobotic', 'NASA'] },
      { company: /\b(space|orbital|satellites?)\b/i },
      { title: /\b(spacecraft|satellite|launch vehicle|orbital|propulsion engineer|space systems|gnc engineer|mission operations)\b/i },
    ],
    exclude: { company: /\b(workspace|self storage|space planning|parking)\b/i },
  },
  {
    slug: 'robotics-automation',
    group: 'Technology and communications',
    name: 'Robotics and automation',
    label: 'robotics and automation',
    blurb: 'Robot makers, warehouse automation and industrial controls: mechatronics, controls, software, field and operations roles.',
    query: 'robotics',
    rules: [
      { employers: ['Boston Dynamics', 'Figure AI', 'Agility Robotics', 'Apptronik', 'Symbotic', 'Locus Robotics', 'Berkshire Grey', 'FANUC America', 'ABB Robotics', 'KUKA', 'Rockwell Automation', 'Teradyne Robotics', 'iRobot', 'Intuitive Surgical', 'Path Robotics', 'Machina Labs', 'Formic', 'Dexterity', 'Covariant', 'Amazon Robotics', 'Nuro', 'Skydio', 'AutoStore', 'Zebra Technologies', 'Fetch Robotics', 'Vecna Robotics', 'Ready Robotics', 'Seegrid', 'Mujin', 'Plus One Robotics', 'RightHand Robotics', 'Carbon Robotics'] },
      { company: /\b(robotics?|robots?|mechatronics)\b/i },
      { title: /\b(robotics?|robot|mechatronics|automation engineer|controls engineer|plc programmer)\b/i },
    ],
  },
  {
    slug: 'biotech-pharma',
    group: 'Health and life sciences',
    name: 'Biotech and pharma',
    label: 'biotech and pharma',
    blurb: 'Drug makers, biotechs and life sciences companies: research, clinical, manufacturing, quality, regulatory and commercial roles.',
    query: 'biotech',
    rules: [
      { codes: ['life_sciences'] },
      { title: /\b(biomanufacturing|gmp|pharmaceutical (manufacturing|operations)|bioprocess|cell therapy|clinical (operations|development))\b/i },
    ],
  },
]

export const segmentBySlug = (slug: string): SegmentDef | null => SEGMENTS.find((s) => s.slug === slug) ?? null

interface Compiled { def: SegmentDef; rules: (Rule & { employerSet?: Set<string> })[] }
const COMPILED: Compiled[] = SEGMENTS.map((def) => ({ def, rules: def.rules.map((r) => ({ ...r, employerSet: r.employers ? names(r.employers) : undefined })) }))

// A search firm's or staffing agency's posting is not the employer's own, so it is in no segment: the lists are of employers.
const FIRM = /\b(staffing|recruit(ing|ers?|ment)|executive search|search (firm|group|partners|associates)|talent (acquisition|partners|solutions)|management search)\b|gecko hospitality|source one hospitality|food management search|jrg partners|park avenue group|^confidential$/i

/** The segments one posting belongs to (usually none, at most a few). */
export function segmentsOf(row: Pick<BoardRow, 'title' | 'company' | 'industry' | 'reqTags'> & { postingType?: string | null; sourceCategory?: string | null; sector?: string | null }): string[] {
  if (row.postingType === 'recruiter_search' || row.sourceCategory === 'search_firm' || FIRM.test(row.company)) return []
  const norm = companyKey(row.company)
  const out: string[] = []
  for (const { def, rules } of COMPILED) {
    if (def.exclude?.title?.test(row.title) || def.exclude?.company?.test(row.company)) continue
    const hit = rules.some((r) => {
      if (r.codes && !(row.industry && r.codes.includes(row.industry))) return false
      if (r.sectors && !(row.sector && r.sectors.includes(row.sector))) return false
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

/** The industry bucket a layoff notice carries (src/lib/seo/topics.ts) to the segments where people from that industry can look next. */
export const SEGMENTS_BY_BUCKET: Record<string, string[]> = {
  'Healthcare & Hospital Systems': ['healthcare'],
  'Financial Services & Banking': ['financial-services'],
  'Insurance': ['financial-services'],
  'Pharmaceuticals & Biotech': ['biotech-pharma'],
  'Medical Devices': ['biotech-pharma'],
  'Retail & E-commerce': ['retail'],
  'Consumer Packaged Goods': ['consumer-packaged-goods'],
  'Hospitality, Travel & Food Service': ['tourism-hospitality', 'restaurants', 'casino-gaming'],
  'Manufacturing & Industrial': ['us-manufacturing', 'steel-aluminum', 'robotics-automation'],
  'Automotive & Mobility': ['automotive-ev'],
  'Aerospace & Defense': ['defense', 'space', 'airlines-aviation'],
  'Energy & Utilities': ['oil-and-gas', 'utilities', 'clean-energy'],
  'Construction & Real Estate': ['construction', 'real-estate'],
  'Transportation & Logistics': ['transportation-logistics', 'airlines-aviation'],
  'Media & Entertainment': ['tv', 'movies', 'music', 'sports'],
  'Telecommunications': ['telecom'],
  'Technology & Software': ['ai', 'data-centers', 'semiconductors', 'robotics-automation'],
  'Education & EdTech': ['education'],
  'Non-profit & Social Impact': ['nonprofits'],
  'Agriculture & Food Production': ['natural-resources'],
}
