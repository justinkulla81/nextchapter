import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PRIORITY_RANKINGS, PRIORITY_TOOLS } from '@/lib/seo/priority-links'

const root = process.cwd()
const rankingSources = readdirSync(join(root, 'src/lib/rankings')).filter((f) => f.endsWith('.ts')).map((f) => readFileSync(join(root, 'src/lib/rankings', f), 'utf8')).join('\n')

describe('priority links', () => {
  it('points every tool at a page that exists', () => {
    for (const t of PRIORITY_TOOLS) expect(existsSync(join(root, 'src/app', t.href, 'page.tsx')), t.href).toBe(true)
  })
  it('points every ranking at a list the rankings code defines', () => {
    for (const r of PRIORITY_RANKINGS) {
      const slug = r.href.replace('/rankings/', '')
      expect(rankingSources.includes(`'${slug}'`), slug).toBe(true)
    }
  })
  it('has no repeats and keeps each list short', () => {
    for (const list of [PRIORITY_TOOLS, PRIORITY_RANKINGS]) {
      expect(new Set(list.map((l) => l.href)).size).toBe(list.length)
      expect(list.length).toBeLessThanOrEqual(10)
    }
  })
})
