import { NextResponse, type NextRequest } from 'next/server'
import { isBearerAuthorized } from '@/lib/auth/bearer-secret'
import { reseedWorkforceDemo } from '@/lib/workforce/demo'
import { captureServerEvent } from '@/lib/posthog/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Fresh sample data for one workforce or economic development demo, on request (owner, 2026-11-18: filling a demo should not wait for
// the nightly run or need a dashboard click). Same job as Admin > Organizations > Reset demo data, for the Claude session that
// maintains the demos. Bearer key NC_RESEED_KEY. It only ever touches a demo row of sample data (reseedWorkforceDemo checks), keeps
// the demo's name, region and address, and replaces its sample people, companies and hub data. A real organization is refused.
export async function POST(request: NextRequest) {
  if (!isBearerAuthorized(request.headers.get('authorization'), process.env.NC_RESEED_KEY)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as { slug?: unknown } | null
  const slug = typeof body?.slug === 'string' ? body.slug.trim() : ''
  if (!/^demo-[a-z0-9-]{2,80}$/.test(slug)) {
    return NextResponse.json({ error: 'Body must be JSON: { slug: "demo-..." }' }, { status: 400 })
  }
  const r = await reseedWorkforceDemo(slug)
  if ('error' in r) return NextResponse.json({ ok: false, error: r.error }, { status: 422 })
  captureServerEvent('admin-api', 'he_demo_reset', { slug, workforce: true, source: 'api' })
  return NextResponse.json({ ok: true, slug })
}
