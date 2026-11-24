import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { getEvaluation } from '@/lib/bid-evaluator/store'
import { draftToMarkdown, type Draft } from '@/lib/bid-evaluator/draft'

/** The response draft as a Markdown file the owner opens in an editor. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params
  const row = await getEvaluation(id)
  if (!row?.draft) return new NextResponse('No draft yet.', { status: 404 })
  const name = row.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 60) || 'response'
  return new NextResponse(draftToMarkdown(row.title, row.draft as unknown as Draft), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}.md"` },
  })
}
