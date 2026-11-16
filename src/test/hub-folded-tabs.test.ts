import { describe, expect, it } from 'vitest'
import { WORKSPACES, getWorkspace } from '@/lib/higher-ed/workspaces'

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
  it('the first tab is the workspace home', () => {
    expect(hub.tabs[0].key).toBe('home')
    expect(WORKSPACES.some((w) => w.key === 'execed')).toBe(true)
  })
})
