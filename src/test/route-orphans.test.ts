import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

// A parent address that has only dynamic children (/network/company/[slug]) and no page of its own is a 404 the moment
// someone trims a URL or a crawler walks a breadcrumb up. Public ones redirect to the nearest real page (redirects() in
// next.config.ts). Anything else must be listed here with the reason it is not a public page.

const ROOT = path.join(process.cwd(), 'src/app')
const has = (d: string, f: string) => fs.existsSync(path.join(d, f))
const isPage = (d: string) => ['page.tsx', 'page.ts', 'route.ts', 'route.tsx'].some((f) => has(d, f))

function orphans(dir = ROOT, url = ''): string[] {
  const subs = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory())
  const out: string[] = []
  if (url && !isPage(dir) && subs.some((e) => e.name.startsWith('[') && isPage(path.join(dir, e.name)))) out.push(url)
  for (const e of subs) {
    if (e.name.startsWith('_') || e.name.startsWith('@')) continue
    out.push(...orphans(path.join(dir, e.name), /^\(.*\)$/.test(e.name) ? url : `${url}/${e.name}`))
  }
  return out
}

// Not public pages: API endpoints, token links sent in emails, signed-in areas, embeds and per-workspace routes.
const NOT_PUBLIC = [/^\/api\//, /^\/(support|dashboard|employer|i|recruiters|talent|embed|noexperience)\//, /\/\[[^/]+\]/]
const TOKEN_LINKS = new Set(['/benefits-network-verify', '/claim', '/claim-reference', '/credentials', '/in', '/in/claim', '/p', '/prepared', '/ref', '/reports/files', '/scorecard', '/share', '/start', '/supporter', '/updates/unsubscribe'])

async function redirectSources(): Promise<Set<string>> {
  const config = (await import('../../next.config')).default
  const rules = (await config.redirects?.()) ?? []
  return new Set(rules.map((r) => r.source))
}

describe('parent routes without a page', () => {
  it('each public one redirects instead of returning 404', async () => {
    const redirects = await redirectSources()
    const missing = orphans().filter((u) => !NOT_PUBLIC.some((re) => re.test(u)) && !TOKEN_LINKS.has(u) && !redirects.has(u))
    expect(missing, `Add a redirect in next.config.ts (or list it as a token link here): ${missing.join(', ')}`).toEqual([])
  })
})
