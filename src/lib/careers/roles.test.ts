import { describe, expect, it } from 'vitest'
import { ALL_SKILL_TERMS, extractTopSkills } from '@/lib/companies/skills-extraction'
import { inferFunctionFromTitle } from '@/lib/jobs/infer-job-function'
import { classifyTitleRung } from '@/lib/jobs/job-seniority'
import { parseYearsRequired } from '@/lib/jobs/years-required'
import { CAREER_ROLES, GROUP_ORDER, getRole, rolesInGroup } from '@/lib/careers/roles'
import { roleDescriptionText } from '@/lib/careers/role-description'

const JOBS = CAREER_ROLES.filter((r) => r.kind !== 'platform')

describe('career roles', () => {
  it('has unique slugs', () => {
    const slugs = CAREER_ROLES.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('gives every role the content a posting needs', () => {
    for (const r of CAREER_ROLES) {
      expect(r.title.trim(), r.slug).not.toBe('')
      expect(r.summary.trim(), r.slug).not.toBe('')
      expect(r.about.trim(), r.slug).not.toBe('')
      expect(r.seniority.trim(), r.slug).not.toBe('')
      expect(r.responsibilities.length, r.slug).toBeGreaterThan(0)
      expect(r.required.length, r.slug).toBeGreaterThan(0)
    }
    for (const r of JOBS) {
      expect(r.skills.length, r.slug).toBeGreaterThan(0)
      expect(r.knowledge.length, r.slug).toBeGreaterThan(0)
      expect(r.howYouWork.length, r.slug).toBeGreaterThan(0)
    }
  })

  it('marks platform roles as platform and early-career roles as contributors', () => {
    for (const r of rolesInGroup('platform')) expect(r.kind).toBe('platform')
    for (const r of rolesInGroup('early-career')) expect(r.kind).toBe('contributor')
    for (const r of CAREER_ROLES) if (r.kind === 'platform') expect(r.group).toBe('platform')
  })

  it('sends platform roles to an existing page, and no other role', () => {
    for (const r of CAREER_ROLES) {
      if (r.kind === 'platform') expect(r.externalHref, r.slug).toMatch(/^\//)
      else expect(r.externalHref, r.slug).toBeUndefined()
    }
  })

  it('has no empty groups in the display order', () => {
    for (const g of GROUP_ORDER) expect(rolesInGroup(g).length, g).toBeGreaterThan(0)
  })

  it('makes AI experience a stated requirement of the technology lead', () => {
    const tech = getRole('technology-lead')
    expect(tech?.required.join(' ')).toMatch(/AI/)
    expect(tech?.required.join(' ')).toMatch(/required/i)
  })

  it('asks for AI in every job, and says no experience is needed in every junior one', () => {
    for (const r of JOBS) {
      expect(r.required.join(' '), `${r.slug} AI`).toMatch(/\bAI\b/)
      if (r.yearsMin === null) expect(r.required.join(' '), `${r.slug} no experience`).toMatch(/no experience needed/i)
    }
    for (const slug of ['sales-development-representative', 'internship', 'associate-program']) {
      const r = getRole(slug)!
      expect(r.yearsMin, slug).toBeNull()
      expect(r.summary, slug).toMatch(/No experience needed/)
    }
  })

  it('finds a role by slug and returns undefined for an unknown one', () => {
    expect(getRole('editorial-lead')?.title).toBe('Editorial lead')
    expect(getRole('nope')).toBeUndefined()
  })
})

// Our own jobs are the test of matching: the platform's parsers must read each one the way it is meant.
describe('career roles as the platform reads them', () => {
  it('uses only skills the platform recognizes', () => {
    for (const r of JOBS) {
      for (const s of r.skills) expect(ALL_SKILL_TERMS, `${r.slug}: ${s}`).toContain(s)
    }
  })

  it('has the platform find every declared skill in the description text', () => {
    for (const r of JOBS) {
      const found = extractTopSkills([roleDescriptionText(r)], 100).map((s) => s.term)
      for (const s of r.skills) expect(found, `${r.slug}: ${s}`).toContain(s)
    }
  })

  it('reads the matching title as the declared function and seniority', () => {
    for (const r of JOBS) {
      expect(inferFunctionFromTitle(r.matchTitle), `${r.slug} function`).toBe(r.function)
      expect(classifyTitleRung(r.matchTitle).rung, `${r.slug} rung`).toBe(r.rung)
    }
  })

  it('states the years of experience the way the platform parses them', () => {
    for (const r of JOBS) {
      const years = parseYearsRequired(roleDescriptionText(r))
      expect(years?.min ?? null, `${r.slug} years`).toBe(r.yearsMin)
    }
  })

  it('gives every lead a director-level matching title', () => {
    for (const r of JOBS.filter((j) => j.kind === 'lead')) expect(r.rung).toBe('DIRECTOR')
  })
})
