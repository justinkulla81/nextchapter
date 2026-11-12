import { describe, expect, it } from 'vitest'
import { isEmployerListed, isJunkListing, normalizeEmployer, parseSourceView, sourceKeep } from '@/lib/jobs/job-source'

describe('job source gate', () => {
  it('defaults to From employers', () => {
    expect(parseSourceView(undefined)).toBe('direct')
    expect(parseSourceView('all')).toBe('all')
    expect(parseSourceView(['all'])).toBe('all')
    expect(parseSourceView('x')).toBe('direct')
  })

  it('never shows hidden-employer or junk-board listings', () => {
    for (const companyName of ['Confidential', 'Confidential Careers', 'Undisclosed', 'ClearanceJobs', 'GrabJobs', ' ']) {
      expect(isJunkListing({ companyName })).toBe(true)
      expect(sourceKeep('all', null)({ companyName, sourceCategory: 'employer' })).toBe(false)
    }
    expect(isJunkListing({ companyName: 'Stripe' })).toBe(false)
  })

  it('From employers drops recruiter, search-firm and board listings', () => {
    const keep = sourceKeep('direct', null)
    expect(keep({ companyName: 'Stripe', sourceCategory: 'employer' })).toBe(true)
    expect(keep({ companyName: 'Stripe', sourceCategory: null })).toBe(true)
    expect(keep({ companyName: 'Robert Half', sourceCategory: 'search_firm' })).toBe(false)
    expect(keep({ companyName: 'Acme', sourceCategory: 'aggregator' })).toBe(false)
  })

  it('Employers and recruiters hides a board copy when the employer lists the job itself', () => {
    const keep = sourceKeep('all', new Set([normalizeEmployer('Acme, Inc.')]))
    expect(keep({ companyName: 'ACME', sourceCategory: 'aggregator' })).toBe(false)
    expect(keep({ companyName: 'Other Co', sourceCategory: 'aggregator' })).toBe(true)
    expect(keep({ companyName: 'Robert Half', sourceCategory: 'search_firm' })).toBe(true)
    expect(isEmployerListed({ companyName: 'Acme', sourceCategory: 'employer' })).toBe(true)
    expect(isEmployerListed({ companyName: 'Acme', sourceCategory: 'aggregator' })).toBe(false)
  })
})
