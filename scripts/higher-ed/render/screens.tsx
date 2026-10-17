// Renders every Higher Ed workspace screen on the server, as an nc_admin
// previewing a demo college, against real data. Catches runtime errors in
// screens that need a signed-in session to reach in a browser, and prints
// what each one says.
//
//   npm run check:he-screens               # W&J, first 500 chars each
//   npm run check:he-screens -- demo career # one college, tabs starting with "career"
//   CHARS=2000 npm run check:he-screens
//   A11Y=1 npm run check:he-screens -- demo   # also check accessibility basics
import { renderToReadableStream } from 'react-dom/server.edge'
import { prisma } from '@/lib/prisma'
import { WORKSPACE_SCREENS } from '@/components/higher-ed/screens'
import { ALL_TOKENS, WORKSPACES, type AccessToken } from '@/lib/higher-ed/workspaces'

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

// Accessibility basics a screen reader depends on: every button, link and
// form field has a name, images have alt text, and headings don't skip levels.
function a11yIssues(html: string): string[] {
  const out: string[] = []
  const attr = (a: string, n: string) => a.match(new RegExp(`\\b${n}="([^"]*)"`))?.[1]
  const named = (attrs: string, inner: string) => !!(text(inner) || attr(attrs, 'aria-label') || attr(attrs, 'aria-labelledby') || attr(attrs, 'title') || /<img\b[^>]*alt="[^"]+"/.test(inner) || /<svg\b[^>]*aria-label="[^"]+"/.test(inner))
  for (const m of html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) if (!named(m[1], m[2])) out.push(`button without a name: ${m[0].slice(0, 120)}`)
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)) if (!named(m[1], m[2])) out.push(`link without text: ${m[0].slice(0, 120)}`)
  for (const m of html.matchAll(/<img\b([^>]*)>/g)) if (attr(m[1], 'alt') === undefined) out.push(`image without alt: ${m[0].slice(0, 120)}`)
  const labelFor = new Set([...html.matchAll(/<label\b[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]))
  const insideLabels = [...html.matchAll(/<label\b[^>]*>([\s\S]*?)<\/label>/g)].map((m) => m[1]).join(' ')
  for (const m of html.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const a = m[2]
    if (/type="(hidden|submit|button)"/.test(a)) continue
    const id = attr(a, 'id')
    if (attr(a, 'aria-label') || attr(a, 'aria-labelledby') || (id && labelFor.has(id)) || insideLabels.includes(m[0])) continue
    out.push(`${m[1]} without a label: ${m[0].slice(0, 120)}`)
  }
  let last = 0
  for (const m of html.matchAll(/<h([1-6])\b/g)) {
    const lvl = Number(m[1])
    if (last && lvl > last + 1) out.push(`heading skips from h${last} to h${lvl}`)
    last = lvl
  }
  return out
}

async function main() {
  const slug = process.argv[2] ?? 'washjeff'
  const only = process.argv[3]
  const inst = await prisma.institution.findUniqueOrThrow({ where: { slug }, select: { id: true, slug: true, name: true, programBrandName: true, logoUrl: true, accentColor: true, isDemo: true, tier: true } })
  const tokens = new Set<AccessToken>([...ALL_TOKENS, 'MEMBER', 'EMPLOYER'])
  let failed = 0
  for (const ws of WORKSPACES.filter((w) => w.release === 'V1')) {
    for (const tab of ws.tabs) {
      const key = `${ws.key}:${tab.key}`
      if (only && !key.startsWith(only)) continue
      const Screen = WORKSPACE_SCREENS[key]
      if (!Screen) { console.log(`\n## ${key}: (no screen, coming ${tab.comingIn})`); continue }
      const ctx = {
        institution: inst, userId: 'render-check', email: 'render@check', ownTokens: new Set<AccessToken>(), tokens, workspaces: [], isNcAdmin: true,
        mode: 'demo-admin' as const, demoPersona: 'all', staffUsers: [], memberId: `${slug}_member_featured`, employerProfileIds: [], workspace: ws.key, readOnly: false,
      }
      try {
        const errors: unknown[] = []
        const s = await renderToReadableStream(<Screen ctx={ctx as never} searchParams={{}} base={`/i/${slug}/${ws.homePath}`} />, { onError: (e) => { errors.push(e) } })
        await s.allReady
        const html = await new Response(s).text()
        const t = text(html)
        if (process.env.A11Y) {
          const issues = [...new Set(a11yIssues(html))]
          const controls = (html.match(/<(button|a|input|select|textarea|img)\b/g) ?? []).length
          console.log(issues.length ? `\n## ${key}: ${issues.length} accessibility issue(s) in ${controls} controls\n  - ${issues.slice(0, 8).join('\n  - ')}` : `## ${key}: ok (${controls} controls)`)
          continue
        }
        if (errors.length) { failed++; console.log(`\n## ${key}: ERROR ${String((errors[0] as Error)?.message ?? errors[0]).slice(0, 300)}`) }
        else console.log(`\n## ${key} (${t.length} chars)\n${t.slice(0, Number(process.env.CHARS ?? 500))}`)
      } catch (e) { failed++; console.log(`\n## ${key}: THREW ${(e as Error).message.slice(0, 300)}`) }
    }
  }
  console.log(`\n${failed} screens failed`)
  await prisma.$disconnect()
}
main()
