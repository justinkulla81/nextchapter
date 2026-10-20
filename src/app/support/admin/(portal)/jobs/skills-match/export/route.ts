import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin/auth'
import { captureServerEvent } from '@/lib/posthog/server'
import { csvContentHeaders } from '@/lib/admin/csv-export'
import { loadSkillMatchReport } from '@/lib/applications/skill-snapshot-data'
import { skillMatchCsv } from '@/lib/applications/skill-match-aggregate'
import { windowSince, parseWindow } from '../window'

export const maxDuration = 60

// Every segment of every dimension, aggregates only (no names, no member ids).
export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  const win = parseWindow(req.nextUrl.searchParams.get('days'))
  const { report, rows } = await loadSkillMatchReport(windowSince(win))
  captureServerEvent(admin.email ?? 'admin', 'admin_skills_match_exported', { days: win, applications: rows })
  return new Response(skillMatchCsv(report), { headers: csvContentHeaders(`skills-match-${win}-${new Date().toISOString().slice(0, 10)}.csv`) })
}
