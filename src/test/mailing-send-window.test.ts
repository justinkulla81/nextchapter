import { describe, expect, it } from 'vitest'
import { inSendWindow } from '@/lib/mailing/editions'

describe('inSendWindow', () => {
  it('is open from 7:00 a.m. to 5:00 p.m. Eastern', () => {
    expect(inSendWindow(new Date('2026-11-12T12:00:00Z'))).toBe(true) // 7:00 a.m. EST
    expect(inSendWindow(new Date('2026-11-12T21:59:00Z'))).toBe(true) // 4:59 p.m. EST
  })
  it('is closed overnight', () => {
    expect(inSendWindow(new Date('2026-11-12T11:59:00Z'))).toBe(false) // 6:59 a.m. EST
    expect(inSendWindow(new Date('2026-11-12T22:00:00Z'))).toBe(false) // 5:00 p.m. EST
    expect(inSendWindow(new Date('2026-11-13T04:00:00Z'))).toBe(false) // 11:00 p.m. EST
  })
})
