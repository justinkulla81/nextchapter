import { describe, expect, it } from 'vitest'
import { giftDedupeKey, parseGifts, parseRoster } from '@/lib/higher-ed/crm-csv'

const HEADER = 'external_id,email,first_name,last_name,affiliation,class_year,degree,major,employer,title,do_not_contact'

describe('parseRoster (spec §9)', () => {
  it('reads the spec example row', () => {
    const r = parseRoster(`${HEADER}\n100234,JSmith@Example.com,Jordan,Smith,ALUM,2009,BA,Economics,Example Corp,Director of Operations,false`)
    expect(r.errors).toEqual([])
    expect(r.rows[0]).toMatchObject({ row: 2, externalId: '100234', email: 'jsmith@example.com', affiliation: 'ALUM', classYear: 2009, employer: 'Example Corp', doNotContact: false })
  })
  it('refuses a file missing a required column, naming it', () => {
    expect(parseRoster('external_id,email,first_name\n1,a@b.co,A').fileError).toBe('Missing columns: last_name, affiliation')
  })
  it('reports each bad row by spreadsheet row number and keeps the good ones', () => {
    const r = parseRoster(
      [HEADER, '1,not-an-email,A,B,ALUM,2001,,,,,', '2,b@x.edu,B,C,DONOR,2001,,,,,', '3,c@x.edu,C,D,alum,1800,,,,,', '4,d@x.edu,D,E,parent,,,,,,yes', '4,e@x.edu,E,F,ALUM,,,,,,'].join('\n'),
    )
    expect(r.errors.map((e) => [e.row, e.column])).toEqual([
      [2, 'email'],
      [3, 'affiliation'],
      [4, 'class_year'],
      [6, 'external_id'],
    ])
    expect(r.rows.map((x) => [x.externalId, x.affiliation, x.doNotContact])).toEqual([['4', 'PARENT', true]])
  })
  it('ignores blank lines and a byte-order mark', () => {
    expect(parseRoster(`﻿${HEADER}\n\n1,a@x.edu,A,B,STUDENT,2028,,,,,\n\n`).rows).toHaveLength(1)
  })
})

describe('parseGifts', () => {
  it('reads amounts with $ and commas into cents', () => {
    const r = parseGifts('external_id,gift_date,amount,fund,appeal\n100234,2026-11-03,"$1,250.50",Annual Fund,Giving Day 2026')
    expect(r.rows[0]).toMatchObject({ externalId: '100234', amountCents: 125050, fund: 'Annual Fund' })
  })
  it('rejects bad dates and amounts', () => {
    const r = parseGifts('external_id,gift_date,amount\n1,11/03/2026,10\n2,2026-11-03,0')
    expect(r.errors.map((e) => e.column)).toEqual(['gift_date', 'amount'])
  })
  it('gives the same gift the same dedupe key, so a re-import adds nothing', () => {
    const g = { externalId: '1', giftDate: new Date('2026-11-03T00:00:00Z'), amountCents: 100, fund: 'A', appeal: null }
    expect(giftDedupeKey(g)).toBe(giftDedupeKey({ ...g }))
    expect(giftDedupeKey(g)).not.toBe(giftDedupeKey({ ...g, amountCents: 101 }))
  })
})
