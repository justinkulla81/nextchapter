import { describe, expect, it } from 'vitest'
import { readdirSync, statSync } from 'fs'
import { join } from 'path'
import { APP_TOP_LEVEL, PORTAL_ROOT_PAGES } from '@/lib/app-top-level'

const dirs = (d: string) => readdirSync(d).filter((f) => statSync(join(d, f)).isDirectory())
function pages(d: string): string[] {
  return dirs(d).flatMap((f) => (f.startsWith('(') ? pages(join(d, f)) : f.startsWith('[') ? [] : [f]))
}

describe('route lists the proxy reads', () => {
  const app = join(process.cwd(), 'src/app')
  it('APP_TOP_LEVEL lists every top-level route folder', () => {
    expect([...APP_TOP_LEVEL].sort()).toEqual(dirs(app).filter((f) => !f.startsWith('(') && !f.startsWith('[')).sort())
  })
  it('PORTAL_ROOT_PAGES lists each root-mounted portal’s pages', () => {
    for (const mount of Object.keys(PORTAL_ROOT_PAGES)) {
      expect([...PORTAL_ROOT_PAGES[mount]].sort()).toEqual(pages(join(app, mount)).sort())
    }
  })
})
