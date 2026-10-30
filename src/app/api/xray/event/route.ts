import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { captureServerEvent } from '@/lib/posthog/server'
import { isInstallId, XRAY_EVENTS, XRAY_LINKS, XRAY_SITES } from '@/lib/xray/events'
import { XRAY_CORS } from '@/lib/xray/cors'

// Usage pings from the job X-ray extension: panel shown, link clicked. Site name and link name only; never the page, the
// job, or the employer. The distinct id is a random id the extension made for itself.
export async function POST(req: NextRequest) {
  const b = await req.json().catch(() => null)
  if (!b || !XRAY_EVENTS.has(b.event) || !isInstallId(b.id)) return NextResponse.json({ error: 'bad_request' }, { status: 400, headers: XRAY_CORS })
  if (!(await allowByIp('xray-event', 600, HOUR_MS))) return NextResponse.json({ error: 'rate_limited' }, { status: 429, headers: XRAY_CORS })
  const props = (b.props ?? {}) as Record<string, unknown>
  captureServerEvent(`xray:${b.id}`, b.event, {
    site: XRAY_SITES.has(b.site) ? b.site : 'other',
    link: typeof props.link === 'string' && XRAY_LINKS.has(props.link) ? props.link : undefined,
    exposure_shown: typeof props.exposure === 'boolean' ? props.exposure : undefined,
    layoffs_shown: typeof props.layoffs === 'boolean' ? props.layoffs : undefined,
    pay_shown: typeof props.pay === 'boolean' ? props.pay : undefined,
    source: 'job_xray_extension',
  })
  return NextResponse.json({ ok: true }, { headers: XRAY_CORS })
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: XRAY_CORS })
}
