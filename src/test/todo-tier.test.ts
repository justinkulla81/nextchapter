import { describe, it, expect } from 'vitest'
import { todoTier, etWallToUtc, dueTimeLabel } from '@/lib/crm/todo-source'

describe('todoTier', () => {
  it('files meeting steps, including waiting-on ones, under calls', () => {
    expect(todoTier({ sourceRef: 'evt:1', title: 'Send deck', kind: 'FOLLOW_UP' })).toBe('call')
    expect(todoTier({ sourceRef: 'evt:2', title: 'Waiting on Ann: contract', kind: 'ADMIN' })).toBe('call')
  })
  it('files system-issue tasks (ADMIN, no sourceRef) as system', () => {
    expect(todoTier({ sourceRef: null, title: 'Spam wave on contact form', kind: 'ADMIN' })).toBe('system')
  })
  it('keeps lead tasks automated and typed ones as to-dos', () => {
    expect(todoTier({ sourceRef: null, title: 'Find a contact at Acme (P0 rapid response)', kind: 'FOLLOW_UP' })).toBe('automated')
    expect(todoTier({ sourceRef: null, title: 'Call the printer', kind: 'FOLLOW_UP' })).toBe('todo')
  })
})

describe('etWallToUtc', () => {
  it('uses EDT before the November change and EST after', () => {
    expect(etWallToUtc('2026-10-23', '15:30').toISOString()).toBe('2026-10-23T19:30:00.000Z')
    expect(etWallToUtc('2026-11-10', '15:30').toISOString()).toBe('2026-11-10T20:30:00.000Z')
  })
  it('hides the default 9:00 AM ET time and shows others', () => {
    expect(dueTimeLabel(new Date('2026-10-23T13:00:00Z'))).toBeNull()
    expect(dueTimeLabel(new Date('2026-10-23T19:30:00Z'))).toBe('3:30 PM ET')
  })
})
