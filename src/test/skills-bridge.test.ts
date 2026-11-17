import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/skills/market-server', () => ({ loadSkillsMarket: async () => null }))

import { buildBridge, teaches, type BridgeOffering } from '@/lib/higher-ed/skills-bridge'

const offering = (key: string, skills: string[]): BridgeOffering => ({ key, kind: 'program', name: key, detail: null, skills, href: '/x' })

describe('teaches', () => {
  it('matches the skill name or slug, normalized', () => {
    expect(teaches(offering('a', ['financial modeling']), { name: 'Financial Modeling', slug: 'financial-modeling' })).toBe(true)
    expect(teaches(offering('a', ['sql']), { name: 'SQL', slug: 'sql' })).toBe(true)
    expect(teaches(offering('a', ['python']), { name: 'SQL', slug: 'sql' })).toBe(false)
  })
})

describe('buildBridge', () => {
  it('pairs each missing skill with the offerings that teach it', () => {
    const b = buildBridge(
      {
        label: 'Finance',
        basis: 1200,
        have: [{ name: 'Excel' }],
        missing: [
          { slug: 'financial-modeling', name: 'Financial Modeling', share: 0.31 },
          { slug: 'python', name: 'Python', share: 0.12 },
        ],
      },
      [offering('program:1', ['financial modeling']), offering('audit:2', ['python', 'sql'])],
    )
    expect(b.state).toBe('ready')
    if (b.state !== 'ready') return
    expect(b.rows.map((r) => [r.skill, r.offerings.map((o) => o.key)])).toEqual([
      ['Financial Modeling', ['program:1']],
      ['Python', ['audit:2']],
    ])
    expect(b.have).toEqual(['Excel'])
  })
  it('says there is no data when the field is too thin', () => {
    expect(buildBridge(null, []).state).toBe('no-data')
  })
})
