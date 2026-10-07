// Victoria's weekly advice shows numbers as numerals with the key ones bold.
import { describe, it, expect } from 'vitest'
import { numeralize, boldNumbers } from '@/lib/reports/weekly-focus-format'

describe('numeralize', () => {
  it('converts spelled-out counts', () => {
    expect(numeralize('Zero applications went out this week')).toBe('0 applications went out this week')
    expect(numeralize('Ten people are currently owed a follow-up')).toBe('10 people are currently owed a follow-up')
    expect(numeralize('aiming to book at least one call')).toBe('aiming to book at least 1 call')
    expect(numeralize('send one more message')).toBe('send 1 more message')
  })
  it('leaves "one" as a pronoun alone', () => {
    expect(numeralize('the one that is working')).toBe('the one that is working')
    expect(numeralize('someone noticed')).toBe('someone noticed')
  })
})

describe('boldNumbers', () => {
  it('marks numbers and their units', () => {
    expect(boldNumbers('0 applications against a 15/week goal, 2 messages')).toEqual([
      { text: '0', bold: true }, { text: ' applications against a ', bold: false }, { text: '15/week', bold: true },
      { text: ' goal, ', bold: false }, { text: '2', bold: true }, { text: ' messages', bold: false },
    ])
  })
})
