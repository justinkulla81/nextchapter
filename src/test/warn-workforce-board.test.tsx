import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))

import { WarnWorkforceBoard } from '@/components/admin/WarnWorkforceBoard'

const board = {
  id: 'TX-568', name: 'North Central Texas Workforce Development Board', website: 'https://www.dfwjobs.com/', zip: '76011',
  detailsUrl: 'https://www.careeronestop.org/LocalHelp/WorkforceDevelopment/find-workforce-development-boards-details.aspx?location=TX&id=568',
  directorName: 'Phedra Redifer', directorTitle: 'Executive Director', directorEmail: 'PRedifer@dfwjobs.com', directorPhone: '253-380-2692',
  chairName: 'Mr. Carlton Tidwell', chairEmail: 'carlton@terrelltexas.com', chairPhone: '972-563-5703',
}

describe('WarnWorkforceBoard', () => {
  it('links the board, its people and its job centers', () => {
    const html = renderToStaticMarkup(<WarnWorkforceBoard board={board} match="county" state="TX" noticeZip={null} />)
    expect(html).toContain('href="https://www.dfwjobs.com/"')
    expect(html).toContain('North Central Texas Workforce Development Board')
    expect(html).toContain('href="mailto:PRedifer@dfwjobs.com"')
    expect(html).toContain('Executive Director')
    expect(html).toContain('href="tel:972-563-5703"')
    expect(html).toContain('Board chair')
    // Job centers near the board's own ZIP when the notice has none.
    expect(html).toContain('find-american-job-centers.aspx?location=76011&amp;radius=25')
    expect(html).toContain('Directory listing')
  })

  it('uses the notice ZIP for job centers when there is one', () => {
    const html = renderToStaticMarkup(<WarnWorkforceBoard board={board} match="city" state="TX" noticeZip="75024" />)
    expect(html).toContain('location=75024')
  })

  it('falls back to the state list when no board was found', () => {
    const html = renderToStaticMarkup(<WarnWorkforceBoard board={null} match={null} state="NY" noticeZip={null} />)
    expect(html).toContain('Find NY board')
    expect(html).toContain('find-workforce-development-boards.aspx?location=NY')
  })
})
