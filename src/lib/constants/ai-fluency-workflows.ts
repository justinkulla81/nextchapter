import { matchByFunction } from '@/lib/constants/ai-tools-by-function'

export interface AiWorkflow {
  title: string
  steps: string[]
}

// A guided, concrete task per function — something a candidate can actually
// run today with a general-purpose AI tool, not another "learn AI" course.
// Finishing one is exactly what the "Log an AI project" form on the Learning
// page is for.
const WORKFLOWS_BY_KEYWORD: { keywords: string[]; workflow: AiWorkflow }[] = [
  {
    keywords: ['finance', 'accounting', 'cfo', 'controller', 'fp&a'],
    workflow: {
      title: 'Build a variance-analysis narrative',
      steps: [
        'Paste a budget-vs-actual table into an AI chat and ask it to draft a 3-bullet variance narrative a CFO would actually read.',
        'Ask it to flag which variance is worth investigating first, and why.',
        'Have it rewrite the narrative twice — once terse for a slide, once detailed for an appendix.',
      ],
    },
  },
  {
    keywords: ['marketing', 'brand', 'growth', 'demand'],
    workflow: {
      title: 'Draft a campaign brief from a one-line idea',
      steps: [
        'Give an AI tool one sentence describing a campaign idea and ask for a full brief: audience, message, channels, success metric.',
        'Ask it to write 3 headline variants and critique which is strongest and why.',
        'Have it draft a one-paragraph recap as if the campaign already ran, to pressure-test the metric.',
      ],
    },
  },
  {
    keywords: ['sales', 'account executive', 'business development', 'revenue'],
    workflow: {
      title: 'Turn call notes into a follow-up sequence',
      steps: [
        'Paste rough notes from a (real or practice) sales call and ask for a same-day follow-up email.',
        'Ask for a 3-touch follow-up sequence for a prospect who goes quiet.',
        'Have it identify the single biggest objection in the notes and draft a response to it.',
      ],
    },
  },
  {
    keywords: ['product', 'pm ', 'product manager'],
    workflow: {
      title: 'Draft a one-pager from a rough idea',
      steps: [
        'Describe a feature idea in a few sentences and ask for a one-pager: problem, users affected, success metric, open questions.',
        'Ask it to list the 3 riskiest assumptions in the one-pager.',
        'Have it draft a short Slack message pitching the idea to an engineering lead.',
      ],
    },
  },
  {
    keywords: ['engineer', 'developer', 'software', 'technical'],
    workflow: {
      title: 'Pair-program a small utility end to end',
      steps: [
        'Pick a small real utility you need (a script, a CLI tool) and build it with an AI pair-programmer instead of from scratch.',
        'Ask it to write tests for the utility, then intentionally break something and have it debug from the failing test.',
        'Have it write the README as if a stranger needs to use this without asking you anything.',
      ],
    },
  },
  {
    keywords: ['human resources', 'hr', 'talent', 'recruit', 'people'],
    workflow: {
      title: 'Draft a role scorecard from a rough job description',
      steps: [
        'Paste a rough job description and ask for a structured scorecard: must-haves, nice-to-haves, interview questions per competency.',
        'Ask it to flag any requirement that reads as a proxy for something else (e.g. a degree requirement standing in for a skill).',
        'Have it draft a rejection email template that\'s specific and kind, not generic.',
      ],
    },
  },
  {
    keywords: ['operations', 'supply chain', 'logistics'],
    workflow: {
      title: 'Turn a messy process into a documented SOP',
      steps: [
        'Describe a process you know well, out loud or in bullet points, and ask for a clean step-by-step SOP.',
        'Ask it to identify the step most likely to break under volume and why.',
        'Have it draft a one-page training doc a new hire could follow without you in the room.',
      ],
    },
  },
  {
    keywords: ['legal', 'counsel', 'compliance'],
    workflow: {
      title: 'Summarize and redline a sample clause',
      steps: [
        'Paste a sample contract clause and ask for a plain-English summary of what it actually obligates each party to do.',
        'Ask it to flag the clause\'s biggest risk to the party you represent.',
        'Have it draft a redline with a brief rationale for each change.',
      ],
    },
  },
]

const GENERAL_WORKFLOW: AiWorkflow = {
  title: 'Turn a real work artifact into a proof point',
  steps: [
    'Pick something real you produced recently — a memo, an analysis, a plan — and ask an AI tool to help you tighten it into a one-page version.',
    'Ask it to identify the single weakest part of the argument and suggest a fix.',
    'Have it draft a 2-sentence summary you could use to describe this artifact in an interview.',
  ],
}

export function getAiWorkflowForFunction(primaryFunction: string | null): AiWorkflow {
  return (
    matchByFunction(primaryFunction, WORKFLOWS_BY_KEYWORD.map((g) => ({ keywords: g.keywords, value: g.workflow }))) ??
    GENERAL_WORKFLOW
  )
}
