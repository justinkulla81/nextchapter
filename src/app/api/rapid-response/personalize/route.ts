import { NextRequest, NextResponse } from 'next/server'
import { allowByIp } from '@/lib/security/rate-limit'
import { cleanLinkId, personalizeRapidResponse } from '@/lib/marketing/rapid-response-personalize'

// Fills in the personal line on https://launchyournextchapter.com/for-rapid-response. Public, because the visitor is
// anonymous; the email link id (a random cuid in the visitor's own email link) is the only credential, the same as the
// click-tracking route, and the answer is only that link's organization name, city and state. Never cached.
export async function GET(request: NextRequest) {
  if (!(await allowByIp('rapid-response-personalize', 60, 60 * 60_000))) {
    return NextResponse.json({ source: 'none' }, { status: 429, headers: { 'Cache-Control': 'no-store' } })
  }
  const q = request.nextUrl.searchParams
  const result = await personalizeRapidResponse({
    linkId: cleanLinkId(q.get('e')),
    stateParam: q.get('s'),
    regionHeader: request.headers.get('x-vercel-ip-country') === 'US' ? request.headers.get('x-vercel-ip-country-region') : null,
  })
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
}
