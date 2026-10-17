// The three AI work-sample types (AI-skills analysis, findings.md section 5 "proof map"):
// postings rarely ask for AI certificates; they ask for *demonstrated* AI use with a
// *measured* result. Each type has a short guided template, the checks from the proof map,
// and résumé bullet templates to copy. Pure and client-safe; tested in
// src/test/ai-work-samples.test.ts.
//
// Stored on WorkSample: sampleType, the template answers in aiDetails, and — for the
// automation type, which predates this — aiToolsUsed / beforeMetric / afterMetric.

export type AiSampleType = 'ai_workflow' | 'ai_policy' | 'ai_rag_eval'
export const AI_SAMPLE_TYPES: AiSampleType[] = ['ai_workflow', 'ai_policy', 'ai_rag_eval']

export function isAiSampleType(t: string | null | undefined): t is AiSampleType {
  return !!t && (AI_SAMPLE_TYPES as string[]).includes(t)
}

export interface AiSampleField {
  key: string
  label: string
  placeholder: string
  long?: boolean
}

export interface AiSampleCheck {
  key: string
  label: string
  /** The check that is "has a measured result" — weighted most in the evidence score. */
  metric?: boolean
}

export interface AiSampleSpec {
  type: AiSampleType
  label: string
  /** For whom and what to show, one or two sentences. */
  intro: string
  fields: AiSampleField[]
  checks: AiSampleCheck[]
  bullets: string[]
}

export const AI_SAMPLE_SPECS: Record<AiSampleType, AiSampleSpec> = {
  ai_workflow: {
    type: 'ai_workflow',
    label: 'AI automation with a before and after',
    intro: 'One real task in your own work that you automated or sped up with AI, and what changed. The most common AI ask in postings outside tech.',
    fields: [
      { key: 'task', label: 'The task', placeholder: 'For example: weekly variance commentary for 14 cost centers' },
      { key: 'aiToolsUsed', label: 'Tools you used', placeholder: 'For example: Microsoft Copilot in Excel, Power Automate' },
      {
        key: 'flow',
        label: 'How it works (the prompt or the steps)',
        placeholder: 'For example: export → Copilot prompt with our template → I review and edit → send',
        long: true,
      },
      { key: 'beforeMetric', label: 'Before', placeholder: 'For example: 6 hours a week' },
      { key: 'afterMetric', label: 'After', placeholder: 'For example: 1.5 hours a week' },
      { key: 'hoursSaved', label: 'Hours saved (per week or month)', placeholder: 'For example: 4.5 hours a week for a team of 3' },
      { key: 'reviewStep', label: 'How a person checks the output', placeholder: 'For example: I tie every number back to the ledger before it goes out' },
    ],
    checks: [
      { key: 'tool', label: 'Names the tool' },
      { key: 'measured', label: 'Has a measured before and after', metric: true },
      { key: 'review', label: 'Has a human-review step' },
      { key: 'flow', label: 'Shows the flow or prompt' },
    ],
    bullets: [
      'Built a [tool: Copilot / ChatGPT + Zapier] workflow for [task] that cut [hours/week or turnaround] from [X] to [Y] for a team of [N]; adopted by [N] colleagues.',
      'Used [AI tool] to [analyze / summarize / draft] [N] [contracts / tickets / survey responses] per [week], cutting review time [X%] with a human-review checklist that held error rates at [Y].',
      'Wrote a prompt library of [N] templates for [function]; [N]% of the team uses it weekly; [metric] improved [X].',
    ],
  },
  ai_policy: {
    type: 'ai_policy',
    label: 'AI policy or use-case portfolio',
    intro:
      'An AI acceptable-use policy, or 8–12 use cases scored on value, feasibility and risk with a 90-day plan, for a real or public company. What leadership and governance postings ask you to have done.',
    fields: [
      {
        key: 'framework',
        label: 'Framework you used',
        placeholder: 'For example: NIST AI RMF (Govern, Map, Measure, Manage), EU AI Act risk tiers, ISO/IEC 42001',
      },
      { key: 'scope', label: 'What it covers', placeholder: 'For example: 10 use cases across finance and HR, or the policy for all staff' },
      { key: 'owners', label: 'Owners', placeholder: 'For example: CFO owns finance use cases; Legal owns the intake review' },
      { key: 'metrics', label: 'Metrics you track', placeholder: 'For example: weekly active users, hours saved, incidents' },
      {
        key: 'riskControls',
        label: 'Risk controls',
        placeholder: 'For example: no client data in public tools; human sign-off on anything external; quarterly review',
        long: true,
      },
      { key: 'result', label: 'Measured result', placeholder: 'For example: 3 of 10 use cases piloted, 40 hours a month saved, 0 incidents' },
    ],
    checks: [
      { key: 'framework', label: 'Cites a framework' },
      { key: 'owners_metrics', label: 'Names owners and metrics' },
      { key: 'controls', label: 'Lists risk controls' },
      { key: 'measured', label: 'Has a measured result', metric: true },
    ],
    bullets: [
      'Led AI adoption for [org / N people]: [N] use cases piloted, [N] scaled; [N] hours/month saved; weekly active use went from [X%] to [Y%] in [N] months.',
      'Drafted and rolled out the [company] AI acceptable-use policy aligned to NIST AI RMF; set up an intake and risk review covering [N] tools with [0] incidents.',
      'Built the AI roadmap and business case for [function], [N] initiatives, $[X] projected savings; secured $[Y] budget.',
    ],
  },
  ai_rag_eval: {
    type: 'ai_rag_eval',
    label: 'RAG or agent project with an eval',
    intro:
      'A retrieval (RAG) assistant or a small agent on public data, with an evaluation set and the measured accuracy, on GitHub with a README. What builder postings ask for.',
    fields: [
      { key: 'what', label: 'What it does', placeholder: 'For example: answers questions over 2,000 pages of SEC filings' },
      { key: 'evalSize', label: 'Eval set size', placeholder: 'For example: 40 questions with checked answers' },
      { key: 'accuracy', label: 'Measured accuracy', placeholder: 'For example: 85% correct, up from 62% before re-ranking' },
      { key: 'costLatency', label: 'Cost and latency', placeholder: 'For example: $0.40 per 1,000 queries, p95 1.8 s' },
      { key: 'howToRun', label: 'How to run it', placeholder: 'For example: README with setup; `make eval` reruns the eval' },
    ],
    checks: [
      { key: 'runs', label: 'Repo link and how to run it' },
      { key: 'measured', label: 'Has an eval with a number', metric: true },
      { key: 'cost', label: 'Notes cost and latency' },
    ],
    bullets: [
      'Shipped a RAG assistant over [N] documents for [users]; answer accuracy [X%] on a [N]-question eval set; p95 latency [Y]s at $[Z] per 1,000 queries.',
      'Fine-tuned / prompted [model] for [task], improving [metric] from [X] to [Y]; deployed on [SageMaker / Vertex / Bedrock] serving [N] requests/day.',
      'Built an LLM evaluation harness ([N] test cases, regression-gated in CI) that caught [N] regressions before release.',
    ],
  },
}

export const AI_DETAIL_MAX_CHARS = 400

/** Template answers from a form (only the type's own fields, trimmed and capped). The three legacy columns stay separate. */
export function readAiDetails(type: AiSampleType, get: (key: string) => unknown): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of AI_SAMPLE_SPECS[type].fields) {
    if (f.key === 'aiToolsUsed' || f.key === 'beforeMetric' || f.key === 'afterMetric') continue
    const v = get(f.key)
    if (typeof v === 'string' && v.trim()) out[f.key] = v.trim().slice(0, AI_DETAIL_MAX_CHARS)
  }
  return out
}

export interface AiSampleInput {
  sampleType: string
  aiDetails?: unknown
  aiToolsUsed?: string | null
  beforeMetric?: string | null
  afterMetric?: string | null
  externalUrl?: string | null
  fileUrl?: string | null
}

const NUMBER = /\d/
const has = (v: unknown) => typeof v === 'string' && v.trim().length > 0
const num = (v: unknown) => has(v) && NUMBER.test(v as string)

export interface AiSampleCheckResult {
  type: AiSampleType
  passed: AiSampleCheck[]
  missing: AiSampleCheck[]
  hasMetric: boolean
}

/** Which of the proof-map checks a sample meets. Null for a non-AI sample. */
export function aiSampleChecks(s: AiSampleInput): AiSampleCheckResult | null {
  if (!isAiSampleType(s.sampleType)) return null
  const d = (s.aiDetails && typeof s.aiDetails === 'object' ? s.aiDetails : {}) as Record<string, unknown>
  const spec = AI_SAMPLE_SPECS[s.sampleType]
  const ok: Record<string, boolean> = {}
  if (s.sampleType === 'ai_workflow') {
    ok.tool = has(s.aiToolsUsed)
    ok.measured = (num(s.beforeMetric) && num(s.afterMetric)) || num(d.hoursSaved)
    ok.review = has(d.reviewStep)
    ok.flow = has(d.flow)
  } else if (s.sampleType === 'ai_policy') {
    ok.framework = has(d.framework)
    ok.owners_metrics = has(d.owners) && has(d.metrics)
    ok.controls = has(d.riskControls)
    ok.measured = num(d.result)
  } else {
    ok.runs = has(s.externalUrl) && has(d.howToRun)
    ok.measured = num(d.evalSize) && num(d.accuracy)
    ok.cost = num(d.costLatency)
  }
  const passed = spec.checks.filter((c) => ok[c.key])
  return { type: s.sampleType, passed, missing: spec.checks.filter((c) => !ok[c.key]), hasMetric: !!ok.measured }
}

// Evidence points (score.ts): an AI sample earns the work-sample base, then most of its extra
// for a measured result — that is what postings ask for ("demonstrated", "measurable").
export const AI_SAMPLE_POINTS = { metric: 8, perOtherCheck: 2 } as const

export function aiSamplePoints(check: Pick<AiSampleCheckResult, 'passed' | 'hasMetric'>, base: number): number {
  const others = check.passed.filter((c) => !c.metric).length
  return base + (check.hasMetric ? AI_SAMPLE_POINTS.metric : 0) + others * AI_SAMPLE_POINTS.perOtherCheck
}
