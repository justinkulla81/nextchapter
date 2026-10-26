import { describe, expect, it } from 'vitest'
import { pickSubpageLinks } from './extract'

const L = (text: string, href: string) => ({ text, href })
const HOME = 'https://www.futuresummit.org/'

describe('pickSubpageLinks: which pages to read beyond the home page', () => {
  it('follows one page each for speaking, registration, demos and the program, on the same site only', () => {
    const out = pickSubpageLinks(HOME, [
      L('Call for speakers', 'https://futuresummit.org/speak'),
      L('Submit a proposal', 'https://futuresummit.org/proposals'), // a second speaking link: skipped
      L('Register now', 'https://futuresummit.org/register'),
      L('Book a ticket', 'https://tickets.cvent.com/abc'), // other site: not fetched
      L('Exhibit and demo', 'https://futuresummit.org/exhibit'),
      L('Agenda', 'https://futuresummit.org/agenda'),
      L('Sponsor us', 'https://futuresummit.org/sponsors'),
    ])
    expect(out).toEqual(['https://futuresummit.org/speak', 'https://futuresummit.org/register', 'https://futuresummit.org/exhibit', 'https://futuresummit.org/agenda'])
  })
  it('never exceeds four pages, never re-reads the home page, never opens files', () => {
    const out = pickSubpageLinks(HOME, [L('Speakers', 'https://futuresummit.org'), L('Call for papers (PDF)', 'https://futuresummit.org/cfp.pdf'), L('Register', 'https://futuresummit.org/#register')])
    expect(out).toEqual([])
    expect(pickSubpageLinks(HOME, Array.from({ length: 20 }, (_, i) => L('Agenda', `https://futuresummit.org/a${i}`))).length).toBeLessThanOrEqual(4)
  })
  it('returns nothing when the page links nowhere useful', () => {
    expect(pickSubpageLinks(HOME, [L('About', 'https://futuresummit.org/about'), L('Contact', 'https://futuresummit.org/contact')])).toEqual([])
  })
})
