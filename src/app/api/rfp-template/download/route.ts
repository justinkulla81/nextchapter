import { NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import { RfpTemplatePdfDocument } from '@/lib/marketing/rfp-template-pdf'

// Public, unauthenticated download — this is a free, vendor-neutral
// marketing asset (Partners Master Build Script §D2.2), not gated behind
// login. Analytics for the click live client-side on the download button
// (RfpDownloadButton) per CLAUDE.md's client-vs-server capture split —
// there's no per-user identity to attach a server-side event to here.
export async function GET() {
  const fileBuffer = await renderToBuffer(RfpTemplatePdfDocument())

  return new NextResponse(new Uint8Array(fileBuffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="nextchapter-outplacement-rfp-template.pdf"',
    },
  })
}
