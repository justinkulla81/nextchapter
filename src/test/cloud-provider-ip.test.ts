import { describe, it, expect } from 'vitest'
import { isCloudProviderIp } from '@/lib/http/cloud-provider-ip'

describe('Amazon and Google Cloud addresses', () => {
  it('recognises addresses that clicked as scanners in the Resend history', () => {
    for (const ip of ['3.148.231.115', '44.200.49.139', '52.90.202.73', '54.188.113.31', '100.24.121.236', '104.197.69.115']) {
      expect(isCloudProviderIp(ip), ip).toBe(true)
    }
  })
  it('leaves ordinary and private addresses alone', () => {
    for (const ip of ['8.8.8.8', '73.12.200.9', '192.168.1.4', '203.0.113.9', '255.255.255.255', '0.0.0.0']) {
      expect(isCloudProviderIp(ip), ip).toBe(false)
    }
  })
  it('handles IPv6, including the compressed form, and rejects junk', () => {
    expect(isCloudProviderIp('2600:1f18::1')).toBe(true) // AWS us-east-1 IPv6 block
    expect(isCloudProviderIp('2606:4700:4700::1111')).toBe(false) // Cloudflare
    for (const junk of ['', 'not an ip', '1.2.3', '1.2.3.999', '1::2::3', null, undefined]) {
      expect(isCloudProviderIp(junk as string), String(junk)).toBe(false)
    }
  })
})
