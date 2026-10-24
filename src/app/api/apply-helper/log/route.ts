import { NextResponse, type NextRequest } from 'next/server'
import { candidateFromAuthHeader } from '@/lib/apply-helper/token'
import { logExtensionApplication } from '@/lib/apply-helper/log-application'

export async function POST(req: NextRequest) {
  const candidateId = candidateFromAuthHeader(req.headers.get('authorization'))
  if (!candidateId) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const b = await req.json().catch(() => null)
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const r = await logExtensionApplication(candidateId, { url: str(b?.url), title: str(b?.title), company: str(b?.company), site: str(b?.site).slice(0, 20) })
  return NextResponse.json(r, { status: r.ok ? 200 : 400 })
}
