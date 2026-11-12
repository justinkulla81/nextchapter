import { describe, it, expect } from 'vitest'
import { botClickReason, botOpenReason, burstClickIds, ipBlock, isHumanClick, isHumanOpen } from '@/lib/mailing/click-human'

const delivered = new Date('2026-11-11T15:55:26Z')
const click = (over: Partial<Parameters<typeof botClickReason>[0]> = {}) => ({
  ip: '198.51.100.20',
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_7) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36',
  at: new Date(delivered.getTime() + 10 * 60 * 1000),
  deliveredAt: delivered,
  ...over,
})

describe('which list-email clicks are a person', () => {
  it('counts a click from an ordinary address and browser well after delivery', () => {
    expect(isHumanClick(click(), new Set())).toBe(true)
  })
  it('does not count a click from a cloud network, a known scanner address or a bot browser', () => {
    expect(isHumanClick(click({ ip: '74.176.10.1' }), new Set())).toBe(false)
    expect(isHumanClick(click({ ip: '203.0.113.7' }), new Set(['203.0.113.7']))).toBe(false)
    expect(isHumanClick(click({ userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }), new Set())).toBe(false)
  })
  it('does not count a click from a network block that clicked emails for several different people', () => {
    const blocks = new Set(['205.169.39', '2600:4040:9748'])
    expect(isHumanClick(click({ ip: '205.169.39.210' }), new Set(), blocks)).toBe(false)
    expect(isHumanClick(click({ ip: '2600:4040:9748:3e00::1' }), new Set(), blocks)).toBe(false)
    expect(isHumanClick(click({ ip: '205.169.40.210' }), new Set(), blocks)).toBe(true)
    expect(ipBlock('1.2.3.4')).toBe('1.2.3')
    expect(ipBlock(null)).toBeNull()
  })
  it('does not count a click from an Amazon or Google Cloud address', () => {
    expect(isHumanClick(click({ ip: '3.148.231.115' }), new Set())).toBe(false)
    expect(botClickReason(click({ ip: '44.200.49.139' }), new Set())).toMatch(/Amazon Web Services or Google Cloud/)
  })
  it('does not count a click from a private or loopback address', () => {
    for (const ip of ['10.234.14.96', '192.168.1.5', '172.20.0.1', '127.0.0.1', '100.100.1.1', 'fd00::1']) expect(isHumanClick(click({ ip }), new Set())).toBe(false)
    expect(isHumanClick(click({ ip: '172.32.0.1' }), new Set())).toBe(true) // just outside 172.16.0.0/12
  })
  it('does not count a click within two minutes of delivery, but does after that', () => {
    expect(botClickReason(click({ at: new Date(delivered.getTime() + 60_000) }), new Set())).toMatch(/two minutes/)
    expect(isHumanClick(click({ at: new Date(delivered.getTime() + 3 * 60_000) }), new Set())).toBe(true)
  })
  it('does not count a click from a browser years out of date, but does from a current one', () => {
    const chrome84 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.105 Safari/537.36'
    expect(botClickReason(click({ userAgent: chrome84 }), new Set())).toMatch(/out of date/)
    expect(isHumanClick(click({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; rv:109.0) Gecko/20100101 Firefox/109.0' }), new Set())).toBe(false)
    expect(isHumanClick(click({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36' }), new Set())).toBe(true)
    expect(isHumanClick(click({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' }), new Set())).toBe(true)
    expect(isHumanClick(click({ userAgent: null }), new Set())).toBe(true)
  })
  it('counts a click when delivery is not known and nothing else marks it a bot', () => {
    expect(isHumanClick(click({ deliveredAt: null }), new Set())).toBe(true)
  })
})

describe('scanner bursts on one email', () => {
  const t0 = new Date('2026-11-11T15:00:00Z')
  const c = (id: string, ip: string, ms: number) => ({ id, ip, at: new Date(t0.getTime() + ms) })
  it('marks every click when two addresses clicked the same email within a minute', () => {
    expect(Array.from(burstClickIds([c('a', '1.1.1.1', 0), c('b', '2.2.2.2', 30_000)])).sort()).toEqual(['a', 'b'])
  })
  it('marks a double hit from one address within two seconds, but not two clicks from it minutes apart', () => {
    expect(burstClickIds([c('a', '1.1.1.1', 0), c('b', '1.1.1.1', 1_000)]).size).toBe(2)
    expect(burstClickIds([c('a', '1.1.1.1', 0), c('b', '1.1.1.1', 5 * 60_000)]).size).toBe(0)
  })
  it('leaves a lone click, and clicks from different addresses more than a minute apart, alone', () => {
    expect(burstClickIds([c('a', '1.1.1.1', 0)]).size).toBe(0)
    expect(burstClickIds([c('a', '1.1.1.1', 0), c('b', '2.2.2.2', 61_000)]).size).toBe(0)
  })
  it('only marks the clicks in the burst, not a person click from earlier the same day', () => {
    const ids = burstClickIds([c('early', '9.9.9.9', -3 * 3600_000), c('a', '1.1.1.1', 0), c('b', '2.2.2.2', 10_000)])
    expect(Array.from(ids).sort()).toEqual(['a', 'b'])
  })
})

describe('which list-email opens are a person', () => {
  const delivered = new Date('2026-11-11T15:00:00Z')
  const open = (over: Partial<Parameters<typeof botOpenReason>[0]> = {}) => ({
    ip: '198.51.100.20',
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_7) AppleWebKit/537.36 Chrome/152.0.0.0 Safari/537.36',
    at: new Date(delivered.getTime() + 20 * 60 * 1000),
    deliveredAt: delivered,
    ...over,
  })
  it('counts an open from an ordinary address well after delivery, including Gmail and Superhuman image proxies', () => {
    expect(isHumanOpen(open(), new Set())).toBe(true)
    expect(isHumanOpen(open({ ip: '66.249.84.1', userAgent: 'Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)' }), new Set())).toBe(true)
  })
  it('counts Gmail image proxy opens from any Google address and soon after delivery, unless the address is a known scanner', () => {
    const gmail = 'Mozilla/5.0 (Windows NT 5.1; rv:11.0) Gecko Firefox/11.0 (via ggpht.com GoogleImageProxy)'
    for (const ip of ['192.178.10.1', '74.125.210.3', '66.249.84.1', '34.118.1.1']) {
      expect(isHumanOpen(open({ ip, userAgent: gmail }), new Set())).toBe(true)
    }
    expect(isHumanOpen(open({ ip: '192.178.10.1', userAgent: gmail, at: new Date(delivered.getTime() + 30_000) }), new Set())).toBe(true)
    expect(isHumanOpen(open({ ip: '203.0.113.7', userAgent: gmail }), new Set(['203.0.113.7']))).toBe(false)
  })
  it('does not count Apple Mail Privacy Protection, a scanner address, a cloud address or an open within two minutes of delivery', () => {
    expect(botOpenReason(open({ ip: '17.58.12.9' }), new Set())).toMatch(/Apple Mail Privacy Protection/)
    expect(isHumanOpen(open({ ip: '203.0.113.7' }), new Set(['203.0.113.7']))).toBe(false)
    expect(isHumanOpen(open({ ip: '3.148.231.115' }), new Set())).toBe(false)
    expect(isHumanOpen(open({ at: new Date(delivered.getTime() + 30_000) }), new Set())).toBe(false)
  })
  it('does not count the bare "Mozilla/5.0" image relay, but does count a browser that says more', () => {
    expect(botOpenReason(open({ ip: '2a02:26f7:c356:fff0:c000::9', userAgent: 'Mozilla/5.0' }), new Set())).toMatch(/Apple Mail Privacy Protection/)
    expect(isHumanOpen(open({ userAgent: '  Mozilla/5.0 ' }), new Set())).toBe(false)
    expect(isHumanOpen(open({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148' }), new Set())).toBe(true)
  })
  it('does not mistake an address that merely starts with 17 for Apple', () => {
    expect(isHumanOpen(open({ ip: '172.20.0.1' }), new Set())).toBe(false) // private, for another reason
    expect(isHumanOpen(open({ ip: '171.64.1.1' }), new Set())).toBe(true)
  })
})
