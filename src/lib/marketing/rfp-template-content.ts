// Outplacement RFP Template + Vendor Evaluation Scorecard content.
// Partners Master Build Script §D2.2: "the highest-leverage marketing
// asset in the plan... Make them genuinely useful and vendor-neutral in
// tone." The eight questions below are reproduced near-verbatim from that
// section — see docs/COMPETITIVE_CLAIMS_SUBSTANTIATION.md row 18.
//
// Deliberately vendor-neutral: nothing here names NextChapter or any
// competitor. It's a real evaluation tool a buyer could run against any
// vendor, including us.

export interface RfpQuestion {
  question: string
  /** Why this question matters — vendor-neutral framing, not a pitch. */
  whyItMatters: string
}

export const RFP_QUESTIONS: RfpQuestion[] = [
  {
    question: 'What written deliverable does the participant retain after the contract ends?',
    whyItMatters:
      'Some programs leave the participant with nothing but a lapsed login once the contract term ends. Ask for the specific artifact — resume, references, assessment results — and whether the participant keeps access to it independent of the employer relationship.',
  },
  {
    question: 'What is your reporting latency — real time, monthly, or quarterly?',
    whyItMatters:
      'Reporting cadence determines whether HR and finance can act on utilization data during the program or only after it. A quarterly PDF means three months can pass before anyone notices a cohort isn\'t engaging.',
  },
  {
    question: 'Can we see utilization the day a cohort is enrolled?',
    whyItMatters:
      'A related but distinct question from latency — some vendors report periodically but still can\'t show day-one enrollment status on demand. Ask to see the actual reporting view, not a description of it.',
  },
  {
    question: 'What percentage of participants complete a structured reference process?',
    whyItMatters:
      'References are one of the most concretely useful things a program can produce for a participant\'s next search. Ask for a completion rate, not just whether the capability exists.',
  },
  {
    question: 'What documentation do you provide proving the severance obligation was met?',
    whyItMatters:
      'Legal and HR need to be able to demonstrate, per employee, that the outplacement benefit specified in a severance agreement was actually delivered. Ask to see a sample compliance document before signing.',
  },
  {
    question: 'What is the participant-to-coach ratio at each tier?',
    whyItMatters:
      'Caseload size is the single biggest driver of how much individual attention a participant actually gets. Ask for the ratio at every tier you\'re considering, not just the top one.',
  },
  {
    question: 'What happens to the participant\'s data and access at contract end?',
    whyItMatters:
      'This determines whether the program is a service the employer rents for a term or something durable the participant keeps. Ask specifically what is deleted, what is retained, and who controls that decision.',
  },
  {
    question: 'Can you provide time-to-placement benchmarks by function and level?',
    whyItMatters:
      'Ask every vendor for this, including us. Be skeptical of any placement-speed or success-rate number that isn\'t accompanied by a clear, disclosed methodology — sample size, definition of "placed," and how outcomes were measured. A vendor that can\'t show its methodology can\'t substantiate the number.',
  },
]

export const SCORECARD_CRITERIA = [
  { label: 'Deliverable retention', description: 'What the participant keeps, and for how long.' },
  { label: 'Reporting latency', description: 'Real time, monthly, or quarterly.' },
  { label: 'Day-one utilization visibility', description: 'Can you see enrollment activity the day it happens.' },
  { label: 'Reference completion rate', description: 'Percentage completing a structured reference process.' },
  { label: 'Compliance documentation', description: 'Proof the severance obligation was met, per employee.' },
  { label: 'Participant-to-coach ratio', description: 'By tier, not just the top one.' },
  { label: 'Data and access at contract end', description: 'What\'s deleted, what\'s retained, who decides.' },
  { label: 'Placement benchmarks and methodology', description: 'Whether any claim is disclosed with a real methodology.' },
]
