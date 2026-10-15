import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { parseEnrollmentCsv } from '@/lib/employer/parse-enrollment-csv'
import { parseLearners, parseRosterRecords } from '@/lib/higher-ed/crm-csv'
import { readComms } from '@/lib/census/comms-settings'

describe('outplacement census CSV', () => {
  it('reads the optional census columns', () => {
    const r = parseEnrollmentCsv('email,name,employee_id,cohort,package,access_ends,remove\njane@co.com,Jane,E1,March RIF,Executives,2027-03-31,\nsam@co.com,Sam,E2,,,,yes')
    expect(r.errors).toEqual([])
    expect(r.rows[0]).toMatchObject({ email: 'jane@co.com', externalId: 'E1', cohort: 'March RIF', package: 'Executives', accessEnds: '2027-03-31', remove: false })
    expect(r.rows[1]).toMatchObject({ email: 'sam@co.com', cohort: null, remove: true })
  })
  it('leaves census fields undefined when the file has no such column', () => {
    const r = parseEnrollmentCsv('email,name\njane@co.com,Jane')
    expect(r.rows[0].cohort).toBeUndefined()
    expect(r.rows[0].package).toBeUndefined()
  })
})

describe('college census records', () => {
  it('validates JSON roster records like the CSV', () => {
    const r = parseRosterRecords([
      { external_id: '1', email: 'A@x.edu', first_name: 'A', last_name: 'B', affiliation: 'alum', class_year: 2010 },
      { external_id: '2', email: 'bad', first_name: 'C', last_name: 'D', affiliation: 'ALUM' },
    ])
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0]).toMatchObject({ email: 'a@x.edu', affiliation: 'ALUM', classYear: 2010 })
    expect(r.errors[0].row).toBe(2)
  })
  it('parses learners', () => {
    const r = parseLearners('email,first_name,last_name,payer\na@x.com,A,B,wioa voucher\na@x.com,A,B,')
    expect(r.rows).toHaveLength(1)
    expect(r.rows[0].payer).toBe('WIOA_VOUCHER')
    expect(r.errors).toHaveLength(1)
  })
})

describe('census comms settings', () => {
  it('are off unless switched on', () => {
    expect(readComms(null)).toEqual({ joinReminders: false, accessEndingNotice: false })
    expect(readComms({ comms: { joinReminders: true } })).toEqual({ joinReminders: true, accessEndingNotice: false })
  })
})
