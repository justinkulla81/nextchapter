import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { JobFitCard } from '@/components/jobs/JobFitCard'

describe('JobFitCard', () => {
  it('is one promise and one button that carries the job id into onboarding', () => {
    const html = renderToStaticMarkup(<JobFitCard jobId="cmv123abc" placement="inline" />)
    expect(html).toContain('Would you get an interview?')
    expect(html).toContain('Check my fit')
    expect(html).toContain('href="/onboarding/desire?from=jobs_page&amp;job=cmv123abc"')
    expect(html.match(/<a /g)).toHaveLength(1)
  })

  it('says which job was applied to and tags the after-apply placement', () => {
    const html = renderToStaticMarkup(<JobFitCard jobId="cmv123abc" placement="after_apply" heading="Applied to Acme? See if you’d get an interview." />)
    expect(html).toContain('Applied to Acme?')
    expect(html).toContain('Check my fit')
  })
})
