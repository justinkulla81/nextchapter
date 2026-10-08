import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { isSafeWebhookUrl, signWebhookBody } from '@/lib/recruiter/webhook-shared'

describe('firm webhooks', () => {
  it('signs "<timestamp>.<body>" with HMAC-SHA256', () => {
    const header = signWebhookBody('whsec_test', 1700000000, '{"a":1}')
    const expected = createHmac('sha256', 'whsec_test').update('1700000000.{"a":1}').digest('hex')
    expect(header).toBe(`t=1700000000,v1=${expected}`)
  })

  it('accepts public https addresses', () => {
    expect(isSafeWebhookUrl('https://hooks.example.com/nextchapter')).toEqual({ ok: true, url: 'https://hooks.example.com/nextchapter' })
  })

  it('rejects http, localhost, private ranges, IPv6 and credentials', () => {
    for (const bad of [
      'http://example.com/h', 'https://localhost/h', 'https://127.0.0.1/h', 'https://10.1.2.3/h', 'https://192.168.1.5/h',
      'https://172.20.0.1/h', 'https://169.254.169.254/latest', 'https://[::1]/h', 'https://foo.internal/h', 'https://user:pw@example.com/h', 'not a url',
    ]) {
      expect(isSafeWebhookUrl(bad).ok, bad).toBe(false)
    }
  })
})
