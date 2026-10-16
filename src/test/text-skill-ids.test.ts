import { describe, expect, it } from 'vitest'
import { textSkillIds } from '@/lib/careers/text-skill-ids'
import aliases from '@/lib/careers/text-skill-aliases.json'

const idOf = (alias: string) => (aliases as Record<string, string[]>)[alias]?.[0]

describe('O*NET skills named in free text', () => {
  it('finds well-known tools inside a description', () => {
    const ids = textSkillIds('Senior Analyst', 'You will build dashboards in Tableau and manage pipelines in Salesforce.')
    if (idOf('tableau')) expect(ids.has(idOf('tableau')!)).toBe(true)
    if (idOf('salesforce')) expect(ids.has(idOf('salesforce')!)).toBe(true)
  })
  it('ignores ordinary words and bare acronyms that name a field, not a product', () => {
    expect(textSkillIds('Office manager', 'Reporting, scheduling and budgeting; CRM and HIPAA experience').size).toBe(0)
  })
  it('never trips over object keys', () => {
    expect(textSkillIds('constructor toString hasOwnProperty').size).toBe(0)
  })
})
