// AEI task → our O*NET skill ids (Skill.id). Two deterministic routes, no model call:
//  1. alias: a tool / skill name (text-skill-aliases.json, the same matcher job postings use)
//     appears in the task statement ("Maintain spreadsheets…" → spreadsheet software);
//  2. rule: fixed task-verb patterns for O*NET's basic skills and a few knowledge areas
//     ("Write…", "Draft…" → Writing). An allowlist: tasks that match none get no skill.
// Pure; used by scripts/careers/aei/load-aei.ts and unit-tested in src/test/aei-exposure.test.ts.

import { textSkillIds } from '@/lib/careers/text-skill-ids'

export const TASK_SKILL_RULES: { skillId: string; pattern: RegExp }[] = [
  { skillId: 'skill:2.A.1.c', pattern: /\b(write|writes|writing|draft|drafts|drafting|edit|edits|editing|compose|composes|proofread\w*)\b/i }, // Writing
  { skillId: 'skill:2.B.3.e', pattern: /\b(code|coding|programming|software|scripts?|scripting|debug\w*|computer programs?)\b/i }, // Programming
  { skillId: 'skill:2.A.1.e', pattern: /\b(calculate\w*|compute|computes|statistic\w*|mathematical|quantitative)\b/i }, // Mathematics
  { skillId: 'skill:2.B.1.d', pattern: /\bnegotiat\w*/i }, // Negotiation
  { skillId: 'skill:2.B.1.e', pattern: /\b(teach\w*|instruct|instructs|train|trains|tutor\w*|coach|coaches|coaching|mentor\w*)\b/i }, // Instructing
  { skillId: 'skill:2.B.1.c', pattern: /\b(persuade\w*|sell|sells|solicit\w*|pitch|pitches)\b/i }, // Persuasion
  { skillId: 'skill:2.A.2.a', pattern: /\b(analy[sz]e|analy[sz]es|analysis|evaluate|evaluates|assess|assesses)\b/i }, // Critical Thinking
  { skillId: 'skill:2.A.1.d', pattern: /\b(present|presents|presentations?|speak\w*|speeches)\b/i }, // Speaking
  { skillId: 'skill:2.B.1.b', pattern: /\bcoordinat\w*/i }, // Coordination
  { skillId: 'skill:2.B.1.f', pattern: /\b(customer service|(assist|help|serve|advise)s? (customers|clients|patrons|the public))\b/i }, // Service Orientation
  { skillId: 'skill:2.B.3.k', pattern: /\b(troubleshoot\w*|diagnose (problems|faults|issues))\b/i }, // Troubleshooting
  { skillId: 'skill:2.B.3.m', pattern: /\b(quality (control|assurance)|inspect\w*|test (products|software|systems))\b/i }, // Quality Control Analysis
  { skillId: 'skill:2.A.2.d', pattern: /\bmonitor\w*/i }, // Monitoring
  { skillId: 'skill:2.B.5.a', pattern: /\bschedul\w*/i }, // Time Management
  { skillId: 'skill:2.B.5.b', pattern: /\b(budget\w*|financial resources)\b/i }, // Management of Financial Resources
  { skillId: 'skill:2.B.5.d', pattern: /\b(hire|hires|hiring|recruit\w*|supervise\w*|staffing)\b/i }, // Management of Personnel Resources
  { skillId: 'skill:2.A.2.b', pattern: /\b(research|researches|researching)\b/i }, // Active Learning
  { skillId: 'knowledge:2.C.1.c', pattern: /\b(accounting|financial statements?|ledgers?|audit\w*|tax returns?|payroll)\b/i }, // Economics and Accounting
  { skillId: 'knowledge:2.C.1.d', pattern: /\b(marketing|advertis\w*|promotional)\b/i }, // Sales and Marketing
  { skillId: 'knowledge:2.C.8.b', pattern: /\b(legal|laws?|regulations?|statutes?|court|contracts?)\b/i }, // Law and Government
  { skillId: 'knowledge:2.C.7.b', pattern: /\btranslat\w*/i }, // Foreign Language
  { skillId: 'knowledge:2.C.3.a', pattern: /\b(computers?|databases?|networks?|hardware)\b/i }, // Computers and Electronics
]

/** Skill ids a task statement names: alias matches first, then the rules. */
export function taskSkillLinks(text: string): { skillId: string; via: 'alias' | 'rule' }[] {
  const out = new Map<string, 'alias' | 'rule'>()
  for (const id of textSkillIds(text)) out.set(id, 'alias')
  for (const r of TASK_SKILL_RULES) if (r.pattern.test(text) && !out.has(r.skillId)) out.set(r.skillId, 'rule')
  return [...out].map(([skillId, via]) => ({ skillId, via }))
}
