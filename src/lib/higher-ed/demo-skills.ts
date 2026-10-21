// A function and a skills list for each fictional demo alum, so the AI skills panel on the
// Outcomes tab has a story: most people in finance, operations, marketing and sales show no
// AI skill yet, data and product people mostly do. Deterministic per index (same people every
// seed). Pure; tested in src/test/demo-skills.test.ts. Sample data only: never used for real members.

import { createHash } from 'crypto'

const FUNCTIONS: { fn: string; weight: number; skills: string[]; aiRate: number }[] = [
  { fn: 'Finance', weight: 18, skills: ['financial modeling', 'excel', 'budgeting', 'forecasting', 'gaap'], aiRate: 0.3 },
  { fn: 'Operations', weight: 16, skills: ['process improvement', 'supply chain', 'project management', 'excel', 'vendor management'], aiRate: 0.25 },
  { fn: 'Marketing', weight: 14, skills: ['content strategy', 'seo', 'brand management', 'google analytics', 'email marketing'], aiRate: 0.55 },
  { fn: 'Sales', weight: 12, skills: ['account management', 'crm', 'negotiation', 'pipeline management', 'salesforce'], aiRate: 0.3 },
  { fn: 'Human Resources', weight: 10, skills: ['talent acquisition', 'employee relations', 'compensation', 'hris', 'onboarding'], aiRate: 0.25 },
  { fn: 'Data & Analytics', weight: 10, skills: ['sql', 'python', 'tableau', 'statistics', 'dashboards'], aiRate: 0.85 },
  { fn: 'Product', weight: 8, skills: ['roadmapping', 'user research', 'agile', 'stakeholder management', 'jira'], aiRate: 0.65 },
  { fn: 'Engineering', weight: 6, skills: ['java', 'cloud architecture', 'ci/cd', 'api design', 'testing'], aiRate: 0.7 },
  { fn: 'Customer Success', weight: 6, skills: ['renewals', 'onboarding', 'customer health', 'zendesk', 'escalation management'], aiRate: 0.4 },
]
const AI_BASIC = ['chatgpt', 'microsoft copilot', 'prompt engineering']
const AI_DEEP = ['machine learning', 'llm', 'rag', 'ai agents']

const unit = (slug: string, i: number, salt: string) => parseInt(createHash('sha256').update(`${slug}:${i}:${salt}`).digest('hex').slice(0, 8), 16) / 0xffffffff

export function demoProfile(slug: string, i: number): { primaryFunction: string; resumeKeywords: string[] } {
  const total = FUNCTIONS.reduce((n, f) => n + f.weight, 0)
  let r = unit(slug, i, 'fn') * total
  const f = FUNCTIONS.find((x) => (r -= x.weight) < 0) ?? FUNCTIONS[0]
  const skills = f.skills.filter((_, k) => unit(slug, i, `s${k}`) < 0.75)
  const out = skills.length ? skills : f.skills.slice(0, 2)
  if (unit(slug, i, 'ai') < f.aiRate) {
    out.push(AI_BASIC[Math.floor(unit(slug, i, 'b') * AI_BASIC.length)])
    if (unit(slug, i, 'deep') < (f.aiRate > 0.6 ? 0.5 : 0.1)) out.push(AI_DEEP[Math.floor(unit(slug, i, 'd') * AI_DEEP.length)])
  }
  return { primaryFunction: f.fn, resumeKeywords: out }
}
