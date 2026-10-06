import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { isKnowledgeWork, naicsSector } from '@/lib/workforce/sector'
import { boardLabor, latestWithYearAgo } from '@/lib/workforce/labor'
import { articleIsLocal, boardCity, boardPlaceNames } from '@/lib/workforce/board-news'
import { boardCountyKeys, visibleBoards } from '@/lib/workforce/board-area'
import { buildBoardReport, type ReportNotice } from '@/lib/workforce/board-report'
import { csvFields } from '../../scripts/workforce/load-colleges'

describe('sector', () => {
  it('reads the NAICS sector however the state writes it', () => {
    expect(naicsSector('54 Professional Scientific and Technical Services')).toBe('54')
    expect(naicsSector('48 (NAICS 488510)')).toBe('48')
    expect(naicsSector('31-33 Manufacturing')).toBe('31')
    expect(naicsSector('Manufacturing')).toBeNull()
    expect(naicsSector(null)).toBeNull()
  })
  it('counts only the listed sectors as white collar, and unknown as unknown', () => {
    expect(isKnowledgeWork('52 Finance and Insurance')).toBe(true)
    expect(isKnowledgeWork('62 Health Care')).toBe(false)
    expect(isKnowledgeWork(null)).toBeNull()
  })
})

describe('county labor', () => {
  const p = (year: number, month: number, value: number) => ({ year, month, value })
  it('takes the latest month and the same month a year earlier', () => {
    const r = latestWithYearAgo([p(2025, 8, 50), p(2026, 7, 40), p(2026, 8, 45)], [p(2025, 8, 1000), p(2026, 7, 1000), p(2026, 8, 1000)])
    expect(r).toEqual({ period: '2026-08', unemployed: 45, laborForce: 1000, rate: 4.5, rateYearAgo: 5 })
  })
  it('weights a board’s counties by labor force', () => {
    const l = boardLabor([
      { laborForce: 900, unemployed: 27, rateYearAgo: 4, period: '2026-08' },
      { laborForce: 100, unemployed: 13, rateYearAgo: 10, period: '2026-08' },
      { laborForce: null, unemployed: null, rateYearAgo: null, period: 'none' },
    ])
    expect(l).toMatchObject({ rate: 4, rateYearAgo: 4.6, laborForce: 1000, unemployed: 40, counties: 2 })
    expect(boardLabor([])).toBeNull()
  })
})

describe('board news', () => {
  const board = {
    id: 'TX-565', state: 'TX', statewide: false, placeCounties: [],
    address: '801 Washington Avenue, Suite 700, Waco, TX 76701',
    counties: ['bosque', 'mclennan', 'hill'], serviceArea: 'Bosque, McLennan, Hill',
  }
  it('names the board’s city and counties', () => {
    expect(boardCity(board.address)).toBe('Waco')
    expect(boardPlaceNames(board)).toEqual(['Waco', 'Bosque County', 'Mclennan County', 'Hill County'])
    expect(boardPlaceNames({ ...board, statewide: true, state: 'VT' })).toEqual(['Vermont'])
  })
  it('keeps a story only when it is about the topic and names the area', () => {
    const places = ['Waco', 'Cleveland']
    expect(articleIsLocal({ title: 'Hello Bello facility in Waco shutting down', description: 'layoffs of 120' }, places, 'layoffs')).toBe(true)
    expect(articleIsLocal({ title: 'Waco council approves budget', description: null }, places, 'layoffs')).toBe(false)
    expect(articleIsLocal({ title: 'Canada threatens Cleveland-Cliffs over layoffs', description: null }, places, 'layoffs')).toBe(false)
    expect(articleIsLocal({ title: 'Waco employers weigh AI as jobs shift', description: null }, places, 'ai')).toBe(true)
  })
})

describe('board area', () => {
  it('uses listed counties plus the counties of a town-drawn board', () => {
    expect(boardCountyKeys({ counties: ['tarrant'], placeCounties: ['-'], statewide: false })).toEqual(['tarrant'])
    expect(boardCountyKeys({ counties: [], placeCounties: ['suffolk'], statewide: false })).toEqual(['suffolk'])
    expect(boardCountyKeys({ counties: ['vermont'], placeCounties: [], statewide: true })).toBe('all')
  })
  it('shows a state board only where there are no local boards', () => {
    const boards = [
      { id: 'TX-TX', state: 'TX', statewide: true }, { id: 'TX-1', state: 'TX', statewide: false },
      { id: 'VT-VT', state: 'VT', statewide: true },
    ]
    expect(visibleBoards(boards).map((b) => b.id)).toEqual(['TX-1', 'VT-VT'])
  })
})

describe('board report sectors', () => {
  const n = (employees: number, industry: string | null, companyWide = false): ReportNotice => ({
    id: String(Math.random()), workforceBoardId: 'b', employer: `E${employees}`, normalizedEmployer: `e${employees}`, employees,
    noticeDate: new Date('2026-09-01'), effectiveDate: null, companyId: null, sourceUrl: null, companyWide, industry,
  })
  it('totals white-collar jobs among those with a published sector', () => {
    const [row] = buildBoardReport([{ id: 'b', state: 'CA', name: 'B', serviceArea: null, directorName: null, chairName: null }],
      [n(100, '54 Professional'), n(300, '31-33 Manufacturing'), n(50, null), n(9000, '51 Information', true)], {})
    expect(row).toMatchObject({ sectorJobs: 400, knowledgeJobs: 100, jobs: 450, reportedJobs: 9000 })
    expect(row.companies.find((c) => c.employer === 'E100')?.sector).toBe('54')
  })
})

describe('IPEDS csv', () => {
  it('keeps commas inside quoted fields', () => {
    expect(csvFields('100654,"Alabama A & M University, Normal",AL')).toEqual(['100654', 'Alabama A & M University, Normal', 'AL'])
    expect(csvFields('1,"say ""hi""",2')).toEqual(['1', 'say "hi"', '2'])
  })
})
