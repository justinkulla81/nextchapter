import { describe, expect, it } from 'vitest'
import { buildCountryRequest, countryName, parseCountryReply } from '@/lib/warn/layoff-country-rules'

describe('parseCountryReply', () => {
  it('reads codes and nulls by id, even wrapped in prose', () => {
    const m = parseCountryReply('Here you go: {"a":"au","b":null,"c":"UK"}', ['a', 'b', 'c'])
    expect(m.get('a')).toBe('AU')
    expect(m.get('b')).toBeNull()
    expect(m.get('c')).toBe('GB')
  })
  it('leaves out ids the reply skipped or got wrong, so they are asked again', () => {
    const m = parseCountryReply('{"a":"Australia","b":5,"c":"ZZ"}', ['a', 'b', 'c', 'd'])
    expect([...m.keys()]).toEqual([])
  })
  it('survives a reply that is not JSON', () => {
    expect(parseCountryReply('sorry', ['a']).size).toBe(0)
  })
})

describe('buildCountryRequest', () => {
  it('lists every layoff with its id and headlines', () => {
    const r = buildCountryRequest([{ id: 'x1', employer: 'KPMG', headlines: ['KPMG to cut jobs in Australia'], sourceUrl: 'https://afr.com/a' }])
    expect(r.messages[0].content).toContain('id x1')
    expect(r.messages[0].content).toContain('KPMG to cut jobs in Australia')
  })
})

describe('countryName', () => {
  it('names a code', () => expect(countryName('GB')).toBe('United Kingdom'))
})
