// The CRM sync turns an email display name into a person's name. Directory-
// style senders put the surname first and tag the org after it; the result
// has to match the record already in the CRM ("Taylor Stockton").
import { describe, it, expect } from 'vitest'
import { personNameFromDisplay } from '@/lib/crm/sync-matching'
import { namesLookAlike } from '@/lib/text/person-name-match'

describe('personNameFromDisplay', () => {
  const cases: [string, string][] = [
    ['Stockton, Taylor C - ETA', 'Taylor Stockton'],
    ['Stockton, Taylor C. - ETA', 'Taylor Stockton'],
    ['Doe, Jane', 'Jane Doe'],
    ['Jane Doe, MBA', 'Jane Doe'],
    ['Jane Doe, Ph.D.', 'Jane Doe'],
    ['Taylor Stockton', 'Taylor Stockton'],
    ['Taylor Stockton (DOL)', 'Taylor Stockton'],
    ['Taylor Stockton | Acme', 'Taylor Stockton'],
    ['"Kulla, Justin"', 'Justin Kulla'],
  ]
  for (const [raw, want] of cases) it(`${raw} → ${want}`, () => expect(personNameFromDisplay(raw)).toBe(want))

  it('matches the CRM record for the Department of Labor sender', () => {
    expect(namesLookAlike(personNameFromDisplay('Stockton, Taylor C - ETA')!, 'Taylor Stockton')).toBe(true)
  })
  it('empty in, null out', () => expect(personNameFromDisplay(null)).toBeNull())
})
