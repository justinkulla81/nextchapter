// The industries a member can filter the board by, in the order of the public industry hub (src/lib/segments/defs.ts SEGMENTS).
// Kept apart from defs.ts, which holds every employer list and rule, so the filter's dropdown and the proxy stay small.
// src/test/industry-filter.test.ts keeps this list equal to defs.ts.

export interface IndustryOption { slug: string; name: string; group: string }

export const INDUSTRY_OPTIONS: readonly IndustryOption[] = [
  { slug: 'data-centers', name: 'Data centers', group: 'Technology and communications' },
  { slug: 'defense', name: 'Defense and aerospace', group: 'Built in America' },
  { slug: 'healthcare', name: 'Healthcare', group: 'Health and life sciences' },
  { slug: 'financial-services', name: 'Financial services', group: 'Finance and property' },
  { slug: 'real-estate', name: 'Real estate', group: 'Finance and property' },
  { slug: 'construction', name: 'Construction', group: 'Built in America' },
  { slug: 'retail', name: 'Retail', group: 'Consumer' },
  { slug: 'consumer-packaged-goods', name: 'Consumer packaged goods', group: 'Consumer' },
  { slug: 'restaurants', name: 'Restaurants', group: 'Consumer' },
  { slug: 'tourism-hospitality', name: 'Tourism and hospitality', group: 'Transportation and travel' },
  { slug: 'casino-gaming', name: 'Casino and gaming', group: 'Consumer' },
  { slug: 'sports', name: 'Sports', group: 'Media and sports' },
  { slug: 'tv', name: 'TV and streaming', group: 'Media and sports' },
  { slug: 'movies', name: 'Movies and film', group: 'Media and sports' },
  { slug: 'music', name: 'Music', group: 'Media and sports' },
  { slug: 'us-manufacturing', name: 'US manufacturing', group: 'Built in America' },
  { slug: 'automotive-ev', name: 'Automotive and EV', group: 'Built in America' },
  { slug: 'ai', name: 'AI', group: 'Technology and communications' },
  { slug: 'semiconductors', name: 'Semiconductors', group: 'Built in America' },
  { slug: 'shipbuilding', name: 'Shipbuilding and maritime', group: 'Built in America' },
  { slug: 'steel-aluminum', name: 'Steel, aluminum and metals', group: 'Built in America' },
  { slug: 'transportation-logistics', name: 'Transportation and logistics', group: 'Transportation and travel' },
  { slug: 'airlines-aviation', name: 'Airlines and aviation', group: 'Transportation and travel' },
  { slug: 'oil-and-gas', name: 'Oil and gas', group: 'Energy and resources' },
  { slug: 'utilities', name: 'Utilities and power', group: 'Energy and resources' },
  { slug: 'clean-energy', name: 'Clean energy and nuclear', group: 'Energy and resources' },
  { slug: 'telecom', name: 'Telecom', group: 'Technology and communications' },
  { slug: 'natural-resources', name: 'Mining and natural resources', group: 'Energy and resources' },
  { slug: 'nonprofits', name: 'Non-profits', group: 'Education and nonprofit' },
  { slug: 'foundation', name: 'Foundation', group: 'Education and nonprofit' },
  { slug: 'museum', name: 'Museum', group: 'Education and nonprofit' },
  { slug: 'education', name: 'Education', group: 'Education and nonprofit' },
  { slug: 'space', name: 'Space', group: 'Built in America' },
  { slug: 'robotics-automation', name: 'Robotics and automation', group: 'Technology and communications' },
  { slug: 'biotech-pharma', name: 'Biotech and pharma', group: 'Health and life sciences' },
]

export const INDUSTRY_GROUP_ORDER: readonly string[] = ['Built in America', 'Technology and communications', 'Energy and resources', 'Transportation and travel', 'Health and life sciences', 'Finance and property', 'Consumer', 'Media and sports', 'Education and nonprofit']

export const INDUSTRY_SLUGS: ReadonlySet<string> = new Set(INDUSTRY_OPTIONS.map((o) => o.slug))
