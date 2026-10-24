import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Owner decision 2026-10-23: the website shows plans, not prices. These are
// the public page components and data files that used to carry amounts or
// cost claims. Comments are skipped. The $500 offer bonus is a payment to a
// member, not a price, so it is the one dollar amount allowed.

const PUBLIC_FILES = [
  'src/app/pricing/page.tsx',
  'src/app/higher-education/page.tsx',
  'src/app/government-workforce/page.tsx',
  'src/lib/marketing/portal-pages/workforce.ts',
  'src/lib/marketing/portal-pages/hiring.ts',
  'src/app/employees/page.tsx',
  'src/lib/marketing/portal-pages/employees.ts',
  'src/lib/marketing/portal-pages/higher-education.ts',
  'src/components/marketing/PortalMarketingPage.tsx',
  'src/app/outplacement/page.tsx',
  'src/app/membership/page.tsx',
  'src/app/vs/page.tsx',
  'src/app/vs/[competitor]/page.tsx',
  'src/app/insights/page.tsx',
  'src/app/llms.txt/route.ts',
  'src/app/talent/page.tsx',
  'src/app/talent/signup/page.tsx',
  'src/app/coaching/page.tsx',
  'src/app/coach-platform/page.tsx',
  'src/app/ai-training/page.tsx',
  'src/app/faq/page.tsx',
  'src/app/funding/page.tsx',
  'src/app/nonprofits/page.tsx',
  'src/app/submit-resume/page.tsx',
  'src/app/terms/page.tsx',
  'src/app/prepared/[slug]/page.tsx',
  'src/components/marketing/ComparisonPageTemplate.tsx',
  'src/components/marketing/PublicSiteChrome.tsx',
  'src/components/employer/EmployerWaitlistForm.tsx',
  'src/components/home/HomeLearnMore.tsx',
  'src/components/home/NewHome.tsx',
  'src/components/audience/audience-data.ts',
  'src/components/faq-data.ts',
  'src/lib/marketing/competitor-comparisons.ts',
  'src/lib/marketing/plans.ts',
  'src/lib/seo/facts.ts',
  'src/lib/seo/insights.ts',
]

// Extended scope: signed-in screens, emails and pitch defaults that quoted our own prices.
const EXTENDED_FILES = [
  'src/app/dashboard/membership/page.tsx',
  'src/app/dashboard/premium/page.tsx',
  'src/app/dashboard/plans/scholarship/page.tsx',
  'src/emails/upgrade-offer.tsx',
  'src/lib/email/send-upgrade-offer.ts',
  'src/lib/admin/nudge-content.ts',
]

// Files that legitimately hold other dollar amounts (a liability cap in the terms). They are checked for price wording only.
const WORDING_ONLY = new Set(['src/app/terms/page.tsx'])

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .join('\n')
}

function check(file: string) {
  const src = stripComments(readFileSync(join(process.cwd(), file), 'utf8'))
  const withoutBonus = src.replace(/\$500(?=[^\n]{0,30}bonus)/g, '')
  if (!WORDING_ONLY.has(file)) expect(withoutBonus, `${file} has a dollar amount`).not.toMatch(/\$\s?\d/)
  expect(src, `${file} has price wording`).not.toMatch(/per seat|per month|discounts?\b|savings|volume pricing|list price/i)
}

describe('no public prices', () => {
  it.each(PUBLIC_FILES)('%s shows no amounts or cost wording', (file) => check(file))
  it.each(EXTENDED_FILES)('%s (extended scope) shows no amounts or cost wording', (file) => check(file))
  it('pitch defaults make no cost comparison with legacy outplacement (extended scope)', () => {
    const src = stripComments(readFileSync(join(process.cwd(), 'src/lib/pitch/defaults.ts'), 'utf8'))
    expect(src).not.toMatch(/costs less|cost-effective|cost per participant|legacy outplacement/i)
  })
  it('retired the cost calculator and incumbent cost ranges', () => {
    expect(() => readFileSync(join(process.cwd(), 'src/components/marketing/CostCalculator.tsx'))).toThrow()
    expect(() => readFileSync(join(process.cwd(), 'src/lib/marketing/incumbent-cost-ranges.ts'))).toThrow()
  })
})
