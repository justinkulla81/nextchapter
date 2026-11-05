import { describe, expect, it } from 'vitest'
import { START_PAYOFF, isEmail, startDestination } from './start-gate'

describe('startDestination', () => {
  it('adds the source as from= and keeps the Market Reality goal', () => {
    expect(startDestination('/onboarding/desire?goal=market-reality', 'home_hero')).toBe('/onboarding/desire?goal=market-reality&from=home_hero')
    expect(startDestination('/onboarding/desire', 'about_hero')).toBe('/onboarding/desire?from=about_hero')
  })
  it('keeps a from= the link already names', () => {
    expect(startDestination('/onboarding/desire?from=jobs_page', 'job_fit_x')).toBe('/onboarding/desire?from=jobs_page')
  })
  it('never follows a path that is not onboarding', () => {
    expect(startDestination('https://evil.example/x', 'a')).toBe('/onboarding/desire?from=a')
    expect(startDestination('/dashboard', 'a')).toBe('/onboarding/desire?from=a')
  })
})

describe('isEmail', () => {
  it('accepts an address and rejects words', () => {
    expect(isEmail(' ana@example.com ')).toBe(true)
    expect(isEmail('ana')).toBe(false)
    expect(isEmail('ana@')).toBe(false)
  })
})

describe('START_PAYOFF', () => {
  it('has the three lines the onboarding really delivers', () => {
    expect(START_PAYOFF).toHaveLength(3)
  })
})
