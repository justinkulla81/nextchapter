import { requireAdmin } from '@/lib/admin/auth'
import { renderDraftSlide } from '@/lib/linkedin/draft-slides'

/** Admin-only preview of one slide (`?slide=0` is the cover); `?download=1` sets a filename. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const url = new URL(request.url)
  const slide = Number(url.searchParams.get('slide') ?? 0) || 0
  const r = await renderDraftSlide(id, slide)
  if (!r) return new Response('Not found', { status: 404 })
  if (url.searchParams.get('download')) {
    const name = `layoff-${r.employer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${slide + 1}.png`
    r.image.headers.set('Content-Disposition', `attachment; filename="${name}"`)
  }
  return r.image
}
