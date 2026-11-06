import { NextResponse, type NextRequest } from 'next/server'
import { isWaitOp } from '@/lib/perf/thinking-timer'
import { waitEstimate } from '@/lib/perf/wait-estimate'

export const dynamic = 'force-dynamic'

// Asked by the "Thinking…" clock (components/ui/ThinkingTimer) once a member has waited 10 s. Answers with the 95th percentile of
// recent real waits of one kind. Aggregates only, no member data, so it is public and cached for everyone.
export async function GET(request: NextRequest) {
  const op = request.nextUrl.searchParams.get('op')
  if (!isWaitOp(op)) return NextResponse.json({ error: 'Unknown wait.' }, { status: 400 })
  const estimate = await waitEstimate(op)
  return NextResponse.json(
    { op, ...estimate },
    { headers: { 'Cache-Control': 'public, max-age=60', 'Vercel-CDN-Cache-Control': 'public, max-age=300' } },
  )
}
