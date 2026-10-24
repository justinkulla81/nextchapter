import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  EMPLOYER_SECTIONS,
  allEmployerServices,
  employerSection,
  employerSectionForPath,
  employerSectionTrail,
  employerServiceForPath,
  isEmployerSectionKey,
  sectionForWorkspaceType,
  sectionsHeld,
} from '@/lib/employer/sections'
import { PORTAL_TYPES, employerUseForPath } from '@/lib/partners/portal-types'
import { EmployerOverview } from '@/components/marketing/EmployerOverview'

describe('employer sections', () => {
  it('has three sections in lifecycle order with the agreed services', () => {
    expect(EMPLOYER_SECTIONS.map((s) => s.key)).toEqual(['hiring', 'employees', 'outplacement'])
    expect(employerSection('hiring').services.map((s) => s.label)).toEqual(['Roles', 'Candidate inbox', 'Scorecards', 'Analytics'])
    expect(employerSection('employees').services.map((s) => s.label)).toEqual(['Learning and development', 'Retention', 'Job retraining'])
    expect(employerSection('outplacement').services.map((s) => s.label)).toEqual(['Seats', 'Roster', 'Scorecard', 'Compliance'])
  })
  it('stores each section as its own workspace type', () => {
    expect(EMPLOYER_SECTIONS.map((s) => s.workspaceType)).toEqual(['HIRING', 'EMPLOYEES', 'OUTPLACEMENT'])
    expect(sectionForWorkspaceType('EMPLOYEES')?.key).toBe('employees')
    expect(sectionForWorkspaceType('HIGHER_ED')).toBeNull()
    expect(sectionForWorkspaceType(null)).toBeNull()
  })
  it('gives every service a unique key and a declared section', () => {
    const keys = allEmployerServices().map((s) => `${s.section}:${s.key}`)
    expect(new Set(keys).size).toBe(keys.length)
    for (const s of EMPLOYER_SECTIONS) for (const svc of s.services) expect(svc.section).toBe(s.key)
  })
  it('maps today\'s routes to a section the way the portals work now', () => {
    expect(employerSectionForPath('/talent/roles/new')?.key).toBe('hiring')
    expect(employerSectionForPath('/talent/dashboard')?.key).toBe('hiring')
    expect(employerSectionForPath('/talent/login')?.key).toBe('hiring')
    expect(employerSectionForPath('/employer/growth/roles/abc')?.key).toBe('employees')
    expect(employerSectionForPath('/employer/learning')?.key).toBe('employees')
    expect(employerSectionForPath('/employer')?.key).toBe('outplacement')
    expect(employerSectionForPath('/employer/roster')?.key).toBe('outplacement')
    expect(employerSectionForPath('/employer/invoices?x=1')?.key).toBe('outplacement')
    expect(employerSectionForPath('/employer/growthy')?.key).toBe('outplacement')
    expect(employerSectionForPath('/employers')).toBeNull()
    expect(employerSectionForPath('/talentpool')).toBeNull()
    expect(employerSectionForPath('/dashboard')).toBeNull()
    expect(employerSectionForPath(null)).toBeNull()
  })
  it('finds the named service for a path, or none for an overview page', () => {
    expect(employerServiceForPath('/talent/analytics')?.key).toBe('analytics')
    expect(employerServiceForPath('/talent/messages/t1')?.key).toBe('candidate_inbox')
    expect(employerServiceForPath('/employer/growth')?.key).toBe('retention')
    expect(employerServiceForPath('/employer/enroll')?.key).toBe('seats')
    expect(employerServiceForPath('/employer/reporting/review')?.key).toBe('scorecard')
    expect(employerServiceForPath('/employer')).toBeNull()
    expect(employerServiceForPath('/talent/settings')).toBeNull()
  })
  it('agrees with the top bar for every employer path', () => {
    const useToSection: Record<string, string> = { Retention: 'employees', 'Learning and development': 'employees', Outplacement: 'outplacement' }
    for (const path of ['/employer', '/employer/growth', '/employer/growth/roles/1', '/employer/learning', '/employer/roster', '/employer/team']) {
      expect(employerSectionForPath(path)?.key, path).toBe(useToSection[employerUseForPath(path)])
    }
  })
  it('declares every service that has pages as a portal use', () => {
    const uses = PORTAL_TYPES.employer.uses
    for (const label of ['Retention', 'Learning and development', 'Job retraining', 'Hiring', 'Outplacement']) expect(uses).toContain(label)
  })
  it('builds the top bar trail', () => {
    expect(employerSectionTrail('/employer/learning')).toEqual(['Employees', 'Learning and development'])
    expect(employerSectionTrail('/employer/growth')).toEqual(['Employees', 'Retention'])
    expect(employerSectionTrail('/employer/roster')).toEqual(['Outplacement'])
    expect(employerSectionTrail('/talent/analytics')).toEqual(['Hiring'])
    expect(employerSectionTrail('/about')).toEqual([])
  })
  it('lists the sections an organization holds in display order', () => {
    expect(sectionsHeld(['OUTPLACEMENT', 'HIGHER_ED', 'HIRING']).map((s) => s.key)).toEqual(['hiring', 'outplacement'])
    expect(sectionsHeld([])).toEqual([])
    expect(isEmployerSectionKey('employees')).toBe(true)
    expect(isEmployerSectionKey('growth')).toBe(false)
  })
})

describe('EmployerOverview', () => {
  const html = renderToStaticMarkup(<EmployerOverview />)
  it('lists all three sections and every service', () => {
    for (const s of EMPLOYER_SECTIONS) {
      expect(html).toContain(s.label)
      for (const svc of s.services) expect(html).toContain(svc.label)
    }
  })
  it('marks the service that is not built yet', () => {
    expect(html).toContain('Not available yet.')
    expect(html.match(/Not available yet\./g)?.length).toBe(1)
  })
  it('has no prices, no links and no forms', () => {
    expect(html).not.toMatch(/\$\d/)
    expect(html).not.toMatch(/<a |<form|<button|<input/)
  })
})
