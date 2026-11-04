import type { Handles } from '@/lib/social/tags'

/**
 * Accounts that layoff posts may tag, checked 2026-11-04. Every X handle was looked up through X's API and its listed website or
 * name matches the organization; every Bluesky handle is the organization's own domain with a verified check (or its own site links it).
 * A state is left out when no account was confirmed, so its posts tag nobody; never add a handle from memory.
 *
 * Not yet covered (no confirmed handle): TX, NY, PA, IL, WA, MA, AZ, CO, MD, MN, DE, AL, NV, NH, MS, MT, NE, ND, OR, UT, WY, HI, KS, KY, AR, DC.
 * PA, DE and NY are left out on purpose: their site-linked X accounts are the Governor's, the state's general account and a
 * Spanish-language account, not the labor department.
 */

/** The state labor or workforce agency that runs unemployment and rapid response. Keyed `agency:<state>`. */
export const STATE_AGENCIES: Record<string, Handles> = {
  AK: { name: 'Alaska Department of Labor and Workforce Development', x: 'AlaskaLabor' },
  CA: { name: 'California Employment Development Department', x: 'CA_EDD' },
  CT: { name: 'Connecticut Department of Labor', x: 'CTDOL' },
  FL: { name: 'CareerSource Florida', x: 'CareerSourceFL' },
  GA: { name: 'Georgia Department of Labor', x: 'GeorgiaDOL' },
  IA: { name: 'Iowa Workforce Development', x: 'iowaworkforce' },
  ID: { name: 'Idaho Department of Labor', x: 'IdahoLabor' },
  IN: { name: 'Indiana Department of Workforce Development', x: 'WorkforceIND' },
  LA: { name: 'Louisiana Workforce Commission', x: 'LouisianaWorks' },
  ME: { name: 'Maine Department of Labor', x: 'maine_labor' },
  MI: { name: 'Michigan Department of Labor and Economic Opportunity', x: 'MichiganLEO' },
  MO: { name: 'Missouri Department of Labor and Industrial Relations', x: 'MOLabor' },
  NC: { name: 'North Carolina Department of Commerce', x: 'NCCommerce' },
  NJ: { name: 'New Jersey Department of Labor and Workforce Development', x: 'NJLaborDept' },
  NM: { name: 'New Mexico Department of Workforce Solutions', x: 'NMDWS' },
  OH: { name: 'Ohio Department of Job and Family Services', x: 'OhioJFS' },
  OK: { name: 'Oklahoma Employment Security Commission', x: 'OESCnews' },
  RI: { name: 'Rhode Island Department of Labor and Training', x: 'RI_DLT' },
  SC: { name: 'South Carolina Department of Employment and Workforce', x: 'SCDEWinfo' },
  SD: { name: 'South Dakota Department of Labor and Regulation', x: 'SouthDakotaDLR' },
  TN: { name: 'Tennessee Department of Labor and Workforce Development', x: 'Jobs4_TN' },
  VA: { name: 'Virginia Employment Commission', x: 'vaemploy' },
  VT: { name: 'Vermont Department of Labor', x: 'VTLabor' },
  WI: { name: 'Wisconsin Department of Workforce Development', x: 'WIWorkforce' },
  WV: { name: 'WorkForce West Virginia', x: 'workforcewv' },
}

/** News outlets, keyed `outlet:<site>`. Credited on layoffs a story reported, never on a state filing. */
export const OUTLETS: Record<string, Handles> = {
  'apnews.com': { name: 'The Associated Press', bluesky: 'apnews.com' },
  'reuters.com': { name: 'Reuters', bluesky: 'reuters.com' },
  'bloomberg.com': { name: 'Bloomberg', bluesky: 'bloomberg.com', x: 'business' },
  'axios.com': { name: 'Axios', bluesky: 'axios.com', x: 'axios' },
  'cnbc.com': { name: 'CNBC', bluesky: 'cnbc.com', x: 'CNBC' },
  'wsj.com': { name: 'The Wall Street Journal', bluesky: 'wsj.com', x: 'WSJ' },
  'washingtonpost.com': { name: 'The Washington Post', bluesky: 'washingtonpost.com', x: 'washingtonpost' },
  'nytimes.com': { name: 'The New York Times', bluesky: 'nytimes.com', x: 'nytimes' },
  'fortune.com': { name: 'Fortune', bluesky: 'fortune.com', x: 'FortuneMagazine' },
  'businessinsider.com': { name: 'Business Insider', bluesky: 'businessinsider.com', x: 'BusinessInsider' },
  'forbes.com': { name: 'Forbes', bluesky: 'forbes.com', x: 'Forbes' },
  'cnn.com': { name: 'CNN', bluesky: 'cnn.com', x: 'CNN' },
  'npr.org': { name: 'NPR', bluesky: 'npr.org', x: 'NPR' },
  'usatoday.com': { name: 'USA Today', x: 'USATODAY' },
  'nbcnews.com': { name: 'NBC News', x: 'NBCNews' },
  'cbsnews.com': { name: 'CBS News', x: 'CBSNews' },
  'techcrunch.com': { name: 'TechCrunch', x: 'TechCrunch' },
}

/** Both registries as registry entries, so one lookup (tagsFor) serves every kind of tag. */
export function layoffHandleRegistry(): Record<string, Handles> {
  const out: Record<string, Handles> = {}
  for (const [state, h] of Object.entries(STATE_AGENCIES)) out[`agency:${state}`] = h
  for (const [site, h] of Object.entries(OUTLETS)) out[`outlet:${site}`] = h
  return out
}
