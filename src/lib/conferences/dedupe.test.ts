import { describe, expect, it } from 'vitest'
import { findExistingSeries } from './dedupe'

const rows = [
  { id: 'hr-tech', name: 'HR Tech Conference', urlKey: 'hrtechconference.com' },
  { id: 'shrm', name: 'SHRM Annual', urlKey: 'shrm.org/annual' },
  { id: 'shrm-talent', name: 'SHRM Talent', urlKey: 'shrm.org/talent' },
]

describe('findExistingSeries', () => {
  it('matches the same canonical URL', () => expect(findExistingSeries(rows, { urlKey: 'hrtechconference.com', name: null })).toEqual({ id: 'hr-tech', by: 'url' }))
  it('matches a year page on a host that holds one series', () => expect(findExistingSeries(rows, { urlKey: 'hrtechconference.com/2027', name: null })).toEqual({ id: 'hr-tech', by: 'url' }))
  it('does not assume a deep path is the same event', () => expect(findExistingSeries(rows, { urlKey: 'hrtechconference.com/a/b/c', name: null })).toBeNull())
  it('matches the same name and year written differently', () => expect(findExistingSeries(rows, { urlKey: 'other.com', name: 'HR Tech 2027' })).toEqual({ id: 'hr-tech', by: 'name' }))
  it('does not merge different events on a shared host', () => expect(findExistingSeries(rows, { urlKey: 'shrm.org/new', name: null })).toBeNull())
  it('never matches on a short or generic name', () => expect(findExistingSeries([{ id: 'x', name: 'Summit', urlKey: null }], { urlKey: null, name: 'The Summit 2027' })).toBeNull())
})
