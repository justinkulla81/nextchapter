import { describe, expect, it } from 'vitest'
import { ENTRY_AND_EARLY_PARAM, parseSeniorityParam, seniorityParamValue } from '@/lib/jobs/job-seniority'

describe('seniority URL parameter', () => {
  it('reads one group, as before', () => {
    expect(parseSeniorityParam('DIRECTOR')).toEqual(['DIRECTOR'])
    expect(parseSeniorityParam('ENTRY_LEVEL')).toEqual(['ENTRY_LEVEL'])
  })
  it('reads several, in the groups own order, whatever order they came in', () => {
    expect(parseSeniorityParam('ENTRY_LEVEL,EARLY_CAREER')).toEqual(['EARLY_CAREER', 'ENTRY_LEVEL'])
    expect(parseSeniorityParam('EARLY_CAREER,ENTRY_LEVEL')).toEqual(['EARLY_CAREER', 'ENTRY_LEVEL'])
  })
  it('drops unknown names, repeats and blanks', () => {
    expect(parseSeniorityParam('NOPE,ENTRY_LEVEL,ENTRY_LEVEL, ')).toEqual(['ENTRY_LEVEL'])
    expect(parseSeniorityParam('')).toEqual([])
    expect(parseSeniorityParam(null)).toEqual([])
    expect(parseSeniorityParam(undefined)).toEqual([])
  })
  it('writes the value back in the same order', () => {
    expect(seniorityParamValue(['ENTRY_LEVEL', 'EARLY_CAREER'])).toBe('EARLY_CAREER,ENTRY_LEVEL')
    expect(seniorityParamValue([])).toBe('')
    expect(ENTRY_AND_EARLY_PARAM).toBe('EARLY_CAREER,ENTRY_LEVEL')
  })
})
