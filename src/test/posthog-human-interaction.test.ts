import { describe, expect, it, vi } from 'vitest'
import { watchForHumanInteraction, type InteractionTarget } from '@/lib/posthog/human-interaction'

function fakeTarget() {
  const handlers = new Map<string, (event: { isTrusted: boolean }) => void>()
  const target: InteractionTarget = {
    addEventListener: (type, listener) => void handlers.set(type, listener),
    removeEventListener: (type) => void handlers.delete(type),
  }
  return { target, handlers, fire: (type: string, isTrusted: boolean) => handlers.get(type)?.({ isTrusted }) }
}

describe('watchForHumanInteraction', () => {
  it('ignores script-dispatched events', () => {
    const t = fakeTarget()
    const onFirst = vi.fn()
    watchForHumanInteraction(t.target, onFirst)
    t.fire('pointerdown', false)
    t.fire('keydown', false)
    expect(onFirst).not.toHaveBeenCalled()
  })

  it('fires once on the first trusted input, with its kind, then stops listening', () => {
    const t = fakeTarget()
    const onFirst = vi.fn()
    watchForHumanInteraction(t.target, onFirst)
    t.fire('wheel', true)
    t.fire('keydown', true)
    expect(onFirst).toHaveBeenCalledTimes(1)
    expect(onFirst).toHaveBeenCalledWith('wheel')
    expect(t.handlers.size).toBe(0)
  })

  it('can be stopped before any input', () => {
    const t = fakeTarget()
    const onFirst = vi.fn()
    const stop = watchForHumanInteraction(t.target, onFirst)
    stop()
    expect(t.handlers.size).toBe(0)
    expect(onFirst).not.toHaveBeenCalled()
  })

  it('listens for pointer, key, touch and wheel input', () => {
    const t = fakeTarget()
    watchForHumanInteraction(t.target, () => undefined)
    expect([...t.handlers.keys()].sort()).toEqual(['keydown', 'pointerdown', 'touchstart', 'wheel'])
  })
})
