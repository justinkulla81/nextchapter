/**
 * Candidate foundations that fund workforce transitions and mid-career
 * education. A seed list for Justin to work from, not a prospect database.
 *
 * Rules for this file:
 *  - NextChapter is a for-profit company. Most foundations fund 501(c)(3)
 *    organizations only, so `forProfit` is the first thing to read.
 *  - `VERIFIED` means the program name, access route and eligibility wording
 *    were read on the funder's own page on `dateChecked`. `TO VERIFY` means we
 *    only have secondary sources (news, grant directories) or could not load
 *    the funder's page. Nothing marked TO VERIFY is a fact.
 *  - Nobody has been contacted. Adding an entry is not outreach.
 *
 * Human-readable twin: docs/funding/foundations-to-verify.md. Keep them in step.
 */

export type FoundationStatus = 'VERIFIED' | 'TO VERIFY'

/**
 * Can a for-profit company receive a grant directly?
 *  EXCLUDED   the funder's own wording limits grants to public charities / 501(c)(3).
 *  NOT_STATED the funder's page names eligible organizations but not for-profits either way.
 *  ELIGIBLE   a for-profit is named as eligible.
 *  UNKNOWN    no official wording read.
 */
export type ForProfitEligibility = 'EXCLUDED' | 'NOT_STATED' | 'ELIGIBLE' | 'UNKNOWN'

export type AccessRoute = 'INVITATION_ONLY' | 'OPEN_CALLS' | 'OPEN' | 'UNKNOWN'

export interface Foundation {
  id: string
  name: string
  /** Program or initiative names relevant to workforce transitions or mid-career education. */
  program: string
  whatItFunds: string
  /** Who can apply, in the funder's words where read, otherwise labelled as secondary. */
  whoCanApply: string
  forProfit: ForProfitEligibility
  access: AccessRoute
  /** What this means for NextChapter, one plain sentence. */
  route: string
  sourceUrl: string
  /** ISO date the source was last checked. */
  dateChecked: string
  status: FoundationStatus
  /** Flagged: excludes for-profits or cannot be pursued directly. */
  flag?: string
}

const CHECKED = '2026-10-13'

export const FOUNDATIONS: Foundation[] = [
  {
    id: 'lumina',
    name: 'Lumina Foundation',
    program: 'Proactive grantmaking on postsecondary attainment; occasional open RFPs',
    whatItFunds: 'Postsecondary access and attainment work. Funds are mostly chosen by Lumina and its partners.',
    whoCanApply:
      'Its grants page says grantmaking is primarily proactive and that it does not accept or respond to unsolicited requests or letters of inquiry. It says it occasionally issues open RFPs on specific topics. The page does not state which organization types are eligible.',
    forProfit: 'NOT_STATED',
    access: 'INVITATION_ONLY',
    route: 'No direct route today. Watch for an open RFP, or be named by a college or nonprofit partner it already funds.',
    sourceUrl: 'https://www.luminafoundation.org/grants/',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'Invitation only. For-profit eligibility is not stated on the pages read; older third-party listings say 501(c)(3) public charities only (secondary, unconfirmed).',
  },
  {
    id: 'strada',
    name: 'Strada Education Foundation',
    program: 'Catalytic grantmaking: Beyond Completion Challenge, Intermediary Learning Collaborative, Innovation in Career Services',
    whatItFunds: 'Education-to-employment pathways, career services, employer and college partnerships.',
    whoCanApply:
      'Its grantmaking page says: "We provide grants to nonprofit organizations, postsecondary education providers, and workforce and skills-based educators." The page does not say whether for-profits qualify or whether applications are open or invited; individual initiative pages may.',
    forProfit: 'NOT_STATED',
    access: 'UNKNOWN',
    route: 'Possible as a "workforce and skills-based educator" or as a delivery partner to a college. Ask Strada, through a college partner first, whether for-profit providers qualify.',
    sourceUrl: 'https://www.strada.org/how-we-work/grantmaking',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'Whether a for-profit qualifies as a "skills-based educator" is not stated. Read the specific initiative page before approaching.',
  },
  {
    id: 'markle',
    name: 'Markle Foundation',
    program: 'Skillful and the Rework America task force (workforce, skills-based hiring)',
    whatItFunds: 'Skills-based hiring and job access for workers without a four-year degree, state partnerships.',
    whoCanApply:
      'Not read. The foundation site returned an access error to our fetch. Secondary sources describe Skillful as a Markle nonprofit initiative aimed at workers without four-year degrees, which is a different population from our mid-career professionals.',
    forProfit: 'UNKNOWN',
    access: 'UNKNOWN',
    route: 'Unknown. Population focus looks like a poor fit for a mid-career professional product.',
    sourceUrl: 'https://www.markle.org/',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Eligibility and application process not confirmed. Stated focus (no four-year degree) may not fit.',
  },
  {
    id: 'walmart-org',
    name: 'Walmart.org (Walmart Foundation)',
    program: 'Creating Opportunity priority area (invitation-only programs); Spark Good Local Community Grants',
    whatItFunds: 'Opportunity and workforce programs through invited grantees; local community grants through stores.',
    whoCanApply:
      'Its eligibility page says funding in the U.S. is generally limited to IRS-recognized public charities and equivalents (examples: government units, faith-based organizations, schools). Most focus areas are invitation only: "Unsolicited proposals will not be accepted, and invitations are not granted upon request." Local Community Grants is the only program that accepts applications throughout the year.',
    forProfit: 'EXCLUDED',
    access: 'INVITATION_ONLY',
    route: 'Not directly. Only through a nonprofit or college grantee that includes NextChapter as a vendor.',
    sourceUrl: 'https://walmart.org/how-we-give/grant-eligibility',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'EXCLUDES FOR-PROFITS: public charities and equivalents only, and invitation only.',
  },
  {
    id: 'siegel',
    name: 'Siegel Family Endowment',
    program: 'Learning, Work and Infrastructure grantmaking areas (future of work and AI)',
    whatItFunds: 'Work and learning in a changing economy, including how technology changes work.',
    whoCanApply:
      'Its What We Fund page says "Siegel only accepts proposals by invitation," and that grants go to or through U.S. organizations the IRS has determined are section 501(c)(3) public charities. It occasionally runs open calls. The page does not mention for-profits.',
    forProfit: 'EXCLUDED',
    access: 'INVITATION_ONLY',
    route: 'Not directly. A 501(c)(3) partner (a workforce nonprofit or college foundation) would hold the grant.',
    sourceUrl: 'https://www.siegelendowment.org/what-we-fund/',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'EXCLUDES FOR-PROFITS: 501(c)(3) public charities only, and invitation only.',
  },
  {
    id: 'openai-foundation',
    name: 'OpenAI Foundation',
    program: 'Initial $250 million for research, grants and partnerships on AI and jobs, announced May 2026',
    whatItFunds: 'Research into AI effects on jobs, support for workers and communities facing near-term job losses, ways to share economic gains.',
    whoCanApply:
      'One news report (WHBL, May 27, 2026) quotes: "Grants will go to non-profits as well as a wide range of other organizations." No application process or deadline is described; first initiatives were to be announced later in 2026.',
    forProfit: 'UNKNOWN',
    access: 'UNKNOWN',
    route: 'Possibly open to "other organizations". Watch for the first initiatives; read eligibility on the foundation\'s own page when published.',
    sourceUrl: 'https://whbl.com/2026/05/27/openai-foundation-commits-250-million-to-help-workers-economies-navigate-ai-disruption/',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Single secondary source. Check the foundation\'s own announcement; the report itself notes OpenAI is also an AI services investor, so consider how that sits with our "no AI-cause claim" voice.',
  },
  {
    id: 'ascendium',
    name: 'Ascendium Education Group',
    program: 'Education philanthropy: workforce training, BOOST (with Jobs for the Future), exploration-validation-scaling grants',
    whatItFunds: 'Postsecondary and career outcomes for learners from low-income backgrounds, including nonprofit sectoral workforce training.',
    whoCanApply:
      'Not read on its own site (access error). Secondary sources describe recipients as nonprofits, colleges and research organizations; none addresses for-profits. Contact listed by a third party: philanthropy@ascendiumeducation.org.',
    forProfit: 'UNKNOWN',
    access: 'UNKNOWN',
    route: 'Unknown. Its low-income learner focus differs from our mid-career professional market.',
    sourceUrl: 'https://www.ascendiumeducation.org/',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Eligibility not confirmed. Likely nonprofit-oriented.',
  },
  {
    id: 'google-org',
    name: 'Google.org',
    program: 'AI Opportunity Fund (U.S. workforce, $75 million committed in 2024)',
    whatItFunds: 'AI skills training delivered by workforce development and education organizations.',
    whoCanApply:
      'Secondary sources: early U.S. grants went to selected organizations (for example Goodwill); the European open call listed nonprofits, social enterprises, trade unions and municipalities. Current U.S. eligibility not found.',
    forProfit: 'UNKNOWN',
    access: 'UNKNOWN',
    route: 'Unknown. Likely through a nonprofit or workforce partner.',
    sourceUrl: 'https://www.philanthropy.com/news/google-org-commits-75-million-for-work-force-development-in-a-i/',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Secondary sources only; the program may have changed since 2024.',
  },
  {
    id: 'gates',
    name: 'Gates Foundation (Postsecondary Success)',
    program: 'Postsecondary success strategy; targeted solicitations',
    whatItFunds: 'Student success and completion at colleges, mostly for low-income students.',
    whoCanApply:
      'Secondary sources say the foundation does not take full unsolicited proposals and sets eligibility per solicitation. No current open postsecondary call found.',
    forProfit: 'UNKNOWN',
    access: 'INVITATION_ONLY',
    route: 'Unknown. A college-level, completion-focused strategy; poor fit for adult professional transitions.',
    sourceUrl: 'https://grantable.co/grants/gates-foundation-grants',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Secondary sources only. Likely a poor fit.',
  },
  {
    id: 'ballmer',
    name: 'Ballmer Group',
    program: 'Economic mobility portfolio (re-granting and intermediaries)',
    whatItFunds: 'Economic mobility for children and families, often through intermediaries.',
    whoCanApply:
      'Secondary source (Inside Philanthropy) says it does not accept unsolicited applications and often re-grants through partners. Official wording not read.',
    forProfit: 'UNKNOWN',
    access: 'INVITATION_ONLY',
    route: 'Not directly.',
    sourceUrl: 'https://www.insidephilanthropy.com/grants-b/tag/data',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Secondary source only. Probably not a route for a for-profit.',
  },
  {
    id: 'jpmorgan-chase',
    name: 'JPMorganChase (Jobs and Skills)',
    program: 'Jobs and Skills focus area of its philanthropy',
    whatItFunds: 'Workforce development and skills training for underserved populations.',
    whoCanApply:
      'A third-party listing says eligible applicants are tax-exempt nonprofits and proposals are by invitation. Not read on the company\'s own page.',
    forProfit: 'UNKNOWN',
    access: 'INVITATION_ONLY',
    route: 'Not directly; through a nonprofit or workforce board partner.',
    sourceUrl: 'https://www.jpmorganchase.com/impact',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Secondary source says nonprofits only. Treat as excluding for-profits until read.',
  },
  {
    id: 'panorama-ipm',
    name: 'Innovative Postsecondary Models Fund (administered by Panorama Global)',
    program: 'Pooled fund from eight foundations: seven to ten grants of $750,000 to $1 million',
    whatItFunds: 'New postsecondary models.',
    whoCanApply:
      'A grant-database blog says the fund is open to for-profits and that applications closed September 14, 2026. Not confirmed on the administrator\'s page.',
    forProfit: 'UNKNOWN',
    access: 'OPEN_CALLS',
    route: 'The round appears closed. Check whether there will be another round and whether for-profits were eligible.',
    sourceUrl: 'https://grantedai.com/blog/innovative-postsecondary-models-fund-7-million-eight-foundations-september-14-2026-deadline-750k-1-million-awards-panorama-global-strategy',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Aggregator source only; round appears closed. Worth confirming because it is the one item described as open to for-profits.',
  },
]

/** Foundations a for-profit cannot approach directly, by their own published wording. */
export function excludesForProfits(f: Foundation): boolean {
  return f.forProfit === 'EXCLUDED'
}
