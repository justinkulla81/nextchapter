import { describe, expect, it } from 'vitest'
import { isLayoffsAddress, layoffReplyText, parseLayoffExtraction } from '@/lib/warn/layoff-inbox-rules'

const TODAY = '2026-11-02'
const IN = 'in.launchyournextchapter.com'

describe('isLayoffsAddress', () => {
  it('accepts layoffs@ on the inbound and root domains', () => {
    expect(isLayoffsAddress('layoffs', IN, IN)).toBe(true)
    expect(isLayoffsAddress('layoffs', 'launchyournextchapter.com', IN)).toBe(true)
    expect(isLayoffsAddress('layoffs+acme', IN, IN)).toBe(true)
  })
  it('rejects other names and domains', () => {
    expect(isLayoffsAddress('layoffs-team', IN, IN)).toBe(false)
    expect(isLayoffsAddress('layoffs', 'example.com', IN)).toBe(false)
  })
})

describe('parseLayoffExtraction', () => {
  it('reads a complete reply, even wrapped in prose', () => {
    const r = parseLayoffExtraction('Here: {"company":"Acme Corp","employees":1200,"state":"wa","noticeDate":"2026-10-30","sourceUrl":"https://news.example.com/acme"}', TODAY)
    expect(r).toEqual({ ok: true, layoff: { company: 'Acme Corp', employees: 1200, state: 'WA', noticeDate: '2026-10-30', sourceUrl: 'https://news.example.com/acme' } })
  })
  it('fails with no employer', () => {
    expect(parseLayoffExtraction('{"company":null}', TODAY)).toEqual({ ok: false, reason: 'no-company' })
    expect(parseLayoffExtraction('not json', TODAY)).toEqual({ ok: false, reason: 'no-company' })
  })
  it('fails with no usable link', () => {
    expect(parseLayoffExtraction('{"company":"Acme","sourceUrl":null}', TODAY)).toEqual({ ok: false, reason: 'no-link' })
    expect(parseLayoffExtraction('{"company":"Acme","sourceUrl":"javascript:alert(1)"}', TODAY)).toEqual({ ok: false, reason: 'no-link' })
  })
  it('files a future, old or missing date as today and drops bad numbers', () => {
    for (const d of ['2027-01-01', '2020-01-01', 'soon', undefined]) {
      const r = parseLayoffExtraction(JSON.stringify({ company: 'Acme', employees: -5, state: 'Washington', noticeDate: d, sourceUrl: 'https://a.example.com/x' }), TODAY)
      expect(r).toMatchObject({ ok: true, layoff: { noticeDate: TODAY, employees: null, state: null } })
    }
  })
})

describe('layoffReplyText', () => {
  it('says what happened and where to look', () => {
    expect(layoffReplyText('filed', { company: 'Acme', employees: 1200 }).text).toContain('Acme (1,200 jobs)')
    expect(layoffReplyText('no-link', { company: 'Acme', employees: null }).text).toContain('link')
  })
})
