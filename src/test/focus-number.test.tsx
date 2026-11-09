import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { FocusNumber } from '@/components/candidate/FocusNumber'

describe('FocusNumber', () => {
  it('shows the minutes, what is left and the week of the search', () => {
    const html = renderToStaticMarkup(<FocusNumber done={105} target={150} week={3} />)
    expect(html).toContain('105')
    expect(html).toContain('of 150')
    expect(html).toContain('45 to go')
    expect(html).toContain('week 3 of your search')
  })

  it('says the target is reached, and leaves the week out when none is given', () => {
    const html = renderToStaticMarkup(<FocusNumber done={150} target={150} />)
    expect(html).toContain('target reached')
    expect(html).not.toContain('of your search')
  })
})
