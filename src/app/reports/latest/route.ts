import { redirect } from 'next/navigation'
import { latestReport, reportPath } from '@/lib/reports'

// A stable address that always points at the newest edition. redirect() in a
// route handler serves a 307 (temporary) — correct here, since "latest" moves.
export function GET() {
  const latest = latestReport()
  redirect(latest ? reportPath(latest) : '/reports')
}
