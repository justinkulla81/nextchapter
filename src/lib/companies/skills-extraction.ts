// "Skills they hire for" extraction (Phase 2 Master Script, Part C, Prompt
// 2) — genuinely new, no existing utility to reuse. Two real options were
// available: a lightweight Anthropic call per posting, or a keyword-
// frequency scan over posting text. This picks keyword-frequency
// deliberately, flagged per this project's standing rule on metered-cost
// features:
//
// The nightly cron this feeds runs over every OPEN posting for every
// company with active listings — potentially hundreds to low thousands of
// rows a night, every night, forever. An LLM call per posting (or even
// batched per company) would be a real, recurring, volume-scaling cost with
// no natural cap, unlike the one-time-per-company-ever LLM lookups already
// running elsewhere (CompanySizeLookup/CompanyIndustryLookup — resolved
// once, cached permanently). A keyword-frequency scan costs nothing per run
// and is genuinely good enough for "ranked by frequency" — the spec's own
// bar — even though it will miss skills phrased in ways not in the
// vocabulary below. Revisit only if ranked accuracy against real postings
// proves too weak in practice; the vocabulary here is deliberately broad
// and easy to extend without switching approaches.

const SKILL_TERMS: string[] = [
  // Finance / accounting
  'excel', 'sox', 'sarbanes-oxley', 'netsuite', 'sap', 'oracle', 'quickbooks', 'workday',
  'fp&a', 'gaap', 'ifrs', 'financial modeling', 'variance analysis', 'forecasting',
  'budgeting', 'treasury', 'audit', 'reconciliation', 'accounts payable', 'accounts receivable',
  'revenue recognition', 'consolidations', 'hyperion', 'anaplan', 'tableau', 'power bi',
  // Engineering / product / data
  'python', 'java', 'javascript', 'typescript', 'sql', 'aws', 'azure', 'gcp', 'kubernetes',
  'docker', 'react', 'node.js', 'ci/cd', 'devops', 'agile', 'scrum', 'jira', 'machine learning',
  'data pipeline', 'etl', 'snowflake', 'databricks', 'airflow', 'terraform', 'microservices',
  'rest api', 'graphql', 'salesforce', 'crm', 'a/b testing', 'roadmapping', 'figma',
  // Sales / marketing
  'hubspot', 'salesforce crm', 'seo', 'sem', 'google analytics', 'demand generation',
  'account-based marketing', 'crm management', 'pipeline management', 'quota', 'saas sales',
  'enterprise sales', 'channel partnerships', 'content strategy', 'brand strategy',
  // Ops / supply chain / HR
  'six sigma', 'lean', 'supply chain', 'logistics', 'procurement', 'vendor management',
  'inventory management', 'erp', 'project management', 'pmp', 'change management',
  'talent acquisition', 'hris', 'compensation planning', 'employee relations', 'onboarding',
  // Legal / compliance
  'contract negotiation', 'regulatory compliance', 'gdpr', 'hipaa', 'risk management',
  'due diligence', 'intellectual property', 'litigation',
  // Leadership / general
  'p&l ownership', 'cross-functional leadership', 'stakeholder management', 'm&a',
  'go-to-market', 'strategic planning', 'board reporting', 'team building',
]

export interface RankedSkill {
  term: string
  count: number
}

// Ranks SKILL_TERMS by how many DISTINCT postings mention them (not raw
// occurrence count) — a term repeated five times in one posting shouldn't
// outrank a term mentioned once each in five different postings; the
// candidate-facing question is "how many of their open roles want this,"
// not "how often does this word appear."
export function extractTopSkills(postingTexts: string[], limit: number = 10): RankedSkill[] {
  const counts = new Map<string, number>()

  for (const text of postingTexts) {
    const lower = text.toLowerCase()
    const seenInThisPosting = new Set<string>()
    for (const term of SKILL_TERMS) {
      if (seenInThisPosting.has(term)) continue
      // Word-boundary-ish check — good enough for multi-word terms and the
      // handful of short ones (sql, aws, gcp) where a bare .includes()
      // would risk matching inside an unrelated longer word.
      const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(term)}(?:[^a-z0-9]|$)`, 'i')
      if (pattern.test(lower)) {
        seenInThisPosting.add(term)
        counts.set(term, (counts.get(term) ?? 0) + 1)
      }
    }
  }

  return Array.from(counts.entries())
    .map(([term, count]) => ({ term, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Candidate-facing gap flag (Prompt 3: "You match 7 of their top 10.
// Missing: SOX, NetSuite.") — pure set comparison against the candidate's
// own resumeKeywords, case-insensitive.
export function computeSkillGap(
  topSkills: RankedSkill[],
  candidateResumeKeywords: string[]
): { matched: string[]; missing: string[] } {
  const candidateLower = new Set(candidateResumeKeywords.map((k) => k.toLowerCase()))
  const matched: string[] = []
  const missing: string[] = []
  for (const skill of topSkills) {
    const has = Array.from(candidateLower).some(
      (k) => k.includes(skill.term.toLowerCase()) || skill.term.toLowerCase().includes(k)
    )
    if (has) matched.push(skill.term)
    else missing.push(skill.term)
  }
  return { matched, missing }
}
