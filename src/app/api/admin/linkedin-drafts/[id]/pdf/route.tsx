import { Document, Image, Page, renderToBuffer } from '@react-pdf/renderer'
import { requireAdmin } from '@/lib/admin/auth'
import { renderDraftSlides } from '@/lib/linkedin/draft-slides'

/** The slides as one PDF, for LinkedIn's "document" post type (swipeable, and the format that gets the most reach). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const r = await renderDraftSlides(id)
  if (!r) return new Response('Not found', { status: 404 })
  const pdf = await renderToBuffer(
    <Document>
      {r.pngs.map((png, i) => (
        <Page key={i} size={[1080, 1350]} style={{ padding: 0 }}>
          <Image src={{ data: png, format: 'png' }} style={{ width: 1080, height: 1350 }} />
        </Page>
      ))}
    </Document>,
  )
  const name = `layoff-${r.employer.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.pdf`
  return new Response(new Uint8Array(pdf), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="${name}"` } })
}
