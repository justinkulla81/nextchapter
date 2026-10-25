// Comparison-page content for /vs/[competitor].
//
// Rules (CLAUDE.md and docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md):
//  - Every statement about NextChapter carries a `VS-n` id that has a row in the
//    "Claims on /vs and /insights" table of the substantiation file, with its
//    evidence (a file in this repo) and a status of OK.
//  - Statements about a competitor are NOT made here. data/competitor-matrix/ holds
//    no researched cells for LHH, Randstad RiseSmart, Careerminds or INTOO (only
//    _sample.json), so there is no evidence URL and date to cite. Each competitor
//    column is therefore a question to put to the vendor, not a claim about it.
//  - No "only", "first", "no other", "unlike", "nobody", "best" or "leading", and no
//    prices. src/test/vs-insights-claims.test.ts fails on those words and on a
//    missing substantiation row.

export interface FeatureComparisonRow {
  aspect: string
  /** What NextChapter does. Substantiated by the row named in substantiationRef. */
  us: string
  /** A question to put to the vendor. Never a statement about the vendor. */
  ask: string
  /** `VS-n` id in docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md */
  substantiationRef: string
}

export interface CompetitorComparison {
  slug: 'lhh' | 'randstad-risesmart' | 'careerminds' | 'intoo'
  /** Full display name, used in copy and metadata. */
  name: string
  /** Short form for compact UI (table headers, buttons). */
  shortName: string
  metaTitle: string
  metaDescription: string
  /** One paragraph on how to approach this vendor in an evaluation. Makes no claim about the vendor's strengths. */
  bestForSummary: string
  /** Concede-and-redirect sentence. Conditional on the buyer's need; claims nothing about speed or outcomes. */
  concessionParagraph: string
  whereTheyMayBeStrongerBullets: string[]
  featureComparison: FeatureComparisonRow[]
  whatParticipantsKeep: { us: string; ask: string; substantiationRef: string }
  whatTheEmployerSees: { us: string; ask: string; substantiationRef: string }
  whenToChooseThemInstead: string[]
}

// Things a buyer should check with any vendor, ours included. Not claims about a named vendor.
const THINGS_TO_CHECK = [
  'Countries covered. If your reduction spans several countries, ask which ones the vendor serves directly and how local labor-law questions are handled.',
  'Coach capacity. If you need a large number of people supported on short notice, ask how many coaches are available and how quickly.',
  'Procurement requirements. If your process needs certifications, insurance, standard contract terms or references, ask each vendor, including us, for them.',
  'Vendor history. A longer-established vendor may matter to your internal risk review. Ask each vendor how long it has served employers like you.',
  'In-person services. If your contract or workforce needs workshops or local offices, ask each vendor whether it provides them.',
]

const THINGS_TO_CHECK_NOTE = 'These are questions for any outplacement vendor, not statements about this one. We have not verified any of them for this vendor, so ask it directly.'

const FEATURE_COMPARISON: FeatureComparisonRow[] = [
  {
    aspect: 'Reporting',
    us: 'A live roster of enrolled people and their status, aggregate outcomes for the program, and a printable quarterly review.',
    ask: 'What is your reporting latency: real time, monthly or quarterly? Can we see utilization the day a cohort is enrolled? (Questions 2 and 3 on our RFP template.)',
    substantiationRef: 'VS-1',
  },
  {
    aspect: 'What the person keeps after the seat ends',
    us: 'Their account, free, for as long as they want it, plus their profile, résumé, documents and search plan. Employer-paid coaching sessions and the recruiter network stop.',
    ask: 'What does the participant keep, and for how long, after the contract ends? What is deleted, and who decides? (Questions 1 and 7.)',
    substantiationRef: 'VS-2',
  },
  {
    aspect: 'What the employer sees about individuals',
    us: 'Aggregate outcomes with a minimum group size of 10. No individual’s activity, grade or usage is shown to the employer.',
    ask: 'What does the employer see about each participant? Is there a minimum group size on aggregate reporting?',
    substantiationRef: 'VS-3',
  },
  {
    aspect: 'Proof the obligation was met',
    us: 'A compliance pack documenting that the severance support was offered.',
    ask: 'What documentation do you provide that the severance obligation was met? Ask for a sample before signing. (Question 5.)',
    substantiationRef: 'VS-4',
  },
  {
    aspect: 'References',
    us: 'Structured reference collection from past managers and colleagues.',
    ask: 'What percentage of participants complete a structured reference process? (Question 4.)',
    substantiationRef: 'VS-5',
  },
  {
    aspect: 'How you buy it',
    us: 'Outplacement seats are enrolled one by one or by CSV, and bought on their own.',
    ask: 'Is outplacement sold on its own or as part of a wider staffing or RPO agreement?',
    substantiationRef: 'VS-6',
  },
]

const WHAT_PARTICIPANTS_KEEP_US = FEATURE_COMPARISON[1].us
const WHAT_EMPLOYER_SEES_US = 'A live roster, aggregate outcomes and a compliance pack. Aggregates need a group of at least 10, and no individual’s activity, grade or usage is shown.'

const PARTICIPANTS_KEEP_ASK = 'Ask what the participant keeps and for how long after the contract ends. It is question 7 on our RFP template.'
const EMPLOYER_SEES_ASK = 'Ask about reporting latency and what is shown about individuals. It is question 2 on our RFP template.'

function comparison(
  c: Pick<CompetitorComparison, 'slug' | 'name' | 'shortName' | 'bestForSummary' | 'concessionParagraph' | 'whenToChooseThemInstead'>,
): CompetitorComparison {
  return {
    ...c,
    metaTitle: `NextChapter vs. ${c.name}: outplacement comparison`,
    metaDescription: `A side-by-side look at NextChapter and ${c.name} outplacement: what we do, and the questions to ask ${c.name} on reporting, what participants keep and what the employer sees.`,
    whereTheyMayBeStrongerBullets: THINGS_TO_CHECK,
    featureComparison: FEATURE_COMPARISON,
    whatParticipantsKeep: { us: WHAT_PARTICIPANTS_KEEP_US, ask: PARTICIPANTS_KEEP_ASK, substantiationRef: 'VS-2' },
    whatTheEmployerSees: { us: WHAT_EMPLOYER_SEES_US, ask: EMPLOYER_SEES_ASK, substantiationRef: 'VS-3' },
  }
}

export const COMPETITOR_COMPARISONS: CompetitorComparison[] = [
  comparison({
    slug: 'lhh',
    name: 'LHH',
    shortName: 'LHH',
    bestForSummary:
      'LHH is an outplacement provider. This page sets out what NextChapter does and the questions to ask LHH, because we have not verified current details of its offering.',
    concessionParagraph:
      'If you are running a multi-country reduction, check which countries LHH covers directly. If you are running a US reduction and want your people to walk away with proof they keep, not just promises, that is us.',
    whenToChooseThemInstead: [
      'You are running a reduction across several countries and LHH confirms it covers each one.',
      'Your workforce or contract requires in-person, on-site delivery and LHH confirms it provides it.',
      'Procurement requires specific certifications or references and LHH supplies them.',
    ],
  }),
  comparison({
    slug: 'randstad-risesmart',
    name: 'Randstad RiseSmart',
    shortName: 'RiseSmart',
    bestForSummary:
      'Randstad RiseSmart is an outplacement provider. This page sets out what NextChapter does and the questions to ask Randstad RiseSmart, because we have not verified current details of its offering.',
    concessionParagraph:
      'If you already have a Randstad relationship or are running a multi-country reduction, ask Randstad RiseSmart what it covers. If you are running a US reduction and want your people to walk away with proof they keep, not just promises, that is us.',
    whenToChooseThemInstead: [
      'You already have a Randstad staffing or RPO relationship and want outplacement handled inside it.',
      'You are running a reduction across several countries and Randstad RiseSmart confirms it covers each one.',
      'Procurement requires specific certifications or references and Randstad RiseSmart supplies them.',
    ],
  }),
  comparison({
    slug: 'careerminds',
    name: 'Careerminds',
    shortName: 'Careerminds',
    bestForSummary:
      'Careerminds is an outplacement provider. This page sets out what NextChapter does and the questions to ask Careerminds, because we have not verified current details of its offering.',
    concessionParagraph:
      'If your main requirement is a fully virtual program, ask Careerminds how it delivers one. If you want your people to walk away with proof they keep, not just promises, that is us.',
    whenToChooseThemInstead: [
      'Your main requirement is a fully virtual program and Careerminds confirms it delivers one.',
      'Coaching depth is not a priority for your program.',
      'Your workforce does not need in-person delivery at any point.',
    ],
  }),
  comparison({
    slug: 'intoo',
    name: 'INTOO',
    shortName: 'INTOO',
    bestForSummary:
      'INTOO is an outplacement provider. This page sets out what NextChapter does and the questions to ask INTOO, because we have not verified current details of its offering.',
    concessionParagraph:
      'If your main requirement is a fully virtual program, ask INTOO how it delivers one. If you want your people to walk away with proof they keep, not just promises, that is us.',
    whenToChooseThemInstead: [
      'Your main requirement is a fully virtual program and INTOO confirms it delivers one.',
      'Coaching depth is not a priority for your program.',
      'Your workforce does not need in-person delivery at any point.',
    ],
  }),
]

export const WHERE_THEY_MAY_BE_STRONGER_NOTE = THINGS_TO_CHECK_NOTE

export function getComparison(slug: string): CompetitorComparison | undefined {
  return COMPETITOR_COMPARISONS.find((c) => c.slug === slug)
}
