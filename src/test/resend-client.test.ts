import { describe, expect, it, vi } from 'vitest'

const send = vi.fn(async (_payload: { to: string | string[] }, _options?: unknown) => ({ data: { id: 'real' }, error: null, headers: null }))

vi.mock('resend', () => ({
  Resend: class {
    emails = { send }
  },
}))

import { createResend, isUndeliverableAddress } from '@/lib/email/resend-client'

describe('isUndeliverableAddress', () => {
  it.each([
    'test-candidate-01@nextchapter.test',
    'scratch-net-1786545881105@nextchapter.test',
    'Someone <x@demo.invalid>',
    'a@example.com',
    'A@EXAMPLE.ORG',
  ])('flags %s', (a) => expect(isUndeliverableAddress(a)).toBe(true))

  it.each(['justin@launchyournextchapter.com', 'jkulla@alum.mit.edu', 'tester@gmail.com', 'nodomain'])(
    'allows %s',
    (a) => expect(isUndeliverableAddress(a)).toBe(false),
  )
})

describe('createResend().emails.send', () => {
  it('skips a send whose only recipient is undeliverable, reporting success', async () => {
    send.mockClear()
    const r = await createResend('k').emails.send({ from: 'a@b.com', to: 'test-candidate-01@nextchapter.test', subject: 's', html: 'x' })
    expect(send).not.toHaveBeenCalled()
    expect(r.error).toBeNull()
    expect(r.data?.id).toBe('skipped-undeliverable-recipient')
  })

  it('passes a deliverable single recipient through untouched', async () => {
    send.mockClear()
    const payload = { from: 'a@b.com', to: 'real@gmail.com', subject: 's', html: 'x' }
    await createResend('k').emails.send(payload)
    expect(send).toHaveBeenCalledWith(payload, undefined)
  })

  it('strips undeliverable recipients from a mixed list', async () => {
    send.mockClear()
    await createResend('k').emails.send({ from: 'a@b.com', to: ['real@gmail.com', 'x@nextchapter.test'], subject: 's', html: 'x' })
    expect(send.mock.calls[0][0].to).toEqual(['real@gmail.com'])
  })
})
