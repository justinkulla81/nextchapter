import { skillSlug } from './assemble'
import type { PayData, PayGroup, SkillPay } from './types'

// Page addresses for the pay data groups and skills. An industry's slug is its code with hyphens (financial-services); a function's and a
// skill's are slugified from the label ("Data & Analytics" -> data-and-analytics).

export const groupSlug = (g: Pick<PayGroup, 'key' | 'label'>, cut: 'industry' | 'function') => (cut === 'industry' ? g.key.replace(/_/g, '-') : skillSlug(g.label))
export const findGroup = (groups: PayGroup[], slug: string, cut: 'industry' | 'function') => groups.find((g) => groupSlug(g, cut) === slug) ?? null
export const findSkill = (d: PayData, slug: string): SkillPay | null => d.skills.find((s) => skillSlug(s.skill) === slug) ?? null
export const skillPath = (s: Pick<SkillPay, 'skill'>) => `/resources/pay-data/skills/${skillSlug(s.skill)}`
export const functionPayPath = (label: string) => `/resources/pay-data/function/${skillSlug(label)}`
export const industryPayPath = (key: string) => `/resources/pay-data/industry/${key.replace(/_/g, '-')}`
