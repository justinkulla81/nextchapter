import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const getCurrentWeekSprint = vi.fn()
const autoCompleteEngagementAction = vi.fn()
vi.mock('@/lib/weekly/sprint', () => ({
  getCurrentWeekSprint: (...args: unknown[]) => getCurrentWeekSprint(...args),
  autoCompleteEngagementAction: (...args: unknown[]) => autoCompleteEngagementAction(...args),
}))
const captureServerEvent = vi.fn()
vi.mock('@/lib/posthog/server', () => ({ captureServerEvent: (...args: unknown[]) => captureServerEvent(...args) }))

import { creditWeeklyLogin } from './login-credit'

beforeEach(() => {
  getCurrentWeekSprint.mockReset()
  autoCompleteEngagementAction.mockReset()
  captureServerEvent.mockReset()
})

describe('creditWeeklyLogin', () => {
  it('credits the first login of the week with a tiny amount, and records it', async () => {
    getCurrentWeekSprint.mockResolvedValue({ committedActions: [{ actionType: 'OUTREACH_MESSAGE', completed: true }] })
    await creditWeeklyLogin('c1')
    expect(autoCompleteEngagementAction).toHaveBeenCalledTimes(1)
    expect(autoCompleteEngagementAction).toHaveBeenCalledWith('c1', expect.objectContaining({ actionType: 'LOGIN_VISIT', points: 2 }))
    expect(captureServerEvent).toHaveBeenCalledWith('c1', 'weekly_login_credited', { points: 2 })
  })

  it('does not credit a second login in the same week', async () => {
    getCurrentWeekSprint.mockResolvedValue({ committedActions: [{ actionType: 'LOGIN_VISIT', completed: true }] })
    await creditWeeklyLogin('c1')
    expect(autoCompleteEngagementAction).not.toHaveBeenCalled()
    expect(captureServerEvent).not.toHaveBeenCalled()
  })

  it('gives a member with no sprint yet nothing, and creates nothing for them', async () => {
    getCurrentWeekSprint.mockResolvedValue(null)
    await creditWeeklyLogin('c1')
    expect(autoCompleteEngagementAction).not.toHaveBeenCalled()
  })
})
