import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { HUB_MOVED_TABS, WORKSPACES, getWorkspace } from '@/lib/higher-ed/workspaces'

// The screen map, read as text: importing the screens pulls in the database client.
const SCREENS_SOURCE = readFileSync('src/components/higher-ed/screens.tsx', 'utf8')

describe('Program workspace tabs', () => {
  const hub = getWorkspace('hub')!
  it('every folded tab points at a real screen of the workspace it came from', () => {
    for (const t of hub.tabs.filter((x) => x.from)) {
      const src = getWorkspace(t.from!.workspace)
      expect(src, t.key).toBeTruthy()
      expect(src!.tabs.some((x) => x.key === t.from!.tab), t.key).toBe(true)
    }
  })
  it('tab keys are unique and every tab belongs to an area', () => {
    const keys = hub.tabs.map((t) => t.key)
    expect(new Set(keys).size).toBe(keys.length)
    expect(hub.tabs.every((t) => !!t.group)).toBe(true)
  })
  it('areas follow the blueprint, in order', () => {
    const areas = [...new Set(hub.tabs.map((t) => t.group))]
    // Partners and Funding moved out to their own sections, training partners to the Education Hub (owner, 2026-11-18).
    expect(areas).toEqual(['Home', 'People', 'Employers', 'Jobs', 'Market', 'Reports', 'Public presence'])
  })
  it('every moved Talent Hub page lives in its new section, with a screen, and the old address points there', () => {
    for (const [oldTab, to] of Object.entries(HUB_MOVED_TABS)) {
      expect(hub.tabs.some((t) => t.key === oldTab)).toBe(false)
      const ws = WORKSPACES.find((w) => w.key === to.workspace)!
      expect(ws.tabs.some((t) => t.key === to.tab)).toBe(true)
      expect(SCREENS_SOURCE).toContain(`'${to.workspace}:${to.tab}':`)
    }
  })
  it('Funding and Partners open for everyone who opened them inside Talent Hub', () => {
    for (const key of ['funding', 'partners', 'education'] as const) {
      const ws = WORKSPACES.find((w) => w.key === key)!
      for (const role of ['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'VIEWER:hub'] as const) expect(ws.requiredRoles).toContain(role)
    }
  })
  it('the first tab is the workspace home', () => {
    expect(hub.tabs[0].key).toBe('home')
    expect(WORKSPACES.some((w) => w.key === 'execed')).toBe(true)
  })
})
