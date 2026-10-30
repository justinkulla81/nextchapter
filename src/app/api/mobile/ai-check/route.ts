import { NextResponse, type NextRequest } from 'next/server'
import { allowByIp, HOUR_MS } from '@/lib/security/rate-limit'
import { searchOccupationTitles } from '@/lib/careers/candidate-occupation'
import { loadOccupationCheck } from '@/lib/ai-check/load'
import { checkPath } from '@/lib/ai-check/slug'
import { loadExposureMap } from '@/lib/skills/ai-exposure-server'
import { AI_EXPOSURE_SOURCE, BAND_LABEL, EXPOSURE_WHY, RETRAINING_LINE, exposureSentence, scorePercent, soc6Of } from '@/lib/skills/ai-exposure'
import { SITE_URL } from '@/lib/seo/facts'

export const maxDuration = 30

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, OPTIONS' }
export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

// The app's AI job check. ?q=<job title> lists matching occupations; ?soc=15-1252 returns that occupation's result card.
// No AI model is called: the same O*NET title matcher and stored exposure data as the website's /tools/ai-job-check.
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  if (!(await allowByIp('mobile-ai-check', 240, HOUR_MS))) return NextResponse.json({ error: 'Too many requests. Try again in a few minutes.' }, { status: 429, headers: CORS })
  const cache = { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' }
  try {
    const soc = sp.get('soc')
    if (soc !== null) {
      if (!/^\d{2}-\d{4}$/.test(soc)) return NextResponse.json({ error: 'soc must look like 15-1252.' }, { status: 400, headers: CORS })
      const check = await loadOccupationCheck(soc)
      if (!check) return NextResponse.json({ error: 'Not measured.' }, { status: 404, headers: CORS })
      const e = check.exposure
      const shareUrl = `${SITE_URL}${checkPath(e.title, soc)}`
      return NextResponse.json(
        {
          soc6: soc,
          title: e.title,
          scorePercent: scorePercent(e.score),
          band: e.band,
          bandLabel: BAND_LABEL[e.band],
          sentence: exposureSentence(e),
          why: EXPOSURE_WHY,
          retraining: RETRAINING_LINE[check.need],
          medianWage: check.medianWage,
          tasks: check.tasks,
          skillsToBuild: check.skillsToBuild,
          related: check.bets.map((b) => ({ title: b.title, soc6: b.soc6, medianWage: b.medianWage, payDelta: b.payDelta })),
          source: `${AI_EXPOSURE_SOURCE.name}, ${AI_EXPOSURE_SOURCE.released}`,
          shareUrl,
          shareMessage: `${scorePercent(e.score)} of ${e.title.toLowerCase()} tasks already show AI use. Check your job: ${shareUrl}`,
        },
        { headers: { ...CORS, ...cache } },
      )
    }
    const q = (sp.get('q') ?? '').trim().slice(0, 80)
    if (q.length < 2) return NextResponse.json({ matches: [] }, { headers: CORS })
    const [found, exposure] = await Promise.all([searchOccupationTitles(q), loadExposureMap()])
    const matches = found
      .filter((c) => exposure.has(soc6Of(c.socCode)))
      .slice(0, 12)
      .map((c) => ({ title: c.title, soc6: soc6Of(c.socCode), exact: c.score === 1 }))
    return NextResponse.json({ matches }, { headers: { ...CORS, ...cache } })
  } catch (e) {
    console.error('mobile ai-check failed:', e instanceof Error ? e.message : e)
    return NextResponse.json({ error: 'Not working right now. Try again in a minute.' }, { status: 503, headers: CORS })
  }
}
