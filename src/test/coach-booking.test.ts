import { describe, expect, it } from 'vitest'
import { generateSlots, isOpenSlot, isValidTimeZone, zonedParts, zonedWallTimeToInstant, type BookingSettings } from '@/lib/coach/booking/slots'

const NY = 'America/New_York'
const settings = (over: Partial<BookingSettings> = {}): BookingSettings => ({
  timezone: NY,
  slotMinutes: 60,
  bufferMinutes: 0,
  minNoticeHours: 0,
  maxDaysAhead: 7,
  ...over,
})
// Monday 9:00 to 12:00 and Wednesday 13:00 to 14:00, in the coach's zone.
const windows = [
  { weekday: 1, startMinute: 9 * 60, endMinute: 12 * 60 },
  { weekday: 3, startMinute: 13 * 60, endMinute: 14 * 60 },
]
const local = (iso: string, tz = NY) => {
  const [d, t] = iso.split(' ')
  const [y, mo, da] = d.split('-').map(Number)
  const [h, mi] = t.split(':').map(Number)
  return zonedWallTimeToInstant(y, mo, da, h * 60 + mi, tz)
}
const hoursLocal = (slots: Date[]) => slots.map((s) => `${zonedParts(s, NY).hour}:${String(zonedParts(s, NY).minute).padStart(2, '0')}`)

describe('zoned time conversion', () => {
  it('maps wall time to the right instant in winter and summer', () => {
    expect(local('2026-01-12 09:00').toISOString()).toBe('2026-01-12T14:00:00.000Z') // EST, UTC-5
    expect(local('2026-07-13 09:00').toISOString()).toBe('2026-07-13T13:00:00.000Z') // EDT, UTC-4
  })

  it('works for zones ahead of UTC and ones with half-hour offsets', () => {
    expect(zonedWallTimeToInstant(2026, 1, 12, 9 * 60, 'Asia/Kolkata').toISOString()).toBe('2026-01-12T03:30:00.000Z')
    expect(zonedWallTimeToInstant(2026, 1, 12, 9 * 60, 'Europe/London').toISOString()).toBe('2026-01-12T09:00:00.000Z')
  })

  it('keeps wall-clock hours steady across the spring clock change', () => {
    // US clocks moved forward on 2026-03-08. 9:00 the day before and the day after are both 9:00 local.
    expect(zonedParts(local('2026-03-07 09:00'), NY).hour).toBe(9)
    expect(zonedParts(local('2026-03-09 09:00'), NY).hour).toBe(9)
    expect(local('2026-03-07 09:00').toISOString()).toBe('2026-03-07T14:00:00.000Z')
    expect(local('2026-03-09 09:00').toISOString()).toBe('2026-03-09T13:00:00.000Z')
  })

  it('validates zone names', () => {
    expect(isValidTimeZone('America/Chicago')).toBe(true)
    expect(isValidTimeZone('Mars/Olympus')).toBe(false)
  })
})

describe('generateSlots', () => {
  const now = local('2026-01-11 08:00') // Sunday morning

  it('lists the hour-long slots inside each window', () => {
    const slots = generateSlots({ settings: settings(), windows, busy: [], now })
    expect(hoursLocal(slots)).toEqual(['9:00', '10:00', '11:00', '13:00'])
    expect(slots[0].toISOString()).toBe('2026-01-12T14:00:00.000Z')
  })

  it('drops a slot that is already booked, and the one the buffer would crowd', () => {
    const booked = { startsAt: local('2026-01-12 10:00'), endsAt: local('2026-01-12 11:00') }
    expect(hoursLocal(generateSlots({ settings: settings(), windows, busy: [booked], now }))).toEqual(['9:00', '11:00', '13:00'])
    // With a 15 minute buffer, 9:00 would end right at the booking and 11:00 would start right after it,
    // so both are gone, and only Wednesday's slot is left.
    expect(hoursLocal(generateSlots({ settings: settings({ bufferMinutes: 15 }), windows, busy: [booked], now }))).toEqual(['13:00'])
  })

  it('respects minimum notice and how far ahead people can book', () => {
    const tightNow = local('2026-01-12 08:30')
    const withNotice = generateSlots({ settings: settings({ minNoticeHours: 2, maxDaysAhead: 6 }), windows, busy: [], now: tightNow })
    expect(hoursLocal(withNotice)).toEqual(['11:00', '13:00'])
    const nearOnly = generateSlots({ settings: settings({ maxDaysAhead: 1 }), windows, busy: [], now })
    expect(hoursLocal(nearOnly)).toEqual(['9:00', '10:00', '11:00'])
  })

  it('fits 45 minute slots without running past the end of the window', () => {
    const slots = generateSlots({ settings: settings({ slotMinutes: 45 }), windows: [windows[0]], busy: [], now })
    expect(hoursLocal(slots)).toEqual(['9:00', '9:45', '10:30', '11:15'])
  })

  it('ignores empty windows and weekdays with none', () => {
    expect(generateSlots({ settings: settings(), windows: [{ weekday: 1, startMinute: 600, endMinute: 600 }], busy: [], now })).toEqual([])
    expect(generateSlots({ settings: settings(), windows: [], busy: [], now })).toEqual([])
  })

  it('reads hours in the coach zone, not the viewer’s', () => {
    const tokyoNow = local('2026-01-11 08:00', 'Asia/Tokyo')
    const slots = generateSlots({ settings: settings({ timezone: 'Asia/Tokyo' }), windows: [windows[0]], busy: [], now: tokyoNow })
    expect(slots[0].toISOString()).toBe('2026-01-12T00:00:00.000Z') // 9:00 in Tokyo is midnight UTC
  })

  it('confirms whether a start time is currently open', () => {
    const input = { settings: settings(), windows, busy: [], now }
    expect(isOpenSlot(local('2026-01-12 10:00'), input)).toBe(true)
    expect(isOpenSlot(local('2026-01-12 10:30'), input)).toBe(false)
    expect(isOpenSlot(local('2026-01-12 12:00'), input)).toBe(false)
  })
})
