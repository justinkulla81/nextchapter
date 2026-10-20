import { describe, it, expect } from 'vitest'
import { AI_SKILL_ITEMS, aiSkillGap, cleanAiSkillItems, importAiSkillFields, isAiAlias, memberAiSkillIds } from '@/lib/skills/ai-skills'
import { aiMarketLine, aiMarketLineForOccupation, functionCode, industryKeys, suggestedAiItems, suggestedAiTools } from '@/lib/skills/ai-skill-market'
import { AI_COURSE_TAGS, AI_LEARNING_PATHS, aiSkillLabelsForCourse, courseForAiSkill, defaultCourseForAiSkill } from '@/lib/learning/ai-course-tags'
import { jobSkillGap } from '@/lib/jobs/job-skill-gap'
import { whyThisJob } from '@/lib/personalization/why-this-job'
import { whyLineText } from '@/lib/jobs/job-card'

describe('AI skill taxonomy', () => {
  it('has the 24 items of the analysis in 3 groups, with unique ids and labels', () => {
    expect(AI_SKILL_ITEMS).toHaveLength(24)
    expect(new Set(AI_SKILL_ITEMS.map((i) => i.id)).size).toBe(24)
    expect(new Set(AI_SKILL_ITEMS.map((i) => i.label)).size).toBe(24)
    expect(new Set(AI_SKILL_ITEMS.map((i) => i.group))).toEqual(new Set(['builder', 'applied', 'leadership']))
  })

  it('keeps known ids only, in taxonomy order, and derives groups from items', () => {
    expect(cleanAiSkillItems(['l_governance', 'nope', 'a_prompt', 'a_prompt', 7])).toEqual(['a_prompt', 'l_governance'])
    const f = importAiSkillFields({
      aiSkillItems: ['l_governance', 'b_rag'],
      aiSkillGroups: ['applied'],
      aiToolsNamed: ['Claude', ' Claude ', ''],
      aiCertsNamed: ['IAPP AIGP'],
      aiExposed: true,
      aiExposureWhy: ['skill'],
      aiMention: true,
      aiBasis: 'full',
    })
    expect(f).toEqual({
      aiSkillGroups: ['leadership', 'builder'],
      aiSkillItems: ['b_rag', 'l_governance'],
      aiToolsNamed: ['Claude'],
      aiCertsNamed: ['IAPP AIGP'],
      aiExposed: true,
      aiExposureWhy: ['skill'],
      aiMention: true,
      aiBasis: 'full',
    })
    // An older exporter (no exposure fields) no longer overwrites the AI fields.
    expect(importAiSkillFields({ aiSkillItems: ['a_prompt'] })).toEqual({})
    // Not sent → nothing returned, so a row keeps what it holds.
    expect(importAiSkillFields({})).toEqual({})
  })
})

describe('memberAiSkillIds', () => {
  it('reads AI skills from the skills matrix as whole words', () => {
    const ids = memberAiSkillIds(['Prompt engineering', 'Zapier', 'NIST AI RMF', 'Excel'])
    expect(ids.has('a_prompt')).toBe(true)
    expect(ids.has('a_automation_tools')).toBe(true)
    expect(ids.has('l_governance')).toBe(true)
    expect(ids.has('b_llm_eng')).toBe(false)
  })
  it('does not read AI into unrelated words', () => {
    const ids = memberAiSkillIds(['Retail operations', 'Email marketing', 'Ragtime piano', 'Cursory review'])
    expect(ids.size).toBe(0)
  })
  it('credits a member who uses ChatGPT with AI tools in daily work', () => {
    expect(memberAiSkillIds(['ChatGPT']).has('a_tool_use')).toBe(true)
  })
})

describe('aiSkillGap and the job skills gap', () => {
  it('names the most specific missing AI skill first', () => {
    const g = aiSkillGap(['a_tool_use', 'a_agentic_automation'], ['Excel'])
    expect(g.missing).toEqual(['AI workflow automation', 'AI tools in daily work'])
  })
  it('counts a confirmed AI skill as had', () => {
    const g = aiSkillGap(['a_agentic_automation', 'a_prompt'], ['AI agents', 'prompt engineering'])
    expect(g.missing).toEqual([])
    expect(g.have).toHaveLength(2)
  })
  it('folds AI asks into the job gap, first, even when the posting lists few other skills', () => {
    const gap = jobSkillGap({ title: 'Ops Manager', description: null, skills: ['excel'], aiSkillItems: ['a_agentic_automation'], memberKeywords: ['excel'] })
    expect(gap.basis).toBe('posting')
    expect(gap.requested).toEqual(['AI workflow automation'])
    expect(gap.missing).toEqual(['AI workflow automation'])
  })
  it('does not show machine learning twice', () => {
    expect(isAiAlias('machine learning', ['b_ml_general'])).toBe(true)
    const gap = jobSkillGap({
      title: 'Data Scientist',
      description: null,
      skills: ['python', 'machine learning', 'sql'],
      aiSkillItems: ['b_ml_general'],
      memberKeywords: ['python'],
    })
    expect(gap.requested).toEqual(['Machine learning engineering', 'python', 'sql'])
  })
  it('without AI items, behaves as before', () => {
    const gap = jobSkillGap({ title: 'Controller', description: null, skills: ['gaap', 'sox'], memberKeywords: ['gaap'] })
    expect(gap.requested).toEqual(['gaap', 'sox'])
    expect(gap.ai?.asked).toEqual([])
  })
  it('puts the AI gap on the "Why this job" line', () => {
    const gap = jobSkillGap({
      title: 'FP&A Manager',
      description: null,
      skills: ['excel', 'forecasting'],
      aiSkillItems: ['a_agentic_automation', 'a_tool_use'],
      memberKeywords: ['excel', 'forecasting'],
    })
    const why = whyThisJob({ jobRemote: false, city: null, hasIndustries: false, have: gap.have, missing: gap.missing, level: 'your level' })
    expect(whyLineText(why)).toBe('Fits you: your level · uses excel, forecasting — Gap: asks for AI workflow automation')
  })
})

describe('AI market line (static, from the analysis)', () => {
  it('maps member labels and crawler codes', () => {
    expect(functionCode('Data & Analytics')).toBe('data_ai')
    expect(functionCode('finance')).toBe('finance')
    expect(functionCode('General')).toBeNull()
    expect(industryKeys(['Financial Services & Banking', 'technology', 'Other'])).toEqual(['financial_services', 'technology'])
  })
  it('always shows raw and like-for-like together', () => {
    const l = aiMarketLine('Finance')!
    expect(l.hasPremium).toBe(true)
    expect(l.text).toMatch(/^In Finance postings, \d+% ask for a specific AI skill\./)
    expect(l.text).toMatch(/higher raw, about \d+% higher like-for-like \(same level and industry\)/)
    expect(l.text).toMatch(/As of Oct 16, 2026\.$/)
  })
  it('shows only the share when the like-for-like comparison is too thin', () => {
    const l = aiMarketLine('Legal')!
    expect(l.hasPremium).toBe(false)
    expect(l.text).not.toMatch(/raw/)
    expect(l.text).toMatch(/Too few postings with pay to compare like-for-like/)
  })
  it('has a line for a pivot occupation', () => {
    const l = aiMarketLineForOccupation('11-3031.00', 'Financial Managers')!
    expect(l.text).toMatch(/^In Financial Managers postings, \d+% ask for a specific AI skill\. Across Finance postings that ask,/)
    expect(aiMarketLineForOccupation('99-9999.99')).toBeNull()
  })
  it('suggests the AI tools a cell names most, then the function’s', () => {
    const t = suggestedAiTools('Finance', ['Financial Services & Banking'])
    expect(t[0]).toBe('Microsoft Copilot')
    expect(t.length).toBeLessThanOrEqual(8)
    expect(suggestedAiTools('General')).toEqual([])
    expect(suggestedAiItems('Finance')[0]).toBe('a_tool_use')
  })
})

describe('AI course tags', () => {
  it('tags only known items, and every path is tagged', () => {
    const ids = new Set(AI_SKILL_ITEMS.map((i) => i.id))
    for (const t of Object.values(AI_COURSE_TAGS)) for (const i of t.items) expect(ids.has(i)).toBe(true)
    for (const p of AI_LEARNING_PATHS) expect(AI_COURSE_TAGS[p.url]?.items.length).toBeGreaterThan(0)
  })
  it('links an AI gap to a course that covers it', () => {
    expect(defaultCourseForAiSkill('AI governance and risk')?.title).toBe('NIST AI Risk Management Framework (AI RMF)')
    expect(defaultCourseForAiSkill('Prompt design')?.url).toMatch(/coursera|edx|google/)
    expect(defaultCourseForAiSkill('excel')).toBeNull()
    const courses = [{ url: 'https://iapp.org/certify/aigp' }, { url: 'https://www.coursera.org/learn/prompt-engineering' }]
    expect(courseForAiSkill('l_governance', courses)?.url).toBe('https://iapp.org/certify/aigp')
    expect(aiSkillLabelsForCourse('https://www.coursera.org/learn/prompt-engineering/')).toEqual([
      'Prompt design',
      'Gen-AI assistants (ChatGPT, Copilot, Claude)',
    ])
  })
})
