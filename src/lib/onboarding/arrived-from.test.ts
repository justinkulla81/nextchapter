import { describe, expect, it } from 'vitest'
import { arrivedFromDetails, arrivedFromForm, arrivedHiddenFields, boardForPlace, parseArrivedFrom, placeStartHref } from './arrived-from'

describe('place and board arrivals', () => {
  it('round-trips a link built on a place page', () => {
    const href = placeStartHref({ situation: 'relocating', state: 'oh', area: 'Franklin County', boardId: 'OH-123', from: 'top_place_ohio-franklin' })
    expect(href.startsWith('/onboarding/desire?goal=market-reality&')).toBe(true)
    const params = Object.fromEntries(new URL(href, 'https://x.test').searchParams)
    expect(parseArrivedFrom(params)).toEqual({ state: 'OH', area: 'Franklin County', boardId: 'OH-123', situation: 'relocating' })
    expect(params.from).toBe('top_place_ohio-franklin')
  })

  it('drops anything that is not a state, a board id or a known situation', () => {
    expect(parseArrivedFrom({ st: 'Ohio' })).toBeNull()
    expect(parseArrivedFrom({ st: 'OH', board: '<script>', situation: 'hacker', area: 'A<b>' })).toEqual({ state: 'OH', area: 'Ab', boardId: null, situation: null })
  })

  it('carries the arrival through the form and the saved details', () => {
    const a = { state: 'TX', area: 'Austin', boardId: 'TX-9', situation: 'just_graduated' as const }
    const fd = new FormData()
    for (const [k, v] of Object.entries(arrivedHiddenFields(a))) fd.set(k, v)
    expect(arrivedFromForm(fd)).toEqual(a)
    expect(arrivedFromDetails({ arrivedFrom: a })).toEqual(a)
    expect(arrivedFromDetails({})).toBeNull()
  })

  it('offers a board only when one board clearly serves the place', () => {
    expect(boardForPlace([{ id: 'S', statewide: true }, { id: 'L', statewide: false }])?.id).toBe('L')
    expect(boardForPlace([{ id: 'S', statewide: true }])?.id).toBe('S')
    expect(boardForPlace([{ id: 'A', statewide: false }, { id: 'B', statewide: false }])).toBeNull()
    expect(boardForPlace([])).toBeNull()
  })
})
