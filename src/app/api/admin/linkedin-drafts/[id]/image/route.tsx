import { requireAdmin } from '@/lib/admin/auth'
import { renderDraftImage } from '@/lib/linkedin/draft-image'

/** Admin-only preview of a draft's card; `?download=1` sets a filename. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const r = await renderDraftImage(id)
  if (!r) return new Response('Not found', { status: 404 })
  if (new URL(request.url).searchParams.get('download')) {
    const name = `layoff-${r.employer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.png`
    r.image.headers.set('Content-Disposition', `attachment; filename="${name}"`)
  }
  return r.image
}
