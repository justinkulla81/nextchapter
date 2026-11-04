import { beforeEach, describe, expect, it, vi } from 'vitest'

const send = vi.fn()
const crmPersonFindFirst = vi.fn()

vi.mock('server-only', () => ({}))
vi.mock('@/lib/email/resend-client', () => ({ createResend: () => ({ emails: { send } }) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    helpRequest: {
      findUnique: async () => ({
        id: 'req_1', subject: 'Website will not load', kind: 'PROBLEM', portal: 'CANDIDATE', flaggedCrisis: false,
        contextTitle: 'What I Need', contextPath: '/dashboard/what-i-need', createdAt: new Date(), candidateId: 'cand_1',
      }),
    },
    candidateProfile: { findUnique: async () => ({ firstName: 'Chris', lastName: 'Bates', email: 'chris@example.com' }) },
    helpMessage: { findMany: async () => [] },
    crmPerson: { findFirst: (...a: unknown[]) => crmPersonFindFirst(...a) },
  },
}))

import { notifyAdminOfHelp } from '@/lib/help/notify'

const ADMIN = 'https://admin.launchyournextchapter.com'

describe('help alert email links', () => {
  beforeEach(() => {
    send.mockReset().mockResolvedValue({ error: null })
    crmPersonFindFirst.mockReset()
    process.env.RESEND_API_KEY = 're_test'
  })

  it('links the ticket page and the CRM record', async () => {
    crmPersonFindFirst.mockResolvedValue({ id: 'person_9' })
    await notifyAdminOfHelp('req_1', 'Website will continuously load', false)
    const mail = send.mock.calls[0][0]
    expect(mail.html).toContain(`${ADMIN}/support/admin/help/req_1`)
    expect(mail.html).toContain(`${ADMIN}/support/admin/crm/people/person_9`)
    expect(mail.text).toContain(`Ticket (reply here): ${ADMIN}/support/admin/help/req_1`)
    expect(mail.text).toContain(`CRM record: ${ADMIN}/support/admin/crm/people/person_9`)
  })

  it('falls back to the candidate page when there is no CRM person yet', async () => {
    crmPersonFindFirst.mockResolvedValue(null)
    await notifyAdminOfHelp('req_1', 'Website will continuously load', false)
    expect(send.mock.calls[0][0].html).toContain(`${ADMIN}/support/admin/candidates/cand_1`)
  })

  it('still sends the ticket link when the CRM lookup fails', async () => {
    crmPersonFindFirst.mockRejectedValue(new Error('db down'))
    await notifyAdminOfHelp('req_1', 'Website will continuously load', false)
    const mail = send.mock.calls[0][0]
    expect(mail.html).toContain(`${ADMIN}/support/admin/help/req_1`)
    expect(mail.html).not.toContain('in the CRM')
  })
})
