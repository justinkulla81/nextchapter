// Comparison-page content for /vs/[competitor] — Partners Master Build
// Script §D2.8 ("Comparison pages, written fairly") and §C5 ("Publish the
// comparison honestly... including where LHH is stronger... converts
// better than a one-sided table").
//
// EVERY comparative claim in this file traces to a numbered row in
// docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md. Do not add a new comparative
// statement here without adding a matching row there first — that file is
// the actual defense per §D3's "one rule above all."
//
// This is deliberately NOT a finished, launch-ready comparison. The spec's
// own §A2.1 table is presented there as "informed estimates, not cited
// sources," and this build has no independent, current verification of any
// competitor's real pricing, features, or market position. Every page
// rendered from this data carries a visible "needs independent
// verification" notice — see ComparisonPageTemplate.

export interface FeatureComparisonRow {
  aspect: string
  us: string
  them: string
  /** Row number in docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md */
  substantiationRef: number
}

export interface CompetitorComparison {
  slug: 'lhh' | 'randstad-risesmart' | 'careerminds' | 'intoo'
  /** Full display name, used in copy and metadata. */
  name: string
  /** Short form for compact UI (table headers, buttons). */
  shortName: string
  metaTitle: string
  metaDescription: string
  /** One paragraph: what this vendor is genuinely best for. */
  bestForSummary: string
  /** Pricing range as characterized by the spec's own table (§A2.1). */
  pricingRangeLabel: string
  /** Footnote making clear how precise (or not) that range actually is. */
  pricingRangeCaveat: string
  /** The §D1.1 concession, adapted per vendor. Deliberately NOT verbatim
   * even for LHH — the spec's own sentence ("...land faster with proof
   * they keep...") is an unquantified but still real placement-speed
   * claim, which conflicts with §C1.3's "no placement-speed claims until
   * there is outcome data." That rule wins; every version here is reworded
   * to concede+redirect without any speed/outcome claim. See
   * docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md row 12. */
  concessionParagraph: string
  isConcessionVerbatim: boolean
  /** §D1.1 "where they're genuinely stronger" bullets — same list across
   * all four vendors, since that's the only sourced content available;
   * see the disclaimer rendered alongside this on the page. */
  whereTheyMayBeStrongerBullets: string[]
  featureComparison: FeatureComparisonRow[]
  whatParticipantsKeep: { us: string; them: string }
  whatTheEmployerSees: { us: string; them: string }
  whenToChooseThemInstead: string[]
}

const WHERE_THEY_MAY_BE_STRONGER = [
  'Global footprint — large providers commonly operate across 60+ countries with local labor-law knowledge, per the Master Build Script’s own assessment of the category.',
  'Coach supply at scale — a large contractor bench available on short notice for a sudden, large reduction.',
  'Procurement readiness — established vendors are more likely to already carry SOC 2, standard MSAs, insurance, and a long reference list procurement teams recognize.',
  'Brand safety — choosing a long-established, widely recognized vendor carries less internal risk for the buyer than choosing an unproven one.',
  'Physical services — in-person workshops and local offices, where a contract or workforce actually requires them.',
]

const WHERE_THEY_MAY_BE_STRONGER_DISCLAIMER =
  'These are the categories of strength the Master Build Script (§D1.1) associates with large outplacement providers as a category — not a vendor-specific verified fact about this particular company. We have not independently confirmed which of these apply, or to what degree, to this vendor specifically. Treat this as a starting point for your own diligence, not a substitute for it.'

const FEATURE_COMPARISON: FeatureComparisonRow[] = [
  {
    aspect: 'List pricing',
    us: 'Published in full, updated live — see /pricing. No quote-only pricing on any tier.',
    them: 'Typically not published; pricing is quoted per deal.',
    substantiationRef: 4,
  },
  {
    aspect: 'Reporting latency',
    us: 'Live seat utilization and aggregate outcomes, visible as soon as a cohort is enrolled.',
    them: 'Commonly quarterly PDF reporting, per the Master Build Script’s assessment of the category.',
    substantiationRef: 6,
  },
  {
    aspect: 'What the candidate keeps after the contract ends',
    us: 'A permanent Executive Dossier, collected references, and a free, permanent alumni account — none of it tied to the employer’s contract term.',
    them: 'Portal access commonly ends when the contract ends, per the Master Build Script’s assessment of the category. Ask this vendor directly — it’s question 7 on our RFP template.',
    substantiationRef: 7,
  },
  {
    aspect: 'Delivery at volume',
    us: 'The same structured, scored program at every tier.',
    them: 'Large caseloads and templated curriculum are common at volume, per the Master Build Script’s assessment — reportedly strongest at the executive tier, thinner below it.',
    substantiationRef: 8,
  },
  {
    aspect: 'Measurement',
    us: 'Every candidate is scored across the same competency model; the employer sees aggregate results, never an individual’s grade or activity.',
    them: 'Commonly does not structure or score participant activity or output, per the Master Build Script’s assessment of the category.',
    substantiationRef: 10,
  },
  {
    aspect: 'How you buy it',
    us: 'Evaluated on its own — list price published, no bundling requirement.',
    them: 'Outplacement is frequently bundled into a broader staffing or RPO relationship rather than independently evaluated, per the Master Build Script’s assessment of the category.',
    substantiationRef: 9,
  },
]

const WHAT_PARTICIPANTS_KEEP_US =
  'The Executive Dossier, five structured references, and a free permanent alumni account — all of it stays with the person, not the employer’s contract.'
const WHAT_EMPLOYER_SEES_US =
  'Live seat utilization and aggregate outcomes, plus an exportable compliance pack documenting the severance obligation was met — never an individual’s grade or whether they used the product. That boundary is contractual.'

export const COMPETITOR_COMPARISONS: CompetitorComparison[] = [
  {
    slug: 'lhh',
    name: 'LHH',
    shortName: 'LHH',
    metaTitle: 'NextChapter vs. LHH — outplacement comparison',
    metaDescription:
      'An honest, two-sided comparison of NextChapter and LHH outplacement — pricing, reporting, what participants keep, and when LHH is genuinely the better call.',
    bestForSummary:
      'Per the Master Build Script’s own pricing table, LHH’s outplacement spans the mid-level tier (grouped there with Randstad RiseSmart, roughly $3,500–$7,000 per person) up through executive-tier programs (roughly $8,000–$15,000+ per person, 6–12 months). LHH is one of the largest, most established names in the category — the reflexive choice for a multi-country reduction or an executive-tier program where global reach and brand recognition matter most.',
    pricingRangeLabel: 'Roughly $3,500–$7,000 (mid-level) to $8,000–$15,000+ (executive), per person',
    pricingRangeCaveat:
      'These are the Master Build Script’s own estimates (§A2.1), not a cited, current source — see the substantiation file before relying on this for a real deal.',
    concessionParagraph:
      'If you’re running a 12-country reduction, use LHH. If you’re running a US reduction and want your people to walk away with proof they keep, not just promises, that’s us.',
    isConcessionVerbatim: false,
    whereTheyMayBeStrongerBullets: WHERE_THEY_MAY_BE_STRONGER,
    featureComparison: FEATURE_COMPARISON,
    whatParticipantsKeep: {
      us: WHAT_PARTICIPANTS_KEEP_US,
      them:
        'Varies by contract and vendor. Ask directly what the participant keeps and for how long after the contract ends — it’s question 7 on our RFP template.',
    },
    whatTheEmployerSees: {
      us: WHAT_EMPLOYER_SEES_US,
      them:
        'Typically periodic reporting rather than a live view, per the Master Build Script’s assessment of the category. Ask about reporting latency directly — it’s question 2 on our RFP template.',
    },
    whenToChooseThemInstead: [
      'You’re running a reduction across multiple countries and need local labor-law compliance in each one.',
      'Your workforce or contract specifically requires in-person, on-site delivery.',
      'Procurement requires an established, long-track-record vendor with an extensive reference list already on file.',
    ],
  },
  {
    slug: 'randstad-risesmart',
    name: 'Randstad RiseSmart',
    shortName: 'RiseSmart',
    metaTitle: 'NextChapter vs. Randstad RiseSmart — outplacement comparison',
    metaDescription:
      'An honest, two-sided comparison of NextChapter and Randstad RiseSmart outplacement — pricing, reporting, what participants keep, and when RiseSmart is genuinely the better call.',
    bestForSummary:
      'The Master Build Script’s pricing table groups Randstad RiseSmart with LHH at the mid-level tier — roughly $3,500–$7,000 per person. As part of Randstad, one of the largest global staffing organizations, RiseSmart is a common choice for buyers who already have or want a broader Randstad relationship, or who want a well-known staffing brand behind a mid-level program.',
    pricingRangeLabel: 'Roughly $3,500–$7,000 per person (grouped with LHH at this tier in the source table)',
    pricingRangeCaveat:
      'The Master Build Script (§A2.1) groups LHH and Randstad RiseSmart together at this price tier and gives no RiseSmart-specific breakout. Treat this as directional, not a cited, RiseSmart-specific figure — see the substantiation file.',
    concessionParagraph:
      'If you’re running a multi-country reduction and want a global staffing brand behind the program, Randstad RiseSmart is a reasonable, defensible choice. If you’re running a US reduction and want your people to walk away with proof they keep, not just promises, that’s us.',
    isConcessionVerbatim: false,
    whereTheyMayBeStrongerBullets: WHERE_THEY_MAY_BE_STRONGER,
    featureComparison: FEATURE_COMPARISON,
    whatParticipantsKeep: {
      us: WHAT_PARTICIPANTS_KEEP_US,
      them:
        'Varies by contract and vendor. Ask directly what the participant keeps and for how long after the contract ends — it’s question 7 on our RFP template.',
    },
    whatTheEmployerSees: {
      us: WHAT_EMPLOYER_SEES_US,
      them:
        'Typically periodic reporting rather than a live view, per the Master Build Script’s assessment of the category. Ask about reporting latency directly — it’s question 2 on our RFP template.',
    },
    whenToChooseThemInstead: [
      'You already run a broader Randstad staffing or RPO relationship and want outplacement bundled into it.',
      'You’re running a reduction across multiple countries and need local labor-law compliance in each one.',
      'Procurement requires an established, global staffing brand with an extensive reference list already on file.',
    ],
  },
  {
    slug: 'careerminds',
    name: 'Careerminds',
    shortName: 'Careerminds',
    metaTitle: 'NextChapter vs. Careerminds — outplacement comparison',
    metaDescription:
      'An honest, two-sided comparison of NextChapter and Careerminds outplacement — pricing, reporting, what participants keep, and when a virtual-first provider is genuinely the better call.',
    bestForSummary:
      'The Master Build Script’s pricing table groups Careerminds with INTOO as "virtual-first" providers, roughly $1,000–$3,000 per person — the lowest-cost tier in the category. Careerminds is a reasonable pick for a buyer whose primary constraint is the lowest possible sticker price and who doesn’t need a durable candidate artifact or a dedicated recruiter relationship.',
    pricingRangeLabel: 'Roughly $1,000–$3,000 per person (grouped with INTOO in the source table)',
    pricingRangeCaveat:
      'The Master Build Script (§A2.1) groups Careerminds and INTOO together under "virtual-first" and gives no Careerminds-specific breakout. Treat this as directional, not a cited, Careerminds-specific figure — see the substantiation file.',
    concessionParagraph:
      'If your primary constraint is the lowest possible sticker price and you don’t need coaching depth, a dedicated recruiter relationship, or a durable artifact the participant keeps, a virtual-first low-cost provider like Careerminds is worth a look. If you want your people to walk away with proof they keep, not just promises, at a price that still undercuts the mid-level tier, that’s us.',
    isConcessionVerbatim: false,
    whereTheyMayBeStrongerBullets: WHERE_THEY_MAY_BE_STRONGER,
    featureComparison: FEATURE_COMPARISON,
    whatParticipantsKeep: {
      us: WHAT_PARTICIPANTS_KEEP_US,
      them:
        'Varies by contract and vendor. Ask directly what the participant keeps and for how long after the contract ends — it’s question 7 on our RFP template.',
    },
    whatTheEmployerSees: {
      us: WHAT_EMPLOYER_SEES_US,
      them:
        'Varies by vendor. Ask about reporting latency directly — it’s question 2 on our RFP template.',
    },
    whenToChooseThemInstead: [
      'Budget is the dominant constraint and the program can be entirely virtual.',
      'You need the lowest possible per-seat list price and coaching depth is not a priority.',
      'Your workforce doesn’t need in-person delivery at any point.',
    ],
  },
  {
    slug: 'intoo',
    name: 'INTOO',
    shortName: 'INTOO',
    metaTitle: 'NextChapter vs. INTOO — outplacement comparison',
    metaDescription:
      'An honest, two-sided comparison of NextChapter and INTOO outplacement — pricing, reporting, what participants keep, and when a virtual-first provider is genuinely the better call.',
    bestForSummary:
      'The Master Build Script’s pricing table groups INTOO with Careerminds as "virtual-first" providers, roughly $1,000–$3,000 per person — the lowest-cost tier in the category. INTOO is a reasonable pick for a buyer whose primary constraint is the lowest possible sticker price and who doesn’t need a durable candidate artifact or a dedicated recruiter relationship.',
    pricingRangeLabel: 'Roughly $1,000–$3,000 per person (grouped with Careerminds in the source table)',
    pricingRangeCaveat:
      'The Master Build Script (§A2.1) groups INTOO and Careerminds together under "virtual-first" and gives no INTOO-specific breakout. Treat this as directional, not a cited, INTOO-specific figure — see the substantiation file.',
    concessionParagraph:
      'If your primary constraint is the lowest possible sticker price and you don’t need coaching depth, a dedicated recruiter relationship, or a durable artifact the participant keeps, a virtual-first low-cost provider like INTOO is worth a look. If you want your people to walk away with proof they keep, not just promises, at a price that still undercuts the mid-level tier, that’s us.',
    isConcessionVerbatim: false,
    whereTheyMayBeStrongerBullets: WHERE_THEY_MAY_BE_STRONGER,
    featureComparison: FEATURE_COMPARISON,
    whatParticipantsKeep: {
      us: WHAT_PARTICIPANTS_KEEP_US,
      them:
        'Varies by contract and vendor. Ask directly what the participant keeps and for how long after the contract ends — it’s question 7 on our RFP template.',
    },
    whatTheEmployerSees: {
      us: WHAT_EMPLOYER_SEES_US,
      them:
        'Varies by vendor. Ask about reporting latency directly — it’s question 2 on our RFP template.',
    },
    whenToChooseThemInstead: [
      'Budget is the dominant constraint and the program can be entirely virtual.',
      'You need the lowest possible per-seat list price and coaching depth is not a priority.',
      'Your workforce doesn’t need in-person delivery at any point.',
    ],
  },
]

export const WHERE_THEY_MAY_BE_STRONGER_NOTE = WHERE_THEY_MAY_BE_STRONGER_DISCLAIMER

export function getComparison(slug: string): CompetitorComparison | undefined {
  return COMPETITOR_COMPARISONS.find((c) => c.slug === slug)
}
