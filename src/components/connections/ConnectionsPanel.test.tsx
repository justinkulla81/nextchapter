import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ConnectionsPanel } from './ConnectionsPanel'
import type { ConnectionsData } from '@/lib/connections/connections'

const noop = vi.fn(async () => undefined)
const actions = { request: noop, decide: noop, shares: noop, end: vi.fn(async () => ({})) }
const party = (id: string, name: string, label: string, kind: 'INSTITUTION' | 'EMPLOYER' = 'INSTITUTION') => ({ kind, id, name, label, demo: false, href: null })
const data: ConnectionsData = {
  me: party('ol', 'One Louisville', 'Economic development'),
  incoming: [{ id: 'c1', other: party('lul', 'Louisville Urban League', 'Community organization'), status: 'REQUESTED', asked: 'them', since: new Date('2026-11-18'), myShares: [], theirShares: [], shared: {} }],
  outgoing: [{ id: 'c2', other: party('acme', 'Acme Co', 'Employer', 'EMPLOYER'), status: 'REQUESTED', asked: 'me', since: new Date('2026-11-17'), myShares: ['JOBS'], theirShares: [], shared: {} }],
  active: [{
    id: 'c3', other: party('kw', 'KentuckianaWorks', 'Workforce board'), status: 'ACTIVE', asked: 'me', since: new Date('2026-11-16'), myShares: ['JOBS', 'EVENTS'], theirShares: ['JOBS', 'LAYOFFS'],
    shared: { JOBS: [{ id: 'j1', title: 'Data Analyst', company: 'Humana', location: 'Louisville, KY', url: 'https://example.com/j1' }], LAYOFFS: [{ id: 'r1', employer: 'GE Appliances', title: 'Plant 2 response', seats: 120, since: new Date('2026-11-01') }] },
  }],
  candidates: [{ ...party('jctc', 'Jefferson Community & Technical College', 'College'), why: 'You linked them' }],
}

describe('connections panel', () => {
  it('puts requests to answer first, then connections with what they share, then who to connect with', () => {
    const html = renderToStaticMarkup(<ConnectionsPanel data={data} actions={actions} canEdit q="" />)
    const at = (s: string) => html.indexOf(s)
    expect(at('Waiting for your answer')).toBeGreaterThan(-1)
    expect(at('Waiting for your answer')).toBeLessThan(at('Connected <'))
    expect(at('Connected <')).toBeLessThan(at('Connect with'))
    expect(at('Connect with')).toBeLessThan(at('Your requests'))
    expect(html).toContain('Data Analyst')
    expect(html).toContain('GE Appliances')
    expect(html).toContain('they share jobs and layoffs')
    expect(html).toContain('Ask to connect')
  })
  it('shows no buttons to someone who cannot edit', () => {
    const html = renderToStaticMarkup(<ConnectionsPanel data={data} actions={actions} canEdit={false} q="" />)
    expect(html).not.toContain('Ask to connect')
    expect(html).not.toContain('>Accept<')
    expect(html).toContain('You share jobs and events.')
  })
})
