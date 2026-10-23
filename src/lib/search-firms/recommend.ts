import { inferFunctionFromTitle, inferLevelFromTitle } from '@/lib/jobs/infer-job-function'
import { SEGMENT_LABEL, type FirmSegment } from './match'

/**
 * Which recruiters and search firms fit a Candidate+ member — pure, so it is
 * tested without a database. A firm fits when its live searches are in the
 * member's function, or its name, searches or known focus mention the
 * member's industry. Nothing is guessed beyond that: no match, no listing.
 */

export interface FirmForRecommend {
  id: string
  name: string
  website: string | null
  domain: string | null
  segment: string
  liveSearchCount: number
  sampleTitles: string[]
  teamPageUrl: string | null
  orgIndustry: string | null
  orgFocus: string | null
}

export interface MemberForRecommend {
  functions: (string | null | undefined)[]
  industries: (string | null | undefined)[]
  level: string | null
}

export interface RecommendedFirm {
  id: string
  name: string
  url: string | null
  /** The firm's team page, where its recruiters are listed, when we have it. */
  teamUrl: string | null
  segmentLabel: string
  why: string
  score: number
}

// The industries we recognise (an allowlist) and the words a firm uses for
// the same thing. Free text outside this list is ignored rather than guessed.
const SYNONYMS: Record<string, string[]> = {
  'higher education': ['higher ed', 'university', 'college', 'academic', 'provost', 'dean'],
  education: ['school', 'academic', 'k-12', 'university', 'college'],
  healthcare: ['health', 'hospital', 'clinical', 'medical', 'physician', 'nursing'],
  health: ['healthcare', 'hospital', 'clinical', 'medical'],
  finance: ['financial', 'banking', 'investment', 'private equity', 'asset management', 'cfo', 'fp&a'],
  financial: ['finance', 'banking', 'investment'],
  'venture capital': ['venture', 'vc', 'private equity', 'investment'],
  technology: ['tech', 'software', 'saas', 'engineering', 'cto', 'data'],
  ai: ['machine learning', 'ml', 'artificial intelligence', 'data science'],
  telecommunications: ['telecom', 'wireless', 'network'],
  nonprofit: ['non-profit', 'foundation', 'philanthropy', 'mission'],
  climate: ['energy', 'sustainability', 'renewable', 'clean'],
  energy: ['power', 'utilities', 'renewable', 'oil', 'gas'],
  insurance: ['underwriter', 'casualty', 'actuarial', 'claims'],
  manufacturing: ['plant', 'industrial', 'production', 'supply chain'],
  legal: ['attorney', 'counsel', 'law'],
  retail: ['consumer', 'merchandising', 'ecommerce'],
  fintech: ['fintech', 'payments', 'banking'],
  saas: ['saas', 'software'],
  'private equity': ['private equity', 'portfolio company', 'pe-backed'],
  'real estate': ['real estate', 'property', 'reit'],
  construction: ['construction', 'contractor', 'structural'],
  pharmaceutical: ['pharma', 'biotech', 'life sciences', 'clinical'],
  biotech: ['biotech', 'life sciences', 'pharma'],
  government: ['public sector', 'government', 'federal', 'municipal'],
  hospitality: ['hotel', 'hospitality', 'restaurant'],
  logistics: ['logistics', 'supply chain', 'transportation', 'freight'],
  automotive: ['automotive', 'dealership'],
  aerospace: ['aerospace', 'defense', 'aviation'],
  'skilled trades': ['trades', 'hvac', 'electrical', 'plumbing'],
}

/** The industry words to look for, from the member's free-text industries. */
export function industryTerms(industries: (string | null | undefined)[]): string[] {
  const out = new Set<string>()
  for (const raw of industries) {
    const text = (raw ?? '').toLowerCase().trim()
    if (!text) continue
    for (const [key, syns] of Object.entries(SYNONYMS)) {
      if (new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`).test(text)) {
        out.add(key)
        syns.forEach((s) => out.add(s))
      }
    }
  }
  return [...out]
}

function contains(text: string, term: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(text)
}

const SENIOR = new Set(['Director', 'VP', 'C-Suite'])
const LEVEL_RANK: Record<string, number> = { IC: 0, Manager: 1, Director: 2, VP: 3, 'C-Suite': 4 }

/** A search counts for a member when it is at most one level below theirs. */
function levelFits(title: string, memberLevel: string | null): boolean {
  const member = memberLevel ? LEVEL_RANK[memberLevel] : undefined
  if (member === undefined) return true
  const search = LEVEL_RANK[inferLevelFromTitle(title)] ?? 0
  return search >= member - 1
}

export function recommendFirms(member: MemberForRecommend, firms: FirmForRecommend[], limit = 12): RecommendedFirm[] {
  const functions = new Set(member.functions.filter((f): f is string => Boolean(f) && f !== 'General' && f !== 'Other'))
  const terms = industryTerms(member.industries)
  const wantsNonprofit = terms.some((t) => ['nonprofit', 'higher education', 'education', 'university'].includes(t))
  const senior = member.level ? SENIOR.has(member.level) : false

  const scored: RecommendedFirm[] = []
  for (const f of firms) {
    const fnTitles = f.sampleTitles.filter((t) => {
      const fn = inferFunctionFromTitle(t)
      return fn !== null && functions.has(fn) && levelFits(t, member.level)
    })
    const firmText = [f.name, ...f.sampleTitles, f.orgIndustry, f.orgFocus].filter(Boolean).join(' · ').toLowerCase()
    const industryHits = terms.filter((t) => contains(firmText, t))
    const segment = (f.segment in SEGMENT_LABEL ? f.segment : 'retained') as FirmSegment
    const nonprofitFit = wantsNonprofit && segment === 'nonprofit_higher_ed'
    if (fnTitles.length === 0 && industryHits.length === 0 && !nonprofitFit) continue

    let score = Math.min(fnTitles.length, 5) * 3 + Math.min(industryHits.length, 2) * 4
    if (nonprofitFit) score += 6
    if (senior && segment === 'retained') score += 2
    if (!senior && segment === 'contingent') score += 1
    score += Math.min(f.liveSearchCount, 10) * 0.1

    const why: string[] = []
    if (fnTitles.length > 0) {
      const fnList = [...functions].filter((fn) => fnTitles.some((t) => inferFunctionFromTitle(t) === fn))
      why.push(`${fnTitles.length} recent search${fnTitles.length === 1 ? '' : 'es'} in ${fnList.join(' and ')}, e.g. "${shorten(fnTitles[0].trim(), 60)}"`)
    }
    if (nonprofitFit) why.push('specializes in nonprofit and higher education search')
    else if (industryHits.length > 0) why.push(`works in ${industryHits[0]}`)

    const url = f.website ?? (f.domain ? `https://${f.domain}` : null)
    scored.push({ id: f.id, name: f.name, url, teamUrl: f.teamPageUrl, segmentLabel: SEGMENT_LABEL[segment], why: capitalize(why.join('; ')), score })
  }
  return scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name)).slice(0, limit)
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

function shorten(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`
}
