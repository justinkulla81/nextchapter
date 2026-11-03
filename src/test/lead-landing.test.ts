import { describe, expect, it } from 'vitest'
import { LEAD_OFFERS } from '@/lib/marketing/lead-landing'
import { APP_TOP_LEVEL } from '@/lib/app-top-level'
import { readFileSync } from 'node:fs'

describe('lead landing pages', () => {
  const offers = Object.values(LEAD_OFFERS)

  it('has a path under /lp that matches its key', () => {
    for (const o of offers) expect(o.path).toBe(`/lp/${o.key}`)
    expect(APP_TOP_LEVEL.has('lp')).toBe(true)
  })

  it('shows three reasons, three problems, three steps and three screens', () => {
    for (const o of offers) {
      expect(o.bullets).toHaveLength(3)
      expect(o.pains).toHaveLength(3)
      expect(o.steps).toHaveLength(3)
      expect(o.shots).toHaveLength(3)
    }
  })

  it('offers at most four choices, so they are shown as buttons', () => {
    for (const o of offers) expect(o.form.choices.length).toBeLessThanOrEqual(4)
  })

  it('files each lead under a source the contact action accepts', () => {
    const actions = readFileSync('src/app/contact/actions.ts', 'utf8')
    for (const o of offers) expect(actions).toContain(`'lp-${o.key}'`)
  })

  it('states no dollar amount and no customer claim', () => {
    for (const o of offers) {
      const text = JSON.stringify([o.headline, o.subhead, o.bullets, o.pains, o.steps, o.faq, o.form, o.success])
      expect(text).not.toMatch(/\$\d/)
      expect(text).not.toMatch(/trusted by|customers like|leading companies/i)
    }
  })
})
