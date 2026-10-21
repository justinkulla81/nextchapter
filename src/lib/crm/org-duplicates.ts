// Finds organizations that are the same company written two ways, and decides
// whether a group is safe to merge on its own or needs a person to look.
//
// Pure functions only (no database), so the bulk cleanup script and the
// Duplicates page agree and the rules can be tested.
//
// "merge" means the names differ only by decoration: spacing, punctuation,
// "&" vs "and", a legal suffix, ".com", a trailing "US"/"USA", a trailing
// abbreviation or ticker in parentheses, a "formerly" note, or a warehouse /
// site code ("Amazon - SF019").
//
// "review" means something real could separate them: a parenthetical naming a
// lab, campus or location ("MIT (Lincoln Lab)", "Goddard School (Murray
// Hill)"), two different parentheticals, or a short one-word name that could
// be two companies ("Apollo" / "Apollo.io").

const LEGAL = /\b(the|inc|incorporated|llc|llp|lp|ltd|limited|corp|corporation|company|co|plc|gmbh|na|n a)\b/g
const TLD = /\.(com|org|net|io|ai|co|tech|us)\b/g
// "Amazon - SF019", "Intel Corporation - SC11"
const SITE_CODE = /\s*[-–—]\s*[a-z]{2,5}\d{1,4}[a-z]?\s*$/i
const TRAILING_US_CAPS = /[\s,]+(?:\(US\)|US|-\s*US)\s*$/
const TRAILING_USA = /[\s,]+(?:usa|u\.s\.a\.?|u\.s\.?|\(usa\))\s*$/i

function ascii(name: string): string {
  // Accents come off the letter ("Soléa" -> "Solea") instead of leaving a gap that would make it look like "Sola".
  return name.replace(/[’‘`´]/g, "'").normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/** Spacing, punctuation, "&", legal suffixes: the part that never separates two companies. */
function squash(text: string, stripTld: boolean): string {
  let s = ascii(text).toLowerCase()
  if (stripTld) s = s.replace(TLD, ' ')
  s = s.replace(/[.,']/g, '').replace(/&|\+/g, ' and ').replace(/[^a-z0-9\s]/g, ' ')
  s = s.replace(LEGAL, ' ').replace(/\s+/g, '')
  return s
}

type Paren = 'acronym' | 'ticker' | 'formerly' | 'place' | 'other'

function classifyParen(inner: string): Paren {
  const t = inner.trim()
  if (/^(nasdaq|nyse|otc|tsx|lse)\s*:/i.test(t)) return 'ticker'
  if (/^(formerly|f\/k\/a|fka|previously)\b/i.test(t)) return 'formerly'
  if (/^[A-Z][A-Z&.\/]{1,9}$/.test(t)) return 'acronym'
  if (/^(US|USA|U\.S\.A?\.?)$/i.test(t)) return 'acronym'
  if (/^[A-Z]{2}$/.test(t)) return 'place'
  return 'other'
}

export interface NameParts {
  /** The name with every decoration removed. */
  core: string
  /** Parenthetical groups found, with what each looks like. */
  parens: { text: string; kind: Paren }[]
  hadSiteCode: boolean
  hadUsSuffix: boolean
  hadTld: boolean
  /** Words in the core, a cheap measure of how generic the name is. */
  tokens: number
}

export function nameParts(name: string): NameParts {
  let rest = ascii(name).trim()
  const parens: NameParts['parens'] = []
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    parens.push({ text: inner.trim(), kind: classifyParen(inner) })
    return ' '
  })
  const hadSiteCode = SITE_CODE.test(rest)
  rest = rest.replace(SITE_CODE, '')
  const hadTld = TLD.test(rest.toLowerCase())
  TLD.lastIndex = 0
  let hadUsSuffix = false
  const noUs = rest.replace(TRAILING_US_CAPS, '').replace(TRAILING_USA, '')
  if (noUs !== rest) { hadUsSuffix = true; rest = noUs }
  // A leading "USA" ("USA The Nature Conservancy"), only when a real name remains.
  const noLeadUsa = rest.replace(/^\s*usa[\s-]+/i, '')
  if (noLeadUsa !== rest && squash(noLeadUsa, true).length >= 8) { hadUsSuffix = true; rest = noLeadUsa }
  const core = squash(rest.replace(/[-–—:]/g, ' '), true)
  const tokens = ascii(rest).replace(TLD, ' ').split(/[\s,]+/).filter(Boolean).length
  return { core, parens, hadSiteCode, hadUsSuffix, hadTld, tokens }
}

/** Whether a website's domain is the name with ".com"/".io" on the end ("gong.io" for "Gong.io"). */
export function websiteMatchesName(website: string | null | undefined, name: string): boolean {
  if (!website) return false
  const host = website.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0]
  const label = host.split('.').slice(0, -1).join('')
  return label.length >= 3 && label.replace(/[^a-z0-9]/g, '') === nameParts(name).core
}

/** Same company ignoring everything decorative. Names shorter than 3 letters never group. */
export function looseKey(name: string): string {
  const k = nameParts(name).core
  return k.length >= 3 ? k : ''
}

/** Same letters once spacing, punctuation, "&" and legal suffixes are ignored. No TLD or parenthetical removal. */
export function strictKey(name: string): string {
  const k = squash(ascii(name).replace(/[():\-–—]/g, ' '), false)
  return k.length >= 3 ? k : ''
}

export interface GroupDecision {
  action: 'merge' | 'review'
  reason: string
}

/** Decides one group of names that share a looseKey. */
export function classifyGroup(names: string[]): GroupDecision {
  const parts = names.map(nameParts)
  const strict = new Set(names.map(strictKey))
  const anyTld = parts.some((p) => p.hadTld)
  const shortBrand = Math.min(...parts.map((p) => p.core.length)) <= 6 || Math.min(...parts.map((p) => p.tokens)) <= 1

  if (anyTld && shortBrand && strict.size > 1) {
    return { action: 'review', reason: 'One has .com / .io / .ai on the end and the name is short enough to be two different companies.' }
  }
  if (strict.size === 1) return { action: 'merge', reason: 'Same name apart from spacing, punctuation or a legal suffix.' }

  // Two or more different parentheticals: units or locations, not decoration.
  const parenSets = parts.map((p) => p.parens.map((x) => x.text.toLowerCase()).sort().join('|'))
  const distinctNonEmpty = new Set(parenSets.filter(Boolean))
  if (distinctNonEmpty.size > 1) {
    return { action: 'review', reason: 'Each has its own bracketed detail, so they may be different units or locations.' }
  }
  for (const p of parts) {
    for (const x of p.parens) {
      if (x.kind === 'other') return { action: 'review', reason: `“(${x.text})” names a lab, campus, division or location that may be its own organization.` }
      if (x.kind === 'place' && p.tokens <= 1) return { action: 'review', reason: `“${x.text}” after a one-word name could be a different company.` }
    }
  }
  return { action: 'merge', reason: 'Differs only by a US suffix, a site code, an abbreviation or a "formerly" note.' }
}

/** The cleanest way to write a group's name: no site code, bracket or US suffix, then shortest. */
export function cleanestName(names: string[]): string {
  const score = (n: string) => {
    const p = nameParts(n)
    return (p.parens.length ? 100 : 0) + (p.hadSiteCode ? 100 : 0) + (p.hadUsSuffix ? 50 : 0) + (p.hadTld ? 20 : 0) + (/\b(inc|llc|ltd|corp|co)\b\.?,?\s*$/i.test(n) ? 10 : 0)
  }
  const upper = (n: string) => (n.match(/[A-Z]/g) ?? []).length
  return [...names].sort((a, b) => score(a) - score(b) || a.length - b.length || upper(b) - upper(a) || a.localeCompare(b))[0]
}
