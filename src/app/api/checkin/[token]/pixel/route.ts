import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

// A standard, minimal 1x1 transparent GIF — the smallest valid image any
// mail client's image renderer will accept.
const TRANSPARENT_GIF = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7',
  'base64'
)

// Best-effort email-open signal for the Saturday check-in — no Resend
// webhook/tracking infra exists anywhere else in this codebase (email opens
// are explicitly untracked today, see admin/metrics.ts), so this is
// deliberately the simplest possible mechanism: an <img> tag in the email
// hits this route, which stamps openedAt once. Known limitation: many mail
// clients block remote images by default, so this undercounts real opens —
// acceptable for a rough signal, not presented as exact.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  // First-open-wins — never overwrite a real earlier timestamp with a
  // later re-render (e.g. the recipient scrolling back to an old email).
  await prisma.candidateSearchCheckIn
    .updateMany({ where: { token, openedAt: null }, data: { openedAt: new Date() } })
    .catch(() => {
      // An unknown/stale token should never break the image request itself.
    })

  return new NextResponse(TRANSPARENT_GIF, {
    headers: {
      'content-type': 'image/gif',
      'cache-control': 'no-store, no-cache, must-revalidate, private',
    },
  })
}
