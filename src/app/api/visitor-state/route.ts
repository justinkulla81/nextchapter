import { NextResponse } from 'next/server'
import { ALL_STATE_CODES } from '@/lib/seo/states'

export const dynamic = 'force-dynamic'

/** The visitor's US state from the platform's IP geolocation header, or null. Nothing is stored; the browser keeps the answer. */
export function GET(req: Request) {
  const country = req.headers.get('x-vercel-ip-country')
  const region = req.headers.get('x-vercel-ip-country-region')?.toUpperCase() ?? ''
  const state = country === 'US' && ALL_STATE_CODES.includes(region) ? region : null
  return NextResponse.json({ state }, { headers: { 'Cache-Control': 'private, no-store' } })
}
