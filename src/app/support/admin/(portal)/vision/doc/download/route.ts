import { requireAdmin } from '@/lib/admin/auth'
import { prisma } from '@/lib/prisma'

export const maxDuration = 30

/** The current vision as raw Markdown, for a deck, an advisor, or Claude. */
export async function GET() {
  await requireAdmin()
  const doc = await prisma.productVisionDoc.findFirst({ where: { isCurrent: true } })
  if (!doc) return new Response('No vision document has been saved yet.', { status: 404 })

  const header = [
    `<!-- ${doc.title} -->`,
    `<!-- version ${doc.version}, saved ${doc.createdAt.toISOString().slice(0, 10)} -->`,
    doc.changeNote ? `<!-- change note: ${doc.changeNote} -->` : null,
    '',
  ].filter((l) => l !== null).join('\n')

  return new Response(header + doc.bodyMarkdown, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="nextchapter-vision-v${doc.version}.md"`,
    },
  })
}
