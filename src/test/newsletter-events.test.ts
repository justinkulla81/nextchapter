import { describe, it, expect, vi } from 'vitest'
vi.mock('server-only', () => ({}))
import { eventsFromRead, newsletterText } from '@/lib/research/newsletter-events'

describe('newsletterText', () => {
  it('keeps story links in order and drops housekeeping links', () => {
    const n = newsletterText(`<html><body><p>Flock cuts 270.</p>
      <a href="https://techcrunch.com/flock">more here</a>
      <a href="https://example.com/unsubscribe?x=1">Unsubscribe</a>
      <a href="https://techcrunch.com/flock">again</a>
      <a href="https://thenewstack.io/deno">more here</a></body></html>`)
    expect(n.links.map((l) => l.url)).toEqual(['https://techcrunch.com/flock', 'https://thenewstack.io/deno'])
    expect(n.text).toContain('Flock cuts 270.')
  })
})

describe('eventsFromRead', () => {
  const links = [{ url: 'https://techcrunch.com/flock' }, { url: 'https://thenewstack.io/deno' }]
  it('resolves link numbers to real urls and drops other kinds and bad indexes', () => {
    const out = eventsFromRead({ events: [
      { company: 'Flock', kind: 'layoff', summary: 'Flock cuts 18%.', employees: 270, role: null, direction: null, linkIndex: 0 },
      { company: 'Deno', kind: 'acquisition', summary: 'Cloudflare acquires Deno.', employees: null, role: null, direction: null, linkIndex: 1 },
      { company: 'Automattic', kind: 'exec_change', summary: 'CFO resigns.', employees: null, role: 'CFO', direction: 'search', linkIndex: 9 },
      { company: 'Acme', kind: 'other', summary: 'Raised $5M.', employees: null, role: null, direction: null, linkIndex: null },
      { company: ' ', kind: 'layoff', summary: 'x', employees: null, role: null, direction: null, linkIndex: null },
    ] }, links)
    expect(out.map((e) => [e.company, e.url])).toEqual([
      ['Flock', 'https://techcrunch.com/flock'], ['Deno', 'https://thenewstack.io/deno'], ['Automattic', null],
    ])
  })
})
