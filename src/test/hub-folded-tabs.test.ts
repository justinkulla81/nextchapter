import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { MOVED_TABS, WORKSPACES, getWorkspace, type WorkspaceKey } from '@/lib/higher-ed/workspaces'

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
    // Funding, grant reporting and public pages moved to the Workforce Hub, partners to the Partner Hub, training partners to the
    // Education Hub (owner, 2026-11-18).
    expect(areas).toEqual(['Home', 'People', 'Employers', 'Jobs', 'Market', 'Reports'])
  })
  it('every moved page lives in its new section, with a screen, and the old address points there', () => {
    for (const [from, tabs] of Object.entries(MOVED_TABS) as [WorkspaceKey, Record<string, { workspace: WorkspaceKey; tab: string; orgKind?: string }>][]) {
      const old = getWorkspace(from)!
      for (const [oldTab, to] of Object.entries(tabs)) {
        // Gone from the old section (for a workforce organization; a college keeps its Admin pages).
        const left = old.tabs.find((t) => t.key === oldTab)
        expect(!left || (to.orgKind === 'workforce' && left.orgKind === 'college'), `${from}:${oldTab}`).toBe(true)
        const ws = getWorkspace(to.workspace)!
        expect(ws.tabs.some((t) => t.key === to.tab), `${to.workspace}:${to.tab}`).toBe(true)
        expect(SCREENS_SOURCE).toContain(`'${to.workspace}:${to.tab}':`)
      }
    }
  })
  it("pages keep their roles: moved Admin pages stay admin-only and locked through 'from', the Workforce Hub's own pages keep theirs", () => {
    const wf = getWorkspace('wfhub')!
    const ph = getWorkspace('partnerhub')!
    for (const key of ['publicpage', 'branding', 'board']) expect(wf.tabs.find((t) => t.key === key)!.from).toEqual({ workspace: 'admin', tab: key })
    expect(ph.tabs.find((t) => t.key === 'related')!.from).toEqual({ workspace: 'admin', tab: 'related' })
    expect(wf.tabs.find((t) => t.key === 'funding')!.requiredRoles).toEqual(['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'VIEWER:wfhub'])
    for (const key of ['partners', 'feed']) expect(ph.tabs.find((t) => t.key === key)!.requiredRoles).toEqual(['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'VIEWER:wfhub'])
  })
  it('the moved pages open for everyone who opened them in Talent Hub', () => {
    for (const key of ['wfhub', 'partnerhub', 'education'] as const) {
      const ws = WORKSPACES.find((w) => w.key === key)!
      for (const role of ['INSTITUTION_ADMIN', 'WORKFORCE_PARTNER', 'CAREER_SERVICES', 'EMPLOYER_RELATIONS', 'VIEWER:hub'] as const) expect(ws.requiredRoles).toContain(role)
    }
  })
  it('the partner-facing section is "Your partnership" and the staff section is "Partner Hub"', () => {
    expect(getWorkspace('partnerview')!.workforceLabel).toBe('Your partnership')
    expect(getWorkspace('partnerhub')!.label).toBe('Partner Hub')
  })
})
