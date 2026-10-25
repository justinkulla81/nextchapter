import { describe, expect, it } from 'vitest'
import { canonicalFromEmployerSlug, employerSlug, idSuffixFromSlug, readable } from '@/lib/seo/employer-slug'

describe('employerSlug', () => {
  it('joins plain names with hyphens and reverses them', () => {
    expect(employerSlug('american express', 'cmabc123456')).toBe('american-express')
    expect(canonicalFromEmployerSlug('american-express')).toBe('american express')
  })
  it('adds an id suffix when the name has punctuation', () => {
    expect(employerSlug('at&t', 'cmabc123456')).toBe('at-and-t-123456')
    expect(idSuffixFromSlug('at-and-t-123456')).toBe('123456')
  })
  it('never returns an empty slug', () => {
    expect(employerSlug('***', 'cmabc123456')).toBe('employer-123456')
    expect(readable('Netflix, Inc.')).toBe('netflix-inc')
  })
})
