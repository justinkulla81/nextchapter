import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { buildFromParams, loadHeadshot, type Params } from '@/lib/pitch/request'
import { renderPptx } from '@/lib/pitch/pptx'
import { renderPdf } from '@/lib/pitch/pdf'
import { captureServerEvent } from '@/lib/posthog/server'

export const maxDuration = 60
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const user = await requireAdmin()
  const url = new URL(req.url)
  const sp: Params = {}
  for (const k of new Set(url.searchParams.keys())) { const v = url.searchParams.getAll(k); sp[k] = v.length > 1 ? v : v[0] }
  const format = url.searchParams.get('format') === 'pdf' ? 'pdf' : 'pptx'

  const built = await buildFromParams(sp)
  if (!built) return NextResponse.json({ error: 'Pick a customer type first.' }, { status: 400 })
  const headshot = built.deck.slides.some((s) => s.people?.some((p) => p.name === 'Justin Kulla')) ? await loadHeadshot(url.origin) : undefined

  const body = format === 'pdf' ? await renderPdf(built.deck, { headshot }) : await renderPptx(built.deck, { headshot })
  const stem = `NextChapter - ${built.deck.brand.orgName || (built.deck.generic ? 'overview' : 'pitch')} - ${built.deck.type}`.replace(/[^\w .-]+/g, '')
  captureServerEvent(user.email ?? 'admin', 'pitch_deck_generated', {
    type: built.deck.type, format, generic: built.deck.generic, leadId: built.lead?.id ?? null, areaId: sp.area ?? null,
    slides: built.deck.slides.length, warnings: built.deck.warnings.length, colorMode: sp.colors ?? 'nextchapter', rulesEdited: built.edited,
  })
  return new NextResponse(new Uint8Array(body), {
    headers: {
      'Content-Type': format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': `attachment; filename="${stem}.${format}"`,
      'Cache-Control': 'no-store',
    },
  })
}
