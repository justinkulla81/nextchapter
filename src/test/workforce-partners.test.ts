import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { parseJobCenters } from '@/lib/workforce/partners'

const html = readFileSync(path.join(__dirname, 'fixtures/careeronestop-job-centers.html'), 'utf8')

describe('parseJobCenters', () => {
  it('reads each center with its type, address, phone and emails', () => {
    const centers = parseJobCenters(html)
    expect(centers.length).toBe(10)
    expect(centers[0]).toMatchObject({
      centerId: '31220348',
      name: 'Arlington Workforce Center-Workforce Solutions',
      kind: 'Affiliate',
      address: '2000 E. Lamar Blvd., Suite 100, Arlington, TX 76006',
      city: 'Arlington', state: 'TX',
      phone: '817-413-4000',
      email: 'info@workforcesolutions.net',
      businessEmail: 'ulrica.plummer@workforcesolutions.net',
      hours: 'Monday - Friday 8:00am to 5:00pm',
      distanceMiles: 1.2,
    })
    expect(centers[1]).toMatchObject({ name: 'Workforce Solutions Greater Dallas - Grand Prairie', kind: 'Comprehensive', city: 'Grand Prairie' })
    expect(centers.every((c) => c.detailsUrl?.startsWith('https://www.careeronestop.org/LocalHelp/AmericanJobCenters/'))).toBe(true)
  })
})
