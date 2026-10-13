import { describe, it, expect, beforeAll } from 'vitest'
import {
  audienceUnsubscribeUrl,
  candidateUnsubscribeUrl,
  interimCheckInUrl,
  verifyLink,
} from '@/lib/email/signed-links'

const APP = 'https://example.test'
beforeAll(() => {
  process.env.LINK_SIGNING_SECRET = 'unit-test-signing-secret-0123456789'
})

const sigOf = (url: string) => new URL(url).searchParams.get('sig')

describe('signed email links', () => {
  it('candidate unsubscribe: verifies for its own id and type only', () => {
    const url = candidateUnsubscribeUrl(APP, 'cand_1', 'weekly')
    expect(url.startsWith(`${APP}/api/unsubscribe/cand_1?`)).toBe(true)
    expect(new URL(url).searchParams.get('type')).toBe('weekly')
    const sig = sigOf(url)
    expect(verifyLink(sig, 'unsub-candidate', 'cand_1', 'weekly')).toBe(true)
    expect(verifyLink(sig, 'unsub-candidate', 'cand_2', 'weekly')).toBe(false)
    expect(verifyLink(sig, 'unsub-candidate', 'cand_1', 'daily')).toBe(false)
    expect(verifyLink(sig, 'unsub-audience', 'cand_1', 'weekly')).toBe(false)
  })

  it('candidate unsubscribe without a type signs the empty type', () => {
    const url = candidateUnsubscribeUrl(APP, 'cand_1')
    expect(new URL(url).searchParams.has('type')).toBe(false)
    expect(verifyLink(sigOf(url), 'unsub-candidate', 'cand_1', '')).toBe(true)
  })

  it('audience unsubscribe binds audience and id', () => {
    const url = audienceUnsubscribeUrl(APP, 'recruiter', 'r1', 'candidate-alert')
    expect(url.startsWith(`${APP}/api/unsubscribe/audience/recruiter/r1?`)).toBe(true)
    const sig = sigOf(url)
    expect(verifyLink(sig, 'unsub-audience', 'recruiter', 'r1')).toBe(true)
    expect(verifyLink(sig, 'unsub-audience', 'coach', 'r1')).toBe(false)
    expect(verifyLink(sig, 'unsub-audience', 'recruiter', 'r2')).toBe(false)
  })

  it('interim check-in binds entry and response', () => {
    const ended = interimCheckInUrl(APP, 'e1', 'ended')
    expect(verifyLink(sigOf(ended), 'interim-check-in', 'e1', 'ended')).toBe(true)
    // An "active" link cannot be edited into an "ended" one.
    expect(verifyLink(sigOf(ended), 'interim-check-in', 'e1', 'active')).toBe(false)
  })

  it('rejects missing, truncated and tampered signatures', () => {
    const sig = sigOf(candidateUnsubscribeUrl(APP, 'c', 'daily'))!
    expect(verifyLink(null, 'unsub-candidate', 'c', 'daily')).toBe(false)
    expect(verifyLink('', 'unsub-candidate', 'c', 'daily')).toBe(false)
    expect(verifyLink(sig.slice(0, -1), 'unsub-candidate', 'c', 'daily')).toBe(false)
    expect(verifyLink(sig.slice(0, -1) + (sig.endsWith('A') ? 'B' : 'A'), 'unsub-candidate', 'c', 'daily')).toBe(false)
  })

  it('a different secret invalidates previously issued links', () => {
    const sig = sigOf(candidateUnsubscribeUrl(APP, 'c', 'daily'))
    process.env.LINK_SIGNING_SECRET = 'a-completely-different-secret-value'
    expect(verifyLink(sig, 'unsub-candidate', 'c', 'daily')).toBe(false)
    process.env.LINK_SIGNING_SECRET = 'unit-test-signing-secret-0123456789'
    expect(verifyLink(sig, 'unsub-candidate', 'c', 'daily')).toBe(true)
  })
})
