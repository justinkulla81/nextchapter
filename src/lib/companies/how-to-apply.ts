// How to approach applying to a company, from facts we hold: which applicant tracking
// system its postings go through (read from the posting URL — exact, not guessed), how
// long its roles typically stay open, whether it is PE- or VC-backed (crawler badges),
// and whether it runs recruiter-led searches. Pure, tested in
// src/test/company-intel-panels.test.ts.

export interface AtsInfo {
  name: string
  /** What is true of this system and worth knowing before applying. */
  tips: string[]
}

// Host fragment -> system. Only systems whose behaviour is well documented; the tips are
// deliberately modest — general facts about how each system works, not promises.
const ATS_HOSTS: { match: RegExp; info: AtsInfo }[] = [
  {
    match: /(^|\.)greenhouse\.io$/,
    info: { name: 'Greenhouse', tips: ['Applications are read as text, so a simple single-column resume parses best.', 'Questions are often free text — answer them specifically; recruiters read them.'] },
  },
  {
    match: /(^|\.)lever\.co$/,
    info: { name: 'Lever', tips: ['Your resume is shown to recruiters as parsed text beside the original file.', 'A short, specific note in the optional field is read and stands out.'] },
  },
  {
    match: /(^|\.)ashbyhq\.com$/,
    info: { name: 'Ashby', tips: ['Fields are filled from your resume; check them, since parsing errors carry through.', 'Recruiters here often work from a shortlist view — a clear top third of the resume matters.'] },
  },
  {
    match: /(^|\.)(myworkdayjobs|myworkday|workday)\.com$/,
    info: { name: 'Workday', tips: ['Expect to create an account and re-enter your work history by hand; set aside 20–30 minutes.', 'Match the posting\'s wording in your job titles and skills — Workday search is keyword driven.'] },
  },
  {
    match: /(^|\.)icims\.com$/,
    info: { name: 'iCIMS', tips: ['Upload a plain-text-friendly resume; heavy formatting and tables can parse badly.', 'You usually need an account; the profile it builds from your resume is what recruiters search.'] },
  },
  {
    match: /(^|\.)smartrecruiters\.com$/,
    info: { name: 'SmartRecruiters', tips: ['One-click apply from a profile is common; keep that profile current.', 'Screening questions can auto-filter, so answer them accurately and completely.'] },
  },
  {
    match: /(^|\.)jobvite\.com$/,
    info: { name: 'Jobvite', tips: ['Referrals are tracked and prioritised here — a named referral changes how you are reviewed.'] },
  },
  {
    match: /(^|\.)(taleo\.net|oraclecloud\.com)$/,
    info: { name: 'Oracle Taleo', tips: ['An older system: plain formatting, no headers or footers, and no text boxes.', 'It can time out — draft answers elsewhere and paste them in.'] },
  },
  {
    match: /(^|\.)bamboohr\.com$/,
    info: { name: 'BambooHR', tips: ['Typically smaller employers; the application often goes straight to a hiring manager.'] },
  },
  {
    match: /(^|\.)successfactors\.(com|eu)$/,
    info: { name: 'SAP SuccessFactors', tips: ['A large-employer system: expect an account and a long form; keep your own record of what you submitted.'] },
  },
]

export function detectAts(url: string | null | undefined): AtsInfo | null {
  if (!url) return null
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
  return ATS_HOSTS.find((a) => a.match.test(host))?.info ?? null
}

/** The system most of a company's postings use, with how many of them. */
export function dominantAts(urls: (string | null | undefined)[]): { info: AtsInfo; postings: number; of: number } | null {
  const counts = new Map<string, { info: AtsInfo; n: number }>()
  let known = 0
  for (const u of urls) {
    const info = detectAts(u)
    if (!info) continue
    known += 1
    const c = counts.get(info.name) ?? { info, n: 0 }
    c.n += 1
    counts.set(info.name, c)
  }
  const best = [...counts.values()].sort((a, b) => b.n - a.n)[0]
  return best ? { info: best.info, postings: best.n, of: Math.max(known, urls.length) } : null
}

export interface ApplyFacts {
  ats: { info: AtsInfo; postings: number; of: number } | null
  /** Median days its currently open roles have been open, since we first saw them. */
  medianDaysOpen: number | null
  backing: 'PE-backed' | 'VC-backed' | null
  recruiterLedSearches: number
}

export interface ApplyPosting {
  url: string
  createdAt: Date
  badges: string[]
  postingType: string | null
  sourceCategory: string | null
}

export function summarizeHowToApply(list: ApplyPosting[], now: Date = new Date()): ApplyFacts {
  const ages = list.map((p) => Math.max(0, Math.floor((now.getTime() - p.createdAt.getTime()) / 86_400_000))).sort((a, b) => a - b)
  const median =
    ages.length === 0
      ? null
      : ages.length % 2
        ? ages[(ages.length - 1) / 2]
        : Math.round((ages[ages.length / 2 - 1] + ages[ages.length / 2]) / 2)
  const has = (label: string) => list.some((p) => p.badges.some((b) => b.toLowerCase() === label.toLowerCase()))
  return {
    ats: dominantAts(list.map((p) => p.url)),
    medianDaysOpen: median,
    backing: has('PE-backed') ? 'PE-backed' : has('VC-backed') ? 'VC-backed' : null,
    recruiterLedSearches: list.filter((p) => p.postingType === 'recruiter_search' || p.sourceCategory === 'search_firm').length,
  }
}
