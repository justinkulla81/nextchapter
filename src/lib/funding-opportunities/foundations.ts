/**
 * Candidate foundations that fund workforce transitions and mid-career
 * education. A seed list for Justin to work from, not a prospect database.
 *
 * Rules for this file:
 *  - NextChapter is a for-profit company. Most foundations fund 501(c)(3)
 *    organizations only, so `forProfit` is the first thing to read.
 *  - `VERIFIED` means the program name, access route and eligibility wording
 *    were read on the funder's own page on `dateChecked`. `TO VERIFY` means we
 *    only have secondary sources (news, grant directories), could not load
 *    the funder's page, or the funder's own pages do not say who can apply.
 *    Nothing marked TO VERIFY is a fact.
 *  - Nobody has been contacted. Adding an entry is not outreach.
 *
 * Human-readable twin: docs/funding/foundations-to-verify.md. Keep them in step.
 */

export type FoundationStatus = 'VERIFIED' | 'TO VERIFY'

/**
 * Can a for-profit company receive a grant directly?
 *  EXCLUDED   the funder's own wording limits grants to public charities / 501(c)(3).
 *  NOT_STATED the funder's page names eligible organizations but not for-profits either way.
 *  ELIGIBLE   a for-profit is named as eligible (possibly with conditions).
 *  UNKNOWN    no official wording read.
 */
export type ForProfitEligibility = 'EXCLUDED' | 'NOT_STATED' | 'ELIGIBLE' | 'UNKNOWN'

export type AccessRoute = 'INVITATION_ONLY' | 'OPEN_CALLS' | 'OPEN' | 'UNKNOWN'

/**
 * How NextChapter could realistically reach this money.
 *  DIRECT                 NextChapter would be the grantee.
 *  VIA_COLLEGE_OR_BOARD   inside a college, university or workforce-board grantee.
 *  VIA_NONPROFIT_PARTNER  inside a nonprofit or intermediary grantee.
 *  NOT_ACCESSIBLE         no realistic route found.
 * On a TO VERIFY entry the path is provisional.
 */
export type AccessPath = 'DIRECT' | 'VIA_COLLEGE_OR_BOARD' | 'VIA_NONPROFIT_PARTNER' | 'NOT_ACCESSIBLE'

export interface Foundation {
  id: string
  name: string
  /** Program or initiative names relevant to workforce transitions or mid-career education. */
  program: string
  whatItFunds: string
  /** Who can apply, in the funder's words where read (quotes under 15 words), otherwise labelled as secondary. */
  whoCanApply: string
  /** Typical grant size where the funder states one; omitted when not stated. */
  grantSize?: string
  forProfit: ForProfitEligibility
  access: AccessRoute
  accessPath: AccessPath
  /** How NextChapter could realistically access this, one plain sentence. */
  route: string
  sourceUrl: string
  /** ISO date the source was last checked. */
  dateChecked: string
  status: FoundationStatus
  /** Flagged: excludes for-profits, cannot be pursued directly, or what blocked verification. */
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
    accessPath: 'VIA_COLLEGE_OR_BOARD',
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
    accessPath: 'VIA_COLLEGE_OR_BOARD',
    route: 'Possible as a "workforce and skills-based educator" or as a delivery partner to a college. Ask Strada, through a college partner first, whether for-profit providers qualify.',
    sourceUrl: 'https://www.strada.org/how-we-work/grantmaking',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'Whether a for-profit qualifies as a "skills-based educator" is not stated. Read the specific initiative page before approaching.',
  },
  {
    id: 'markle',
    name: 'Markle Foundation',
    program: 'Skillful and the Rework America Alliance (workforce, skills-based hiring)',
    whatItFunds: 'Skills-based hiring and job access for workers without a four-year degree, state partnerships.',
    whoCanApply:
      'Not read. Every markle.org URL returned HTTP 403 to WebFetch and to a plain browser-style request, and an archive copy was blocked to automated requests. Search-result snippets from markle.org say Skillful is a nonprofit initiative of Markle and that the Rework America Alliance was transferred to Jobs for the Future (scheduled December 2023). An archived FAQ from about 2006 said Markle had stopped taking unsolicited applications (old, secondary).',
    forProfit: 'UNKNOWN',
    access: 'UNKNOWN',
    accessPath: 'NOT_ACCESSIBLE',
    route: 'Provisional: Markle runs its own initiatives and the alliance moved to JFF, so no direct route is known. Population focus (no four-year degree) is a poor fit for mid-career professionals.',
    sourceUrl: 'https://www.markle.org/',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'BLOCKED: markle.org returns 403 to automated fetches. Read markle.org in a normal browser, or ask Justin to. Eligibility and application process unconfirmed.',
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
    accessPath: 'VIA_NONPROFIT_PARTNER',
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
    accessPath: 'VIA_NONPROFIT_PARTNER',
    route: 'Not directly. A 501(c)(3) partner (a workforce nonprofit or college foundation) would hold the grant.',
    sourceUrl: 'https://www.siegelendowment.org/what-we-fund/',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'EXCLUDES FOR-PROFITS: 501(c)(3) public charities only, and invitation only.',
  },
  {
    id: 'openai-foundation',
    name: 'OpenAI Foundation',
    program: 'Economic Futures program: initial $250 million for grants, partnerships and direct work (announced May 27, 2026). Separate: People-First AI Fund.',
    whatItFunds:
      'Three areas: measurement and forecasting of AI economic effects; "supporting the transition" (job search support, help translating experience into new roles, pilots at meaningful scale); long-term economic security. Its People-First AI Fund funds community nonprofits and is not a workforce program.',
    whoCanApply:
      'The Economic Futures announcement says the $250M "will support external organizations through grants, open calls, and institutional partnerships." It does not say whether for-profits qualify and gives no application process; first initiatives were to be announced later in 2026 and none appeared on the foundation news page on 2026-10-13. The 2026 People-First AI Fund (closed July 15, 2026) required "U.S.-Based 501(c)(3) Organization" status and a $500,000 to $10 million budget, so it excludes for-profits.',
    grantSize: 'Economic Futures: not stated. People-First AI Fund: $50 million across 163 organizations in 2026.',
    forProfit: 'NOT_STATED',
    access: 'UNKNOWN',
    accessPath: 'DIRECT',
    route: 'Possible direct route if an Economic Futures open call or pilot opens for career-transition tools. Nothing to apply to yet; the foundation has an email list for grant opportunities.',
    sourceUrl: 'https://openaifoundation.org/news/economic-futures-in-the-age-of-ai',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'Eligibility for Economic Futures is not stated and no call is open. People-First AI Fund excludes for-profits. Our voice is that AI is not shown to cause the long-search rise; decide how an AI-lab-linked funder fits before approaching.',
  },
  {
    id: 'ascendium',
    name: 'Ascendium Education Group',
    program: 'Three strategies: Expand Opportunity, Support Learner Success, Connect and Align Systems (exploration, validation and scaling grants)',
    whatItFunds:
      'Postsecondary education and workforce training outcomes for learners from low-income backgrounds, including adult learners, usually through intermediaries or networks of institutions.',
    whoCanApply:
      'Its grantmaking page says grant partners include "postsecondary education and workforce training providers, intermediaries, researchers, and media organizations" and that most opportunities are "by invitation only." Its grant portal page says it does not accept unsolicited letters of inquiry or proposals. Its FAQ says it occasionally issues limited RFPs and welcomes a brief outreach email from organizations whose work fits a strategy. No page read states whether for-profits qualify.',
    forProfit: 'NOT_STATED',
    access: 'INVITATION_ONLY',
    accessPath: 'VIA_NONPROFIT_PARTNER',
    route: 'Not directly today. Inside an intermediary, college or training-provider grantee; its FAQ allows a short outreach email, which has not been sent.',
    sourceUrl: 'https://www.ascendiumphilanthropy.org/our-approach/grantmaking',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'Invitation only; for-profit eligibility not stated. Focus is learners from low-income backgrounds, which differs from our mid-career professional market. The old seed URL (ascendiumeducation.org) returns 403; the philanthropy site loads.',
  },
  {
    id: 'google-org',
    name: 'Google.org',
    program: 'AI Opportunity Fund (U.S. workforce, $75 million committed in 2024); Generative AI Accelerator (open call, 2025 cohort selected)',
    whatItFunds:
      'AI skills training delivered by "best-in-class workforce development and education organizations." The final $10 million went to intermediaries (Project Evident, Tech:NYC Foundation, community foundations) that give AI adoption help to nonprofits at no cost.',
    whoCanApply:
      'The google.org, publicpolicy.google and blog.google pages read name recipient types and grantees but state no eligibility rules or application process for the U.S. fund. The 2025 Generative AI Accelerator open call is closed and its page does not state for-profit eligibility. European and Asia-Pacific open calls (secondary) named nonprofits, social enterprises, unions and municipalities.',
    grantSize: 'Fund total $75 million; per-grant size not stated on the pages read.',
    forProfit: 'NOT_STATED',
    access: 'UNKNOWN',
    accessPath: 'VIA_NONPROFIT_PARTNER',
    route: 'Provisional: through a workforce or education nonprofit that already holds a grant, or through the intermediaries. No public U.S. application route found.',
    sourceUrl: 'https://publicpolicy.google/article/AI-opportunity-fund/',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'Program name and recipient types read on Google pages, but no page states who can apply or how, so access and for-profit rules remain unconfirmed.',
  },
  {
    id: 'gates',
    name: 'Gates Foundation (Postsecondary Success)',
    program: 'Postsecondary Success: Innovation, Transformation, Data and information, Policy. 2026 AI Transformation Learning Grants (closed)',
    whatItFunds:
      'Institutional change at broad-access colleges and universities to improve student outcomes, including working adults. The AI Transformation Learning Grants supported up to eight institutions.',
    whoCanApply:
      'Its funding page says "We generally do not accept unsolicited proposals" and that most grantmaking is proactive. The same page says charitable funding to "private sector organizations" is possible but carries public-access conditions. The grant opportunities page says most grants go to 501(c)(3) and other tax-exempt organizations identified by staff. The 2026 AI Transformation call (closed September 11, 2026) was for "broad-access colleges and universities."',
    grantSize: 'AI Transformation Learning Grants: about $150,000 to $200,000 each. Otherwise not stated.',
    forProfit: 'ELIGIBLE',
    access: 'INVITATION_ONLY',
    accessPath: 'VIA_COLLEGE_OR_BOARD',
    route: 'Not directly. Gates funds colleges and intermediaries; NextChapter would be a vendor or partner inside a college grantee.',
    sourceUrl: 'https://www.gatesfoundation.org/about/our-funding',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'For-profits can receive Gates funding in principle (with conditions), but proposals are invited and the postsecondary strategy is college-centered. Poor direct fit.',
  },
  {
    id: 'ballmer',
    name: 'Ballmer Group',
    program: 'Economic mobility grantmaking by impact area; grants tagged "Career Success" and "Tech & Data" in its public grantee list',
    whatItFunds:
      'Economic mobility for children and families through direct services and systems change; the grantee list shows workforce training and AI-education grants (for example aiEDU, $1,000,000, 2026 to 2027).',
    whoCanApply:
      'Its grants page says "we cannot accept unsolicited grant applications." The pages read do not state eligible organization types or mention for-profits. The grantee list shows multi-year grants, mostly to nonprofits.',
    grantSize: 'Examples on its grantee list: $750,000 to $20,200,000 over multiple years.',
    forProfit: 'NOT_STATED',
    access: 'INVITATION_ONLY',
    accessPath: 'NOT_ACCESSIBLE',
    route: 'Not directly; it chooses its own grantees and often funds intermediaries. Only conceivable as a vendor inside a Career Success grantee.',
    sourceUrl: 'https://ballmergroup.org/our-grants/',
    dateChecked: CHECKED,
    status: 'VERIFIED',
    flag: 'No unsolicited applications. Focus is children and families; probably not a route for a for-profit.',
  },
  {
    id: 'jpmorgan-chase',
    name: 'JPMorganChase (Careers and Skills)',
    program: 'Careers and Skills impact page (includes New Skills Ready Network for youth career pathways). Third-party listings call the area "Jobs and Skills".',
    whatItFunds:
      'Career-connected education, skills training and policy work. Examples read: nonprofit workforce grants in Chicago, Miami and Alabama (2024 to 2026 press releases).',
    whoCanApply:
      'No page on jpmorganchase.com that was read states who can apply or how. Its press releases show grants to named nonprofits. Secondary listings say proposals are by invitation only and from tax-exempt nonprofits.',
    forProfit: 'UNKNOWN',
    access: 'INVITATION_ONLY',
    accessPath: 'VIA_NONPROFIT_PARTNER',
    route: 'Provisional: through a nonprofit or workforce-board partner that holds a grant.',
    sourceUrl: 'https://www.jpmorganchase.com/impact/careers-and-skills',
    dateChecked: CHECKED,
    status: 'TO VERIFY',
    flag: 'No how-to-apply page found on the company site. Invitation-only and nonprofit-only are secondary claims. Treat as excluding for-profits until read.',
  },
]

/** Foundations a for-profit cannot approach directly, by their own published wording. */
export function excludesForProfits(f: Foundation): boolean {
  return f.forProfit === 'EXCLUDED'
}
