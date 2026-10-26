import { describe, expect, it } from 'vitest'
import { CAREER_ROLES } from '@/lib/careers/roles'
import { careerJobPostingJsonLd } from '@/lib/careers/job-posting-jsonld'

describe('career job posting structured data', () => {
  it('describes every job and no platform role', () => {
    for (const r of CAREER_ROLES) {
      const ld = careerJobPostingJsonLd(r)
      if (r.kind === 'platform') {
        expect(ld, r.slug).toBeNull()
        continue
      }
      expect(ld?.['@type'], r.slug).toBe('JobPosting')
      expect(ld?.title, r.slug).toBe(r.title)
      expect(ld?.datePosted, r.slug).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(ld?.directApply, r.slug).toBe(true)
      expect(String(ld?.description), r.slug).toContain('<li>')
      expect(ld?.baseSalary, r.slug).toBeUndefined()
    }
  })

  it('marks the internship as an internship', () => {
    expect(careerJobPostingJsonLd(CAREER_ROLES.find((r) => r.slug === 'internship')!)?.employmentType).toBe('INTERN')
  })
})
