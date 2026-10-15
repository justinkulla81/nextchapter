import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { isSuppressed, looksLikeNonWorkSender, suppressionTarget } from './suppressed-senders'

describe('suppressionTarget', () => {
  it('blocks a whole domain for spam or school senders', () => {
    expect(suppressionTarget('Room Parent <news@mail.pta.org>', 'domain')).toEqual({ value: 'mail.pta.org', isDomain: true })
  })
  it('never blocks a consumer mailbox domain', () => {
    expect(suppressionTarget('mom@gmail.com', 'domain')).toEqual({ value: 'mom@gmail.com', isDomain: false })
  })
  it('uses the address for family', () => {
    expect(suppressionTarget('"Dad" <dad@example.com>', 'address')).toEqual({ value: 'dad@example.com', isDomain: false })
  })
})

describe('isSuppressed', () => {
  const set = { addresses: new Set(['dad@example.com']), domains: new Set(['pta.org']) }
  it('matches exact addresses, headers, and subdomains', () => {
    expect(isSuppressed(set, 'Dad <DAD@example.com>')).toBe(true)
    expect(isSuppressed(set, 'x@mail.pta.org')).toBe(true)
    expect(isSuppressed(set, 'x@notpta.org')).toBe(false)
    expect(isSuppressed(set, null)).toBe(false)
  })
})

describe('looksLikeNonWorkSender', () => {
  it('catches automated and school mail but not people', () => {
    expect(looksLikeNonWorkSender('noreply@acme.com')).toBe(true)
    expect(looksLikeNonWorkSender('office@lincoln.k12.ca.us')).toBe(true)
    expect(looksLikeNonWorkSender('hello@parentsquare.com')).toBe(true)
    expect(looksLikeNonWorkSender('dana.lee@acme.com')).toBe(false)
    expect(looksLikeNonWorkSender('recruiter@gmail.com')).toBe(false)
  })
})
