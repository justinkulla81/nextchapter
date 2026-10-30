import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'
import { renderContentCard, type ImageSize } from '@/lib/content/image'

/** Admin-only image for one content draft: `?size=portrait` (1080x1350, default) or `wide` (1200x630); `?download=1` sets a filename. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const url = new URL(request.url)
  const size: ImageSize = url.searchParams.get('size') === 'wide' ? 'wide' : 'portrait'
  const d = await prisma.contentDraft.findUnique({ where: { id }, select: { kind: true, subject: true, day: true, big: true, bigLabel: true, headline: true, facts: true } })
  if (!d) return new Response('Not found', { status: 404 })
  const source = String((d.facts as { source?: string } | null)?.source ?? '')
  const image = renderContentCard({ ...d, source }, size)
  if (url.searchParams.get('download')) {
    image.headers.set('Content-Disposition', `attachment; filename="nextchapter-${d.day}-${d.kind}-${size}.png"`)
  }
  return image
}
