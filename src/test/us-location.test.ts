import { describe, it, expect } from 'vitest'
import { classifyLocation, isUsLocation } from '@/lib/jobs/us-location'

const us = (l: string) => expect(classifyLocation(l), l).toBe('us')
const non = (l: string) => expect(classifyLocation(l), l).toBe('non_us')
const unk = (l: string | null) => expect(classifyLocation(l), String(l)).toBe('unknown')

describe('US jobs the old substring filter wrongly rejected', () => {
  it('state names that contain a country name', () => {
    us('Indianapolis, Indiana')
    us('Albuquerque, New Mexico')
    us('Santa Fe, NM')
    us('Indianapolis, IN')
  })
  it('US towns named after foreign cities or countries', () => {
    us('Paris, TX')
    us('London, KY')
    us('Dublin, OH')
    us('Manchester, NH')
    us('Berlin, CT')
    us('Lebanon, PA')
    us('China Grove, NC')
    us('Vancouver, WA')
    us('Cambridge, MA')
  })
  it('real US formats from the board', () => {
    us('Princeton - NJ - US')
    us('Beaverton, Oregon')
    us('Seattle, Washington')
    us("O'Fallon, Missouri")
    us('Washington, D.C.')
    us('San Francisco, CA')
    us('Remote - United States')
    us('United States')
    us('USA')
  })
})

describe('non-US jobs the old filter let through', () => {
  it('cities with no country', () => {
    non('Bengaluru')
    non('Gurugram')
    non('Taichung')
  })
  it('countries missing from the old list, and country codes', () => {
    non('Taichung - Fab 16, Taiwan')
    non('Laem Chabang, 20, TH')
    non('Penang, 07, MY')
    non('Hsinchu, TW')
  })
  it('countries and cities as before', () => {
    non('Toronto, ON, Canada')
    non('London, United Kingdom')
    non('Remote - Canada')
    non('Berlin')
    non('Mexico City')
    non('Sydney, Australia')
    non('Indianapolis, IN, India')
  })
})

describe('well-known bare US cities', () => {
  it('resolve to US only when no foreign signal is present', () => {
    us('Chicago')
    us('San Francisco')
    us('San Francisco Bay Area')
    us('STORE SUPPORT CENTER, ATLANTA - 9090')
    non('Paris')
  })
})

describe('unknown is kept but never called US', () => {
  it('has no usable signal', () => {
    unk(null)
    unk('')
    unk('Remote')
    unk('Hybrid')
    unk('2 Locations')
    unk('Distributed')
  })
  it('isUsLocation rejects only confident non-US', () => {
    expect(isUsLocation(null)).toBe(true)
    expect(isUsLocation('Remote')).toBe(true)
    expect(isUsLocation('Indianapolis, Indiana')).toBe(true)
    expect(isUsLocation('Bengaluru')).toBe(false)
  })
})
