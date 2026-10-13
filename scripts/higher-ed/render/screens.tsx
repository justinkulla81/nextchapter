// Renders every Higher Ed workspace screen on the server, as an nc_admin
// previewing a demo college, against real data. Catches runtime errors in
// screens that need a signed-in session to reach in a browser, and prints
// what each one says.
//
//   npm run check:he-screens               # W&J, first 500 chars each
//   npm run check:he-screens -- demo career # one college, tabs starting with "career"
//   CHARS=2000 npm run check:he-screens
import { renderToReadableStream } from 'react-dom/server.edge'
import { prisma } from '@/lib/prisma'
import { WORKSPACE_SCREENS } from '@/components/higher-ed/screens'
import { ALL_TOKENS, WORKSPACES, type AccessToken } from '@/lib/higher-ed/workspaces'

const text = (html: string) => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

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
        const t = text(await new Response(s).text())
        if (errors.length) { failed++; console.log(`\n## ${key}: ERROR ${String((errors[0] as Error)?.message ?? errors[0]).slice(0, 300)}`) }
        else console.log(`\n## ${key} (${t.length} chars)\n${t.slice(0, Number(process.env.CHARS ?? 500))}`)
      } catch (e) { failed++; console.log(`\n## ${key}: THREW ${(e as Error).message.slice(0, 300)}`) }
    }
  }
  console.log(`\n${failed} screens failed`)
  await prisma.$disconnect()
}
main()
