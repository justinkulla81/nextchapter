import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { techTermEntry } from '@/lib/onet/tech-term-rules'
import { ALL_SKILL_TERMS, extractTopSkills } from '@/lib/companies/skills-extraction'
import { OnetAttribution, ONET_WEB_SERVICES_CREDIT } from '@/components/OnetAttribution'

describe('O*NET tool names for the posting scan', () => {
  it('turns O*NET names into the words postings use', () => {
    expect(techTermEntry('Atlassian JIRA')).toEqual({ term: 'jira', aliases: ['atlassian jira', 'jira'] })
    expect(techTermEntry('Cascading style sheets CSS')!.aliases).toEqual(expect.arrayContaining(['css', 'cascading style sheets']))
    expect(techTermEntry('Amazon Web Services AWS CloudFormation')!.term).toBe('cloudformation')
    expect(techTermEntry('Dassault Systemes CATIA')!.aliases).not.toContain('dassault systemes')
  })

  it('keeps everyday words and categories out', () => {
    expect(techTermEntry('Slack')).toBeNull()
    expect(techTermEntry('Payroll software')).toBeNull()
    expect(techTermEntry('REST Assured')).toBeNull()
    expect(techTermEntry('Microsoft Word')!.aliases).toEqual(['microsoft word'])
    expect(techTermEntry('Microsoft Project')!.aliases).not.toContain('project')
  })

  it('finds O*NET tools in a posting without false hits', () => {
    const terms = extractTopSkills(['Project Architect\nMust know Autodesk Revit, Procore and Bluebeam. Rest assured, we value growth.'], 20).map((s) => s.term)
    expect(terms).toEqual(expect.arrayContaining(['revit', 'procore']))
    expect(terms).not.toContain('rest assured')
    const medicare = extractTopSkills(['Follow Centers for Medicare & Medicaid Services (CMS) guidelines.'], 20).map((s) => s.term)
    expect(medicare).not.toContain('cms')
    expect(ALL_SKILL_TERMS.length).toBeGreaterThan(300)
  })
})

describe('O*NET attribution', () => {
  it('credits and links O*NET Web Services with its badge, and names the database release', () => {
    const html = renderToStaticMarkup(createElement(OnetAttribution))
    expect(html).toContain('href="https://services.onetcenter.org/"')
    expect(html).toContain('onet-in-it.svg')
    expect(html).toContain('This site incorporates information from')
    expect(html).toContain('O*NET 31.0 Database')
    expect(html).toContain('O*NET® is a trademark of USDOL/ETA.')
    const compact = renderToStaticMarkup(createElement(OnetAttribution, { compact: true }))
    expect(compact).toContain(ONET_WEB_SERVICES_CREDIT)
    expect(compact).toContain('href="https://services.onetcenter.org/"')
  })
})
