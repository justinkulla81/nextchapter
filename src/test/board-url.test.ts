import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import path from 'path'
import { boardHref, boardHrefWithout, BOARD_SEARCH_URL_PARAMS } from '@/lib/jobs/board-url'

const SEARCH = 'q=vp+finance&loc=metro%3ANY&remote=hybrid&sort=newest&types=full_time%2Ccontract&seniority=EXEC&great=pay&pivot=fpa'
const params = (href: string) => new URLSearchParams(href.slice(href.indexOf('?') + 1).split('#')[0])

describe('board URLs keep the active search and filters', () => {
  it('"Show them" (view=fresh) keeps q, loc, remote, sort and every filter', () => {
    const href = boardHref(SEARCH, { view: 'fresh' }, { hash: 'job-recommendations' })
    const sp = params(href)
    for (const [k, v] of new URLSearchParams(SEARCH)) expect(sp.get(k)).toBe(v)
    expect(sp.get('view')).toBe('fresh')
    expect(href.endsWith('#job-recommendations')).toBe(true)
    expect(href.startsWith('?')).toBe(true)
  })

  it('takes a server component’s params record, a string or URLSearchParams alike', () => {
    const record = Object.fromEntries(new URLSearchParams(SEARCH))
    expect(boardHref(record, { view: 'fresh' })).toBe(boardHref(SEARCH, { view: 'fresh' }))
    expect(boardHref(new URLSearchParams(SEARCH), { view: 'fresh' })).toBe(boardHref(SEARCH, { view: 'fresh' }))
  })

  it('the view toggle back to all jobs drops only view', () => {
    const sp = params(boardHref(`${SEARCH}&view=fresh`, { view: 'all' }, { pathname: '/dashboard/find-my-job' }))
    expect(sp.has('view')).toBe(false)
    expect(sp.get('q')).toBe('vp finance')
    expect(sp.get('loc')).toBe('metro:NY')
  })

  it('tabs, seniority, great and work types change one parameter each', () => {
    expect(params(boardHref(SEARCH, { tab: 'my_jobs' })).get('q')).toBe('vp finance')
    expect(params(boardHref(`${SEARCH}&tab=my_jobs`, { tab: 'board' })).has('tab')).toBe(false)
    expect(params(boardHref(SEARCH, { seniority: null })).has('seniority')).toBe(false)
    expect(params(boardHref(SEARCH, { great: null })).get('remote')).toBe('hybrid')
    expect(params(boardHref(SEARCH, { types: 'advisory' })).get('types')).toBe('advisory')
  })

  it('clearing the pivot or the search keeps everything else', () => {
    const noPivot = params(boardHrefWithout(SEARCH, ['pivot'], { pathname: '/dashboard/find-my-job' }))
    expect(noPivot.has('pivot')).toBe(false)
    expect(noPivot.get('q')).toBe('vp finance')
    const cleared = params(boardHrefWithout(SEARCH, BOARD_SEARCH_URL_PARAMS))
    for (const k of BOARD_SEARCH_URL_PARAMS) expect(cleared.has(k)).toBe(false)
    expect(cleared.get('types')).toBe('full_time,contract')
  })

  it('an empty result still clears the query (relative "?") and keeps the path when given', () => {
    expect(boardHrefWithout('view=fresh', ['view'])).toBe('?')
    expect(boardHrefWithout('view=fresh', ['view'], { pathname: '/dashboard/find-my-job', hash: 'x' })).toBe('/dashboard/find-my-job#x')
  })

  it('no in-board link hard-codes a query string (they all go through boardHref)', () => {
    const files = [
      'src/app/dashboard/find-my-job/page.tsx',
      'src/components/dashboard/BoardViewToggle.tsx',
      'src/components/dashboard/SeniorityFilter.tsx',
      'src/components/dashboard/GreatEmployerFilter.tsx',
      'src/components/dashboard/one-board/WorkTypeToggle.tsx',
      'src/components/dashboard/one-board/BoardTabs.tsx',
      'src/components/dashboard/pivots/PivotBoardBanner.tsx',
    ]
    for (const f of files) {
      const src = readFileSync(path.resolve(__dirname, '../..', f), 'utf8')
      expect(src, f).not.toMatch(/href=["'{`]+\?/)
      expect(src, f).not.toMatch(/`\$\{pathname\}\?/)
    }
  })
})
