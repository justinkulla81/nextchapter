import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BoardWageHistory } from '@/components/seo/BoardWageHistory'
import { boardWageHistory } from '@/lib/workforce/board-wage-history'

describe('BoardWageHistory', () => {
  it('renders the chart, the industry table and the source for a board in the file', async () => {
    const html = renderToStaticMarkup(<BoardWageHistory history={await boardWageHistory('FL-FL')} areaName="Florida" />)
    expect(html).toContain('Jobs and pay in Florida, 2015 to 2025')
    expect(html).toContain('8,814,64')
    expect(html).toContain('$72,719')
    expect(html).toContain('Information')
    expect(html).toContain('<svg')
    expect(html).toContain('Quarterly Census of Employment and Wages')
  })
  it('renders nothing for a board that is not in the file', () => {
    expect(renderToStaticMarkup(<BoardWageHistory history={null} areaName="x" />)).toBe('')
  })
})
