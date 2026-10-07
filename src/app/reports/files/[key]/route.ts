import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAILING_BUCKET } from '@/lib/mailing/editions'

/**
 * The file attached to an update (the report PDF), on the site's own
 * address. The email links here rather than to storage, so the link reads
 * as NextChapter's, survives a storage move, and the manual-send detector
 * recognises it (launchyournextchapter.com/reports/...).
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params
  const edition = await prisma.mailingEdition.findUnique({ where: { key: decodeURIComponent(key) }, select: { attachmentPath: true, status: true } })
  if (!edition?.attachmentPath) return new NextResponse('Not found', { status: 404 })
  const { data } = await createAdminClient().storage.from(MAILING_BUCKET).createSignedUrl(edition.attachmentPath, 60 * 10)
  if (!data?.signedUrl) return new NextResponse('Not found', { status: 404 })
  return NextResponse.redirect(data.signedUrl, 302)
}
