import { describe, expect, it } from 'vitest'
import { inheritIdentityByIp, type IdentityRow } from '@/lib/admin/visitor-ip-identity'

const at = (min: number) => new Date(Date.UTC(2026, 10, 11, 15, min))
const row = (id: string, ip: string | null, min: number, identity: string | null, excluded = false): IdentityRow => ({ id, ip, at: at(min), identity, excluded })

describe('inheritIdentityByIp', () => {
  it('names the later visits from an IP that one event identified', () => {
    const got = inheritIdentityByIp([row('a', '1.1.1.1', 51, 'crm:herminia'), row('b', '1.1.1.1', 53, null), row('c', '1.1.1.1', 54, null)])
    expect(got.get('b')).toBe('crm:herminia')
    expect(got.get('c')).toBe('crm:herminia')
  })
  it('names an earlier event within the hour before the identified one', () => {
    expect(inheritIdentityByIp([row('a', '1.1.1.1', 10, null), row('b', '1.1.1.1', 20, 'crm:x')]).get('a')).toBe('crm:x')
    expect(inheritIdentityByIp([row('a', '1.1.1.1', 0, null), row('b', '1.1.1.1', 90, 'crm:x')]).has('a')).toBe(false)
  })
  it('names nobody when two people are evidenced on the IP', () => {
    expect(inheritIdentityByIp([row('a', '1.1.1.1', 1, 'crm:x'), row('b', '1.1.1.1', 2, 'crm:y'), row('c', '1.1.1.1', 3, null)]).size).toBe(0)
  })
  it('never crosses IPs, and skips excluded and ipless rows', () => {
    const got = inheritIdentityByIp([row('a', '1.1.1.1', 1, 'crm:x'), row('b', '2.2.2.2', 2, null), row('c', '1.1.1.1', 3, null, true), row('d', null, 4, null)])
    expect(got.size).toBe(0)
  })
})

import { isDatacenterIp } from '@/lib/http/datacenter-ip'

describe('isDatacenterIp', () => {
  it('flags the cloud, Facebook crawler and AWS ranges seen on the visitor log', () => {
    for (const ip of ['34.122.147.229', '48.209.223.76', '128.85.97.37', '173.252.69.1', '69.171.230.112', '66.220.149.6', '54.162.1.1', '13.222.5.5']) expect(isDatacenterIp(ip)).toBe(true)
  })
  it('leaves ISP and mobile addresses alone', () => {
    for (const ip of ['74.242.1.1', '72.145.1.1', '172.58.2.136', '107.119.69.5', '205.169.39.6']) expect(isDatacenterIp(ip)).toBe(false)
  })
})
