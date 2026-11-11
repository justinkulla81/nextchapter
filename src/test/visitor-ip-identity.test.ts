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
