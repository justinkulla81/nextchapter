// Decisions a person made about duplicate names, shared by the organization cleanup
// (scripts/crm/consolidate-duplicate-orgs.ts) and the company-directory cleanup
// (scripts/companies/consolidate-duplicate-companies.ts) so the two never disagree.
import { readFileSync } from 'node:fs'
import { classifyGroup, looseKey, nameParts, type GroupDecision } from './org-duplicates'

let dictionary: Set<string> | null = null
/** Common English words (the system word list), to tell "Murphy USA" / "Team USA" from "Sanofi US". */
function isCommonWord(w: string): boolean {
  if (!dictionary) {
    try { dictionary = new Set(readFileSync('/usr/share/dict/words', 'utf8').split('\n').map((x) => x.toLowerCase())) } catch { dictionary = new Set() }
  }
  return dictionary.has(w.toLowerCase())
}

/**
 * Groups a person looked at and decided are different companies, keyed by looseKey.
 * Kept in code so re-running never merges them.
 */
export const NOT_DUPLICATES = new Set<string>([])

/** A group containing any of these names is left alone, with the reason shown in review.json. */
export const HOLD: Record<string, string> = {
  'SAP.iO': 'Confirmed by Justin: SAP.iO and SAP are different companies.',
  'The Help Company': 'Different companies: Help USA vs The Help Company.',
  'Deluxe (media services)': 'Deluxe Corp (checks, payments) and Deluxe Media are different companies.',
  'People Inc. (Dotdash Meredith)': 'People Inc., "People" and People.Co look like three different companies.',
  'Self.': 'SELF the loan fund vs a company called Self.',
  'Care USA': 'CARE USA is a member of CARE International; one record or two?',
  'Valley Health System (New Jersey)': 'There are Valley Health Systems in NJ, VA and NV.',
  'Dart': 'Dart vs DART (Dallas Area Rapid Transit).',
  'Everest Group (Everest Re)': 'Everest Group (consulting) and Everest Re (insurance) are different.',
  'EMPLOYERS (Employers Holdings)': '"Employers" is too generic to merge on a name.',
  'The Goddard School of Manhattan (Murray Hill), NY': 'Separate franchise locations.',
  'Trinity Academy': 'Generic school name; the Raleigh one may be a different school.',
  'ONE (Open Network Exchange)': '"One" is too generic to merge on a name.',
  'AGS': '"AGS" is too generic to merge on a name.',
  'Binance US': 'Binance.US is a separate legal entity from Binance.',
  'Smith Inc.': 'Smith Inc. and Smith.ai are different companies.',
  'You.com': 'You.com and "Y.o.u." may be different.',
  'Visit Us': 'Visit Us and Visit.org may be different.',
  'GovernmentJobs.com': 'Government Jobs / GovernmentJobs.com / US Government Jobs: which is which?',
  'Nextpower': 'Nextracker renamed itself Nextpower? Confirm it is one company.',
  'Polaris (formerly Polaris Project)': 'Polaris Project (anti-trafficking nonprofit) and Polaris Inc. (vehicles) are different.',
}
export const SPACING = 'Differ only by where the spaces are, and the name is generic enough that they could be two companies.'
for (const n of [
  'Alls Well', 'North Central University', 'Visit Site »', 'Trellis Group', 'Blue Bird, Inc.', 'Health Care Services', 'Braintrust',
  'Office of General Counsel', 'Office of Inspector General', 'Office of State Public Defender', 'Freshpaint', 'TerraFirma', 'Hightouch',
  'Human Capital', 'DataOne', 'Félix',
]) HOLD[n] = SPACING
/** Names left out of their group's merge (the rest still merge). */
export const EXCLUDE = new Set<string>([])
/** Groups merged even though the rules would hold them, by one member's name. */
export const FORCE_MERGE = new Set([
  // Same company with a note, abbreviation or alias in brackets (approved by Justin: "do all").
  'RTX (Raytheon)', 'UKG (Ultimate Kronos Group)', 'VTS (View The Space)', 'Precision Recruiting Solutions Group® (PRSG®)',
  'Nortek Data Center Cooling (Nortek Data Center Cooling)', 'ARQ ( Prev DolarApp )', 'LVT (LiveView Technologies)', 'Omnicom Group (incl. Interpublic)',
  'Attune (YC X25)', 'Software Guidance & Assistance, Inc. (SGA, Inc.)', 'Gauss Management Research & Engineering (GMRE Inc.)',
  'Technology Credit Union (Tech CU)', 'AXIS (AXIS Capital)', 'Mathnasium (ID: 5600601)', 'CenterWell Senior Primary Care (By Humana)',
  'Trata (YC W25)', 'Accede Solutions Inc (accedesolution.com)', 'Ford Audio-Video (Ford AV)', 'Kiewit Corporation (Peter Kiewit Sons\')',
  'Gray Architects and Engineers, LLC ("Gray AES")', 'Lightsprint (YC P26)', 'Tria Federal (Tria)', 'FalconSmartIT',
  'GetWyz Mortgage, LLC (NMLS# 2672632)', 'Everything BUT the House (Ebth)', 'CVP (Customer Value Partners)', 'DMI (Digital Management, LLC)',
  'April (Getapril.com)', 'BeautyHealth (Hydrafacial)', 'A Boutique Hedge Fund (confidential)', 'Facility Solutions Group ("FSG")',
  'Department of the Air Force (Agency Wide)', 'Apex Group Ltd (UK Branch)', 'DB Insurance Co., LTD. (U.s. Branch)',
  'Kyocera International, Inc. (North America)', 'General Dynamics - Ordnance and Tactical Systems (PA)', 'Spirit Airlines (DFW) May 2026',
  // US suffix on a well-known one-word brand.
  'Bosch USA', 'Brother USA', 'Canon U.S.A.', 'Sika USA', 'Photon USA', 'AES US', 'Ahead USA', 'Marsh USA', 'Mane USA', "L'Oreal USA", 'Sigma USA',
  'Spirit Airlines', 'KIPP Public Schools Northern California', 'Texana Center (Building A) Airport Service Center',
  'ETH Zurich (Swiss Federal Institute of Technology)',
  'NYU (Endless Frontier Labs)', 'SHRM (SHRMLabs)', 'Massachusetts Institute of Technology (Lincoln Lab)', 'Princeton University (PPPL)',
  'California Institute of Technology (JPL)', 'Carnegie Mellon University (SEI)', 'UC Irvine (incl. UCI Health)',
  'Amazon', 'Walmart', 'MUFG Investor Services (US), LLC', 'National Institutes of Health',
  'The Ladders (Ladders, Inc.)', 'Miami University (Ohio)', 'Omnicom (OMC Group)', 'Zurn Elkay (Elkay Manufacturing)', 'Samsung (US HQ)',
  'Babson College (F.W. Olin Graduate School of Business)', 'Vantor (Maxar Intelligence)', 'Vetter Senior Living (home office)',
  'Police Executive Research Forum (Executive Search)', 'Jobs for the Future (JFFLabs)', 'Abbott (abbottcareers2 board)',
  'Pathstone (merged with Cornerstone Capital Group, 2021)', 'Summit Search Consultants (test)', 'LSEG (London Stock Exchange Group)',
  'Learning Commons (Chan Zuckerberg Initiative)', 'Resource Environmental Solutions ("RES")', 'Weekday AI (YC W21)',
  'United Parks & Resorts (SeaWorld)', 'Nextracker (Nextpower)', 'Aios (Yc W20/S21)', 'MaintainX (An Autodesk Company)',
  'Wounded Warrior Project (Hq)', 'T5 Data Centers (EverOn)', 'EAB (Education Advisory Board)', 'Expert Executive Recruiters (EER Global)',
  'FloWorks International LLC (FloWorks)', 'Ya-Group', 'Seed Health (Biotechnology)', 'TASC, Inc. (Treatment Alternatives for Safe Communities)',
  'Certa (getcerta.com)', 'Net2Source (N2S)', 'HHM Hotels (Philadelphia Corporate)', 'Perseus Operating Group (Constellation Software)',
  'CAMS (Community Association Management Services)', 'SoloPoint Solutions (Wisconsin)', 'Women In Need, Inc. (Win)',
  'East Valley Institute of Technology (District)',
])
/** One-word names so common that "X" and "X.io" are as likely to be two companies; these stay separate unless a website proves it. */
export const GENERIC_WORDS = new Set(['apollo'])
/** Further organizations folded into the group of the first name (legal entities that file WARN notices as Amazon). */
export const EXTRA_MERGES: string[][] = [
  ['Amazon', 'Amazon Data Services', 'Amazon Technologies', 'Amazon Development Center U.S.', 'Amazon Last Mile',
    'Prime Video & Amazon MGM Studios', 'Amazon Web Services', 'AmazonWebServices'],
  ['Spirit Airlines', 'Spirit Airlines (DFW) May 2026', 'Spirit Airlines (IAH) May 2026'],
  // Company directory: Amazon's own divisions (acquisitions with their own brand, like Twitch, Audible and Zappos, stay separate).
  ['Amazon', 'Amazon.com Services', 'Amazon Music', 'Amazon Delivery Service Partner', 'Amazon Web Services (AWS)', 'Amazon Science', 'Amazon Business', 'AWS'],
]
/** Parents that absorb every organization whose name starts with the prefix (sites, group homes, regional schools). */
export const FOLD_PREFIXES: { parent: string; prefix: string }[] = [
  { parent: 'Texana Center', prefix: 'Texana Center ' },
  { parent: 'KIPP Public Schools Northern California', prefix: 'KIPP Public Schools Northern California ' },
]


/**
 * The rules plus the hand decisions above, for one group of names that share a looseKey.
 * websiteProvesIt: a member's website is the web address written in another member's name.
 */
export function decideGroup(names: string[], websiteProvesIt = false): GroupDecision {
  const held = names.find((n) => HOLD[n])
  if (held) return { action: 'review', reason: HOLD[held] }
  // "Super.com" and "super.AI" end differently, so they are two companies, not one written two ways.
  const endings = new Set(names.flatMap((n) => n.toLowerCase().match(/\.(com|org|net|io|ai|co|tech|us)\b/g) ?? []))
  if (endings.size > 1) return { action: 'review', reason: 'Web endings differ (.com vs .ai and so on), so these are probably different companies.' }
  let d = classifyGroup(names)
  // "Murphy" / "Murphy USA", "Current" / "Current USA", "Team" / "Team USA": a US suffix after a single everyday
  // word is as likely to be a different company as the same one.
  if (d.action === 'merge' && !names.some((n) => FORCE_MERGE.has(n))) {
    const parts = names.map(nameParts)
    const generic = parts.some((p) => p.hadUsSuffix && p.tokens <= 1) && isCommonWord(parts[0].core)
    if (generic) {
      return { action: 'review', reason: 'A US suffix after a single everyday word, which could be a different company.' }
    }
  }
  if (d.action === 'review' && names.some((n) => FORCE_MERGE.has(n))) d = { action: 'merge', reason: 'Confirmed by hand.' }
  if (d.action === 'review' && d.reason.startsWith('One has .com') && !names.some((n) => GENERIC_WORDS.has(looseKey(n)))) {
    d = { action: 'merge', reason: 'Same name with a web address on the end.' }
  }
  if (d.action === 'review' && d.reason.startsWith('One has .com') && websiteProvesIt) d = { action: 'merge', reason: 'The website is the web address in the name.' }
  return d
}
