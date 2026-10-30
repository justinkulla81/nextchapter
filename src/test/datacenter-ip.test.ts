import { describe, expect, it } from 'vitest'
import { isDatacenterIp } from '@/lib/http/datacenter-ip'

describe('isDatacenterIp', () => {
  it('flags addresses inside a listed cloud range', () => {
    expect(isDatacenterIp('74.179.70.83')).toBe(true)
    expect(isDatacenterIp('72.153.153.71')).toBe(true)
    expect(isDatacenterIp('51.54.38.112')).toBe(true)
    expect(isDatacenterIp('51.58.1.1')).toBe(true)
    expect(isDatacenterIp('135.232.20.49')).toBe(true)
    expect(isDatacenterIp('62.10.205.4')).toBe(true)
  })

  it('leaves home and campus addresses alone', () => {
    expect(isDatacenterIp('99.111.145.45')).toBe(false)
    expect(isDatacenterIp('192.147.249.189')).toBe(false)
    expect(isDatacenterIp('51.60.0.1')).toBe(false)
    expect(isDatacenterIp('74.180.0.1')).toBe(false)
  })

  it('ignores missing, malformed and IPv6 input', () => {
    expect(isDatacenterIp(null)).toBe(false)
    expect(isDatacenterIp('')).toBe(false)
    expect(isDatacenterIp('999.1.1.1')).toBe(false)
    expect(isDatacenterIp('2001:db8::1')).toBe(false)
  })
})
