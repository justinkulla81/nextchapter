import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AdminBanner } from '@/components/admin/AdminBanner'

describe('admin banner', () => {
  it('says the page is internal and not a member page', () => {
    const html = renderToStaticMarkup(<AdminBanner />)
    expect(html).toContain('Internal')
    expect(html).toContain('staff only')
    expect(html).toContain('Not a member page')
  })

  it('is in the shared admin layout, so every admin page carries it', () => {
    const layout = readFileSync(path.join(process.cwd(), 'src/app/support/admin/(portal)/layout.tsx'), 'utf8')
    expect(layout).toContain('<AdminBanner')
  })
})
