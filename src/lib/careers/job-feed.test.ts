import { describe, expect, it } from 'vitest'
import { careerFeedRoles, careersFeedXml, careersJoobleXml } from '@/lib/careers/job-feed'

describe('careers job feeds', () => {
  it('lists every job and no platform role', () => {
    const slugs = careerFeedRoles().map((r) => r.slug)
    expect(slugs).toContain('editorial-lead')
    expect(slugs).toContain('internship')
    expect(slugs).not.toContain('coach')
    expect(slugs).not.toContain('recruiter')
  })

  it('Indeed-style feed has the required tags and our own role pages', () => {
    const xml = careersFeedXml(new Date('2026-10-26T12:00:00Z'))
    const n = careerFeedRoles().length
    expect(xml.match(/<job>/g)).toHaveLength(n)
    for (const tag of ['title', 'dateposted', 'referencenumber', 'url', 'company', 'city', 'state', 'country', 'description', 'jobtype']) {
      expect(xml.match(new RegExp(`<${tag}>`, 'g')), tag).toHaveLength(n)
    }
    expect(xml).toContain('<url><![CDATA[https://launchyournextchapter.com/careers/editorial-lead]]></url>')
    expect(xml).toContain('<company><![CDATA[NextChapter]]></company>')
    expect(xml).toContain('<jobtype><![CDATA[Internship]]></jobtype>')
    expect(xml.trimEnd().endsWith('</source>')).toBe(true)
  })

  it('Jooble feed uses Jooble tags and DD.MM.YYYY dates', () => {
    const xml = careersJoobleXml()
    const n = careerFeedRoles().length
    expect(xml.match(/<job id="/g)).toHaveLength(n)
    expect(xml.match(/<pubdate><!\[CDATA\[\d{2}\.\d{2}\.\d{4}\]\]><\/pubdate>/g)).toHaveLength(n)
    expect(xml).toContain('<link><![CDATA[https://launchyournextchapter.com/careers/editorial-lead]]></link>')
    expect(xml).not.toContain('<url>')
    expect(xml.trimEnd().endsWith('</jobs>')).toBe(true)
  })
})
