/**
 * The requirements profile: what the document reader pulls out of an RFP, RFQ, RFI or grant notice.
 * Every group carries `quote`, the sentence it came from, so a verdict can be checked against the document.
 * Pure (zod schema and types only).
 */
import { z } from 'zod'

const yesNo = z.enum(['YES', 'NO', 'UNCLEAR'])
const quote = z.string().nullable().describe('The sentence in the document this came from, verbatim, or null if not stated.')

const lineEligibility = z.object({
  eligible: yesNo.describe('Could this service be what is bought or funded here (as prime or as a named sub)?'),
  why: z.string().describe('One plain sentence.'),
})

export const profileSchema = z.object({
  isSolicitation: z.boolean().describe('False when the document is not something anyone applies or bids to: a form, a Q&A answer, a guidance letter, a listing page with nothing open, a past award.'),
  kind: z.enum(['RFP', 'RFQ', 'RFI', 'GRANT', 'FORECAST', 'ACCELERATOR', 'CONTEST', 'TRAINING_LIST', 'OTHER']),
  status: z.enum(['OPEN', 'CLOSED', 'UNCLEAR']),
  title: z.string(),
  issuer: z.string().nullable(),
  state: z.string().nullable().describe('Two-letter state the work is in; null if national.'),
  summary: z.string().describe('Two sentences: what is being bought or funded, for whom.'),

  dates: z.object({
    due: z.string().nullable().describe('ISO date (YYYY-MM-DD) proposals are due; null if rolling or not stated.'),
    dueText: z.string().nullable().describe('As written, with time and time zone.'),
    questionsDue: z.string().nullable().describe('ISO date.'),
    preBidConference: z.string().nullable().describe('Date, and whether attendance is required.'),
    rolling: z.boolean(),
  }),
  submission: z.object({
    method: z.string().nullable().describe('Email address, portal name and link, or mail address.'),
    format: z.string().nullable().describe('File format, signatures, subject line, copies.'),
    pageLimit: z.string().nullable(),
  }),

  whoCanApply: z.object({
    applicantTypes: z.array(z.string()).describe('As stated: e.g. nonprofits, for-profit firms, colleges, local governments, individuals.'),
    forProfitAllowed: z.enum(['YES', 'IMPLICIT', 'NO', 'UNCLEAR']).describe('IMPLICIT when open to "consultants or firms" or "vendors" without saying for-profit.'),
    collegesOnly: z.boolean().describe('Only colleges or universities (or school districts) can apply or receive the money.'),
    individualsOnly: z.boolean(),
    quote,
  }),

  trainingList: z.object({
    required: yesNo.describe('Must the provider be on an Eligible Training Provider List (ETPL) or another approved-provider or vendor list to be paid?'),
    listName: z.string().nullable(),
    howToGetOn: z.string().nullable().describe('What the document says about getting on the list, if anything.'),
    quote,
  }),

  subcontracting: z.object({
    allowed: z.enum(['YES', 'LIMITED', 'NO', 'UNCLEAR']),
    limit: z.string().nullable().describe('e.g. "up to 25% of the award".'),
    expectedPrimes: z.array(z.string()).describe('Who is expected to apply or lead, by type or name.'),
    quote,
  }),

  place: z.object({
    inStateRequired: z.boolean().describe('Bidder must be located or headquartered in the state.'),
    registrationRequired: z.string().nullable().describe('State vendor or Secretary of State registration required, as stated.'),
    inStatePreference: z.boolean(),
    regionalKnowledgeScored: z.boolean(),
    onSiteRequired: z.boolean().describe('Staff must work on site, run a job center, or teach in person.'),
    remoteAllowed: yesNo,
    quote,
  }),

  serviceLines: z.object({
    training: lineEligibility,
    software: lineEligibility,
    coaching: lineEligibility,
  }),

  trainees: z.object({
    who: z.string().nullable().describe('The people served or trained: age, status (dislocated, youth, incumbent), occupations, level.'),
    includesProfessionals: yesNo.describe('Are white-collar, managerial or professional workers among them?'),
    youthOnly: z.boolean(),
    count: z.string().nullable().describe('Number of participants, if stated.'),
  }),
  trainingSubject: z.string().nullable().describe('What is being trained or delivered: skills, occupations, credentials.'),
  results: z.object({
    measures: z.array(z.string()).describe('Outcome measures and targets as stated (e.g. "employment Q2 after exit 80.5%").'),
    payTiedToResults: z.boolean(),
  }),

  requirements: z.object({
    yearsInBusinessMin: z.number().nullable(),
    pastPerformanceRequired: z.string().nullable().describe('e.g. "2 years of WIOA youth outcomes".'),
    soc2: z.enum(['REQUIRED', 'PREFERRED', 'NOT_MENTIONED']),
    securityOther: z.string().nullable().describe('Other security or privacy standards named (NIST, FedRAMP, state standards, HIPAA, FERPA).'),
    accessibility: z.string().nullable().describe('WCAG level, Section 508, VPAT.'),
    insurance: z.array(z.object({ line: z.string(), amount: z.string() })),
    certificationsRequired: z.array(z.string()).describe('Licenses or business certifications required.'),
    bonusCertifications: z.array(z.string()).describe('Certifications that earn points (HUB, MBE...).'),
    samUeiRequired: z.boolean(),
    auditRequired: z.boolean().describe('Single audit or audited financial statements required.'),
    matchRequired: z.string().nullable().describe('Cost share or match, as stated; null if none.'),
    otherKnockouts: z.array(z.string()).describe('Any other condition that would disqualify a bidder (bankruptcy, tax standing, background checks...).'),
    quote,
  }),

  money: z.object({
    contractType: z.string().nullable().describe('Fixed price, deliverable-based, per participant, hourly not-to-exceed, cost-reimbursement, grant.'),
    ceilingUsd: z.number().nullable().describe('Total available or not-to-exceed, in dollars.'),
    term: z.string().nullable(),
    paidAfterSpending: z.boolean().describe('Cost-reimbursement with no advance.'),
    rateCaps: z.string().nullable(),
    quote,
  }),

  incumbentsOrPastWinners: z.array(z.string()).describe('Vendors or providers the document names as current or past holders or winners.'),

  scoring: z.array(z.object({ criterion: z.string(), points: z.number().nullable() })),
  minimumScore: z.string().nullable(),

  responseComponents: z.array(z.object({
    name: z.string(),
    type: z.enum(['NARRATIVE', 'BUDGET', 'FORM', 'CERTIFICATION', 'REFERENCES', 'RESUMES', 'ATTACHMENT', 'OTHER']),
    pageLimit: z.string().nullable(),
    required: z.boolean(),
  })).describe('Every section, form and attachment the response must contain, in the order required.'),

  contact: z.object({ name: z.string().nullable(), email: z.string().nullable(), phone: z.string().nullable() }),
})

export type Profile = z.infer<typeof profileSchema>
