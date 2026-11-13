import { describe, expect, it } from 'vitest'
import { inLayoffSendWindow, inSendWindow } from '@/lib/mailing/editions'

describe('inLayoffSendWindow', () => {
  it('is open weekdays 8:00 a.m. to noon Eastern', () => {
    expect(inLayoffSendWindow(new Date('2026-11-13T13:00:00Z'))).toBe(true) // Fri 8:00 a.m. EST
    expect(inLayoffSendWindow(new Date('2026-11-13T16:59:00Z'))).toBe(true) // Fri 11:59 a.m. EST
  })
  it('is closed overnight, afternoons and weekends', () => {
    expect(inLayoffSendWindow(new Date('2026-11-13T07:02:00Z'))).toBe(false) // Fri 2:02 a.m. EST
    expect(inLayoffSendWindow(new Date('2026-11-13T12:59:00Z'))).toBe(false) // Fri 7:59 a.m. EST
    expect(inLayoffSendWindow(new Date('2026-11-13T17:00:00Z'))).toBe(false) // Fri noon EST
    expect(inLayoffSendWindow(new Date('2026-11-14T15:00:00Z'))).toBe(false) // Sat 10:00 a.m. EST
  })
})

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
