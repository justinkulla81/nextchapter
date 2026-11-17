// Content for the Program workspace's demo tabs (learning and partners,
// upskilling, future skills, rapid response, benefits, attract). Pure data and
// pure functions, no database: the screens in src/components/higher-ed/
// screens-hub-program.tsx join it to real regional data (colleges, WARN
// notices) and to the sample companies. Anything invented here is shown as
// "Sample" in the UI; the benefit descriptions are general and say to confirm
// local details with the workforce board.

import { createHash } from 'crypto'

export const rand01 = (seed: string, salt: string) => createHash('sha256').update(`${seed}:${salt}`).digest().readUInt32BE(0) / 0xffffffff
export const randInt = (seed: string, salt: string, min: number, max: number) => min + Math.floor(rand01(seed, salt) * (max - min + 1))

// ---------------------------------------------------------------------------
// Learning lanes: one picture of exec ed, higher ed, retraining and upskilling.

export type LaneKey = 'upskill' | 'retrain' | 'execed' | 'degree'
export const LANES: { key: LaneKey; label: string; who: string; length: string }[] = [
  { key: 'upskill', label: 'Upskilling', who: 'People who keep their job and need new skills, such as AI tools.', length: 'Days to weeks' },
  { key: 'retrain', label: 'Retraining', who: 'People changing field after a layoff or a shrinking occupation.', length: 'Weeks to months' },
  { key: 'execed', label: 'Executive education', who: 'Senior and mid-career leaders, often paid for by an employer.', length: 'Days to months' },
  { key: 'degree', label: 'Degrees and certificates', who: 'Credit-bearing programs: new degrees, completions, graduate study.', length: 'Months to years' },
]

// Demand: skills employers ask for. Counts are sample; the skill list is
// what the job-spec tool below flags most often.
export const DEMAND_SKILLS: { skill: string; lane: LaneKey; matches: string[] }[] = [
  { skill: 'AI tools for everyday work', lane: 'upskill', matches: ['ai', 'artificial intelligence', 'data science'] },
  { skill: 'Data analysis and reporting', lane: 'upskill', matches: ['data', 'analytics', 'statistics'] },
  { skill: 'Process automation', lane: 'retrain', matches: ['automation', 'engineering', 'computer'] },
  { skill: 'Project and change management', lane: 'execed', matches: ['management', 'business', 'leadership'] },
  { skill: 'Cybersecurity and risk', lane: 'retrain', matches: ['cyber', 'information', 'computer'] },
  { skill: 'Financial planning with AI', lane: 'degree', matches: ['finance', 'accounting', 'business'] },
]

// ---------------------------------------------------------------------------
// Rapid response: the same steps for every layoff, WARN-filed or not.

export const RESPONSE_STEPS = [
  { key: 'notice', label: 'Notice received', detail: 'WARN filing or a member company tells you.' },
  { key: 'employer', label: 'Employer contacted', detail: 'Agree on dates for sessions on site or online.' },
  { key: 'session', label: 'Benefits session held', detail: 'Unemployment, health coverage, training funds, in one hour.' },
  { key: 'seats', label: 'Career seats opened', detail: 'Everyone affected gets free access to NextChapter.' },
  { key: 'hiring', label: 'Hiring employers matched', detail: 'Member companies that are hiring see the group’s skills, with consent.' },
  { key: 'training', label: 'Training offered', detail: 'Partner programs open to the group, paid for where funds allow.' },
] as const
export type ResponseStepKey = (typeof RESPONSE_STEPS)[number]['key']

// ---------------------------------------------------------------------------
// Benefits. General and accurate; the workforce board confirms local rules.

export type Benefit = { group: string; name: string; what: string; how: string }
export const BENEFITS: Benefit[] = [
  { group: 'Income', name: 'Unemployment insurance', what: 'Weekly payments while someone looks for work. Amount and length depend on the state.', how: 'File with the state unemployment office the first week out of work.' },
  { group: 'Income', name: 'Severance and final pay guidance', what: 'What to ask for, what to sign, and what a WARN notice does and does not promise.', how: 'Covered in the benefits session.' },
  { group: 'Health', name: 'Health coverage after a layoff', what: 'Keep the employer plan through COBRA, or enroll in a marketplace plan during the special enrollment window after losing coverage.', how: 'Learn the deadlines in the session; a person can choose either.' },
  { group: 'Training', name: 'Dislocated worker training funds', what: 'The local workforce board can pay for approved training through an individual training account, with career coaching.', how: 'Sign up at the American Job Center or through the board.' },
  { group: 'Training', name: 'On-the-job training wage support', what: 'A hiring employer can be reimbursed for part of a new hire’s wages while they learn the role.', how: 'The board matches hiring employers and eligible people.' },
  { group: 'Career', name: 'Free career support seats', what: 'Résumé scoring, AI exposure for their job title, local jobs ranked first, and an AI career coach.', how: 'Every person in a layoff gets a seat from the pool.' },
  { group: 'Career', name: 'Employer introductions', what: 'Member companies that are hiring see a short profile for people who chose to share one.', how: 'The person chooses; nothing is shared by default.' },
  { group: 'Health', name: 'Health coverage (a marketplace plan or Medicaid)', what: 'For people without job coverage: a marketplace plan, with help paying based on income, or Medicaid where they qualify.', how: 'The program shares the enrollment links.' },
  { group: 'Income', name: 'Free nonprofit credit counseling and emergency assistance', what: 'A nonprofit credit counselor walks through debts and a budget at no cost; local agencies help with one-time emergencies.', how: 'Referred by the program; the person makes the call.' },
  { group: 'Training', name: 'First-job support from partner colleges', what: 'Career services, internships and employer introductions for students and recent graduates.', how: 'Through the partner college’s career center.' },
  { group: 'Childcare', name: 'Child care assistance', what: 'The state’s child care subsidy helps pay for care, based on income and family size.', how: 'Apply through the state program; the program shares the link.' },
  { group: 'Childcare', name: 'Supportive services during training (childcare)', what: 'Workforce boards can pay for childcare and transportation while someone is in approved training.', how: 'Asked for with the board’s career coach.' },
  { group: 'Housing', name: 'Rental and mortgage assistance, and a free housing counselor', what: 'Local help with rent or a mortgage during a job loss, and HUD-approved housing counselors who advise at no cost.', how: 'The program lists the local agencies.' },
  { group: 'Transportation', name: 'Transportation help (transit and supportive services)', what: 'Getting to interviews, training and a new job: transit options and, during approved training, supportive services.', how: 'Asked for with the program or the board’s career coach.' },
  { group: 'Legal', name: 'Free legal help on work authorization and benefits', what: 'Legal aid on benefits, taxes and work authorization questions, and free tax preparation for eligible incomes.', how: 'The program lists local legal aid and tax sites.' },
  { group: 'Moving here', name: 'Relocation help', what: 'Housing, schools, a partner job search and a welcome network for people moving to the region.', how: 'Through the program’s relocation concierge.' },
  { group: 'Moving here', name: 'Relocation help (if your region offers it)', what: 'Where a region or state has an incentive for new households, it is listed here with the income rules.', how: 'Set by the program; the demo leaves it empty.' },
]

// ---------------------------------------------------------------------------
// Attract: where workers could come from. Names are real metros; the counts
// are sample, shown as sample.

export const ORIGINS: { metro: string; reason: string }[] = [
  { metro: 'Nashville, TN', reason: 'High housing costs; many white-collar roles.' },
  { metro: 'Chicago, IL', reason: 'Large layoff base; higher cost of living.' },
  { metro: 'Atlanta, GA', reason: 'Large professional workforce; rising costs.' },
  { metro: 'Charlotte, NC', reason: 'Finance and insurance talent.' },
  { metro: 'Dallas, TX', reason: 'Corporate relocations and layoffs.' },
  { metro: 'Remote workers anywhere', reason: 'Keep the job, change the address.' },
  { metro: 'Alumni of local colleges now elsewhere', reason: 'Already know the place.' },
]

export const FUNNEL = ['Saw a campaign', 'Checked local jobs', 'Made a profile', 'Interviewed here', 'Moved here'] as const

// ---------------------------------------------------------------------------
// Future skills in job specs. A rule-based reading of a pasted job description:
// no model call, nothing leaves the page. It is a starting point for a hiring
// manager, not a ruling on a role.

type Family = { key: string; label: string; test: RegExp; adds: { skill: string; line: string; lane: LaneKey }[] }
const FAMILIES: Family[] = [
  {
    key: 'finance',
    label: 'Finance and accounting',
    test: /\b(account|financ|audit|controller|fp&a|budget|payroll|treasury)/i,
    adds: [
      { skill: 'AI-assisted forecasting and reconciliation', line: 'Uses AI tools to speed up reconciliation and forecasting, and checks the output.', lane: 'upskill' },
      { skill: 'Data analysis (SQL, spreadsheets at scale)', line: 'Builds repeatable reports from raw data, not by hand each month.', lane: 'upskill' },
    ],
  },
  {
    key: 'hr',
    label: 'People and HR',
    test: /\b(human resources|\bhr\b|recruit|talent|benefits administrator|people operations)/i,
    adds: [
      { skill: 'Skills-based hiring and job design', line: 'Writes roles around skills, with AI tool use stated, so a wider range of people can qualify.', lane: 'upskill' },
      { skill: 'Responsible AI use with people data', line: 'Knows what employee data can and cannot go into an AI tool.', lane: 'upskill' },
    ],
  },
  {
    key: 'marketing',
    label: 'Marketing and communications',
    test: /\b(market|brand|content|communicat|social media|public relations|copywrit)/i,
    adds: [
      { skill: 'AI-assisted content workflows', line: 'Drafts and edits with AI tools, keeps the brand voice, fact-checks before publishing.', lane: 'upskill' },
      { skill: 'Measurement and experimentation', line: 'Runs small tests and reads the results.', lane: 'upskill' },
    ],
  },
  {
    key: 'operations',
    label: 'Operations and logistics',
    test: /\b(operation|logistic|supply chain|warehouse|procure|dispatch|plant|production)/i,
    adds: [
      { skill: 'Process automation and workflow tools', line: 'Maps a process and automates the repeated steps.', lane: 'retrain' },
      { skill: 'Data-driven planning', line: 'Uses data and AI-assisted forecasts to plan capacity and schedules.', lane: 'upskill' },
    ],
  },
  {
    key: 'tech',
    label: 'Technology and data',
    test: /\b(software|developer|engineer|data scien|analytics|it support|cyber|devops|systems)/i,
    adds: [
      { skill: 'Working with AI coding and data tools', line: 'Uses AI assistants in daily work and reviews what they produce.', lane: 'upskill' },
      { skill: 'Security and governance of AI systems', line: 'Knows the risks of putting company data into AI tools.', lane: 'retrain' },
    ],
  },
  {
    key: 'management',
    label: 'Management and leadership',
    test: /\b(manager|director|vice president|\bvp\b|head of|lead\b|supervis)/i,
    adds: [
      { skill: 'Leading teams that use AI', line: 'Sets team rules for AI use and measures what changed.', lane: 'execed' },
      { skill: 'Change management', line: 'Takes a team through a new tool or process and keeps results steady.', lane: 'execed' },
    ],
  },
]

const GENERAL_ADDS: { skill: string; line: string; lane: LaneKey }[] = [
  { skill: 'AI tool fluency', line: 'Uses AI tools for drafting, research and analysis, and reviews the output before relying on it.', lane: 'upskill' },
  { skill: 'Judgment on AI output', line: 'Knows when an AI answer is wrong or risky and escalates.', lane: 'upskill' },
]

// Tasks AI tools already help with. The spec should say how the role uses
// them, not list the task as if nothing changed.
const TASK_FLAGS: { test: RegExp; phrase: string; note: string }[] = [
  { test: /data entry|enter data|keying/i, phrase: 'Data entry', note: 'Largely automated now. Describe the checking and exceptions work instead.' },
  { test: /prepare (monthly |weekly |regular )?reports?|compile reports?|manual reports?/i, phrase: 'Preparing routine reports', note: 'Often automated. Ask for the analysis and the recommendation, not the assembly.' },
  { test: /schedul(e|ing) meetings|calendar management/i, phrase: 'Scheduling', note: 'Assistant tools do most of this. Keep it only if it is a real part of the day.' },
  { test: /draft(ing)? (correspondence|emails?|letters?)|write (routine )?(emails?|memos?)/i, phrase: 'Drafting routine messages', note: 'AI drafts these. Ask for judgment, tone and approval instead.' },
  { test: /summariz|transcrib|take notes/i, phrase: 'Summaries and notes', note: 'AI tools do first drafts. Ask for accuracy review.' },
  { test: /research (and|&) (compile|summar)|literature|market research/i, phrase: 'First-pass research', note: 'AI speeds up the first pass. Ask for source checking and a point of view.' },
]

export type SpecReading = {
  family: string | null
  tasks: { phrase: string; note: string }[]
  adds: { skill: string; line: string; lane: LaneKey }[]
  wording: string[]
  alreadyMentionsAi: boolean
}

export function analyzeJobSpec(text: string): SpecReading {
  const t = text.trim()
  const fam = FAMILIES.map((f) => ({ f, n: (t.match(new RegExp(f.test.source, 'gi')) ?? []).length })).sort((a, b) => b.n - a.n)[0]
  const family = fam && fam.n > 0 ? fam.f : null
  const alreadyMentionsAi = /\b(ai|artificial intelligence|machine learning|copilot|chatgpt|generative|automation)\b/i.test(t)
  const tasks = TASK_FLAGS.filter((x) => x.test.test(t)).map(({ phrase, note }) => ({ phrase, note }))
  const adds = [...(family?.adds ?? []), ...GENERAL_ADDS].filter((a) => !(alreadyMentionsAi && a.skill === 'AI tool fluency')).slice(0, 4)
  const wording: string[] = []
  if (/\b(bachelor|degree)\b.*\b(required|must)\b|\b(required|must)\b.*\b(bachelor|degree)\b/i.test(t)) wording.push('A degree is listed as required. Consider "or equivalent experience": it widens the pool, including people laid off from similar roles.')
  if (/\b(\d{1,2})\+?\s*years/i.test(t) && /\b(1[0-9])\+?\s*years/i.test(t)) wording.push('A long years-of-experience minimum can screen out people who have the skills. State the skills and results you need instead.')
  if (/rockstar|ninja|guru|digital native/i.test(t)) wording.push('Wording like "rockstar" or "digital native" narrows who applies and reads as age-coded. Say what the person will do.')
  if (!alreadyMentionsAi) wording.push('The spec does not mention AI tools at all. If the team uses them, say how.')
  return { family: family?.label ?? null, tasks, adds, wording, alreadyMentionsAi }
}

export const SAMPLE_SPEC = `Senior Financial Analyst

We are looking for a Senior Financial Analyst to join our finance team in Louisville.

Responsibilities
- Prepare monthly reports and compile budget variance packages by hand from the ledger
- Enter data into our planning system and reconcile accounts at month end
- Draft correspondence to department heads about their budgets
- Summarize results for the controller

Requirements
- Bachelor's degree in accounting or finance required
- 10+ years of experience in financial analysis
- Advanced Excel`
