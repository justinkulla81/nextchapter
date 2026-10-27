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
})
