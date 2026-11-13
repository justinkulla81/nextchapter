import { describe, expect, it } from 'vitest'
import { cleanName, readLayoffHeadline } from '@/lib/warn/news-headline'

describe('cleanName', () => {
  it('takes the company from a unit of it and drops a verb stuck to the name', () => {
    expect(cleanName('SpaceX’s AI Group')).toBe('SpaceX')
    expect(cleanName("Google's cloud unit")).toBe('Google')
    expect(cleanName('PVH Simplifies')).toBe('PVH')
    expect(cleanName('Marriott')).toBe('Marriott')
    expect(cleanName('Sherwin-Williams')).toBe('Sherwin-Williams')
  })
  it('leaves a name that only ends in a verb-like word inside a longer brand alone when it is not at the end', () => {
    expect(cleanName('Cuts Clothing')).toBe('Cuts Clothing')
  })
})

describe('readLayoffHeadline with cleaned names', () => {
  it('files a unit layoff under the company', () => {
    expect(readLayoffHeadline("SpaceX's AI group cuts 60 jobs")?.company).toBe('SpaceX')
  })
})

describe('readLayoffHeadline counts', () => {
  it('does not read a word starting with K as thousands (Voestalpine, 2026-11-13: 150 became 150,000)', () => {
    expect(readLayoffHeadline('Voestalpine to cut 150 Kindberg jobs')?.employees).toBe(150)
    expect(readLayoffHeadline('Acme to cut 15k jobs')?.employees).toBe(15000)
  })
})
