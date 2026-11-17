// Skills named in job descriptions. Pure: counts how many postings mention each
// skill (one count per posting, however many times it appears). A dictionary
// match is a signal of demand, not a ruling on a role.

export type SkillDef = { skill: string; group: 'AI and data' | 'Tools and systems' | 'Finance' | 'Management' | 'Security and cloud' | 'Operations' | 'People and customers' | 'Sales and marketing'; test: RegExp }

export const SKILLS: SkillDef[] = [
  { skill: 'AI or generative AI', group: 'AI and data', test: /\b(generative ai|gen ?ai|artificial intelligence|llms?|chatgpt|copilot|machine learning|\bai\b)/i },
  { skill: 'SQL', group: 'AI and data', test: /\bsql\b/i },
  { skill: 'Python', group: 'AI and data', test: /\bpython\b/i },
  { skill: 'Data analysis', group: 'AI and data', test: /data analy|analytics|data-driven/i },
  { skill: 'Tableau or Power BI', group: 'AI and data', test: /tableau|power ?bi/i },
  { skill: 'Excel', group: 'Tools and systems', test: /\bexcel\b/i },
  { skill: 'Salesforce', group: 'Tools and systems', test: /salesforce/i },
  { skill: 'SAP or Oracle ERP', group: 'Tools and systems', test: /\bsap\b|oracle (erp|fusion|netsuite)|netsuite/i },
  { skill: 'Workday', group: 'Tools and systems', test: /workday/i },
  { skill: 'Financial modeling or forecasting', group: 'Finance', test: /financial model|forecast/i },
  { skill: 'GAAP or CPA', group: 'Finance', test: /\bgaap\b|\bcpa\b/i },
  { skill: 'Project management', group: 'Management', test: /project manage|\bpmp\b|program manage/i },
  { skill: 'Agile or Scrum', group: 'Management', test: /\bagile\b|scrum/i },
  { skill: 'Change management', group: 'Management', test: /change manage/i },
  { skill: 'Cloud (AWS, Azure, Google Cloud)', group: 'Security and cloud', test: /\baws\b|azure|google cloud|\bgcp\b/i },
  { skill: 'Cybersecurity', group: 'Security and cloud', test: /cyber ?security|information security|infosec/i },
  { skill: 'Process improvement (Lean, Six Sigma)', group: 'Operations', test: /\blean\b|six sigma|process improvement|kaizen/i },
  { skill: 'Supply chain and logistics', group: 'Operations', test: /supply chain|logistics|procurement|inventory/i },
  { skill: 'Budgeting', group: 'Finance', test: /budget/i },
  { skill: 'Compliance and risk', group: 'Operations', test: /compliance|regulatory|risk management/i },
  { skill: 'Recruiting and talent acquisition', group: 'People and customers', test: /recruit|talent acquisition|sourcing/i },
  { skill: 'People management', group: 'People and customers', test: /people management|team leadership|manag(e|ed|ing) (a )?team|leadership/i },
  { skill: 'Customer experience', group: 'People and customers', test: /customer experience|customer success|customer service/i },
  { skill: 'Digital marketing and SEO', group: 'Sales and marketing', test: /\bseo\b|digital marketing|content strategy|social media/i },
  { skill: 'Sales and negotiation', group: 'Sales and marketing', test: /\bsales\b|business development|negotiat/i },
]

export type SkillCount = { skill: string; group: SkillDef['group']; postings: number; share: number }

export function countSkills(texts: string[]): SkillCount[] {
  const n = texts.length
  if (!n) return []
  return SKILLS.map((s) => {
    const postings = texts.filter((t) => s.test.test(t)).length
    return { skill: s.skill, group: s.group, postings, share: postings / n }
  })
    .filter((c) => c.postings > 0)
    .sort((a, b) => b.postings - a.postings)
}
